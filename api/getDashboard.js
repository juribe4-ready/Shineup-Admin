const AIRTABLE_BASE = 'appBwnoxgyIXILe6M';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

// Extraer coordenadas de Google Maps URL
function extractCoordsFromGoogleUrl(url) {
  if (!url) return null;
  try {
    // Formato: https://www.google.com/maps?q=39.9612,-82.9988
    // O: https://www.google.com/maps/place/.../@39.9612,-82.9988,17z
    // O: https://maps.google.com/?q=39.9612,-82.9988
    
    // Try ?q= format first
    const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) {
      return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    }
    
    // Try /@lat,lng format
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) {
      return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }
    
    // Try /place/lat,lng format
    const placeMatch = url.match(/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (placeMatch) {
      return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
    }
    
    return null;
  } catch {
    return null;
  }
}

// Parsear URLs de campo de texto (separadas por newline)
function parseUrlsField(field) {
  if (!field) return [];
  return field.split('\n').map(u => u.trim()).filter(Boolean);
}

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

    const propertyDataMap = {};  // { id: { labor, lat, lng } }
    if (propertyIds.length > 0) {
      try {
        const propFormula = encodeURIComponent(`OR(${propertyIds.map(id => `RECORD_ID()='${id}'`).join(',')})`);
        const propRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/tbl1iETmcFP460oWN?filterByFormula=${propFormula}&fields[]=Labor&fields[]=Latitude&fields[]=Longitude`,
          { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
        );
        if (propRes.ok) {
          const propData = await propRes.json();
          for (const r of (propData.records || [])) {
            propertyDataMap[r.id] = {
              labor: Number(r.fields?.Labor || 0),
              lat: r.fields?.Latitude || null,
              lng: r.fields?.Longitude || null,
            };
          }
        }
      } catch (e) {
        console.error('[getDashboard] Property data fetch error:', e.message);
      }
    }

    // Build cleanings
    const cleanings = filtered.map(record => {
      const f = record.fields;
      const addressRaw = f['Address'];
      const address = Array.isArray(addressRaw) ? addressRaw[0] : (addressRaw || '');
      const staffIds = Array.isArray(f['Assigned Staff']) ? f['Assigned Staff'] : [];
      const staffList = staffIds.map(id => staffMap[id] || { name: '?', initials: '?' });
      const staffListText = f['staffList'] || '';

      // Extract coords from Google Maps URL OR from Property Lat/Lng
      const googleMapsUrl = Array.isArray(f['Google Maps URL']) ? f['Google Maps URL'][0] : (f['Google Maps URL'] || '');
      let coords = extractCoordsFromGoogleUrl(googleMapsUrl);
      
      // Fallback: use Latitude/Longitude from Properties table
      const propId = Array.isArray(f['Property']) ? f['Property'][0] : (f['Property'] || '');
      const propData = propertyDataMap[propId] || {};
      if (!coords && propData.lat && propData.lng) {
        coords = { lat: propData.lat, lng: propData.lng };
      }

      const frontView = f['FrontView'] || [];
      const thumbnail = Array.isArray(frontView) && frontView[0]
        ? frontView[0]?.thumbnails?.large?.url || frontView[0]?.url || null
        : null;

      // Get Labor from Property record
      let labor = propData.labor || 0;

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

      // VIDEO INICIAL - Leer de campo texto VideoInicialURLs, fallback a attachment
      let videoInicial = parseUrlsField(f['VideoInicialURLs']);
      if (videoInicial.length === 0) {
        const videoInicialRaw = f['VideoInicial'] || [];
        videoInicial = Array.isArray(videoInicialRaw)
          ? videoInicialRaw.filter(v => v && v.url).map(v => v.url) : [];
      }

      // CLOSING MEDIA - Leer de campo texto ClosingMediaURLs, fallback a attachment
      let photosVideos = parseUrlsField(f['ClosingMediaURLs']).map(url => ({ url, filename: 'archivo' }));
      if (photosVideos.length === 0) {
        const photosVideosRaw = f['Photos & Videos'] || [];
        photosVideos = Array.isArray(photosVideosRaw)
          ? photosVideosRaw.filter(p => p && p.url).map(p => ({ url: p.url, filename: p.filename || '' })) : [];
      }

      // STORAGE PHOTO - Leer de campo texto StoragePhotoURL, fallback a attachment
      let storagePhoto = f['StoragePhotoURL'] || null;
      if (!storagePhoto) {
        const storagePhotoRaw = f['StoragePhoto'] || [];
        storagePhoto = Array.isArray(storagePhotoRaw) && storagePhotoRaw[0]
          ? (storagePhotoRaw[0].thumbnails?.large?.url || storagePhotoRaw[0].url || null)
          : null;
      }

      const openComments = f['OpenComments'] || '';

      return {
        id: record.id,
        cleaningId: f['Cleaning ID'] || '',
        propertyText: f['Property Text'] || '',
        propertyId: propId,
        address,
        status: f['Status'] || 'Programmed',
        scheduledTime: f['Scheduled Time'] || null,
        startTime: f['Start Time'] || null,
        endTime: f['End Time'] || null,
        estimatedEndTime,
        rating: ratingVal,
        labor,
        staffList,
        staffListText,
        googleMapsUrl,
        thumbnail,
        coords,
        bookUrl: null,
        videoInicial,
        photosVideos,
        storagePhoto,
        openComments,
      };
    });

    // Group by staffListText for timeline with metrics
    const groups = {};
    for (const c of cleanings) {
      const key = c.staffListText || 'Sin asignar';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }

    const timeline = Object.entries(groups).map(([staffListText, items]) => {
      // Calculate average rating for Done cleanings
      const doneWithRating = items.filter(i => i.status === 'Done' && i.rating);
      const avgRating = doneWithRating.length > 0
        ? doneWithRating.reduce((sum, i) => sum + i.rating, 0) / doneWithRating.length
        : null;

      // Calculate average duration for Done cleanings
      const doneWithTimes = items.filter(i => i.status === 'Done' && i.startTime && i.endTime);
      let avgDurationMin = null;
      if (doneWithTimes.length > 0) {
        const totalMin = doneWithTimes.reduce((sum, i) => {
          const start = new Date(i.startTime).getTime();
          const end = new Date(i.endTime).getTime();
          return sum + (end - start) / 60000;
        }, 0);
        avgDurationMin = Math.round(totalMin / doneWithTimes.length);
      }

      // Calculate on-time rate (started within 15 min of scheduled)
      const doneWithScheduled = items.filter(i => i.status === 'Done' && i.scheduledTime && i.startTime);
      let onTimeRate = null;
      if (doneWithScheduled.length > 0) {
        const onTime = doneWithScheduled.filter(i => {
          const scheduled = new Date(i.scheduledTime).getTime();
          const started = new Date(i.startTime).getTime();
          return Math.abs(started - scheduled) <= 15 * 60000; // 15 min tolerance
        }).length;
        onTimeRate = Math.round((onTime / doneWithScheduled.length) * 100);
      }

      // Get cleanerStaff (staff with cleaner role) from first cleaning
      const firstCleaning = items[0];
      const cleanerStaff = firstCleaning?.staffList?.filter(s => 
        s.role?.toLowerCase().includes('cleaner')
      ) || [];

      return {
        staffListText,
        cleanerStaff,
        cleanings: items,
        total: items.length,
        done: items.filter(i => i.status === 'Done').length,
        inProgress: items.filter(i => i.status === 'In Progress').length,
        opened: items.filter(i => i.status === 'Opened').length,
        programmed: items.filter(i => i.status === 'Programmed' || i.status === 'Scheduled').length,
        avgRating,
        avgDurationMin,
        onTimeRate,
      };
    }).sort((a, b) => b.total - a.total);

    const stats = {
      total: cleanings.length,
      done: cleanings.filter(c => c.status === 'Done').length,
      inProgress: cleanings.filter(c => c.status === 'In Progress').length,
      programmed: cleanings.filter(c => c.status === 'Programmed' || c.status === 'Scheduled').length,
      opened: cleanings.filter(c => c.status === 'Opened').length,
    };

    // Global metrics
    const doneCleanings = cleanings.filter(c => c.status === 'Done');
    const globalMetrics = {
      avgRating: doneCleanings.filter(c => c.rating).length > 0
        ? (doneCleanings.filter(c => c.rating).reduce((s, c) => s + c.rating, 0) / doneCleanings.filter(c => c.rating).length).toFixed(1)
        : null,
      avgDurationMin: doneCleanings.filter(c => c.startTime && c.endTime).length > 0
        ? Math.round(doneCleanings.filter(c => c.startTime && c.endTime).reduce((s, c) => {
            return s + (new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000;
          }, 0) / doneCleanings.filter(c => c.startTime && c.endTime).length)
        : null,
      onTimeRate: doneCleanings.filter(c => c.scheduledTime && c.startTime).length > 0
        ? Math.round(doneCleanings.filter(c => c.scheduledTime && c.startTime).filter(c => {
            return Math.abs(new Date(c.startTime).getTime() - new Date(c.scheduledTime).getTime()) <= 15 * 60000;
          }).length / doneCleanings.filter(c => c.scheduledTime && c.startTime).length * 100)
        : null,
      completionRate: cleanings.length > 0 ? Math.round((stats.done / cleanings.length) * 100) : 0,
    };

    return res.status(200).json({ cleanings, timeline, stats, globalMetrics, date: effectiveDate });
  } catch (err) {
    console.error('[getDashboard] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
