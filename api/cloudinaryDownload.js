const AIRTABLE_BASE   = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN  = process.env.AIRTABLE_TOKEN

// Build property name map from Airtable once per cold start
let propMap = null
async function getPropertyMap() {
  if (propMap) return propMap
  propMap = {}
  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/tbl1iETmcFP460oWN?fields[]=Name`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    if (r.ok) {
      const d = await r.json()
      for (const rec of (d.records || [])) {
        propMap[rec.id] = (rec.fields?.Name || 'Unknown').replace(/[^a-zA-Z0-9_\- ]/g,'').trim()
      }
    }
  } catch {}
  return propMap
}

// Build URL → { property, date, type } map from Cleanings
async function buildUrlMap(pMap) {
  const urlMap = {}
  try {
    let offset = null
    do {
      const params = `fields[]=Scheduled%20Time&fields[]=Property&fields[]=VideoInicial&fields[]=Photos%20%26%20Videos&fields[]=StoragePhoto${offset ? `&offset=${offset}` : ''}`
      const r = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/tblabOdNknnjrYUU1?${params}`,
        { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
      )
      if (!r.ok) break
      const d = await r.json()
      offset = d.offset || null

      for (const rec of (d.records || [])) {
        const f = rec.fields
        const propId = Array.isArray(f.Property) ? f.Property[0] : f.Property
        const propName = (pMap[propId] || 'SinPropiedad').replace(/\s+/g,'')
        const date = f['Scheduled Time'] ? f['Scheduled Time'].slice(0,10) : '0000-00-00'

        const addUrls = (attachments, type) => {
          if (!Array.isArray(attachments)) return
          attachments.forEach((a, i) => {
            if (a?.url) {
              // match by partial URL (Cloudinary public_id or filename)
              urlMap[a.url] = { propName, date, type, index: i + 1 }
            }
          })
        }
        addUrls(f['VideoInicial'], 'VideoInicial')
        addUrls(f['Photos & Videos'], 'Cierre')
        addUrls(f['StoragePhoto'], 'StoragePhoto')
      }
    } while (offset)
  } catch {}
  return urlMap
}

async function parseBody(req) {
  return new Promise(resolve => {
    if (req.body && typeof req.body === 'object') return resolve(req.body)
    if (req.body && typeof req.body === 'string') return resolve(JSON.parse(req.body))
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve({}) } })
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { url, publicId, weekKey, createdAt } = await parseBody(req)
    if (!url) return res.status(400).json({ error: 'url requerida' })

    // Try to find metadata in Airtable
    const pMap = await getPropertyMap()
    const urlMap = await buildUrlMap(pMap)

    // Try to match URL by checking if any stored URL contains the publicId
    let meta = null
    const pidParts = publicId?.split('/') || []
    const pidFilename = pidParts[pidParts.length - 1] || ''

    for (const [storedUrl, m] of Object.entries(urlMap)) {
      if (storedUrl.includes(pidFilename) || (pidFilename && storedUrl.includes(pidFilename.split('.')[0]))) {
        meta = m; break
      }
    }

    // Build filename
    const ext = publicId?.includes('.') ? publicId.split('.').pop() : (url.includes('.mp4') ? 'mp4' : 'jpg')
    let filename
    if (meta) {
      filename = `${meta.date}_${meta.propName}_${meta.type}_${String(meta.index).padStart(2,'0')}.${ext}`
    } else {
      const fallbackDate = createdAt ? createdAt.slice(0,10) : '0000-00-00'
      const shortId = pidFilename.slice(0,8)
      filename = `${fallbackDate}_Unknown_${shortId}.${ext}`
    }

    return res.status(200).json({
      filename,
      weekKey,
      url,
      meta: meta || null
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
