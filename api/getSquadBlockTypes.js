const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BLOCKS_TABLE = 'tblR9T67eyBrIi5Ny'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    // Fetch table schema to get Type field options
    const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE}/tables`
    const metaRes = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    })
    if (!metaRes.ok) throw new Error('Error fetching schema')
    const meta = await metaRes.json()

    const blocksTable = meta.tables?.find(t => t.id === BLOCKS_TABLE)
    const typeField = blocksTable?.fields?.find(f => f.name === 'Type')
    const options = typeField?.options?.choices?.map(c => c.name) || [
      'Appointment', 'Manual Block', 'STR', 'Holiday Block', 'Rest'
    ]

    return res.status(200).json({ types: options })
  } catch (err) {
    console.error('[getSquadBlockTypes] Error:', err)
    // Fallback to defaults
    return res.status(200).json({ types: ['Appointment', 'Manual Block', 'STR', 'Holiday Block', 'Rest'] })
  }
}
