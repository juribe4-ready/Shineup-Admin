const AIRTABLE_BASE = 'appBwnoxgyIXILe6M';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

// Calcular número de semana ISO
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

// Obtener rango de fechas para una semana (Lunes a Domingo)
function getWeekRange(weekStr) {
  // weekStr format: "2026-W22"
  const [year, weekPart] = weekStr.split('-W');
  const weekNum = parseInt(weekPart);
  
  // Método más simple y confiable:
  // Encontrar el 4 de enero (siempre está en la semana 1 ISO)
  const jan4 = new Date(parseInt(year), 0, 4);
  // Retroceder al lunes de esa semana
  const dayOfWeek = jan4.getDay() || 7; // 1=Mon, 7=Sun
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (dayOfWeek - 1));
  
  // Calcular el lunes de la semana deseada
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (weekNum - 1) * 7);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
}

// Handler para métricas ejecutivas semanales
async function handleExecutive(req, res) {
  try {
    const { week, compareWeek } = req.query;
    
    // Semana actual por defecto
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const currentWeek = week || getWeekNumber(today);
    const prevWeekNum = parseInt(currentWeek.split('-W')[1]) - 1;
    const prevWeek = compareWeek || `${currentWeek.split('-W')[0]}-W${prevWeekNum.toString().padStart(2, '0')}`;
    
    console.log(`[Executive] Current: ${currentWeek}, Compare: ${prevWeek}`);
    
    // Fetch all cleanings (necesitamos varias semanas para comparar)
    let allRecords = [];
    let offset = null;
    do {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/tblabOdNknnjrYUU1?pageSize=100${offset ? `&offset=${offset}` : ''}`;
      const airtableRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      });
      if (!airtableRes.ok) throw new Error('Error Airtable');
      const pageData = await airtableRes.json();
      allRecords = allRecords.concat(pageData.records || []);
      offset = pageData.offset || null;
    } while (offset);
    
    // Fetch staff para contar cleaners
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
    
    // Calcular métricas para una semana
    const calculateWeekMetrics = (records, weekStr) => {
      const range = getWeekRange(weekStr);
      console.log(`[Executive] Week ${weekStr}: ${range.start} to ${range.end}`);
      
      const weekCleanings = records.filter(r => {
        const date = r.fields['Date'];
        return date && date >= range.start && date <= range.end;
      });
      
      console.log(`[Executive] Week ${weekStr}: ${weekCleanings.length} cleanings found`);
      
      // HH Programadas (Labor en minutos → horas)
      const hhProgramadas = weekCleanings.reduce((sum, r) => {
        const labor = r.fields['Labor (from Property)'];
        const laborVal = Array.isArray(labor) ? labor[0] : labor;
        return sum + (Number(laborVal) || 0);
      }, 0) / 60;
      
      // HH Reales (duración de Done, dividida por cleaners para obtener HH individuales)
      const doneCleanings = weekCleanings.filter(r => r.fields['Status'] === 'Done');
      let hhReales = 0;
      for (const r of doneCleanings) {
        const start = r.fields['Start Time'];
        const end = r.fields['End Time'];
        if (start && end) {
          const duration = (new Date(end) - new Date(start)) / 3600000; // horas
          // Multiplicar por número de cleaners asignados (HH = horas × personas)
          const staffIds = r.fields['Assigned Staff'] || [];
          const cleanerCount = staffIds.filter(id => {
            const staff = staffMap[id];
            return staff && staff.role?.toLowerCase().includes('cleaner');
          }).length;
          const effectiveCleaners = Math.max(cleanerCount, 1);
          hhReales += duration * effectiveCleaners;
        }
      }
      
      // Casas distintas
      const propertyIds = new Set();
      for (const r of weekCleanings) {
        const prop = r.fields['Property'];
        const propId = Array.isArray(prop) ? prop[0] : prop;
        if (propId) propertyIds.add(propId);
      }
      const casasDistintas = propertyIds.size;
      
      // Limpiezas
      const limpiezasTotal = weekCleanings.length;
      const limpiezasDone = doneCleanings.length;
      
      // Cleaners únicos (solo con rol cleaner)
      const cleanerIds = new Set();
      for (const r of weekCleanings) {
        const staffIds = r.fields['Assigned Staff'] || [];
        for (const id of staffIds) {
          const staff = staffMap[id];
          if (staff && staff.role?.toLowerCase().includes('cleaner')) {
            cleanerIds.add(id);
          }
        }
      }
      const cleanersUnicos = cleanerIds.size;
      
      // Métricas derivadas
      const hhPromCasa = limpiezasDone > 0 ? hhReales / limpiezasDone : 0;
      const limpiezasPorCasa = casasDistintas > 0 ? limpiezasTotal / casasDistintas : 0;
      
      // Velocidad: Labor programado vs Real para Done
      let laborProgramadoDone = 0;
      for (const r of doneCleanings) {
        const labor = r.fields['Labor (from Property)'];
        const laborVal = Array.isArray(labor) ? labor[0] : labor;
        laborProgramadoDone += (Number(laborVal) || 0);
      }
      laborProgramadoDone = laborProgramadoDone / 60; // a horas
      const velocidad = laborProgramadoDone > 0 ? (hhReales / laborProgramadoDone) : 1;
      
      // On-time rate
      const withScheduled = doneCleanings.filter(r => r.fields['Scheduled Time'] && r.fields['Start Time']);
      let onTimeCount = 0;
      for (const r of withScheduled) {
        const scheduled = new Date(r.fields['Scheduled Time']).getTime();
        const started = new Date(r.fields['Start Time']).getTime();
        if (Math.abs(started - scheduled) <= 15 * 60000) onTimeCount++;
      }
      const onTimeRate = withScheduled.length > 0 ? (onTimeCount / withScheduled.length) * 100 : null;
      
      // Rating promedio
      const withRating = doneCleanings.filter(r => r.fields['Rating']);
      let ratingSum = 0;
      for (const r of withRating) {
        const rating = r.fields['Rating'] || '';
        if (rating.includes('Bueno')) ratingSum += 3;
        else if (rating.includes('Normal')) ratingSum += 2;
        else if (rating.includes('Malo')) ratingSum += 1;
      }
      const ratingPromedio = withRating.length > 0 ? ratingSum / withRating.length : null;
      
      return {
        week: weekStr,
        range,
        hhDisponibles: 352, // TODO: Hacer dinámico
        hhProgramadas: Math.round(hhProgramadas * 10) / 10,
        hhReales: Math.round(hhReales * 10) / 10,
        casasDistintas,
        limpiezasTotal,
        limpiezasDone,
        cleanersUnicos,
        hhPromCasa: Math.round(hhPromCasa * 10) / 10,
        limpiezasPorCasa: Math.round(limpiezasPorCasa * 10) / 10,
        velocidad: Math.round(velocidad * 100) / 100,
        onTimeRate: onTimeRate !== null ? Math.round(onTimeRate) : null,
        ratingPromedio: ratingPromedio !== null ? Math.round(ratingPromedio * 10) / 10 : null,
      };
    };
    
    const currentMetrics = calculateWeekMetrics(allRecords, currentWeek);
    const compareMetrics = calculateWeekMetrics(allRecords, prevWeek);
    
    // Calcular deltas
    const calcDelta = (current, compare) => {
      if (compare === 0 || compare === null) return null;
      return Math.round(((current - compare) / Math.abs(compare)) * 1000) / 10;
    };
    
    // CASCADA WATERFALL: HH Programadas + Ef.Rapidez + Ef.Casas + Ef.Recurrencia = HH Reales
    // Los efectos DEBEN sumar exactamente la variación total
    
    const hhProg = currentMetrics.hhProgramadas;
    const hhReal = currentMetrics.hhReales;
    const variacionTotal = hhReal - hhProg;
    
    // Bases de comparación (semana anterior)
    const baseHHPorCasa = compareMetrics.hhPromCasa || 4;
    const baseCasas = compareMetrics.casasDistintas || currentMetrics.casasDistintas;
    const baseLimpPorCasa = compareMetrics.limpiezasPorCasa || 1.5;
    
    // Efecto Rapidez: cambio en eficiencia (HH/casa)
    const efRapidez = (currentMetrics.hhPromCasa - baseHHPorCasa) * currentMetrics.limpiezasDone;
    const efRapidezPct = baseHHPorCasa > 0 ? ((currentMetrics.hhPromCasa - baseHHPorCasa) / baseHHPorCasa) * 100 : 0;
    
    // Efecto Casas: cambio en número de casas
    const efCasas = (currentMetrics.casasDistintas - baseCasas) * baseLimpPorCasa * baseHHPorCasa;
    const efCasasPct = baseCasas > 0 ? ((currentMetrics.casasDistintas - baseCasas) / baseCasas) * 100 : 0;
    
    // Efecto Recurrencia: el resto para que cuadre exactamente
    const efRecurrencia = variacionTotal - efRapidez - efCasas;
    const efRecurrenciaPct = baseLimpPorCasa > 0 ? ((currentMetrics.limpiezasPorCasa - baseLimpPorCasa) / baseLimpPorCasa) * 100 : 0;
    
    const cascada = {
      hhProgramadas: Math.round(hhProg * 10) / 10,
      efRapidez: Math.round(efRapidez * 10) / 10,
      efRapidezPct: Math.round(efRapidezPct * 10) / 10,
      efCasas: Math.round(efCasas * 10) / 10,
      efCasasPct: Math.round(efCasasPct * 10) / 10,
      efRecurrencia: Math.round(efRecurrencia * 10) / 10,
      efRecurrenciaPct: Math.round(efRecurrenciaPct * 10) / 10,
      hhReales: Math.round(hhReal * 10) / 10,
      variacionTotal: Math.round(variacionTotal * 10) / 10,
      variacionTotalPct: calcDelta(hhReal, hhProg),
    };
    
    // Comparación semana vs semana
    const comparacion = {
      hhReales: { current: currentMetrics.hhReales, compare: compareMetrics.hhReales, delta: calcDelta(currentMetrics.hhReales, compareMetrics.hhReales) },
      casas: { current: currentMetrics.casasDistintas, compare: compareMetrics.casasDistintas, delta: calcDelta(currentMetrics.casasDistintas, compareMetrics.casasDistintas) },
      limpiezas: { current: currentMetrics.limpiezasTotal, compare: compareMetrics.limpiezasTotal, delta: calcDelta(currentMetrics.limpiezasTotal, compareMetrics.limpiezasTotal) },
      hhPromCasa: { current: currentMetrics.hhPromCasa, compare: compareMetrics.hhPromCasa, delta: calcDelta(currentMetrics.hhPromCasa, compareMetrics.hhPromCasa) },
      limpiezasPorCasa: { current: currentMetrics.limpiezasPorCasa, compare: compareMetrics.limpiezasPorCasa, delta: calcDelta(currentMetrics.limpiezasPorCasa, compareMetrics.limpiezasPorCasa) },
      cleaners: { current: currentMetrics.cleanersUnicos, compare: compareMetrics.cleanersUnicos, delta: calcDelta(currentMetrics.cleanersUnicos, compareMetrics.cleanersUnicos) },
      velocidad: { current: currentMetrics.velocidad, compare: compareMetrics.velocidad, delta: calcDelta(currentMetrics.velocidad, compareMetrics.velocidad) },
      onTimeRate: { current: currentMetrics.onTimeRate, compare: compareMetrics.onTimeRate, delta: currentMetrics.onTimeRate !== null && compareMetrics.onTimeRate !== null ? currentMetrics.onTimeRate - compareMetrics.onTimeRate : null },
      rating: { current: currentMetrics.ratingPromedio, compare: compareMetrics.ratingPromedio, delta: currentMetrics.ratingPromedio !== null && compareMetrics.ratingPromedio !== null ? Math.round((currentMetrics.ratingPromedio - compareMetrics.ratingPromedio) * 10) / 10 : null },
    };
    
    // Obtener lista de semanas disponibles (últimas 12)
    const weeksSet = new Set();
    for (const r of allRecords) {
      const date = r.fields['Date'];
      if (date) weeksSet.add(getWeekNumber(date));
    }
    const availableWeeks = Array.from(weeksSet).sort().reverse().slice(0, 12);
    
    return res.status(200).json({
      currentWeek,
      compareWeek: prevWeek,
      current: currentMetrics,
      compare: compareMetrics,
      cascada,
      comparacion,
      availableWeeks,
    });
    
  } catch (err) {
    console.error('[Executive] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

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

  const { action } = req.query;
  
  // Router para diferentes acciones
  if (action === 'executive') {
    return handleExecutive(req, res);
  }

  // Default: Dashboard del día (comportamiento original)
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
