const AIRTABLE_BASE = 'appBwnoxgyIXILe6M';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/tblgHwN1wX6u3ZtNY?fields[]=Name&fields[]=Email&fields[]=Initials&fields[]=Role`;
    const airtableRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });
    if (!airtableRes.ok) return res.status(500).json({ error: 'Error Airtable' });
    const data = await airtableRes.json();
    const staff = (data.records || [])
      .map(r => ({
        id: r.id,
        name: r.fields?.Name || '',
        email: r.fields?.Email || '',
        initials: r.fields?.Initials || '',
        role: r.fields?.Role || '',
      }))
      .filter(s => s.name)
    return res.status(200).json(staff);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
