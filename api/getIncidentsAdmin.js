const AIRTABLE_BASE  = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const STAFF_TABLE    = 'tblgHwN1wX6u3ZtNY'
const PROPS_TABLE    = 'tbl1iETmcFP460oWN'

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

    // Fetch all incidents (not closed)
    const formula = encodeURIComponent(`NOT({Status}='Closed')`)
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/Incidents?filterByFormula=${formula}&sort[0][field]=Creation%20Date&sort[0][direction]=desc`,
      { headers }
    )
    if (!r.ok) throw new Error('Error Airtable Incidents')
    const data = await r.json()

    const incidents = (data.records || []).map(rec => {
      const f = rec.fields
      const propId = Array.isArray(f['Property']) ? f['Property'][0] : f['Property']
      return {
        id: rec.id,
        name: f['Name'] || 'Sin nombre',
        status: f['Status'] || 'Reported',
        creationDate: f['Creation Date'] || null,
        comment: f['Comment'] || '',
        propertyId: propId || null,
        propertyName: propMap[propId] || 'Sin propiedad',
        photoUrls: f['MediaURL'] ? [f['MediaURL']] : (Array.isArray(f['Photos']) ? f['Photos'].map(p=>p?.url).filter(Boolean) : []),
        reportedBy: Array.isArray(f['Reported By']) ? (staffMap[f['Reported By'][0]] || '') : (f['Reported By'] || ''),
      }
    })

    return res.status(200).json(incidents)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
