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
