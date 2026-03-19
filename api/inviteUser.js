import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jpdajjiaukzilrxwcgtx.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN

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

async function findStaffByEmail(email) {
  try {
    const formula = encodeURIComponent(`{Email} = "${email}"`)
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/tblgHwN1wX6u3ZtNY?filterByFormula=${formula}&fields[]=Name&fields[]=Initials&fields[]=Role`
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    })
    if (!res.ok) return null
    const data = await res.json()
    const record = data.records?.[0]
    if (!record) return null
    return {
      id: record.id,
      name: record.fields?.Name || '',
      initials: record.fields?.Initials || '',
      role: record.fields?.Role || '',
    }
  } catch {
    return null
  }
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

    // 1. Buscar en Airtable Staff por email
    const staffRecord = await findStaffByEmail(email)
    console.log(`[inviteUser] Staff encontrado:`, staffRecord?.name || 'no encontrado')

    // 2. Registrar en lista de invitados
    await supabase.from('invited_emails').upsert(
      { email, role: role || 'cleaner', used: false },
      { onConflict: 'email' }
    )

    // 3. Enviar invitación
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://shineup-ops.vercel.app',
      data: { role: role || 'cleaner' }
    })

    if (error) throw error

    // 4. Si encontramos el staff, actualizar el perfil con nombre, iniciales y staff_airtable_id
    if (staffRecord && data?.user?.id) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        role: role || 'cleaner',
        full_name: staffRecord.name,
        initials: staffRecord.initials,
        staff_airtable_id: staffRecord.id,
        active: true,
      }, { onConflict: 'id' })
    }

    return res.status(200).json({
      success: true,
      email,
      staffFound: !!staffRecord,
      staffName: staffRecord?.name || null,
    })
  } catch (err) {
    console.error('[inviteUser] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
