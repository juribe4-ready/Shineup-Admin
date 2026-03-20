const AIRTABLE_BASE = 'appBwnoxgyIXILe6M';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { date } = req.query;
    const effectiveDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    console.log(`[getDashboard] date: ${effectiveDate}`);

    // Fetch all cleanings
    let allRecords = [];
    let offset = null;
    do {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/tblabOdNknnjrYUU1?pageSize=100&sort[0][field]=Scheduled%20Time&sort[0][direction]=asc${offset ? `&offset=${offset}` : ''}`;
      const airtableRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      });
      if (!airtableRes.ok) throw new Error('Error Airtable');
      const pageData = await airtableRes.json();
      allRecords = allRecords.concat(pageData.records || []);
      offset = pageData.offset || null;
      const hasToday = allRecords.some(r => r.fields['Date']?.startsWith(effectiveDate));
      const hasFuture = allRecords.some(r => r.fields['Date'] > effectiveDate);
      if (hasToday && hasFuture) offset = null;
    } while (offset);

    const filtered = allRecords.filter(r => r.fields['Date']?.startsWith(effectiveDate));
    console.log(`[getDashboard] Cleanings para ${effectiveDate}: ${filtered.length}`);

    // Fetch staff for initials map
    const staffRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/tblgHwN1wX6u3ZtNY?fields[]=Name&fields[]=Initials&fields[]=Role`,
      { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
    );
    const staffData = await staffRes.json();
    const staffMap = {};
    for (const s of (staffData.records || [])) {
      staffMap[s.id] = {
        name: s.fields?.Name || '',
        initials: s.fields?.Initials || '',
        role: s.fields?.Role || '',
      };
    }

    // Build cleanings with geocoding
    const cleanings = await Promise.all(filtered.map(async record => {
      const f = record.fields;
      const addressRaw = f['Address'];
      const address = Array.isArray(addressRaw) ? addressRaw[0] : (addressRaw || '');
      const staffIds = Array.isArray(f['Assigned Staff']) ? f['Assigned Staff'] : [];
      const staffList = staffIds.map(id => staffMap[id] || { name: '?', initials: '?' });
      const staffListText = f['staffList'] || '';

      const frontView = f['FrontView'] || [];
      const thumbnail = Array.isArray(frontView) && frontView[0]
        ? frontView[0]?.thumbnails?.large?.url || frontView[0]?.url || null
        : null;

      return {
        id: record.id,
        cleaningId: f['Cleaning ID'] || '',
        propertyText: f['Property Text'] || '',
        address,
        status: f['Status'] || 'Programmed',
        scheduledTime: f['Scheduled Time'] || null,
        startTime: f['Start Time'] || null,
        endTime: f['End Time'] || null,
        staffList: staffList,
        staffListText,
        googleMapsUrl: Array.isArray(f['Google Maps URL']) ? f['Google Maps URL'][0] : f['Google Maps URL'] || '',
        thumbnail,
        coords,
        bookUrl: null,
      };
    }));

    // Group by staffListText for timeline
    const groups = {};
    for (const c of cleanings) {
      const key = c.staffListText || 'Sin asignar';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }

    const timeline = Object.entries(groups).map(([staffListText, items]) => ({
      staffListText,
      cleanings: items,
      total: items.length,
      done: items.filter(i => i.status === 'Done').length,
      inProgress: items.filter(i => i.status === 'In Progress').length,
      programmed: items.filter(i => i.status === 'Programmed' || i.status === 'Scheduled').length,
    })).sort((a, b) => b.total - a.total);

    const stats = {
      total: cleanings.length,
      done: cleanings.filter(c => c.status === 'Done').length,
      inProgress: cleanings.filter(c => c.status === 'In Progress').length,
      programmed: cleanings.filter(c => c.status === 'Programmed' || c.status === 'Scheduled').length,
      opened: cleanings.filter(c => c.status === 'Opened').length,
    };

    return res.status(200).json({ cleanings, timeline, stats, date: effectiveDate });
  } catch (err) {
    console.error('[getDashboard] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
