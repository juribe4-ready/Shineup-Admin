import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jpdajjiaukzilrxwcgtx.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

async function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body)
    if (req.body && typeof req.body === 'string') return resolve(JSON.parse(req.body))
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(data)) } catch { resolve({}) }
    })
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const body = await parseBody(req)
    const { email, role } = body

    if (!email) return res.status(400).json({ error: 'Email requerido' })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    await supabase.from('invited_emails').upsert(
      { email, role: role || 'cleaner', used: false },
      { onConflict: 'email' }
    )

    const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://shineup-ops.vercel.app',
      data: { role: role || 'cleaner' }
    })

    if (error) throw error

    return res.status(200).json({ success: true, email })
  } catch (err) {
    console.error('[inviteUser] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
