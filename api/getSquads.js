const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const SQUADS_TABLE = 'tbl6CaYpYaZe1PY0s'
const BLOCKS_TABLE = 'tblR9T67eyBrIi5Ny'
const CLEANINGS_TABLE = 'tblabOdNknnjrYUU1'

async function fetchAllSquads(includeInactive) {
  const squadsRes = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${SQUADS_TABLE}?fields[]=Name&fields[]=Color&fields[]=Type&fields[]=Active&fields[]=StartHour&fields[]=EndHour`,
    { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
  )
  const squadsData = await squadsRes.json()
  return (squadsData.records || [])
    .filter(r => includeInactive || r.fields?.Active)
    .map(r => ({
      id: r.id,
      name: r.fields?.Name || '',
      color: r.fields?.Color || '#94A3B8',
      type: r.fields?.Type || 'Weekday',
      active: r.fields?.Active !== false,
      startHour: r.fields?.StartHour ?? 8,
      endHour: r.fields?.EndHour ?? 18,
    }))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const headers = { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' }

  try {
    // POST — create, update, or deactivate a squad
    if (req.method === 'POST') {
      const { action, squadId, name, color, type, startHour, endHour, active } = req.body || {}

      if (action === 'delete' || action === 'deactivate') {
        if (!squadId) return res.status(400).json({ error: 'squadId requerido' })
        await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${SQUADS_TABLE}/${squadId}`, {
          method: 'PATCH', headers, body: JSON.stringify({ fields: { Active: false } })
        })
        return res.status(200).json({ ok: true })
      }

      const fields = {
        ...(name !== undefined ? { Name: name } : {}),
        ...(color !== undefined ? { Color: color } : {}),
        ...(type !== undefined ? { Type: type } : {}),
        ...(startHour !== undefined ? { StartHour: startHour } : {}),
        ...(endHour !== undefined ? { EndHour: endHour } : {}),
        ...(active !== undefined ? { Active: active } : {}),
      }

      if (squadId) {
        const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${SQUADS_TABLE}/${squadId}`, {
          method: 'PATCH', headers, body: JSON.stringify({ fields })
        })
        if (!r.ok) return res.status(500).json({ error: await r.text() })
        return res.status(200).json({ ok: true })
      } else {
        if (!name) return res.status(400).json({ error: 'name requerido' })
        const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${SQUADS_TABLE}`, {
          method: 'POST', headers,
          body: JSON.stringify({ fields: { Name: name, Color: color || '#6366F1', Type: type || 'Weekday', StartHour: startHour ?? 8, EndHour: endHour ?? 18, Active: true } })
        })
        if (!r.ok) return res.status(500).json({ error: await r.text() })
        const created = await r.json()
        return res.status(200).json({ ok: true, id: created.id })
      }
    }

    // GET — list squads, optionally with week blocks
    const { weekStart, includeInactive } = req.query

    if (!weekStart) {
      const squads = await fetchAllSquads(includeInactive === 'true')
      return res.status(200).json({ squads })
    }

    const squads = await fetchAllSquads(false)

    const start = new Date(weekStart)
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d.toISOString().split('T')[0]
    })

    const weekEnd = dates[6]
    const formula = encodeURIComponent(`AND({Date}>='${dates[0]}', {Date}<='${weekEnd}')`)
    const blocksRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}?filterByFormula=${formula}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    const blocksData = await blocksRes.json()

    const blocks = (blocksData.records || []).map(r => ({
      id: r.id,
      squadId: Array.isArray(r.fields?.Squads) ? r.fields.Squads[0] : (r.fields?.Squads || null),
      date: r.fields?.Date || '',
      startTime: r.fields?.StartTime || '',
      endTime: r.fields?.EndTime || '',
      type: r.fields?.Type || 'Manual Block',
      appointmentId: Array.isArray(r.fields?.Appointment) ? r.fields.Appointment[0] : null,
      cleaningId: Array.isArray(r.fields?.Cleaning) ? r.fields.Cleaning[0] : (r.fields?.Cleaning || null),
      notes: r.fields?.Notes || '',
    }))

    // Fetch Cleanings for this week — these are the real launched jobs that need a squad assigned
    const cleaningsFormula = encodeURIComponent(`AND({Date}>='${dates[0]}', {Date}<='${weekEnd}')`)
    const cleaningsRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}?filterByFormula=${cleaningsFormula}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    const cleaningsData = await cleaningsRes.json()
    const cleanings = (cleaningsData.records || []).map(r => ({
      id: r.id,
      date: r.fields?.Date || '',
      scheduledTime: r.fields?.['Scheduled Time'] || null,
      status: r.fields?.Status || 'Scheduled',
      propertyText: r.fields?.['Property Text'] || 'Sin propiedad',
      assignedStaff: r.fields?.['Assigned Staff'] || [],
    }))

    return res.status(200).json({ squads, blocks, cleanings, dates })
  } catch (err) {
    console.error('[getSquads] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
