const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BLOCKS_TABLE = 'tblR9T67eyBrIi5Ny'

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

    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${BLOCKS_TABLE}/${blockId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
      }
    )
    if (!airtableRes.ok) throw new Error('Error al eliminar')
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[deleteSquadBlock] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
