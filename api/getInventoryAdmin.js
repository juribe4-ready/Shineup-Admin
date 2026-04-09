const AIRTABLE_BASE  = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const STAFF_TABLE    = 'tblgHwN1wX6u3ZtNY'
const PROPS_TABLE    = 'tbl1iETmcFP460oWN'
const INV_TABLE      = 'tblppdLDDnyT0eye9'
const CLEANINGS_TABLE= 'tblabOdNknnjrYUU1'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const headers = { Authorization: `Bearer ${AIRTABLE_TOKEN}` }

    // Staff map
    const staffMap = {}
    try {
      const sr = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STAFF_TABLE}?fields[]=Name&fields[]=Initials`, { headers })
      if (sr.ok) { const sd = await sr.json(); for (const s of (sd.records||[])) staffMap[s.id] = s.fields?.Name || s.fields?.Initials || '?' }
    } catch {}

    // Property map
    const propMap = {}
    try {
      const pr = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROPS_TABLE}?fields[]=Name`, { headers })
      if (pr.ok) { const pd = await pr.json(); for (const p of (pd.records||[])) propMap[p.id] = p.fields?.Name || '?' }
    } catch {}

    // Latest StoragePhoto per property from Cleanings
    const storageMap = {} // propId → { url, date }
    try {
      const cr = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}?fields[]=Property&fields[]=StoragePhoto&fields[]=Scheduled%20Time&sort[0][field]=Scheduled%20Time&sort[0][direction]=desc`,
        { headers }
      )
      if (cr.ok) {
        const cd = await cr.json()
        for (const rec of (cd.records || [])) {
          const f = rec.fields
          const propId = Array.isArray(f['Property']) ? f['Property'][0] : f['Property']
          const raw = f['StoragePhoto'] || []
          const url = Array.isArray(raw) && raw[0]
            ? (raw[0].thumbnails?.large?.url || raw[0].url || null)
            : null
          if (propId && url && !storageMap[propId]) {
            storageMap[propId] = { url, date: (f['Scheduled Time'] || '').slice(0,10) }
          }
        }
      }
    } catch {}

    // Fetch all inventory (not optimal)
    const formula = encodeURIComponent(`NOT({Status}='Optimal')`)
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${INV_TABLE}?filterByFormula=${formula}&sort[0][field]=Date&sort[0][direction]=desc`,
      { headers }
    )
    if (!r.ok) throw new Error('Error Airtable Inventory')
    const data = await r.json()

    const records = (data.records || []).map(rec => {
      const f = rec.fields
      const propId = Array.isArray(f['Property']) ? f['Property'][0] : f['Property']
      const photos = f['Attachments'] || f['Photos'] || []
      return {
        id: rec.id,
        status: f['Status'] || 'Low',
        comment: f['Comment'] || f['Item'] || '',
        date: f['Date'] || null,
        propertyId: propId || null,
        propertyName: propMap[propId] || 'Sin propiedad',
        photoUrls: f['MediaURL'] ? [f['MediaURL']] : (Array.isArray(photos) ? photos.map(p=>p?.url).filter(Boolean) : []),
        reportedBy: Array.isArray(f['Reported By']) ? (staffMap[f['Reported By'][0]] || '') : (f['Reported By'] || ''),
        storagePhoto: storageMap[propId] || null,
      }
    })

    return res.status(200).json(records)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
