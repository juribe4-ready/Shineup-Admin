const CLOUDINARY_CLOUD  = 'dw93dwwrh'
const CLOUDINARY_KEY    = '458251832895334'
const CLOUDINARY_SECRET = '1dIQ_8wsDtI5bH6TmBwgLZ-19ng'

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
    const { publicIds } = await parseBody(req)
    if (!publicIds?.length) return res.status(400).json({ error: 'publicIds requerido' })

    const timestamp = Math.floor(Date.now() / 1000)
    const toSign = `public_ids[]=${publicIds.join('&public_ids[]=')}&timestamp=${timestamp}${CLOUDINARY_SECRET}`

    // Generate SHA1 signature
    const msgBuffer = new TextEncoder().encode(toSign)
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer)
    const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('')

    const body = new URLSearchParams()
    publicIds.forEach(id => body.append('public_ids[]', id))
    body.set('timestamp', timestamp.toString())
    body.set('api_key', CLOUDINARY_KEY)
    body.set('signature', signature)

    const r = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/resources/delete_by_ids`,
      { method: 'POST', body }
    )
    const data = await r.json()
    const deleted = Object.values(data.deleted || {}).filter(v => v === 'deleted').length

    return res.status(200).json({ deleted, raw: data })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
