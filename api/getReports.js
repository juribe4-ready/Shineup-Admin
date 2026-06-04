// Consolidated reports API: /api/getReports?type=incidents|inventory
const AIRTABLE_BASE  = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const STAFF_TABLE    = 'tblgHwN1wX6u3ZtNY'
const PROPS_TABLE    = 'tbl1iETmcFP460oWN'
const INV_TABLE      = 'tblppdLDDnyT0eye9'
const CLEANINGS_TABLE= 'tblabOdNknnjrYUU1'
const APPOINTMENTS_TABLE = 'tblXlpg7MuYWA8Ocn'

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

  const formula = encodeURIComponent(`OR({Status}='Done',{Status}='In Progress',{Status}='Opened')`)

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

  // Resolve Client Name and Source from Appointments via Related Cleaning Job
  const cleaningIds = allRecords.map(r => r.id)
  const apptMap = {}
  try {
    if (cleaningIds.length > 0) {
      const chunks = []
      for (let i = 0; i < cleaningIds.length; i += 10) chunks.push(cleaningIds.slice(i, i + 10))
      for (const chunk of chunks) {
        const formula2 = encodeURIComponent(`OR(${chunk.map(id => `FIND("${id}", ARRAYJOIN({Related Cleaning Job}))`).join(',')})`)
        const apptUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${APPOINTMENTS_TABLE}?filterByFormula=${formula2}&fields[]=Client%20Name&fields[]=Online%20Platform%20Source&fields[]=Related%20Cleaning%20Job`
        const ar = await fetch(apptUrl, { headers })
        if (ar.ok) {
          const ad = await ar.json()
          for (const appt of (ad.records || [])) {
            const relIds = appt.fields?.['Related Cleaning Job'] || []
            const clientName = Array.isArray(appt.fields?.['Client Name'])
              ? appt.fields['Client Name'][0]
              : (appt.fields?.['Client Name'] || null)
            const source = appt.fields?.['Online Platform Source'] || null
            for (const cid of relIds) {
              apptMap[cid] = { clientName, source }
            }
          }
        }
      }
    }
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
    // Only default to 'unpaid' when cleaning is Done — in-progress ones have no payment status yet
    const payStatus  = f['Payment Status'] || (status === 'Done' ? 'unpaid' : null)
    return {
      id: rec.id, date: f['Date'] || null,
      property: f['Property Text'] || 'Sin propiedad',
      clientName: apptMap[rec.id]?.clientName || (Array.isArray(f['Client Name']) ? f['Client Name'][0] : (f['Client Name'] || null)),
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
    return res.status(400).json({ error: `Unknown type: ${type}` })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
