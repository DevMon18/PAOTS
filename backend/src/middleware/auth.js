import { createClient } from '@supabase/supabase-js'

// Validate the incoming request's JWT using the Supabase anon client
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' })
  }

  const token = authHeader.split(' ')[1]

  // Verify token using Supabase Auth
  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' })
  }

  req.user = user
  req.token = token
  next()
}

// Require a specific role
export function requireRole(...roles) {
  return async (req, res, next) => {
    const { data: profile } = await (await import('../lib/supabase.js')).supabase
      .from('users')
      .select('role, is_active')
      .eq('id', req.user.id)
      .single()

    if (!profile || !profile.is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact the manager.' })
    }

    if (!roles.includes(profile.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' })
    }

    req.userRole = profile.role
    next()
  }
}
