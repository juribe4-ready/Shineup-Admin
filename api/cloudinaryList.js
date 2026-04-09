const CLOUDINARY_CLOUD  = 'dw93dwwrh'
const CLOUDINARY_KEY    = '458251832895334'
const CLOUDINARY_SECRET = '1dIQ_8wsDtI5bH6TmBwgLZ-19ng'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    let all = []
    let nextCursor = null

    do {
      const params = new URLSearchParams({ max_results: '500', resource_type: 'auto' })
      if (nextCursor) params.set('next_cursor', nextCursor)

      const auth = Buffer.from(`${CLOUDINARY_KEY}:${CLOUDINARY_SECRET}`).toString('base64')
      const r = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/resources/upload?${params}`,
        { headers: { Authorization: `Basic ${auth}` } }
      )
      if (!r.ok) throw new Error(`Cloudinary error ${r.status}`)
      const data = await r.json()
      all = all.concat(data.resources || [])
      nextCursor = data.next_cursor || null
    } while (nextCursor)

    return res.status(200).json({ resources: all, total: all.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
