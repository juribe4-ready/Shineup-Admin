const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const SQUADS_TABLE = 'tbl6CaYpYaZe1PY0s'
const BLOCKS_TABLE = 'tblR9T67eyBrIi5Ny'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { weekStart } = req.query
    if (!weekStart) return res.status(400).json({ error: 'weekStart requerido' })

    // Get week dates (Mon-Sun)
    const start = new Date(weekStart)
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d.toISOString().split('T')[0]
    })

    // Fetch squads
    const squadsRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${SQUADS_TABLE}?fields[]=Name&fields[]=Color&fields[]=Type&fields[]=Active`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    const squadsData = await squadsRes.json()
    const squads = (squadsData.records || [])
      .filter(r => r.fields?.Active)
      .map(r => ({
        id: r.id,
        name: r.fields?.Name || '',
        color: r.fields?.Color || '#94A3B8',
        type: r.fields?.Type || 'Weekday',
      }))

    // Fetch blocks for the week
    const dateFilter = dates.map(d => `{Date}='${d}'`).join(',')
    const formula = encodeURIComponent(`OR(${dateFilter})`)
    const blocksRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}?filterByFormula=${formula}&fields[]=Squads&fields[]=Date&fields[]=StartTime&fields[]=EndTime&fields[]=Type&fields[]=Appointment&fields[]=Notes`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    const blocksData = await blocksRes.json()
    console.log('[getSquads] Raw blocks count:', (blocksData.records || []).length)
    if (blocksData.records?.[0]) {
      console.log('[getSquads] Sample block fields:', JSON.stringify(blocksData.records[0].fields))
    }

    const blocks = (blocksData.records || []).map(r => ({
      id: r.id,
      squadId: Array.isArray(r.fields?.Squads) ? r.fields.Squads[0] : (r.fields?.Squads || null),
      date: r.fields?.Date || '',
      startTime: r.fields?.StartTime || '',
      endTime: r.fields?.EndTime || '',
      type: r.fields?.Type || 'Manual Block',
      appointmentId: Array.isArray(r.fields?.Appointment) ? r.fields.Appointment[0] : null,
      notes: r.fields?.Notes || '',
    }))

    console.log('[getSquads] Processed blocks:', blocks.map(b => ({ id: b.id, squadId: b.squadId, date: b.date })))

    return res.status(200).json({ squads, blocks, dates })
  } catch (err) {
    console.error('[getSquads] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
