// Consolidated Cloudinary API: /api/cloudinary?action=list|delete|download
const CLOUDINARY_CLOUD  = 'dw93dwwrh'
const CLOUDINARY_KEY    = '458251832895334'
const CLOUDINARY_SECRET = '1dIQ_8wsDtI5bH6TmBwgLZ-19ng'
const AIRTABLE_BASE     = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN_ENV = process.env.AIRTABLE_TOKEN

async function parseBody(req) {
  return new Promise(resolve => {
    if (req.body && typeof req.body === 'object') return resolve(req.body)
    if (req.body && typeof req.body === 'string') return resolve(JSON.parse(req.body))
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve({}) } })
  })
}

async function handleList(req, res) {
  let all = [], nextCursor = null
  const auth = Buffer.from(`${CLOUDINARY_KEY}:${CLOUDINARY_SECRET}`).toString('base64')
  for (const rtype of ['image', 'video']) {
    nextCursor = null
    do {
      // resource_type must be in the URL path, not as query param
      let url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/resources/${rtype}/upload?max_results=500`
      if (nextCursor) url += `&next_cursor=${encodeURIComponent(nextCursor)}`
      const r = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
      if (!r.ok) {
        const err = await r.text()
        console.error(`[cloudinaryList] ${rtype} error ${r.status}:`, err)
        break
      }
      const data = await r.json()
      all = all.concat(data.resources || [])
      nextCursor = data.next_cursor || null
    } while (nextCursor)
  }
  return res.status(200).json({ resources: all, total: all.length })
}

async function handleDelete(body, res) {
  const { publicIds } = body
  if (!publicIds?.length) return res.status(400).json({ error: 'publicIds requerido' })
  const timestamp = Math.floor(Date.now() / 1000)
  const toSign = `public_ids[]=${publicIds.join('&public_ids[]=')}×tamp=${timestamp}${CLOUDINARY_SECRET}`
  const msgBuffer = new TextEncoder().encode(toSign)
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer)
  const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('')
  const formBody = new URLSearchParams()
  publicIds.forEach(id => formBody.append('public_ids[]', id))
  formBody.set('timestamp', timestamp.toString())
  formBody.set('api_key', CLOUDINARY_KEY)
  formBody.set('signature', signature)
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/resources/delete_by_ids`, { method: 'POST', body: formBody })
  const data = await r.json()
  const deleted = Object.values(data.deleted || {}).filter(v => v === 'deleted').length
  return res.status(200).json({ deleted, raw: data })
}

async function handleDownload(body, res) {
  const { url, publicId, weekKey, createdAt } = body
  if (!url) return res.status(400).json({ error: 'url requerida' })

  // Build property map
  const pMap = {}
  try {
    const pr = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/tbl1iETmcFP460oWN?fields[]=Name`, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN_ENV}` } })
    if (pr.ok) { const pd = await pr.json(); for (const r of (pd.records||[])) pMap[r.id] = (r.fields?.Name||'Unknown').replace(/[^a-zA-Z0-9_\- ]/g,'').trim() }
  } catch {}

  // Build URL map from Cleanings
  const urlMap = {}
  try {
    let offset = null
    do {
      const offsetParam = offset ? `&offset=${offset}` : ''
      const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/tblabOdNknnjrYUU1?fields[]=Scheduled%20Time&fields[]=Property&fields[]=VideoInicial&fields[]=Photos%20%26%20Videos&fields[]=StoragePhoto${offsetParam}`, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN_ENV}` } })
      if (!r.ok) break
      const d = await r.json()
      offset = d.offset || null
      for (const rec of (d.records||[])) {
        const f = rec.fields
        const propId = Array.isArray(f.Property) ? f.Property[0] : f.Property
        const propName = (pMap[propId]||'SinPropiedad').replace(/\s+/g,'')
        const date = (f['Scheduled Time']||'').slice(0,10) || '0000-00-00'
        const addUrls = (atts, type) => {
          if (!Array.isArray(atts)) return
          atts.forEach((a,i) => { if (a?.url) { const parts = a.url.split('/'); const fn = parts[parts.length-1]; urlMap[fn.split('?')[0]] = { propName, date, type, index: i+1 } } })
        }
        addUrls(f['VideoInicial'], 'VideoInicial')
        addUrls(f['Photos & Videos'], 'Cierre')
        addUrls(f['StoragePhoto'], 'StoragePhoto')
      }
    } while (offset)
  } catch {}

  const pidParts = (publicId||'').split('/'); const pidFilename = pidParts[pidParts.length-1]||''
  let meta = null
  for (const [key, val] of Object.entries(urlMap)) {
    if (pidFilename.includes(key) || key.includes(pidFilename.split('.')[0])) { meta = val; break }
  }
  const ext = (publicId||'').includes('.') ? publicId.split('.').pop() : (url.includes('.mp4')?'mp4':'jpg')
  const filename = meta
    ? `${meta.date}_${meta.propName}_${meta.type}_${String(meta.index).padStart(2,'0')}.${ext}`
    : `${(createdAt||'').slice(0,10)||'0000-00-00'}_Unknown_${pidFilename.slice(0,8)}.${ext}`

  return res.status(200).json({ filename, weekKey, url, meta: meta||null })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const action = req.query?.action || (req.method === 'GET' ? 'list' : null)
    const body = req.method !== 'GET' ? await parseBody(req) : {}
    const act = action || body.action

    if (act === 'list') return handleList(req, res)
    if (act === 'delete') return handleDelete(body, res)
    if (act === 'download') return handleDownload(body, res)
    return res.status(400).json({ error: `Unknown action: ${act}` })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
