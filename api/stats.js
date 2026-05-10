const AIRTABLE_BASE = 'appBwnoxgyIXILe6M';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

function getDateRange(period) {
  const now = new Date();
  const today = new Date(now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));
  let from;
  
  if (period === '7d') {
    from = new Date(today);
    from.setDate(from.getDate() - 7);
  } else if (period === '30d') {
    from = new Date(today);
    from.setDate(from.getDate() - 30);
  } else if (period === 'ytd') {
    from = new Date(today.getFullYear(), 0, 1);
  } else {
    from = new Date(today);
    from.setDate(from.getDate() - 7);
  }
  
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

async function fetchAllRecords(table, formula = null) {
  const headers = { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` };
  let all = [];
  let offset = null;
  
  do {
    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${table}?pageSize=100`;
    if (formula) url += `&filterByFormula=${encodeURIComponent(formula)}`;
    if (offset) url += `&offset=${offset}`;
    
    const res = await fetch(url, { headers });
    if (!res.ok) break;
    
    const data = await res.json();
    all = all.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);
  
  return all;
}

async function handleGetStats(req, res) {
  try {
    const { period = '7d' } = req.query;
    const { from, to } = getDateRange(period);
    
    console.log(`[stats] GET period: ${period}, from: ${from}, to: ${to}`);

    // Fetch cleanings in date range
    const formula = `AND({Date}>='${from}',{Date}<='${to}')`;
    const records = await fetchAllRecords('tblabOdNknnjrYUU1', formula);
    
    // Fetch all staff to get roles - SAME AS getDashboard.js
    const staffRecords = await fetchAllRecords('tblgHwN1wX6u3ZtNY');
    const staffMap = {};
    staffRecords.forEach(r => {
      staffMap[r.id] = {
        id: r.id,
        name: r.fields['Name'] || '',
        role: r.fields['Role'] || '',
        initials: r.fields['Initials'] || '',
      };
    });
    
    // Log staff roles for debugging
    console.log('[stats] Staff roles:', staffRecords.slice(0, 5).map(r => ({ 
      name: r.fields['Name'], 
      role: r.fields['Role'] 
    })));
    
    // Fetch properties for Labor data
    const propRecords = await fetchAllRecords('tbl1iETmcFP460oWN');
    const propDataMap = {};
    propRecords.forEach(r => {
      propDataMap[r.id] = {
        labor: Number(r.fields['Labor'] || 0),
      };
    });
    
    // Fetch incidents and inventory
    const incidentRecords = await fetchAllRecords('Incidents');
    const inventoryRecords = await fetchAllRecords('tblppdLDDnyT0eye9');

    // Process cleanings - SAME LOGIC AS getDashboard.js
    const cleanings = records.map(r => {
      const f = r.fields;
      
      const resolveRating = (r) => {
        if (!r) return null;
        const s = String(r).toLowerCase();
        if (s.includes('bueno')) return 3;
        if (s.includes('normal')) return 2;
        if (s.includes('malo')) return 1;
        return null;
      };
      
      // USE 'Assigned Staff' - SAME AS getDashboard.js line 119
      const staffIds = Array.isArray(f['Assigned Staff']) ? f['Assigned Staff'] : [];
      const staffList = staffIds.map(id => staffMap[id]).filter(Boolean);
      
      // Filter to cleaners only (role contains 'cleaner') - SAME AS getDashboard.js line 154-157
      const cleanerCount = staffIds.filter(id => {
        const s = staffMap[id];
        return s && (s.role || '').toLowerCase().includes('cleaner');
      }).length;
      
      const cleanerNames = staffList
        .filter(s => (s.role || '').toLowerCase().includes('cleaner'))
        .map(s => s.name)
        .join(', ');
      
      // Get labor from Property
      const propId = Array.isArray(f['Property']) ? f['Property'][0] : (f['Property'] || '');
      const propData = propDataMap[propId] || {};
      const labor = propData.labor || 0;
      
      const ratingVal = resolveRating(f['Rating']);
      
      // Calculate estimated end time - SAME AS getDashboard.js
      let estimatedEndTime = f['Estimated End Time'] || null;
      if (!estimatedEndTime && f['Scheduled Time'] && labor > 0) {
        const effectiveCleaners = Math.max(cleanerCount, 1);
        const minutesRaw = labor / effectiveCleaners;
        const minutesRounded = Math.ceil(minutesRaw / 15) * 15;
        const ratingAdj = ratingVal === 1 ? 30 : ratingVal === 3 ? -30 : 0;
        const totalMinutes = Math.max(minutesRounded + ratingAdj, 45);
        estimatedEndTime = new Date(new Date(f['Scheduled Time']).getTime() + totalMinutes * 60000).toISOString();
      }
      
      return {
        id: r.id,
        cleaningId: f['Cleaning ID'] || '',
        propertyText: f['Property Text'] || '',
        propertyId: propId,
        date: f['Date'] || '',
        status: f['Status'] || 'Programmed',
        scheduledTime: f['Scheduled Time'] || null,
        startTime: f['Start Time'] || null,
        endTime: f['End Time'] || null,
        estimatedEndTime,
        rating: ratingVal,
        staffListText: f['staffList'] || '',
        cleanerNames,
        cleanerCount,
        labor,
      };
    }).sort((a, b) => b.date.localeCompare(a.date));

    // Calculate summary
    const doneCleanings = cleanings.filter(c => c.status === 'Done');
    
    const ratings = doneCleanings.filter(c => c.rating).map(c => c.rating);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    
    const durations = doneCleanings.filter(c => c.startTime && c.endTime).map(c => {
      return (new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000;
    });
    const avgDurationMin = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    const totalDurationMin = durations.reduce((a, b) => a + b, 0);
    
    const onTimeChecks = doneCleanings.filter(c => c.scheduledTime && c.startTime);
    const onTimeCount = onTimeChecks.filter(c => {
      const diff = Math.abs(new Date(c.startTime).getTime() - new Date(c.scheduledTime).getTime());
      return diff <= 15 * 60000;
    }).length;
    const onTimeRate = onTimeChecks.length > 0 ? Math.round((onTimeCount / onTimeChecks.length) * 100) : null;
    
    const lateCleanings = onTimeChecks.filter(c => {
      return (new Date(c.startTime).getTime() - new Date(c.scheduledTime).getTime()) > 15 * 60000;
    });
    const lateStarts = lateCleanings.length;
    const totalLateMinutes = lateCleanings.reduce((sum, c) => {
      return sum + (new Date(c.startTime).getTime() - new Date(c.scheduledTime).getTime()) / 60000;
    }, 0);

    // By Property
    const propGroups = {};
    cleanings.forEach(c => {
      if (!c.propertyText) return;
      if (!propGroups[c.propertyText]) {
        propGroups[c.propertyText] = { cleanings: [], propertyId: c.propertyId };
      }
      propGroups[c.propertyText].cleanings.push(c);
    });
    
    const byProperty = Object.entries(propGroups).map(([propertyText, data]) => {
      const items = data.cleanings;
      const done = items.filter(i => i.status === 'Done');
      const propRatings = done.filter(i => i.rating).map(i => i.rating);
      const propDurations = done.filter(i => i.startTime && i.endTime).map(i => {
        return (new Date(i.endTime).getTime() - new Date(i.startTime).getTime()) / 60000;
      });
      
      const propIncidents = incidentRecords.filter(r => {
        const propIds = r.fields['Property'] || [];
        return propIds.includes(data.propertyId);
      }).length;
      
      const propInventory = inventoryRecords.filter(r => {
        const propIds = r.fields['Property'] || [];
        return propIds.includes(data.propertyId) && r.fields['Status'] !== 'Optimal';
      }).length;
      
      return {
        propertyText,
        propertyId: data.propertyId,
        total: items.length,
        avgRating: propRatings.length > 0 ? propRatings.reduce((a, b) => a + b, 0) / propRatings.length : null,
        avgDurationMin: propDurations.length > 0 ? Math.round(propDurations.reduce((a, b) => a + b, 0) / propDurations.length) : null,
        incidents: propIncidents,
        inventory: propInventory,
      };
    }).sort((a, b) => b.total - a.total);

    // Incidents summary
    const incidentCounts = {
      total: incidentRecords.length,
      open: incidentRecords.filter(r => r.fields['Status'] !== 'Closed').length,
      closed: incidentRecords.filter(r => r.fields['Status'] === 'Closed').length,
    };

    // Inventory summary
    const inventoryCounts = {
      total: inventoryRecords.length,
      low: inventoryRecords.filter(r => r.fields['Status'] === 'Low').length,
      outOfStock: inventoryRecords.filter(r => r.fields['Status'] === 'Out of Stock').length,
      optimal: inventoryRecords.filter(r => r.fields['Status'] === 'Optimal').length,
    };

    return res.status(200).json({
      cleanings,
      summary: {
        total: cleanings.length,
        done: doneCleanings.length,
        avgRating,
        avgDurationMin,
        totalDurationMin: Math.round(totalDurationMin),
        onTimeRate,
        lateStarts,
        totalLateMinutes: Math.round(totalLateMinutes),
      },
      byProperty,
      incidents: incidentCounts,
      inventory: inventoryCounts,
    });

  } catch (err) {
    console.error('[stats] GET Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function handleUpdateReport(req, res) {
  try {
    const { type, recordId, status, closeComment } = req.body;

    if (!type || !recordId || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let tableId = type === 'incident' ? 'Incidents' : 'tblppdLDDnyT0eye9';
    const fields = { Status: status };
    if (closeComment) fields.CloseComment = closeComment;

    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}/${recordId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: errorData.error?.message || 'Failed' });
    }

    const updated = await response.json();
    return res.status(200).json({ success: true, record: { id: updated.id, status: updated.fields.Status } });

  } catch (err) {
    console.error('[stats] POST Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return handleGetStats(req, res);
  if (req.method === 'POST') return handleUpdateReport(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}
