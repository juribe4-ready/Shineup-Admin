const AIRTABLE_BASE = 'appBwnoxgyIXILe6M'
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const APPOINTMENTS_TABLE = 'tblXlpg7MuYWA8Ocn'
const CLEANINGS_TABLE = 'tblabOdNknnjrYUU1'
const STAFF_TABLE = 'tblgHwN1wX6u3ZtNY'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action } = req.query

  // POST: Launch week - create cleanings from appointments
  if (req.method === 'POST') {
    return handleLaunchWeek(req, res)
  }

  // GET with action=summary: Week summary for launcher
  if (action === 'summary') {
    return handleGetWeekSummary(req, res)
  }
  
  // GET with action=defaultStaff: Get staff with Default Assignment checked
  if (action === 'defaultStaff') {
    return handleGetDefaultStaff(req, res)
  }

  // GET default: List appointments (original behavior)
  return handleListAppointments(req, res)
}

// Original getAppointments - list for PlanningPage squads section
async function handleListAppointments(req, res) {
  try {
    const { weekStart, debug } = req.query
    if (!weekStart) return res.status(400).json({ error: 'weekStart requerido' })

    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    // Compare only the DATE portion (YYYY-MM-DD) of the field, formatted explicitly,
    // to avoid any timezone ambiguity between the stored UTC value and Airtable's
    // field-level timezone display setting. This compares strings, not datetimes.
    const formula = encodeURIComponent(
      `AND(DATETIME_FORMAT({Requested Date & Time},'YYYY-MM-DD') >= '${startStr}', DATETIME_FORMAT({Requested Date & Time},'YYYY-MM-DD') <= '${endStr}')`
    )

    const fieldsParam = [
      'Appointment ID', 'Requested Date & Time', 'Estimated Duration', 'Status',
      'Client Name', 'Property Address', 'Notes', 'Online Platform Source',
    ].map(f => `fields[]=${encodeURIComponent(f)}`).join('&')

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${APPOINTMENTS_TABLE}?filterByFormula=${formula}&${fieldsParam}&sort[0][field]=${encodeURIComponent('Requested Date & Time')}&sort[0][direction]=asc`

    if (debug === '1') {
      const debugRes = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } })
      const debugData = await debugRes.json()
      return res.status(200).json({
        debug: true,
        exactUrlUsed: url,
        httpStatus: debugRes.status,
        airtableError: debugData.error || null,
        recordCount: debugData.records?.length || 0,
        rawRecords: (debugData.records || []).slice(0, 10),
      })
    }

    const airtableRes = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    })
    const data = await airtableRes.json()

    const appointments = (data.records || []).map(r => {
      const dt = r.fields?.['Requested Date & Time'] || null
      const date = dt ? dt.split('T')[0] : null
      const time = dt ? new Date(dt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null
      return {
        id: r.id,
        appointmentId: r.fields?.['Appointment ID'] || '',
        date,
        time,
        datetime: dt,
        duration: r.fields?.['Estimated Duration'] || 120,
        status: r.fields?.['Status'] || 'Scheduled',
        clientName: Array.isArray(r.fields?.['Client Name']) ? r.fields['Client Name'][0] : (r.fields?.['Client Name'] || ''),
        address: Array.isArray(r.fields?.['Property Address']) ? r.fields['Property Address'][0] : (r.fields?.['Property Address'] || ''),
        notes: r.fields?.['Notes'] || '',
        source: r.fields?.['Online Platform Source'] || '',
      }
    })

    return res.status(200).json(appointments)
  } catch (err) {
    console.error('[getAppointments] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

// Week summary for launcher UI
async function handleGetWeekSummary(req, res) {
  try {
    const { weekStart, debug } = req.query
    if (!weekStart) return res.status(400).json({ error: 'weekStart requerido' })

    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    // Fetch ALL appointments with pagination
    let allRecords = []
    let offset = null
    
    do {
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${APPOINTMENTS_TABLE}?pageSize=100`
      if (offset) url += `&offset=${offset}`
      
      const airtableRes = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
      })
      const data = await airtableRes.json()
      
      if (data.records) {
        allRecords = allRecords.concat(data.records)
      }
      offset = data.offset || null
    } while (offset)

    console.log(`[getAppointments] Fetched ${allRecords.length} total appointments`)

    // If debug mode, return raw Airtable response
    if (debug === '1') {
      return res.status(200).json({
        debug: true,
        airtableRecordsCount: allRecords.length,
        firstRecord: allRecords[0] || null,
        allFields: allRecords[0]?.fields ? Object.keys(allRecords[0].fields) : [],
      })
    }

    const data = { records: allRecords }

    // Fetch properties to get Labor
    const propsRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/tbl1iETmcFP460oWN?fields[]=Name&fields[]=Labor`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    const propsData = await propsRes.json()
    const propsMap = {}
    for (const p of (propsData.records || [])) {
      propsMap[p.id] = {
        name: p.fields?.Name || '',
        labor: p.fields?.Labor || 0
      }
    }

    const allAppointments = (data.records || []).map(r => {
      const dt = r.fields?.['Requested Date & Time'] || null
      const date = dt ? dt.split('T')[0] : null
      const time = dt ? dt.split('T')[1]?.substring(0, 5) : null
      
      // Get property info
      const propIds = r.fields?.['Property'] || []
      const propId = Array.isArray(propIds) ? propIds[0] : propIds
      const propInfo = propsMap[propId] || {}
      
      return {
        id: r.id,
        appointmentId: r.fields?.['Appointment ID'] || '',
        date,
        time,
        datetime: dt,
        propertyId: propId,
        propertyName: propInfo.name || r.fields?.['Property Address']?.[0] || 'Sin propiedad',
        labor: propInfo.labor || r.fields?.['Estimated Duration'] || 120,
        status: r.fields?.['Status'] || 'Confirmed',
        cleaningType: r.fields?.['Cleaning Type'] || 'Checkout',
        clientName: Array.isArray(r.fields?.['Client Name']) ? r.fields['Client Name'][0] : (r.fields?.['Client Name'] || ''),
        notes: r.fields?.['Notes'] || '',
        source: r.fields?.['Online Platform Source'] || r.fields?.['Source'] || '',
        relatedCleaning: r.fields?.['Related Cleaning Job'] || null,
      }
    })

    // Filter appointments by date range in JavaScript
    const appointments = allAppointments.filter(a => {
      if (!a.date) return false
      return a.date >= startStr && a.date <= endStr
    })

    // Group by date for summary
    const byDate = {}
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const dayName = days[d.getDay()]
      byDate[dateStr] = {
        date: dateStr,
        dayName,
        dayNum: d.getDate(),
        appointments: [],
        totalHH: 0,
        count: 0
      }
    }

    let totalScheduled = 0
    let totalConfirmed = 0
    let totalHH = 0
    const uniqueProperties = new Set()

    appointments.forEach(a => {
      if (a.date && byDate[a.date]) {
        byDate[a.date].appointments.push(a)
        byDate[a.date].count++
        byDate[a.date].totalHH += (a.labor || 0) / 60
        
        if (a.propertyId) uniqueProperties.add(a.propertyId)
        totalHH += (a.labor || 0) / 60
        
        if (a.status === 'Scheduled') totalScheduled++
        else if (a.status === 'Confirmed') totalConfirmed++
      }
    })

    // Check for alerts
    const alerts = []
    Object.values(byDate).forEach(day => {
      if (day.count > 6) {
        alerts.push({
          type: 'warning',
          message: `${day.dayName} ${day.dayNum}: ${day.count} limpiezas - día muy cargado`
        })
      }
      // Check for overlapping times
      const sorted = day.appointments.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].time && sorted[i + 1].time) {
          const endTime = addMinutes(sorted[i].time, sorted[i].labor || 120)
          if (endTime > sorted[i + 1].time) {
            alerts.push({
              type: 'overlap',
              message: `${day.dayName}: ${sorted[i].propertyName} y ${sorted[i + 1].propertyName} se traslapan`
            })
          }
        }
      }
    })

    // Check for properties without Labor
    appointments.forEach(a => {
      if (!a.labor || a.labor === 0) {
        alerts.push({
          type: 'info',
          message: `${a.propertyName}: Sin Labor definido, usando default`
        })
      }
    })

    return res.status(200).json({
      weekStart: startStr,
      weekEnd: endStr,
      summary: {
        total: appointments.length,
        scheduled: totalScheduled,
        confirmed: totalConfirmed,
        totalHH: Math.round(totalHH * 10) / 10,
        uniqueProperties: uniqueProperties.size,
      },
      byDate: Object.values(byDate),
      appointments,
      alerts: alerts.slice(0, 5),
    })

  } catch (err) {
    console.error('[getAppointments summary] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

// Launch week - create cleanings from appointments
async function handleLaunchWeek(req, res) {
  try {
    const { appointmentIds, defaultRating = 2, assignedStaffIds = [] } = req.body
    
    if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ error: 'appointmentIds requerido (array)' })
    }

    // Fetch the appointments to launch
    const formula = encodeURIComponent(
      `OR(${appointmentIds.map(id => `RECORD_ID()='${id}'`).join(',')})`
    )
    
    const apptRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${APPOINTMENTS_TABLE}?filterByFormula=${formula}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    const apptData = await apptRes.json()
    const appointments = apptData.records || []

    if (appointments.length === 0) {
      return res.status(404).json({ error: 'No se encontraron appointments' })
    }

    // Fetch properties for Labor, Default Start Time, Price, Default Cleaning Type, Usage
    const propsFieldsParam = ['Name', 'Labor', 'Default Start Time', 'Default End Time', 'Price', 'Default Cleaning Type', 'Usage']
      .map(f => `fields[]=${encodeURIComponent(f)}`).join('&')
    const propsRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/tbl1iETmcFP460oWN?${propsFieldsParam}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    const propsData = await propsRes.json()
    const propsMap = {}
    for (const p of (propsData.records || [])) {
      propsMap[p.id] = { 
        name: p.fields?.Name || '', 
        labor: p.fields?.Labor || 120,
        defaultStartTime: p.fields?.['Default Start Time'] || null,
        defaultEndTime: p.fields?.['Default End Time'] || null,
        price: p.fields?.['Price'] || null,
        defaultCleaningType: p.fields?.['Default Cleaning Type'] || null,
        usage: p.fields?.['Usage'] || null,
      }
    }

    const created = []
    const errors = []

    for (const appt of appointments) {
      const f = appt.fields
      
      // Skip if already scheduled (has Related Cleaning Job)
      if (f['Status'] === 'Scheduled' || f['Related Cleaning Job']) {
        errors.push({ id: appt.id, error: 'Ya está scheduled' })
        continue
      }

      const dt = f['Requested Date & Time']
      if (!dt) {
        errors.push({ id: appt.id, error: 'Sin fecha' })
        continue
      }

      const date = dt.split('T')[0]
      const propIds = f['Property'] || []
      const propId = Array.isArray(propIds) ? propIds[0] : propIds
      const propInfo = propsMap[propId] || {}

      // Generate Cleaning ID for reference (not saved to Airtable if computed)
      const cleaningId = `CLN-${Date.now().toString(36).toUpperCase()}`

      // Determine Scheduled Time:
      // 1. If Property has Default Start Time, use it
      // 2. Otherwise, use Appointment time adjusted for timezone
      let scheduledTime
      if (propInfo.defaultStartTime) {
        // Use property's default start time (format: "HH:MM")
        // Add timezone offset so Airtable displays correct local time
        scheduledTime = `${date}T${propInfo.defaultStartTime}:00.000-04:00`
        console.log(`[Launch] Using property default time: ${scheduledTime}`)
      } else {
        // Adjust timezone: Server is UTC, Columbus is UTC-4 (EDT in summer)
        const dtDate = new Date(dt)
        dtDate.setHours(dtDate.getHours() + 4)
        scheduledTime = dtDate.toISOString().replace('Z', '-04:00')
        console.log(`[Launch] Using appointment time adjusted: ${scheduledTime}`)
      }
      
      // Create Cleaning record with status SCHEDULED
      const cleaningFields = {
        'Date': date,
        'Scheduled Time': scheduledTime,
        'Property': propId ? [propId] : [],
        'Status': 'Scheduled',
        'Rating': defaultRating === 3 ? '⭐⭐⭐ Bueno' : defaultRating === 1 ? '⭐ Malo' : '⭐⭐ Normal',
        'Assigned Staff': assignedStaffIds.length > 0 ? assignedStaffIds : [],
      }

      // Add Cleaning Type if exists
      if (f['Cleaning Type']) {
        cleaningFields['Cleaning Type'] = f['Cleaning Type']
      }

      // Price logic: compare Cleaning Type IDs between appointment and property default
      const apptCleaningTypeId = Array.isArray(f['Cleaning Type']) ? f['Cleaning Type'][0] : (f['Cleaning Type'] || null)
      const propDefaultTypeId  = Array.isArray(propInfo.defaultCleaningType) ? propInfo.defaultCleaningType[0] : (propInfo.defaultCleaningType || null)
      if (apptCleaningTypeId && propDefaultTypeId && apptCleaningTypeId === propDefaultTypeId) {
        if (propInfo.price) {
          cleaningFields['Price'] = propInfo.price
        }
      } else if (propInfo.price && !apptCleaningTypeId) {
        // No cleaning type on appointment — use property price anyway
        cleaningFields['Price'] = propInfo.price
      }

      try {
        const createRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLEANINGS_TABLE}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: cleaningFields })
          }
        )
        
        if (!createRes.ok) {
          const errData = await createRes.json()
          errors.push({ id: appt.id, error: errData.error?.message || 'Error al crear' })
          continue
        }

        const newCleaning = await createRes.json()

        // Update Appointment: Status = Scheduled, link to Cleaning, mark as Launched
        const today = new Date().toISOString().split('T')[0]
        await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/${APPOINTMENTS_TABLE}/${appt.id}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fields: {
                'Status': 'Scheduled',
                'Related Cleaning Job': [newCleaning.id],
                'ProjectedDate': today,
                'Launched': true
              }
            })
          }
        )

        created.push({
          appointmentId: appt.id,
          cleaningId: newCleaning.id,
          cleaningCode: cleaningId,
          date,
          property: propInfo.name || 'Sin propiedad'
        })

      } catch (err) {
        errors.push({ id: appt.id, error: err.message })
      }
    }

    return res.status(200).json({
      success: true,
      created: created.length,
      errors: errors.length,
      details: { created, errors }
    })

  } catch (err) {
    console.error('[getAppointments launch] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

// Get staff with Default Assignment checked
async function handleGetDefaultStaff(req, res) {
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${STAFF_TABLE}?fields[]=Name&fields[]=Initials&fields[]=Role&fields[]=Default Assignment`
    
    const airtableRes = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    })
    const data = await airtableRes.json()
    
    const staff = (data.records || []).map(r => ({
      id: r.id,
      name: r.fields?.Name || '',
      initials: r.fields?.Initials || '',
      role: r.fields?.Role || '',
      defaultAssignment: r.fields?.['Default Assignment'] || false,
    }))
    
    return res.status(200).json({ staff })
  } catch (err) {
    console.error('[getAppointments defaultStaff] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number)
  const totalMin = h * 60 + m + minutes
  const newH = Math.floor(totalMin / 60) % 24
  const newM = totalMin % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}
