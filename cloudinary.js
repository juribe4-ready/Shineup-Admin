const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const APPOINTMENTS_TABLE = 'tblXlpg7MuYWA8Ocn'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { weekStart } = req.query
    if (!weekStart) return res.status(400).json({ error: 'weekStart requerido' })

    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    const formula = encodeURIComponent(
      `AND(IS_AFTER({Requested Date & Time}, '${startStr}'), IS_BEFORE({Requested Date & Time}, '${endStr}T23:59:59'))`
    )

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${APPOINTMENTS_TABLE}?filterByFormula=${formula}&fields[]=Appointment ID&fields[]=Requested Date & Time&fields[]=Estimated Duration&fields[]=Status&fields[]=Client Name&fields[]=Property Address&fields[]=Notes&fields[]=Online Platform Source&sort[0][field]=Requested Date & Time&sort[0][direction]=asc`

    const airtableRes = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    })
    const data = await airtableRes.json()

    const appointments = (data.records || []).map(r => {
      const dt = r.fields?.['Requested Date & Time'] || null
      const date = dt ? dt.split('T')[0] : null
      const time = dt ? new Date(dt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null
      return {
        id: r.id,
        appointmentId: r.fields?.['Appointment ID'] || '',
        date,
        time,
        datetime: dt,
        duration: r.fields?.['Estimated Duration'] || 120,
        status: r.fields?.['Status'] || 'Scheduled',
        clientName: Array.isArray(r.fields?.['Client Name']) ? r.fields['Client Name'][0] : (r.fields?.['Client Name'] || ''),
        address: Array.isArray(r.fields?.['Property Address']) ? r.fields['Property Address'][0] : (r.fields?.['Property Address'] || ''),
        notes: r.fields?.['Notes'] || '',
        source: r.fields?.['Online Platform Source'] || '',
      }
    })

    return res.status(200).json(appointments)
  } catch (err) {
    console.error('[getAppointments] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
