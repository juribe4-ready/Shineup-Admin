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

// GET: Fetch statistics
async function handleGetStats(req, res) {
  try {
    const { period = '7d' } = req.query;
    const { from, to } = getDateRange(period);
    
    console.log(`[stats] GET period: ${period}, from: ${from}, to: ${to}`);

    // Fetch cleanings in date range
    const formula = `AND({Date}>='${from}',{Date}<='${to}')`;
    const records = await fetchAllRecords('tblabOdNknnjrYUU1', formula);
    
    // Fetch all incidents
    const incidentRecords = await fetchAllRecords('Incidents');
    
    // Fetch all inventory
    const inventoryRecords = await fetchAllRecords('tblppdLDDnyT0eye9');

    // Process cleanings
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
      
      return {
        id: r.id,
        cleaningId: f['Cleaning ID'] || '',
        propertyText: f['Property Text'] || '',
        propertyId: Array.isArray(f['Property']) ? f['Property'][0] : (f['Property'] || ''),
        date: f['Date'] || '',
        status: f['Status'] || 'Programmed',
        scheduledTime: f['Scheduled Time'] || null,
        startTime: f['Start Time'] || null,
        endTime: f['End Time'] || null,
        estimatedEndTime: f['Estimated End Time'] || null,
        rating: resolveRating(f['Rating']),
        staffListText: f['staffList'] || '',
        labor: Number(f['Labor'] || 0),
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
    
    const onTimeChecks = doneCleanings.filter(c => c.scheduledTime && c.startTime);
    const onTimeCount = onTimeChecks.filter(c => {
      const diff = Math.abs(new Date(c.startTime).getTime() - new Date(c.scheduledTime).getTime());
      return diff <= 15 * 60000;
    }).length;
    const onTimeRate = onTimeChecks.length > 0 ? Math.round((onTimeCount / onTimeChecks.length) * 100) : null;
    
    const lateStarts = onTimeChecks.filter(c => {
      return (new Date(c.startTime).getTime() - new Date(c.scheduledTime).getTime()) > 15 * 60000;
    }).length;
    
    // Overtime: actual duration > estimated duration + 15 min
    const overtime = doneCleanings.filter(c => c.startTime && c.endTime && c.estimatedEndTime).filter(c => {
      const actualEnd = new Date(c.endTime).getTime();
      const estimatedEnd = new Date(c.estimatedEndTime).getTime();
      return actualEnd > estimatedEnd + 15 * 60000;
    }).length;

    // By Team
    const teamGroups = {};
    cleanings.forEach(c => {
      const team = c.staffListText || 'Sin asignar';
      if (!teamGroups[team]) teamGroups[team] = [];
      teamGroups[team].push(c);
    });
    
    const byTeam = Object.entries(teamGroups).map(([staffListText, items]) => {
      const done = items.filter(i => i.status === 'Done');
      const teamRatings = done.filter(i => i.rating).map(i => i.rating);
      const teamDurations = done.filter(i => i.startTime && i.endTime).map(i => {
        return (new Date(i.endTime).getTime() - new Date(i.startTime).getTime()) / 60000;
      });
      const teamOnTime = done.filter(i => i.scheduledTime && i.startTime);
      const teamOnTimeCount = teamOnTime.filter(i => {
        const diff = Math.abs(new Date(i.startTime).getTime() - new Date(i.scheduledTime).getTime());
        return diff <= 15 * 60000;
      }).length;
      
      // Efficiency: estimated vs actual (100% = on time, >100% = faster)
      const withBoth = done.filter(i => i.startTime && i.endTime && i.labor > 0);
      let efficiencyRate = null;
      if (withBoth.length > 0) {
        const totalEstimated = withBoth.reduce((s, i) => s + i.labor, 0);
        const totalActual = withBoth.reduce((s, i) => {
          return s + (new Date(i.endTime).getTime() - new Date(i.startTime).getTime()) / 60000;
        }, 0);
        if (totalActual > 0) {
          efficiencyRate = Math.round((totalEstimated / totalActual) * 100);
        }
      }
      
      return {
        staffListText,
        total: items.length,
        done: done.length,
        avgRating: teamRatings.length > 0 ? teamRatings.reduce((a, b) => a + b, 0) / teamRatings.length : null,
        avgDurationMin: teamDurations.length > 0 ? Math.round(teamDurations.reduce((a, b) => a + b, 0) / teamDurations.length) : null,
        onTimeRate: teamOnTime.length > 0 ? Math.round((teamOnTimeCount / teamOnTime.length) * 100) : null,
        efficiencyRate,
      };
    }).sort((a, b) => {
      // Sort by efficiency, then by avgRating
      if (b.efficiencyRate !== null && a.efficiencyRate !== null) {
        return b.efficiencyRate - a.efficiencyRate;
      }
      if (b.avgRating !== null && a.avgRating !== null) {
        return b.avgRating - a.avgRating;
      }
      return b.done - a.done;
    });

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
      
      // Count incidents for this property
      const propIncidents = incidentRecords.filter(r => {
        const propIds = r.fields['Property'] || [];
        return propIds.includes(data.propertyId);
      }).length;
      
      // Count inventory issues for this property
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
        onTimeRate,
        efficiencyRate: null,
        lateStarts,
        overtime,
      },
      byTeam,
      byProperty,
      incidents: incidentCounts,
      inventory: inventoryCounts,
    });

  } catch (err) {
    console.error('[stats] GET Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST: Update report status
async function handleUpdateReport(req, res) {
  try {
    const { type, recordId, status, closeComment } = req.body;

    if (!type || !recordId || !status) {
      return res.status(400).json({ error: 'Missing required fields: type, recordId, status' });
    }

    // Determine table based on type
    let tableId;
    if (type === 'incident') {
      tableId = 'Incidents';
    } else if (type === 'inventory') {
      tableId = 'tblppdLDDnyT0eye9';
    } else {
      return res.status(400).json({ error: 'Invalid type. Must be "incident" or "inventory"' });
    }

    // Build fields to update
    const fields = { Status: status };
    
    // Add CloseComment if provided and status is closed/optimal
    if (closeComment && (status === 'Closed' || status === 'Optimal')) {
      fields.CloseComment = closeComment;
    }

    console.log(`[stats] POST type=${type}, recordId=${recordId}, status=${status}`);

    // Update the record in Airtable
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
      console.error('[stats] POST Airtable error:', errorData);
      return res.status(response.status).json({ error: errorData.error?.message || 'Failed to update record' });
    }

    const updatedRecord = await response.json();
    
    return res.status(200).json({
      success: true,
      record: {
        id: updatedRecord.id,
        status: updatedRecord.fields.Status,
        closeComment: updatedRecord.fields.CloseComment || null,
      },
    });

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

  if (req.method === 'GET') {
    return handleGetStats(req, res);
  } else if (req.method === 'POST') {
    return handleUpdateReport(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
