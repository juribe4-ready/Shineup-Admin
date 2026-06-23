const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BLOCKS_TABLE = 'tblR9T67eyBrIi5Ny'
const SQUADS_TABLE = 'tbl6CaYpYaZe1PY0s'
const CLEANINGS_TABLE = 'tblabOdNknnjrYUU1'
const PROPS_TABLE = 'tbl1iETmcFP460oWN'

// Same pattern as createSquadBlock.js's resolveSquadStaff — duplicated since each /api/*.js
// file here is a standalone serverless function with no shared imports between them.
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
  } catch (e) { console.error('[deleteSquadBlock] roster lookup error:', e.message) }
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const body = await parseBody(req)
    const { blockId } = body
    if (!blockId) return res.status(400).json({ error: 'blockId requerido' })

    const headers = { Authorization: `Bearer ${AIRTABLE_TOKEN}` }

    // Read the block BEFORE deleting it — need squadId/date/cleaningId to know whose
    // roster to subtract from the Cleaning's Assigned Staff.
    let squadId = null, date = null, cleaningId = null
    try {
      const blockRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}/${blockId}`, { headers })
      if (blockRes.ok) {
        const blockData = await blockRes.json()
        squadId = Array.isArray(blockData.fields?.Squads) ? blockData.fields.Squads[0] : (blockData.fields?.Squads || null)
        date = blockData.fields?.Date || null
        cleaningId = Array.isArray(blockData.fields?.Cleaning) ? blockData.fields.Cleaning[0] : (blockData.fields?.Cleaning || null)
      }
    } catch (e) { console.error('[deleteSquadBlock] block lookup error (non-blocking):', e.message) }

    // Un-merge: remove exactly the squad's current roster from the Cleaning's staff,
    // preserving anything else that was there (e.g. default staff set at launch).
    // Best-effort — never blocks the actual deletion if anything here fails.
    if (squadId && date && cleaningId) {
      try {
        const staffToRemove = await resolveSquadStaff(headers, squadId, date)
        if (staffToRemove.length > 0) {
          const cleaningRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}/${cleaningId}`, { headers })
          if (cleaningRes.ok) {
            const cleaningData = await cleaningRes.json()
            const currentStaffIds = Array.isArray(cleaningData.fields?.['Assigned Staff']) ? cleaningData.fields['Assigned Staff'] : []
            const removeSet = new Set(staffToRemove)
            const remaining = currentStaffIds.filter(id => !removeSet.has(id))
            if (remaining.length !== currentStaffIds.length) {
              await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}/${cleaningId}`, {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: { 'Assigned Staff': remaining } }),
              })
            }
          }
        }
      } catch (e) { console.error('[deleteSquadBlock] staff un-merge error (non-blocking):', e.message) }
    }

    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}/${blockId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    if (!airtableRes.ok) throw new Error('Error al eliminar')

    // Reset Scheduled Time on the Cleaning back to the property's Default Start Time.
    // This ensures that re-assigning the cleaning to a squad always shows the original
    // property time, never the last resequenced value (which could be anything).
    // Best-effort — a failure here never blocks the deletion response.
    if (cleaningId && date) {
      try {
        const cleaningRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}/${cleaningId}`, { headers })
        if (cleaningRes.ok) {
          const cleaningData = await cleaningRes.json()
          const propId = Array.isArray(cleaningData.fields?.Property) ? cleaningData.fields.Property[0] : (cleaningData.fields?.Property || null)
          if (propId) {
            const propRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROPS_TABLE}/${propId}`, { headers })
            if (propRes.ok) {
              const propData = await propRes.json()
              const defaultTime = propData.fields?.['Default Start Time'] // "HH:MM" text field
              if (defaultTime) {
                const resetTime = `${date}T${defaultTime}:00.000-04:00`
                await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}/${cleaningId}`, {
                  method: 'PATCH',
                  headers: { ...headers, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fields: { 'Scheduled Time': resetTime } }),
                })
              }
            }
          }
        }
      } catch (e) { console.error('[deleteSquadBlock] scheduled time reset error (non-blocking):', e.message) }
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[deleteSquadBlock] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
