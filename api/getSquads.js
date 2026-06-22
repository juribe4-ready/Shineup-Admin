const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const SQUADS_TABLE = 'tbl6CaYpYaZe1PY0s'
const BLOCKS_TABLE = 'tblR9T67eyBrIi5Ny'
const CLEANINGS_TABLE = 'tblabOdNknnjrYUU1'
const PROPS_TABLE = 'tbl1iETmcFP460oWN'

// 'Day Overrides' is a Long Text field on the EXISTING Squads table (no new table needed) that
// holds a JSON object keyed by date: { "2026-06-17": { "staffIds": ["recA","recB"], "notes": "" } }.
// Only days with an actual roster exception get an entry, so it stays small per squad.
function parseDayOverrides(raw) {
  if (!raw) return {}
  try { const obj = JSON.parse(raw); return (obj && typeof obj === 'object') ? obj : {} }
  catch { return {} }
}

async function fetchAllSquads(includeInactive) {
  // NOTE: deliberately NOT using fields[]= here. Airtable's API errors out the ENTIRE
  // request if any field name in fields[]= doesn't exist on the table yet (confirmed live —
  // this broke Squads/SquadBlocks/Pre-dispatch entirely when 'Day Overrides' wasn't created
  // yet). Fetching full records is immune to that — Squads is a tiny table, the extra payload
  // is negligible, and every field read below already falls back safely if missing.
  const squadsRes = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${SQUADS_TABLE}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
  )
  const squadsData = await squadsRes.json()
  if (squadsData.error) console.error('[getSquads] fetchAllSquads error:', squadsData.error)
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
      defaultMemberIds: Array.isArray(r.fields?.['Default Members']) ? r.fields['Default Members'] : [],
      dayOverrides: parseDayOverrides(r.fields?.['Day Overrides']),
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

    // weekStart arrives as a plain "YYYY-MM-DD" string. Parsing it with `new Date(weekStart)`
    // gives a UTC-midnight instant — but mutating that with LOCAL-time methods (.getDate(),
    // .setDate()) is unsafe: if the server process's timezone isn't UTC, the whole 7-day
    // range silently shifts by a day, and the real Sunday falls outside the fetched range
    // entirely (confirmed live — this is exactly what was happening). Pure UTC arithmetic
    // throughout removes any dependency on the server's local timezone setting.
    const [wy, wm, wd] = weekStart.split('-').map(Number)
    const startUTC = new Date(Date.UTC(wy, wm - 1, wd))
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startUTC)
      d.setUTCDate(startUTC.getUTCDate() + i)
      return d.toISOString().split('T')[0]
    })

    const weekEnd = dates[6]
    // Using < (day AFTER weekEnd) instead of <= weekEnd deliberately: if the Date field
    // carries any time-of-day component, comparing <= against the bare last-day date can
    // exclude that day's own records (e.g. 2026-06-21T04:00 is NOT <= bare '2026-06-21').
    // This always hits exactly the LAST day of the range — confirmed live, this is why
    // Sunday specifically (never a mid-week day) kept disappearing.
    const dayAfterWeekEnd = (() => {
      const d = new Date(startUTC)
      d.setUTCDate(startUTC.getUTCDate() + 7)
      return d.toISOString().split('T')[0]
    })()
    const formula = encodeURIComponent(`AND({Date}>='${dates[0]}', {Date}<'${dayAfterWeekEnd}')`)
    // Paginated — Airtable caps each response at 100 records. A full week can easily exceed
    // that (confirmed live: Sunday's records were being silently cut off without this loop).
    let blockRecords = [], blockOffset = null
    do {
      const blocksRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}?filterByFormula=${formula}&pageSize=100${blockOffset ? `&offset=${blockOffset}` : ''}`,
        { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
      )
      const blocksData = await blocksRes.json()
      if (blocksData.error) { console.error('[getSquads] blocks fetch error:', blocksData.error); break }
      blockRecords = blockRecords.concat(blocksData.records || [])
      blockOffset = blocksData.offset || null
    } while (blockOffset)

    const blocks = blockRecords.map(r => ({
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
    const cleaningsFormula = encodeURIComponent(`AND({Date}>='${dates[0]}', {Date}<'${dayAfterWeekEnd}')`)
    let cleaningRecords = [], cleaningOffset = null
    do {
      const cleaningsRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}?filterByFormula=${cleaningsFormula}&pageSize=100${cleaningOffset ? `&offset=${cleaningOffset}` : ''}`,
        { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
      )
      const cleaningsData = await cleaningsRes.json()
      if (cleaningsData.error) { console.error('[getSquads] cleanings fetch error:', cleaningsData.error); break }
      cleaningRecords = cleaningRecords.concat(cleaningsData.records || [])
      cleaningOffset = cleaningsData.offset || null
    } while (cleaningOffset)
    const cleaningsData = { records: cleaningRecords }

    // Reverse-lookup: each Cleaning doesn't store its origin Appointment, but each
    // Appointment stores 'Related Cleaning Job' pointing TO its Cleaning. Fetch appointments
    // for this week and build a Cleaning ID -> Appointment Code map for full traceability.
    // NOTE: previously filtered by {Date} here, but the Appointments table has no such field
    // (it's 'Requested Date & Time') — Airtable returned an error and this map was always
    // empty, which is why Squad Blocks never got an Appointment link. Filter instead on
    // "has a Related Cleaning Job" (same proven pattern as getBilling) and match in JS against
    // this week's cleaning IDs, with pagination since Appointments can be a large table.
    const cleaningIdSet = new Set((cleaningsData.records || []).map(r => r.id))
    const cleaningIdToApptCode = {}
    const cleaningIdToApptRecordId = {}
    try {
      const apptLookupFormula = encodeURIComponent(`NOT({Related Cleaning Job} = BLANK())`)
      let apptOffset = null, apptPage = 0
      do {
        apptPage++
        if (apptPage > 20) break // safety limit
        const apptLookupRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/tblXlpg7MuYWA8Ocn?filterByFormula=${apptLookupFormula}&pageSize=100${apptOffset ? `&offset=${apptOffset}` : ''}`,
          { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
        )
        if (!apptLookupRes.ok) { console.error('[getSquads] appt lookup failed:', apptLookupRes.status); break }
        const apptLookupData = await apptLookupRes.json()
        if (apptLookupData.error) { console.error('[getSquads] appt lookup error:', apptLookupData.error); break }
        for (const r of (apptLookupData.records || [])) {
          const relatedCleaningId = Array.isArray(r.fields?.['Related Cleaning Job']) ? r.fields['Related Cleaning Job'][0] : null
          if (!relatedCleaningId || !cleaningIdSet.has(relatedCleaningId)) continue
          cleaningIdToApptCode[relatedCleaningId] = r.fields?.['Appointment ID'] || null
          cleaningIdToApptRecordId[relatedCleaningId] = r.id
        }
        apptOffset = apptLookupData.offset || null
      } while (apptOffset)
    } catch (e) { console.error('[getSquads] appt lookup exception:', e.message) }

    // Same as every other file in this codebase: Airtable can return a linked-record field
    // as either an array OR a single bare string depending on how the record was written —
    // this MUST handle both, or records end up silently treated as "no property linked" even
    // when they clearly have one (confirmed live: this was exactly the bug).
    const propIdOf = (fields) => {
      const v = fields?.Property
      if (Array.isArray(v)) return v[0] || null
      return v || null
    }

    // ZIP lookup for grouping unassigned pills by zipcode in Pre-dispatch.
    // NOTE: previously fetched each property individually in parallel (Promise.all of N
    // single-record GETs) — with more than ~5 distinct properties in a week, that can exceed
    // Airtable's 5-requests/second limit and some fetches silently fail (intermittent, not
    // tied to any particular property — confirmed live). Fetching the whole table once,
    // paginated, is both simpler and immune to this entirely.
    let propRecords = [], propOffset = null
    do {
      const pr = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROPS_TABLE}?pageSize=100${propOffset ? `&offset=${propOffset}` : ''}`,
        { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
      )
      if (!pr.ok) { console.error('[getSquads] properties fetch failed:', pr.status); break }
      const pd = await pr.json()
      if (pd.error) { console.error('[getSquads] properties fetch error:', pd.error); break }
      propRecords = propRecords.concat(pd.records || [])
      propOffset = pd.offset || null
    } while (propOffset)
    const zipByPropId = {}
    for (const p of propRecords) zipByPropId[p.id] = p.fields?.ZIP || null

    const cleanings = (cleaningsData.records || []).map(r => {
      const pid = propIdOf(r.fields)
      const zip = pid ? (zipByPropId[pid] || null) : null
      return {
        id: r.id,
        date: r.fields?.Date || '',
        scheduledTime: r.fields?.['Scheduled Time'] || null,
        turnoTime: r.fields?.['Turno Time'] || null,
        status: r.fields?.Status || 'Scheduled',
        propertyText: r.fields?.['Property Text'] || 'Sin propiedad',
        zip,
        assignedStaff: r.fields?.['Assigned Staff'] || [],
        appointmentCode: cleaningIdToApptCode[r.id] || null,
        appointmentRecordId: cleaningIdToApptRecordId[r.id] || null,
        price: typeof r.fields?.Price === 'number' ? r.fields.Price : null,
        laborMinutes: typeof r.fields?.Labor === 'number' ? r.fields.Labor : null,
        cleaningType: r.fields?.['Cleaning Type Text'] || (Array.isArray(r.fields?.['Cleaning Type']) ? null : r.fields?.['Cleaning Type']) || null,
      }
    })

    // Day-specific roster overrides for this week — derived from each squad's own
    // 'Day Overrides' JSON field (already fetched above with the squad, no extra API call).
    const rosterOverrides = []
    for (const squad of squads) {
      for (const d of dates) {
        const entry = squad.dayOverrides?.[d]
        if (entry) rosterOverrides.push({ squadId: squad.id, date: d, staffIds: Array.isArray(entry.staffIds) ? entry.staffIds : [], notes: entry.notes || '' })
      }
    }

    return res.status(200).json({ squads, blocks, cleanings, dates, rosterOverrides })
  } catch (err) {
    console.error('[getSquads] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
