import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

export const usersRouter = Router()

// POST /api/users — manager creates a new user account via Supabase Auth Admin
usersRouter.post('/', requireAuth, requireRole('manager'), async (req, res, next) => {
  try {
    const { email, username, password, role } = req.body

    if (!email?.trim() || !username?.trim() || !password || !role) {
      throw Object.assign(new Error('Email, username, password, and role are all required.'), { status: 422 })
    }

    if (!['staff', 'designer', 'manager'].includes(role)) {
      throw Object.assign(new Error('Invalid role. Must be: staff, designer, or manager.'), { status: 422 })
    }

    if (password.length < 8) {
      throw Object.assign(new Error('Password must be at least 8 characters.'), { status: 422 })
    }

    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    })

    if (authErr) throw Object.assign(new Error(authErr.message), { status: 422 })

    // Insert into users table
    const { error: profileErr } = await supabase.from('users').insert({
      id: authData.user.id,
      username: username.trim(),
      role,
      is_active: true,
    })

    if (profileErr) {
      // Rollback auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw profileErr
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'USER_CREATED',
      target_table: 'users',
      target_id: authData.user.id,
      details: { username, role },
    })

    res.status(201).json({ ok: true, userId: authData.user.id })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/users/:id — update a user profile or change password
usersRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const { username, role, isActive, password } = req.body

    const isSelf = id === req.user.id
    const isManager = req.userRole === 'manager'

    if (!isSelf && !isManager) {
      throw Object.assign(new Error('You are not authorized to update this profile.'), { status: 403 })
    }

    if (isSelf) {
      if (isActive === false) {
        throw Object.assign(new Error('You cannot deactivate your own account.'), { status: 400 })
      }
      if (role && role !== req.userRole) {
        throw Object.assign(new Error('You cannot change your own role.'), { status: 400 })
      }
    }

    // Update password via Auth Admin if provided — ONLY ALLOWED FOR SELF
    if (password && password.trim()) {
      if (!isSelf) {
        throw Object.assign(new Error('Only the user themselves can change their own password.'), { status: 403 })
      }
      if (password.length < 8) {
        throw Object.assign(new Error('Password must be at least 8 characters.'), { status: 422 })
      }
      const { error: authErr } = await supabase.auth.admin.updateUserById(id, {
        password: password.trim()
      })
      if (authErr) throw Object.assign(new Error(authErr.message), { status: 422 })
    }

    // Update users table details (non-managers can only update their own username)
    const updateData = {}
    if (username !== undefined) updateData.username = username.trim()
    
    if (isManager) {
      if (role !== undefined) updateData.role = role
      if (isActive !== undefined) updateData.is_active = isActive
    }

    if (Object.keys(updateData).length > 0) {
      const { error: profileErr } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)

      if (profileErr) throw profileErr
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'USER_UPDATED',
      target_table: 'users',
      target_id: id,
      details: { username, role, is_active: isActive, password_changed: !!password },
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/users/:id — delete a user account
usersRouter.delete('/:id', requireAuth, requireRole('manager'), async (req, res, next) => {
  try {
    const { id } = req.params

    if (id === req.user.id) {
      throw Object.assign(new Error('You cannot delete your own account.'), { status: 400 })
    }

    // Get details for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('username')
      .eq('id', id)
      .single()

    // Delete DB profile first
    const { error: dbErr } = await supabase.from('users').delete().eq('id', id)
    if (dbErr) {
      if (dbErr.code === '23503' || dbErr.message?.includes('foreign key')) {
        throw Object.assign(
          new Error('Cannot delete this user because they have recorded activity (orders, payments, or status changes) in the system. Please deactivate their account instead.'),
          { status: 400 }
        )
      }
      throw dbErr
    }

    // Delete auth user
    const { error: authErr } = await supabase.auth.admin.deleteUser(id)
    if (authErr) {
      if (authErr.message?.includes('foreign key') || authErr.status === 400) {
        throw Object.assign(
          new Error('Cannot delete this user because they have recorded activity in the system. Please deactivate their account instead.'),
          { status: 400 }
        )
      }
      throw authErr
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'USER_DELETED',
      target_table: 'users',
      target_id: id,
      details: { username: userProfile?.username || 'unknown' },
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
