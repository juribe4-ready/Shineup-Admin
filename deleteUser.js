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

    // Fetch Labor from Properties for all unique property IDs
    const propertyIds = [...new Set(filtered.map(r => {
      const p = r.fields['Property'];
      return Array.isArray(p) ? p[0] : p;
    }).filter(Boolean))];

    const propertyLaborMap = {};
    if (propertyIds.length > 0) {
      try {
        const propFormula = encodeURIComponent(`OR(${propertyIds.map(id => `RECORD_ID()='${id}'`).join(',')})`);
        const propRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/tbl1iETmcFP460oWN?filterByFormula=${propFormula}&fields[]=Labor`,
          { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
        );
        if (propRes.ok) {
          const propData = await propRes.json();
          for (const r of (propData.records || [])) {
            propertyLaborMap[r.id] = Number(r.fields?.Labor || 0);
          }
        }
      } catch (e) {
        console.error('[getDashboard] Property labor fetch error:', e.message);
      }
    }

    // Build cleanings with geocoding
    const cleanings = await Promise.all(filtered.map(async record => {
      const f = record.fields;
      const addressRaw = f['Address'];
      const address = Array.isArray(addressRaw) ? addressRaw[0] : (addressRaw || '');
      const staffIds = Array.isArray(f['Assigned Staff']) ? f['Assigned Staff'] : [];
      const staffList = staffIds.map(id => staffMap[id] || { name: '?', initials: '?' });
      const staffListText = f['staffList'] || '';

      const coords = null;
      const frontView = f['FrontView'] || [];
      const thumbnail = Array.isArray(frontView) && frontView[0]
        ? frontView[0]?.thumbnails?.large?.url || frontView[0]?.url || null
        : null;

      // Get Labor from Property record
      const propId = Array.isArray(f['Property']) ? f['Property'][0] : (f['Property'] || '');
      let labor = 0;
      if (propId && propertyLaborMap[propId] !== undefined) {
        labor = propertyLaborMap[propId];
      }
      const resolveRating = (r) => {
        if (!r) return undefined;
        const s = String(r).toLowerCase();
        if (s.includes('bueno')) return 3;
        if (s.includes('normal')) return 2;
        if (s.includes('malo')) return 1;
        return undefined;
      };
      const ratingVal = resolveRating(f['Rating']);
      let estimatedEndTime = null;
      if (labor > 0 && f['Scheduled Time']) {
        const cleanerCount = staffIds.filter(id => {
          const s = staffMap[id];
          return s && (s.role || '').toLowerCase().includes('cleaner');
        }).length;
        const effectiveCleaners = Math.max(cleanerCount, 1);
        const minutesRaw = labor / effectiveCleaners;
        const minutesRounded = Math.ceil(minutesRaw / 15) * 15;
        const ratingAdj = ratingVal === 1 ? 30 : ratingVal === 3 ? -30 : 0;
        const totalMinutes = Math.max(minutesRounded + ratingAdj, 45);
        estimatedEndTime = new Date(new Date(f['Scheduled Time']).getTime() + totalMinutes * 60000).toISOString();
      }

      // Media fields
      const videoInicialRaw = f['VideoInicial'] || [];
      const videoInicial = Array.isArray(videoInicialRaw)
        ? videoInicialRaw.filter(v => v && v.url).map(v => v.url) : [];

      const photosVideosRaw = f['Photos & Videos'] || [];
      const photosVideos = Array.isArray(photosVideosRaw)
        ? photosVideosRaw.filter(p => p && p.url).map(p => ({ url: p.url, filename: p.filename || '' })) : [];

      const storagePhotoRaw = f['StoragePhoto'] || [];
      const storagePhoto = Array.isArray(storagePhotoRaw) && storagePhotoRaw[0]
        ? (storagePhotoRaw[0].thumbnails && storagePhotoRaw[0].thumbnails.large
            ? storagePhotoRaw[0].thumbnails.large.url
            : storagePhotoRaw[0].url || null)
        : null;

      const openComments = f['OpenComments'] || '';

      return {
        id: record.id,
        cleaningId: f['Cleaning ID'] || '',
        propertyText: f['Property Text'] || '',
        propertyId: Array.isArray(f['Property']) ? f['Property'][0] : (f['Property'] || ''),
        address,
        status: f['Status'] || 'Programmed',
        scheduledTime: f['Scheduled Time'] || null,
        startTime: f['Start Time'] || null,
        endTime: f['End Time'] || null,
        estimatedEndTime,
        rating: ratingVal || null,
        staffList: staffList,
        staffListText,
        googleMapsUrl: Array.isArray(f['Google Maps URL']) ? f['Google Maps URL'][0] : f['Google Maps URL'] || '',
        thumbnail,
        coords,
        bookUrl: null,
        videoInicial,
        photosVideos,
        storagePhoto,
        openComments,
      };
    }));

    // Roles that represent actual cleaners (not support/admin)
    const CLEANER_ROLES = ['cleaner', 'cleaner wknd', 'cleaner en prueba'];
    const isCleanerRole = (role) => {
      if (!role) return false;
      const lower = role.toLowerCase().trim();
      return CLEANER_ROLES.some(cr => lower.includes(cr) || lower === cr);
    };

    // Group by staffListText for timeline - only groups that have at least one cleaner
    const groups = {};
    for (const c of cleanings) {
      // Check if this cleaning has at least one cleaner role
      const hasCleanerStaff = c.staffList.some(s => isCleanerRole(s.role));
      if (!hasCleanerStaff && c.staffList.length > 0) continue; // Skip non-cleaner groups
      
      const key = c.staffListText || 'Sin asignar';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }

    const timeline = Object.entries(groups).map(([staffListText, items]) => {
      // Calculate average rating for this group (only from Done cleanings with ratings)
      const doneWithRating = items.filter(i => i.status === 'Done' && i.rating);
      const avgRating = doneWithRating.length > 0 
        ? doneWithRating.reduce((sum, i) => sum + i.rating, 0) / doneWithRating.length 
        : null;

      // Calculate average duration (real time) for Done cleanings
      const doneWithTimes = items.filter(i => i.status === 'Done' && i.startTime && i.endTime);
      let avgDurationMin = null;
      let avgEstimatedMin = null;
      if (doneWithTimes.length > 0) {
        const totalRealMin = doneWithTimes.reduce((sum, i) => {
          const start = new Date(i.startTime).getTime();
          const end = new Date(i.endTime).getTime();
          return sum + (end - start) / 60000;
        }, 0);
        avgDurationMin = Math.round(totalRealMin / doneWithTimes.length);

        // Average estimated duration
        const withEstimated = doneWithTimes.filter(i => i.estimatedEndTime && i.scheduledTime);
        if (withEstimated.length > 0) {
          const totalEstMin = withEstimated.reduce((sum, i) => {
            const sched = new Date(i.scheduledTime).getTime();
            const est = new Date(i.estimatedEndTime).getTime();
            return sum + (est - sched) / 60000;
          }, 0);
          avgEstimatedMin = Math.round(totalEstMin / withEstimated.length);
        }
      }

      // Calculate on-time rate (started within 15 min of scheduled)
      const withScheduledAndStart = items.filter(i => i.scheduledTime && i.startTime);
      let onTimeRate = null;
      let lateCount = 0;
      if (withScheduledAndStart.length > 0) {
        const onTimeCount = withScheduledAndStart.filter(i => {
          const sched = new Date(i.scheduledTime).getTime();
          const start = new Date(i.startTime).getTime();
          const diffMin = (start - sched) / 60000;
          return diffMin <= 15; // 15 min grace period
        }).length;
        lateCount = withScheduledAndStart.length - onTimeCount;
        onTimeRate = Math.round((onTimeCount / withScheduledAndStart.length) * 100);
      }

      return {
        staffListText,
        cleanings: items,
        total: items.length,
        done: items.filter(i => i.status === 'Done').length,
        inProgress: items.filter(i => i.status === 'In Progress').length,
        programmed: items.filter(i => i.status === 'Programmed' || i.status === 'Scheduled').length,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        ratingCount: doneWithRating.length,
        avgDurationMin,
        avgEstimatedMin,
        onTimeRate,
        lateCount,
      };
    }).sort((a, b) => b.total - a.total);

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
