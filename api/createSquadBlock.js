const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BLOCKS_TABLE = 'tblR9T67eyBrIi5Ny'
const SQUADS_TABLE = 'tbl6CaYpYaZe1PY0s'
const CLEANINGS_TABLE = 'tblabOdNknnjrYUU1'

// Duplicated from getReports.js's resolveSquadStaff (each /api/*.js file here is a standalone
// serverless function with no shared imports between them, so small helpers are kept in both
// places rather than factored into a shared module). 'Day Overrides' is a Long Text JSON field
// on the Squads table — see getReports.js for the full design note.
function parseDayOverrides(raw) {
  if (!raw) return {}
  try { const obj = JSON.parse(raw); return (obj && typeof obj === 'object') ? obj : {} }
  catch { return {} }
}

async function resolveSquadStaff(headers, squadId, date) {
  try {
    const sr = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${SQUADS_TABLE}/${squadId}`, { headers })
    if (sr.ok) {
      const sd = await sr.json()
      const overrides = parseDayOverrides(sd.fields?.['Day Overrides'])
      if (overrides[date]) return Array.isArray(overrides[date].staffIds) ? overrides[date].staffIds : []
      return Array.isArray(sd.fields?.['Default Members']) ? sd.fields['Default Members'] : []
    }
  } catch (e) { console.error('[createSquadBlock] roster lookup error:', e.message) }
  return []
}

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
    const { squadId, date, startTime, endTime, type, appointmentId, cleaningId, notes } = body

    if (!squadId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'squadId, date, startTime, endTime requeridos' })
    }

    // HARD GUARD: if this Cleaning or Appointment is already assigned to ANY squad block
    // that also has a real Cleaning linked (not orphaned), reject outright.
    if (cleaningId || appointmentId) {
      const dupChecks = []
      if (cleaningId) dupChecks.push(`FIND('${cleaningId}', ARRAYJOIN(Cleaning))`)
      if (appointmentId) dupChecks.push(`AND(FIND('${appointmentId}', ARRAYJOIN(Appointment)), NOT(Cleaning = BLANK()))`)
      const dupFormula = encodeURIComponent(`OR(${dupChecks.join(',')})`)
      const dupRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}?filterByFormula=${dupFormula}`,
        { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
      )
      if (dupRes.ok) {
        const dupData = await dupRes.json()
        if ((dupData.records || []).length > 0) {
          const existing = dupData.records[0]
          return res.status(409).json({
            error: `Esta limpieza ya está asignada a un squad (bloque existente del ${existing.fields?.Date || '?'}). Bórralo primero si quieres reasignar.`
          })
        }
      }
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
    if (cleaningId) fields.Cleaning = [cleaningId]

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

    // One combined PATCH on the Cleaning (after the block is safely created):
    // 1. Date → set to the block's date (handles cross-day moves)
    // 2. Scheduled Time → date + startTime in Eastern, so Ops always shows the right time
    // 3. Assigned Staff → merge in the squad's roster (never remove what's already there)
    // Best-effort: a failure here never rolls back the block creation.
    let dateChanged = false
    if (cleaningId) {
      try {
        const authHeaders = { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
        const staffIds = await resolveSquadStaff(authHeaders, squadId, date)
        const cleaningRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}/${cleaningId}`, { headers: authHeaders })
        const cleaningJson = cleaningRes.ok ? await cleaningRes.json() : null
        const currentStaffIds = Array.isArray(cleaningJson?.fields?.['Assigned Staff']) ? cleaningJson.fields['Assigned Staff'] : []
        const currentDate = cleaningJson?.fields?.Date || null
        dateChanged = currentDate !== null && currentDate !== date

        const merged = staffIds.length > 0
          ? Array.from(new Set([...currentStaffIds, ...staffIds]))
          : currentStaffIds

        const patchFields = {
          'Date': date,
          'Scheduled Time': `${date}T${startTime}:00.000-04:00`,
        }
        if (merged.length > 0) patchFields['Assigned Staff'] = merged

        await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}/${cleaningId}`, {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: patchFields }),
        })
      } catch (e) { console.error('[createSquadBlock] cleaning update error (non-blocking):', e.message) }
    }

    return res.status(200).json({ success: true, id: data.id, dateChanged })
  } catch (err) {
    console.error('[createSquadBlock] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
