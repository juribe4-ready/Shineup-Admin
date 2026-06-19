// Consolidated reports API: /api/getReports?type=incidents|inventory
import { computeLaborBaseMinutes, computeFinalLaborMinutes, getLaborFactorBand } from './_lib/duration.js'
const AIRTABLE_BASE  = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const STAFF_TABLE    = 'tblgHwN1wX6u3ZtNY'
const PROPS_TABLE    = 'tbl1iETmcFP460oWN'
const INV_TABLE      = 'tblppdLDDnyT0eye9'
const CLEANINGS_TABLE= 'tblabOdNknnjrYUU1'
const APPOINTMENTS_TABLE = 'tblXlpg7MuYWA8Ocn'
const CLIENTS_TABLE      = 'Clients'
const SQUADS_TABLE       = 'tbl6CaYpYaZe1PY0s'
const BLOCKS_TABLE       = 'tblR9T67eyBrIi5Ny'

async function buildMaps(headers) {
  const staffMap = {}, propMap = {}
  try {
    const sr = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STAFF_TABLE}?fields[]=Name&fields[]=Initials`, { headers })
    if (sr.ok) { const sd = await sr.json(); for (const s of (sd.records||[])) staffMap[s.id] = s.fields?.Name || s.fields?.Initials || '?' }
  } catch {}
  try {
    const pr = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROPS_TABLE}?fields[]=Name`, { headers })
    if (pr.ok) { const pd = await pr.json(); for (const p of (pd.records||[])) propMap[p.id] = p.fields?.Name || '?' }
  } catch {}
  return { staffMap, propMap }
}

async function getIncidents(headers, staffMap, propMap) {
  const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Incidents?sort[0][field]=Creation%20Date&sort[0][direction]=desc`, { headers })
  if (!r.ok) throw new Error('Error Airtable Incidents')
  const data = await r.json()
  return (data.records||[]).map(rec => {
    const f = rec.fields
    const propId = Array.isArray(f['Property']) ? f['Property'][0] : f['Property']
    return {
      id: rec.id, name: f['Name']||'Sin nombre', status: f['Status']||'Reported',
      creationDate: f['Creation Date']||null, comment: f['Comment']||'',
      propertyId: propId||null, propertyName: propMap[propId]||'Sin propiedad',
      photoUrls: f['MediaURL'] ? [f['MediaURL']] : (Array.isArray(f['Photos']) ? f['Photos'].map(p=>p?.url).filter(Boolean) : []),
      reportedBy: Array.isArray(f['Reported By']) ? (staffMap[f['Reported By'][0]]||'') : (f['Reported By']||''),
    }
  })
}

async function getInventory(headers, staffMap, propMap) {
  // Latest StoragePhoto per property
  const storageMap = {}
  try {
    const cr = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}?fields[]=Property&fields[]=StoragePhoto&fields[]=Scheduled%20Time&sort[0][field]=Scheduled%20Time&sort[0][direction]=desc`, { headers })
    if (cr.ok) {
      const cd = await cr.json()
      for (const rec of (cd.records||[])) {
        const f = rec.fields
        const propId = Array.isArray(f['Property']) ? f['Property'][0] : f['Property']
        const raw = f['StoragePhoto']||[]
        const url = Array.isArray(raw) && raw[0] ? (raw[0].thumbnails?.large?.url || raw[0].url || null) : null
        if (propId && url && !storageMap[propId]) storageMap[propId] = { url, date: (f['Scheduled Time']||'').slice(0,10) }
      }
    }
  } catch {}

  const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${INV_TABLE}?sort[0][field]=Date&sort[0][direction]=desc`, { headers })
  if (!r.ok) throw new Error('Error Airtable Inventory')
  const data = await r.json()
  return (data.records||[]).map(rec => {
    const f = rec.fields
    const propId = Array.isArray(f['Property']) ? f['Property'][0] : f['Property']
    const photos = f['Attachments'] || f['Photos'] || []
    return {
      id: rec.id, status: f['Status']||'Low', comment: f['Comment']||f['Item']||'',
      date: f['Date']||null, propertyId: propId||null, propertyName: propMap[propId]||'Sin propiedad',
      photoUrls: f['MediaURL'] ? [f['MediaURL']] : (Array.isArray(photos) ? photos.map(p=>p?.url).filter(Boolean) : []),
      reportedBy: Array.isArray(f['Reported By']) ? (staffMap[f['Reported By'][0]]||'') : (f['Reported By']||''),
      storagePhoto: storageMap[propId] || null,
    }
  })
}


async function getBilling(headers, query) {
  const { dateFrom, dateTo } = query
  const df = dateFrom || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })()
  const dt = dateTo   || new Date().toISOString().split('T')[0]

  const formula = encodeURIComponent(`OR({Status}='Done',{Status}='In Progress',{Status}='Opened',{Status}='Scheduled',{Status}='Programmed')`)

  let allRecords = [], offset = null
  do {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}?filterByFormula=${formula}&sort[0][field]=Date&sort[0][direction]=desc${offset ? `&offset=${offset}` : ''}`
    const r = await fetch(url, { headers })
    if (!r.ok) throw new Error(await r.text())
    const data = await r.json()
    const inRange = (data.records || []).filter(rec => {
      const d = rec.fields?.['Date']
      return d && d >= df && d <= dt
    })
    allRecords = allRecords.concat(inRange)
    offset = data.offset || null
  } while (offset)

  // Build clients map: record ID → name (primary field of Clients table)
  const clientsMap = {}
  try {
    let clientOffset = null
    do {
      const sep = clientOffset ? `?offset=${clientOffset}` : ''
      const cr = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLIENTS_TABLE}${sep}`, { headers })
      if (!cr.ok) { console.error('[getBilling] clients failed:', cr.status); break }
      const cd = await cr.json()
      for (const c of (cd.records || [])) {
        // Try all likely primary field names for Clients table
        const f = c.fields || {}
        const name = f['Full name'] || f['Name'] || f['Client Name'] || f['First Name'] || f['full name'] || null
        if (name) clientsMap[c.id] = name
      }
      clientOffset = cd.offset || null
    } while (clientOffset)
    console.log('[getBilling] clientsMap:', Object.keys(clientsMap).length, 'entries, sample:', JSON.stringify(Object.entries(clientsMap).slice(0,3)))
  } catch(e) { console.error('[getBilling] clients error:', e.message) }

  // Enrich with Client Name and Source from Appointments (best-effort, won't affect cleaning list)
  const cleaningIdSet = new Set(allRecords.map(r => r.id))
  const apptMap = {}
  try {
    const apptFormula = encodeURIComponent(`NOT({Related Cleaning Job} = BLANK())`)
    let apptOffset = null
    let apptPage = 0
    do {
      apptPage++
      if (apptPage > 20) break // safety limit
      const apptUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${APPOINTMENTS_TABLE}?filterByFormula=${apptFormula}&pageSize=100${apptOffset ? `&offset=${apptOffset}` : ''}`
      const ar = await fetch(apptUrl, { headers })
      if (!ar.ok) { console.error('[getBilling] appt fetch failed:', ar.status); break }
      const ad = await ar.json()
      if (ad.error) { console.error('[getBilling] appt error:', ad.error); break }
      for (const appt of (ad.records || [])) {
        const relIds = Array.isArray(appt.fields?.['Related Cleaning Job']) ? appt.fields['Related Cleaning Job'] : []
        for (const cid of relIds) {
          if (!cleaningIdSet.has(cid)) continue
          const clientRaw = appt.fields?.['Client Name'] || null
          const clientName = Array.isArray(clientRaw) ? clientRaw[0] : (clientRaw || null)
          const source = appt.fields?.['Online Platform Source'] || appt.fields?.['Source'] || null
          apptMap[cid] = { clientName, source }
        }
      }
      apptOffset = ad.offset || null
    } while (apptOffset)
  } catch(e) { console.error('[getBilling] appt lookup error:', e.message) }

  const cleanings = allRecords.map(rec => {
    const f = rec.fields
    let hoursWorked = null
    if (f['Start Time'] && f['End Time']) {
      const start = new Date(f['Start Time']), end = new Date(f['End Time'])
      hoursWorked = Math.round(((end - start) / 3600000) * 10) / 10
    }
    const staffCount = f['#Cleaners'] || 1
    const hoursTotal = hoursWorked ? Math.round(hoursWorked * staffCount * 10) / 10 : null
    const price      = f['Price'] || null
    const status     = f['Status'] || null
    const rawPayStatus = f['Payment Status'] || null
    // Normalize to lowercase, handle both 'Unpaid' and 'unpaid' from Airtable
    const payStatus  = rawPayStatus 
      ? rawPayStatus.toLowerCase()
      : (status === 'Done' ? 'unpaid' : null)
    // Client: ONLY from cleaning's own Client field, resolved via clientsMap
    // apptMap is intentionally NOT used for client name — appointments can have wrong client
    const cleaningClientRaw = Array.isArray(f['Client']) && f['Client'].length > 0
      ? f['Client'][f['Client'].length - 1]
      : null
    const resolveClient = (raw) => {
      if (!raw) return null
      if (/^rec[A-Za-z0-9]{8,}$/.test(raw)) return clientsMap[raw] || null
      return raw
    }
    const clientName = resolveClient(cleaningClientRaw) || f['Client Name Text'] || null
    if (rec.id === 'recjiGUdQbeReKqtd' || rec.id === 'recpC9nCLTDHD5wQx') {
      console.log(`[DEBUG] ${rec.id}: Client=${JSON.stringify(f['Client'])}, raw=${cleaningClientRaw}, resolved=${clientName}, mapSize=${Object.keys(clientsMap).length}`)
    }
    return {
      id: rec.id, date: f['Date'] || null,
      property: f['Property Text'] || 'Sin propiedad',
      clientName,
      source: apptMap[rec.id]?.source || null,
      cleaningType: f['Cleaning Type Text'] || (Array.isArray(f['Cleaning Type']) ? null : f['Cleaning Type']) || null,
      paymentStatus: payStatus,
      status,
      rating: f['Rating'] || null,
      price, hoursWorked, hoursTotal, staffCount,
      hasPrice: !!f['Price'],
    }
  })

  const sum = arr => arr.reduce((acc, c) => acc + (c.price || 0), 0)
  const unpaid   = cleanings.filter(c => c.paymentStatus === 'unpaid')
  const invoiced = cleanings.filter(c => c.paymentStatus === 'invoiced')
  const paid     = cleanings.filter(c => c.paymentStatus === 'paid')
  const overdue  = cleanings.filter(c => c.paymentStatus === 'overdue')
  // noPrice: only count Done cleanings without price (in-progress excluded)
  const doneCleanings = cleanings.filter(c => c.status === 'Done')

  return {
    cleanings,
    summary: {
      total: cleanings.length, noPrice: doneCleanings.filter(c => !c.hasPrice).length,
      unpaidCount: unpaid.length, invoicedCount: invoiced.length,
      paidCount: paid.length, overdueCount: overdue.length,
      unpaidAmount:   Math.round(sum(unpaid)   * 100) / 100,
      invoicedAmount: Math.round(sum(invoiced) * 100) / 100,
      paidAmount:     Math.round(sum(paid)     * 100) / 100,
      overdueAmount:  Math.round(sum(overdue)  * 100) / 100,
      totalRevenue:   Math.round(sum(cleanings.filter(c => c.price)) * 100) / 100,
    }
  }
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const type = req.query?.type
    if (!type) return res.status(400).json({ error: 'type requerido: incidents|inventory' })
    const headers = { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    const { staffMap, propMap } = await buildMaps(headers)

    if (type === 'incidents') return res.status(200).json(await getIncidents(headers, staffMap, propMap))
    if (type === 'inventory') return res.status(200).json(await getInventory(headers, staffMap, propMap))
    if (type === 'billing')   return res.status(200).json(await getBilling(headers, req.query))
    if (type === 'importMatch' && req.method === 'GET')  return res.status(200).json(await getImportMatch(headers, req.query))
    if (type === 'tarsConfig' && req.method === 'GET')  return res.status(200).json(await getTARSConfig(headers))
    if (type === 'tarsConfig' && req.method === 'POST') return res.status(200).json(await saveTARSConfig(headers, req.body))
    if (type === 'availability') return res.status(200).json(await getAvailability(headers, req.query))
    if (type === 'squadRoster' && req.method === 'GET')  return res.status(200).json(await getSquadRoster(headers, req.query))
    if (type === 'squadRoster' && req.method === 'POST') return res.status(200).json(await saveSquadRoster(headers, req.body))
    if (type === 'recalcLabor' && req.method === 'GET')  return res.status(200).json(await previewRecalcLabor(headers))
    if (type === 'recalcLabor' && req.method === 'POST') return res.status(200).json(await applyRecalcLabor(headers))
    if (type === 'cleaningTypes') {
      const ct = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Cleaning%20Type?fields[]=Cleaning%20Type%20Name`, { headers })
      const ctData = await ct.json()
      return res.status(200).json({ cleaningTypes: (ctData.records||[]).map(r => ({ id: r.id, name: r.fields?.['Cleaning Type Name']||'' })) })
    }
    if (type === 'importApply' && req.method === 'POST') return res.status(200).json(await applyImportPayments(headers, req.body))
    if (type === 'createAppointments' && req.method === 'POST') return res.status(200).json(await createTurnoAppointments(headers, req.body))
    return res.status(400).json({ error: `Unknown type: ${type}` })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

async function getImportMatch(headers, query) {
  const { dateFrom, dateTo } = query

  // Fetch cleaning types
  const ctRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Cleaning%20Type?fields[]=Name`, { headers })
  const ctData = await ctRes.json()
  const cleaningTypes = (ctData.records || []).map(r => ({ id: r.id, name: r.fields?.Name || '' }))
  // Fetch all properties without field filter to ensure Turno Name is included
  let allProps = [], propsOffset = null
  do {
    const propsRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROPS_TABLE}${propsOffset ? `?offset=${propsOffset}` : ''}`,
      { headers }
    )
    const propsData = await propsRes.json()
    allProps = allProps.concat(propsData.records || [])
    propsOffset = propsData.offset || null
  } while (propsOffset)
  const propsMap = {}
  for (const p of allProps) {
    propsMap[p.id] = { name: p.fields?.Name || '', turnoName: p.fields?.['Turno Name'] || '' }
  }
  let allCleanings = [], offset = null
  do {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}?pageSize=100${offset?`&offset=${offset}`:''}`
    const r = await fetch(url, { headers })
    const data = await r.json()
    const inRange = (data.records||[]).filter(rec => {
      const d = rec.fields?.Date
      return d && d >= dateFrom && d <= dateTo
    })
    allCleanings = allCleanings.concat(inRange)
    offset = data.offset || null
  } while (offset)
  return { cleanings: allCleanings, propsMap, cleaningTypes }
}

async function applyImportPayments(headers, body) {
  const { updates } = body
  const results = []
  for (const u of (updates || [])) {
    try {
      const r = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}/${u.cleaningId}`,
        { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: {
          'Payment Status': 'Paid',
          'Price':         u.amount,
          'Turno Project': u.projectNumber || '',
        }})}
      )
      results.push({ cleaningId: u.cleaningId, ok: r.ok })
    } catch(e) { results.push({ cleaningId: u.cleaningId, ok: false }) }
  }
  return { results }
}

async function createTurnoAppointments(headers, body) {
  const { date, properties } = body
  // properties = [{name: 'truncated name from turno', propertyId: 'recXXX or null'}]
  const results = []
  for (const p of (properties || [])) {
    if (!p.propertyId) { results.push({ name: p.name, ok: false, reason: 'no_match' }); continue }
    try {
      // Columbus EDT = UTC-4, use 10am local time
      const fields = {
        'Requested Date & Time': `${date}T14:00:00.000Z`,
        'Status': 'Confirmed',
        'Source': 'Turno',
        'Property': [p.propertyId],
        ...(body.cleaningTypeId ? { 'Cleaning Type': body.cleaningTypeId.startsWith('rec') ? [body.cleaningTypeId] : body.cleaningTypeId } : {}),
      }
      const r = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/tblXlpg7MuYWA8Ocn`,
        { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) }
      )
      const data = await r.json()
      results.push({ name: p.name, ok: r.ok, id: data.id, reason: data.error?.message })
    } catch(e) { results.push({ name: p.name, ok: false, reason: e.message }) }
  }
  return { results }
}

async function getTARSConfig(headers) {
  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/Standards?filterByFormula={Name}='TARS_CONFIG'&fields[]=Name&fields[]=Value`,
      { headers }
    )
    if (!r.ok) return { config: null }
    const d = await r.json()
    const rec = d.records?.[0]
    if (!rec?.fields?.Value) return { config: null }
    return { config: JSON.parse(rec.fields.Value), recordId: rec.id }
  } catch { return { config: null } }
}

async function saveTARSConfig(headers, body) {
  const { config } = body
  const value = JSON.stringify(config)
  try {
    const checkR = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/Standards?filterByFormula={Name}='TARS_CONFIG'&fields[]=Name`,
      { headers }
    )
    const checkD = await checkR.json()
    const existingId = checkD.records?.[0]?.id

    let saveRes
    if (existingId) {
      saveRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Standards/${existingId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { Value: value } })
      })
    } else {
      saveRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Standards`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { Name: 'TARS_CONFIG', Value: value } })
      })
    }

    if (!saveRes.ok) {
      const errBody = await saveRes.text()
      console.error('[saveTARSConfig] Airtable rejected write:', saveRes.status, errBody)
      return { ok: false, error: `Airtable error ${saveRes.status}: ${errBody}` }
    }
    return { ok: true }
  } catch(e) {
    console.error('[saveTARSConfig] Exception:', e.message)
    return { ok: false, error: e.message }
  }
}

function timeToMinAvail(t) {
  const [h, m] = (t || '0:0').split(':').map(Number)
  return h * 60 + m
}

// Recalculate Properties.Labor (the FINAL, corrected value every other part of the app
// reads) = "Labor Base" (a×Beds + b×Bathrooms + c×SqFt, using coefficients from Standards)
// × "Labor Correction Factor" (the property's own elasticity multiplier — read-only here,
// NEVER written by this function, so re-running this never erases a calibration).
//
// NOTE: this only does anything useful once Juan has converted Properties.Labor from a
// Formula field to a plain Number field in the Airtable UI — the API physically cannot
// write to a Formula field, so applyRecalcLabor will fail per-record (with a clear
// Airtable error) until that one-time conversion is done. previewRecalcLabor works either
// way since it's read-only — it's safe to run before the conversion to see what WOULD change.
async function fetchPropertiesForLaborCalc(headers) {
  let all = [], offset = null
  do {
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROPS_TABLE}?fields[]=Name&fields[]=Beds&fields[]=Bathrooms&fields[]=SqFt&fields[]=${encodeURIComponent('Labor Base')}&fields[]=${encodeURIComponent('Labor Correction Factor')}&fields[]=Labor&pageSize=100${offset ? `&offset=${offset}` : ''}`,
      { headers }
    )
    if (!r.ok) break
    const d = await r.json()
    if (d.error) { console.error('[recalcLabor] fetch error:', d.error); break }
    all = all.concat(d.records || [])
    offset = d.offset || null
  } while (offset)
  return all
}

function computeLaborDiff(r, cfg) {
  const beds = Number(r.fields?.Beds || 0)
  const bathrooms = Number(r.fields?.Bathrooms || 0)
  const sqft = Number(r.fields?.SqFt || 0)
  const rawFactor = r.fields?.['Labor Correction Factor']
  const factor = (rawFactor === undefined || rawFactor === null || rawFactor === '') ? 1 : Number(rawFactor)
  const { min: minBand, max: maxBand } = getLaborFactorBand(cfg)
  const newLaborBase = computeLaborBaseMinutes(beds, bathrooms, sqft, cfg)
  const newLaborFinal = computeFinalLaborMinutes(newLaborBase, factor)
  return {
    id: r.id,
    name: r.fields?.Name || '(sin nombre)',
    beds, bathrooms, sqft,
    factor,
    factorOutOfBand: Number.isFinite(factor) && (factor < minBand || factor > maxBand),
    currentLaborBase: Number(r.fields?.['Labor Base'] || 0),
    newLaborBase,
    currentLabor: Number(r.fields?.Labor || 0),
    newLabor: newLaborFinal,
    changed: Number(r.fields?.['Labor Base'] || 0) !== newLaborBase || Number(r.fields?.Labor || 0) !== newLaborFinal,
  }
}

async function previewRecalcLabor(headers) {
  const { config } = await getTARSConfig(headers)
  const cfg = config || {}
  const properties = await fetchPropertiesForLaborCalc(headers)
  const diffs = properties.map(r => computeLaborDiff(r, cfg))
  return {
    coefficients: {
      laborMinutesPerBed: cfg.laborMinutesPerBed ?? 18,
      laborMinutesPerBathroom: cfg.laborMinutesPerBathroom ?? 23,
      laborMinutesPerSqFt: cfg.laborMinutesPerSqFt ?? 0.05,
    },
    band: getLaborFactorBand(cfg),
    totalProperties: properties.length,
    changedCount: diffs.filter(d => d.changed).length,
    outOfBandCount: diffs.filter(d => d.factorOutOfBand).length,
    sample: diffs.slice(0, 20),
  }
}

async function applyRecalcLabor(headers) {
  const { config } = await getTARSConfig(headers)
  const cfg = config || {}
  const properties = await fetchPropertiesForLaborCalc(headers)
  const updates = properties.map(r => {
    const diff = computeLaborDiff(r, cfg)
    // Correction Factor is intentionally NOT in this fields object — never overwritten here.
    return { id: r.id, fields: { 'Labor Base': diff.newLaborBase, Labor: diff.newLabor } }
  })

  let updated = 0
  const errors = []
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10)
    const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROPS_TABLE}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: batch }),
    })
    if (r.ok) updated += batch.length
    else {
      const errText = await r.text()
      console.error('[applyRecalcLabor] batch PATCH failed:', errText)
      errors.push(errText)
      // Most likely cause: Labor (or Labor Base) is still a Formula field, or the
      // "Labor Base" / "Labor Correction Factor" fields don't exist yet in Airtable.
      break
    }
  }
  if (errors.length > 0) {
    return { ok: false, updated, totalProperties: properties.length, error: 'Airtable rechazó la escritura — revisá que "Labor" sea tipo Number (no Formula) y que existan los campos "Labor Base" y "Labor Correction Factor" en Properties.', detail: errors[0] }
  }
  return { ok: true, updated, totalProperties: properties.length }
}

// Resolution order for "who is actually on this squad today":
//   1) a day-specific override stored in the squad's own 'Day Overrides' field
//   2) the squad's Default Members (the normal/typical roster)
// 'Day Overrides' is a single Long Text field on the EXISTING Squads table — no new table.
// It holds a JSON object keyed by date: { "2026-06-17": { "staffIds": ["recA","recB"], "notes": "" } }
// Only days with an actual exception get an entry, so this stays small and is fetched as part
// of the normal squad record (one request gets both Default Members and any overrides).
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
      if (overrides[date]) {
        return { staffIds: Array.isArray(overrides[date].staffIds) ? overrides[date].staffIds : [], source: 'override' }
      }
      const defaultStaff = Array.isArray(sd.fields?.['Default Members']) ? sd.fields['Default Members'] : []
      return { staffIds: defaultStaff, source: 'default' }
    }
  } catch (e) { console.error('[resolveSquadStaff] error:', e.message) }
  return { staffIds: [], source: 'none' }
}

// Push a resolved staff list onto every Cleaning already dispatched to this squad on this
// date — this is what lets Juan fix a whole day in one move instead of editing each cleaning.
async function applyStaffToSquadDay(headers, squadId, date, staffIds) {
  const blockFormula = encodeURIComponent(`AND({Type}='Appointment', FIND('${squadId}', ARRAYJOIN(Squads)))`)
  const blocksRes = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}?filterByFormula=${blockFormula}&fields[]=Date&fields[]=Cleaning&pageSize=100`,
    { headers }
  )
  if (!blocksRes.ok) return { updated: 0 }
  const blocksData = await blocksRes.json()
  if (blocksData.error) return { updated: 0 }
  const cleaningIds = (blocksData.records || [])
    .filter(r => r.fields?.Date === date)
    .map(r => Array.isArray(r.fields?.Cleaning) ? r.fields.Cleaning[0] : r.fields?.Cleaning)
    .filter(Boolean)

  let updated = 0
  for (let i = 0; i < cleaningIds.length; i += 10) {
    const batch = cleaningIds.slice(i, i + 10)
    const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: batch.map(id => ({ id, fields: { 'Assigned Staff': staffIds } })) }),
    })
    if (r.ok) updated += batch.length
    else console.error('[applyStaffToSquadDay] batch PATCH failed:', await r.text())
  }
  return { updated, cleaningCount: cleaningIds.length }
}

async function getSquadRoster(headers, query) {
  const { squadId, date } = query
  if (!squadId || !date) return { error: 'squadId y date requeridos' }
  const resolved = await resolveSquadStaff(headers, squadId, date)
  return { squadId, date, ...resolved }
}

async function saveSquadRoster(headers, body) {
  const { squadId, date, staffIds, notes } = body
  if (!squadId || !date || !Array.isArray(staffIds)) {
    return { ok: false, error: 'squadId, date y staffIds (array) requeridos' }
  }
  try {
    // Read-modify-write the squad's own JSON field — merge in just this date's entry,
    // keep every other date's override untouched.
    const sr = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${SQUADS_TABLE}/${squadId}`, { headers })
    if (!sr.ok) return { ok: false, error: 'No se pudo leer el squad' }
    const sd = await sr.json()
    const overrides = parseDayOverrides(sd.fields?.['Day Overrides'])
    overrides[date] = { staffIds, notes: notes || '' }

    const saveRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${SQUADS_TABLE}/${squadId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { 'Day Overrides': JSON.stringify(overrides) } }),
    })
    if (!saveRes.ok) {
      const errBody = await saveRes.text()
      console.error('[saveSquadRoster] Airtable rejected write:', saveRes.status, errBody)
      return { ok: false, error: `Airtable error ${saveRes.status}: ${errBody}` }
    }

    // Cascade: push this roster to every cleaning already dispatched to this squad that day,
    // so Juan never has to edit cleanings one by one when someone swaps for the day.
    const { updated, cleaningCount } = await applyStaffToSquadDay(headers, squadId, date, staffIds)
    return { ok: true, updated, cleaningCount }
  } catch (e) {
    console.error('[saveSquadRoster] Exception:', e.message)
    return { ok: false, error: e.message }
  }
}

async function getAvailability(headers, query) {
  const { date, durationHours } = query
  if (!date) return { error: 'date requerido (YYYY-MM-DD)' }
  const duration = parseFloat(durationHours) || 2.5

  // 1. Load TARS config (the single source of truth for rules)
  const configResult = await getTARSConfig(headers)
  const config = configResult.config || {
    primeStart: '10:00', primeEnd: '16:00', routeBufferPct: 25,
    minRatePrimeTime: 50, minRateFlex: 35, strOnlyDays: [6], strOnlyDates: [],
  }

  const dow = (new Date(date + 'T12:00:00').getDay() + 6) % 7 // 0=Mon..6=Sun
  const isStructuralSTR = (config.strOnlyDays || []).includes(dow) || (config.strOnlyDates || []).includes(date)

  if (isStructuralSTR) {
    return {
      date, available: false, reason: 'STR-only day — fully reserved for short-term rental turnovers',
      suggestedPrice: null,
    }
  }

  // 2. Load active squads for this day-of-week
  const squadsRes = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${SQUADS_TABLE}?fields[]=Name&fields[]=Type&fields[]=Active&fields[]=StartHour&fields[]=EndHour`,
    { headers }
  )
  const squadsData = await squadsRes.json()
  const isWeekend = dow >= 5
  const activeSquads = (squadsData.records || [])
    .filter(r => r.fields?.Active)
    .filter(r => {
      const t = r.fields?.Type
      return t === 'Flexible' || (isWeekend ? t === 'Weekend' : t === 'Weekday')
    })
    .map(r => ({ id: r.id, startMin: (r.fields?.StartHour ?? 8) * 60, endMin: (r.fields?.EndHour ?? 18) * 60 }))

  if (activeSquads.length === 0) {
    return { date, available: false, reason: 'No active squads scheduled this day', suggestedPrice: null }
  }

  // 3. Load existing Squad Blocks for that date (assigned commitments per squad)
  // NOTE: exact equality `{Date}='...'` on Airtable Date fields is unreliable — it compares
  // against the field's full underlying value (which can include a time component depending
  // on field config), not just the date portion, so it can silently return zero matches even
  // when blocks exist for that date. Range comparison (proven in getSquads.js for this same
  // table) is the reliable way to pin to a single day.
  const blockFormula = encodeURIComponent(`AND({Date}>='${date}', {Date}<='${date}')`)
  const blocksRes = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}?filterByFormula=${blockFormula}&fields[]=Squads&fields[]=StartTime&fields[]=EndTime&fields[]=Date`,
    { headers }
  )
  const blocksData = await blocksRes.json()
  const blocksBySquad = {}
  for (const r of (blocksData.records || [])) {
    // Belt-and-suspenders: also confirm the exact date string in JS, since this is the same
    // defensive pattern used elsewhere in this file (getBilling, getImportMatch) to avoid
    // ever trusting Airtable's date-equality formula behavior alone.
    if (r.fields?.Date !== date) continue
    const sId = Array.isArray(r.fields?.Squads) ? r.fields.Squads[0] : r.fields?.Squads
    if (!sId) continue
    const s = timeToMinAvail(r.fields?.StartTime)
    const e = timeToMinAvail(r.fields?.EndTime)
    if (e <= s) continue
    if (!blocksBySquad[sId]) blocksBySquad[sId] = []
    blocksBySquad[sId].push([s, e])
  }

  // 4. Load Confirmed appointments for that date NOT YET assigned to a squad block
  //    These are committed demand (e.g. from Turno) even before a human drags them onto a squad.
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.000Z`
  const apptFormula = encodeURIComponent(
    `AND({Status}='Confirmed', IS_AFTER({Requested Date & Time},'${dayStart}'), IS_BEFORE({Requested Date & Time},'${dayEnd}'))`
  )
  const apptFieldsParam = ['Requested Date & Time', 'Status'].map(f => `fields[]=${encodeURIComponent(f)}`).join('&')
  const apptRes = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${APPOINTMENTS_TABLE}?filterByFormula=${apptFormula}&${apptFieldsParam}`,
    { headers }
  )
  const apptData = await apptRes.json()
  const unassignedApptCount = apptData.error ? 0 : (apptData.records || []).length
  // No verified duration field exists on Appointments yet — use a conservative default per job.
  const unassignedApptHours = unassignedApptCount * 1.5

  // 5. Compute free hours PER SQUAD (largest contiguous gap within that squad's day),
  //    then SUM across all relevant squads for that day — this reflects total real capacity,
  //    not just whichever single squad happens to be most free.
  let totalFreeHours = 0
  const perSquadDebug = []
  for (const sq of activeSquads) {
    const busy = (blocksBySquad[sq.id] || []).sort((a, b) => a[0] - b[0])
    let cursor = sq.startMin
    let squadFree = 0
    for (const [s, e] of busy) {
      if (s > cursor) squadFree += (s - cursor) / 60
      cursor = Math.max(cursor, e)
    }
    if (sq.endMin > cursor) squadFree += (sq.endMin - cursor) / 60
    totalFreeHours += squadFree
    perSquadDebug.push({ squadId: sq.id, startMin: sq.startMin, endMin: sq.endMin, busy, squadFree })
  }

  if (query.debug === '1') {
    const rawTotalCapacityHoursDbg = activeSquads.reduce((sum, s) => sum + (s.endMin - s.startMin) / 60, 0)
    return {
      debug: true,
      date,
      activeSquadsCount: activeSquads.length,
      activeSquadIds: activeSquads.map(s => s.id),
      blocksRawCount: (blocksData.records || []).length,
      blocksRaw: (blocksData.records || []).map(r => ({ squads: r.fields?.Squads, start: r.fields?.StartTime, end: r.fields?.EndTime, date: r.fields?.Date })),
      blocksBySquad,
      perSquadDebug,
      totalCapacityHours: Math.round(rawTotalCapacityHoursDbg * 10) / 10,
      usedHours: Math.round(Math.max(0, rawTotalCapacityHoursDbg - totalFreeHours) * 10) / 10,
      totalFreeHours,
      unassignedApptCount,
      unassignedApptHours,
    }
  }

  // 6. Apply route buffer, then subtract unassigned confirmed STR demand from total free capacity
  const bufferPct = (config.routeBufferPct || 0) / 100
  const residualHours = Math.max(0, totalFreeHours - unassignedApptHours) * (1 - bufferPct)

  const available = residualHours >= duration

  // 7. Suggested price — flex rate (residential jobs are scheduled outside prime time by policy)
  const rate = config.minRateFlex || 35
  const suggestedPrice = available ? Math.round(rate * duration) : null

  // totalFreeHours already nets out every squad block for the day (manual blocks AND
  // cleanings/appointments already dispatched to a squad) — it is NOT a "raw" number.
  // usedHours makes that subtraction visible instead of implicit, so the breakdown reads
  // as capacity → occupied → free, rather than looking like appointments were ignored.
  const rawTotalCapacityHours = activeSquads.reduce((sum, s) => sum + (s.endMin - s.startMin) / 60, 0)
  const totalCapacityHours = Math.round(rawTotalCapacityHours * 10) / 10
  const usedHours = Math.round(Math.max(0, rawTotalCapacityHours - totalFreeHours) * 10) / 10

  return {
    date,
    available,
    residualHours: Math.round(residualHours * 10) / 10,
    requestedHours: duration,
    suggestedPrice,
    ratePerHour: rate,
    reason: available ? null : 'Not enough free capacity that day',
    // Breakdown so the UI can show exactly how this number was calculated.
    // Reading order: totalCapacityHours (squad hours scheduled that day)
    //   − usedHours (already booked: manual blocks + cleanings/appointments dispatched to a squad)
    //   = totalFreeHours (open slots left in squads' calendars)
    //   − unassignedApptHours (Confirmed appointments NOT yet dispatched to any squad — future demand)
    //   × (1 − bufferPct) = residualHours
    breakdown: {
      totalCapacityHours,
      usedHours,
      totalFreeHours: Math.round(totalFreeHours * 10) / 10,
      unassignedApptCount,
      unassignedApptHours: Math.round(unassignedApptHours * 10) / 10,
      bufferPct: config.routeBufferPct || 0,
      perSquad: perSquadDebug.map(s => ({
        squadId: s.squadId,
        capacityHours: Math.round((s.endMin - s.startMin) / 60 * 10) / 10,
        freeHours: Math.round(s.squadFree * 10) / 10,
        blockedCount: s.busy.length,
      })),
    },
  }
}
