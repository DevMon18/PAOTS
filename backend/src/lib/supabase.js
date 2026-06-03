import { createClient } from '@supabase/supabase-js'

// Service-role client: bypasses RLS for server-side operations (pricing, tracking ID, status)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
