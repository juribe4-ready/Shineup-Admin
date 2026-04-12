const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BLOCKS_TABLE = 'tblR9T67eyBrIi5Ny'

async function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body)
    if (req.body && typeof req.body === 'string') return resolve(JSON.parse(req.body))
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve({}) } })
  })
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const body = await parseBody(req)
    const { squadId, date, startTime, endTime, type, appointmentId, notes } = body

    if (!squadId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'squadId, date, startTime, endTime requeridos' })
    }

    // Check for overlapping blocks on same squad + date
    const formula = encodeURIComponent(`AND({Date}='${date}', FIND('${squadId}', ARRAYJOIN(Squads)))`)
    const existingRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}?filterByFormula=${formula}&fields[]=StartTime&fields[]=EndTime`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    if (existingRes.ok) {
      const existing = await existingRes.json()
      const newStart = timeToMin(startTime)
      const newEnd = timeToMin(endTime)

      for (const r of (existing.records || [])) {
        const exStart = timeToMin(r.fields?.StartTime || '00:00')
        const exEnd = timeToMin(r.fields?.EndTime || '00:00')
        // Check overlap: new block overlaps if newStart < exEnd AND newEnd > exStart
        if (newStart < exEnd && newEnd > exStart) {
          return res.status(409).json({
            error: `Conflicto de horario: ya existe un bloque de ${r.fields?.StartTime} a ${r.fields?.EndTime} para este squad en esa fecha.`
          })
        }
      }
    }

    const fields = {
      Squads: [squadId],
      Date: date,
      StartTime: startTime,
      EndTime: endTime,
      Type: type || 'Manual Block',
    }
    if (notes) fields.Notes = notes
    if (appointmentId) fields.Appointment = [appointmentId]

    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields })
      }
    )
    const data = await airtableRes.json()
    if (!airtableRes.ok) throw new Error(JSON.stringify(data))

    return res.status(200).json({ success: true, id: data.id })
  } catch (err) {
    console.error('[createSquadBlock] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
