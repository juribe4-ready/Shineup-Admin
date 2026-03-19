import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jpdajjiaukzilrxwcgtx.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_lVelTDSvaDDwvSGRLINQ8A_9eSKcZVP'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  }
})

export interface Profile {
  id: string
  email: string
  role: 'admin' | 'manager' | 'cleaner' | 'client'
  staff_airtable_id: string | null
  full_name: string | null
  initials: string | null
  active: boolean
  invited_at: string
  created_at: string
}
