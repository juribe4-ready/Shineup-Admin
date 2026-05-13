import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Clock, Star, Zap, AlertTriangle, AlertCircle, Package,
  ExternalLink, X, Home, Calendar, Users, BarChart3, Activity, Timer, Download, Calculator
} from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF', primaryDark: '#4F46E5',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', red: '#EF4444', amber: '#F59E0B', blue: '#3B82F6',
  teal: '#14B8A6', purple: '#8B5CF6', pink: '#EC4899',
}

interface Cleaning {
  id: string
  cleaningId: string
  propertyText: string
  propertyId: string
  date: string
  status: string
  scheduledTime: string | null
  startTime: string | null
  endTime: string | null
  estimatedEndTime: string | null
  rating: number | null
  staffListText: string
  cleanerNames?: string
  cleanerCount?: number
  cleanerIds?: string[]
  labor: number
}

interface StatsData {
  cleanings: Cleaning[]
  summary: {
    total: number
    done: number
    avgRating: number | null
    avgDurationMin: number | null
    totalDurationMin: number
    onTimeRate: number | null
    lateStarts: number
    totalLateMinutes: number
  }
  byProperty: {
    propertyText: string
    propertyId: string
    total: number
    avgRating: number | null
    avgDurationMin: number | null
    incidents: number
    inventory: number
  }[]
  incidents: { total: number; open: number; closed: number }
  inventory: { total: number; low: number; outOfStock: number; optimal: number }
}

const PERIODS = [
  { key: '7d', label: '7 días' },
  { key: '30d', label: 'Mes' },
  { key: 'ytd', label: 'YTD' },
]

export default function StatsPage() {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [selectedCleaning, setSelectedCleaning] = useState<Cleaning | null>(null)
  const [selectedPropertyDetail, setSelectedPropertyDetail] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/stats?period=${period}`)
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [period])

  const properties = useMemo(() => {
    if (!data) return []
    return [...new Set(data.cleanings.map(c => c.propertyText))].sort()
  }, [data])

  const filteredCleanings = useMemo(() => {
    if (!data) return []
    return data.cleanings.filter(c => {
      if (selectedProperty !== 'all' && c.propertyText !== selectedProperty) return false
      // Si solo hay dateFrom sin dateTo, filtrar exactamente ese día
      if (dateFrom && !dateTo && c.date !== dateFrom) return false
      // Si hay ambas fechas, filtrar rango
      if (dateFrom && dateTo) {
        if (c.date < dateFrom || c.date > dateTo) return false
      }
      return true
    })
  }, [data, selectedProperty, dateFrom, dateTo])

  const filteredIncidents = useMemo(() => {
    if (!data) return { open: 0, closed: 0 }
    // Si hay filtro de fecha o propiedad, solo contar incidentes de propiedades en el rango filtrado
    if (selectedProperty !== 'all') {
      const prop = data.byProperty.find(p => p.propertyText === selectedProperty)
      return { open: prop?.incidents || 0, closed: 0 }
    }
    if (dateFrom || dateTo) {
      // Get unique properties from filtered cleanings
      const filteredPropNames = [...new Set(filteredCleanings.map(c => c.propertyText))]
      const totalIncidents = data.byProperty
        .filter(p => filteredPropNames.includes(p.propertyText))
        .reduce((sum, p) => sum + p.incidents, 0)
      return { open: totalIncidents, closed: 0 }
    }
    return data.incidents
  }, [data, selectedProperty, dateFrom, dateTo, filteredCleanings])

  const filteredInventory = useMemo(() => {
    if (!data) return { outOfStock: 0, low: 0 }
    if (selectedProperty !== 'all') {
      const prop = data.byProperty.find(p => p.propertyText === selectedProperty)
      return { outOfStock: 0, low: prop?.inventory || 0 }
    }
    if (dateFrom || dateTo) {
      const filteredPropNames = [...new Set(filteredCleanings.map(c => c.propertyText))]
      const totalInventory = data.byProperty
        .filter(p => filteredPropNames.includes(p.propertyText))
        .reduce((sum, p) => sum + p.inventory, 0)
      return { outOfStock: 0, low: totalInventory }
    }
    return data.inventory
  }, [data, selectedProperty, dateFrom, dateTo, filteredCleanings])

  const filteredMetrics = useMemo(() => {
    const cleanings = filteredCleanings
    const done = cleanings.filter(c => c.status === 'Done')
    
    const withTimes = done.filter(c => c.scheduledTime && c.startTime)
    const onTime = withTimes.filter(c => {
      const diff = Math.abs(new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime())
      return diff <= 15 * 60000
    })
    const onTimeRate = withTimes.length > 0 ? Math.round((onTime.length / withTimes.length) * 100) : null
    
    const lateCleanings = withTimes.filter(c => {
      return (new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime()) > 15 * 60000
    })
    const lateStarts = lateCleanings.length
    const totalLateMinutes = lateCleanings.reduce((sum, c) => {
      return sum + (new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime()) / 60000
    }, 0)
    const lateRate = cleanings.length > 0 ? Math.round((lateStarts / cleanings.length) * 100) : 0
    
    const ratings = done.filter(c => c.rating).map(c => c.rating!)
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
    
    const durations = done.filter(c => c.startTime && c.endTime).map(c => {
      return (new Date(c.endTime!).getTime() - new Date(c.startTime!).getTime()) / 60000
    })
    const avgDurationMin = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
    const totalDurationMin = durations.reduce((a, b) => a + b, 0)
    
    return { total: cleanings.length, done: done.length, onTimeRate, lateStarts, totalLateMinutes, lateRate, avgRating, avgDurationMin, totalDurationMin }
  }, [filteredCleanings])

  // Daily stats for charts
  const dailyStats = useMemo(() => {
    if (!filteredCleanings.length) return []
    
    const byDate: Record<string, { count: number; totalDuration: number; doneCount: number; cleanerIds: Set<string> }> = {}
    filteredCleanings.forEach(c => {
      if (!byDate[c.date]) byDate[c.date] = { count: 0, totalDuration: 0, doneCount: 0, cleanerIds: new Set() }
      byDate[c.date].count++
      // Add unique cleaner IDs for this day
      ;(c.cleanerIds || []).forEach(id => byDate[c.date].cleanerIds.add(id))
      if (c.status === 'Done' && c.startTime && c.endTime) {
        const dur = (new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000
        byDate[c.date].totalDuration += dur
        byDate[c.date].doneCount++
      }
    })
    
    return Object.entries(byDate)
      .map(([date, stats]) => {
        const uniqueCleaners = stats.cleanerIds.size
        return {
          date,
          count: stats.count,
          avgDuration: stats.doneCount > 0 ? Math.round(stats.totalDuration / stats.doneCount) : 0,
          cleaners: uniqueCleaners,
          housesPerCleaner: uniqueCleaners > 0 ? Math.round((stats.count / uniqueCleaners) * 10) / 10 : 0,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredCleanings])

  // Productivity stats - calculate daily ratios then average
  const productivityStats = useMemo(() => {
    if (!filteredCleanings.length) return { avgHousesPerCleaner: 0, totalHouses: 0, uniqueCleaners: 0, bestDay: null as { date: string; housesPerCleaner: number } | null, worstDay: null as { date: string; housesPerCleaner: number } | null }
    
    const totalHouses = filteredCleanings.length
    
    // Get unique cleaner IDs across all filtered cleanings (for display)
    const allCleanerIds = new Set<string>()
    filteredCleanings.forEach(c => {
      (c.cleanerIds || []).forEach(id => allCleanerIds.add(id))
    })
    const uniqueCleaners = allCleanerIds.size
    
    // Calculate ratio PER DAY first
    const byDate: Record<string, { count: number; cleanerIds: Set<string> }> = {}
    filteredCleanings.forEach(c => {
      if (!byDate[c.date]) byDate[c.date] = { count: 0, cleanerIds: new Set() }
      byDate[c.date].count++
      ;(c.cleanerIds || []).forEach(id => byDate[c.date].cleanerIds.add(id))
    })
    
    // Get daily ratios (only days with cleaners)
    const dailyRatios = Object.entries(byDate)
      .map(([date, data]) => ({
        date,
        housesPerCleaner: data.cleanerIds.size > 0 ? Math.round((data.count / data.cleanerIds.size) * 10) / 10 : 0,
      }))
      .filter(d => d.housesPerCleaner > 0)
    
    // AVERAGE of daily ratios (not total/total)
    const avgHousesPerCleaner = dailyRatios.length > 0 
      ? Math.round((dailyRatios.reduce((sum, d) => sum + d.housesPerCleaner, 0) / dailyRatios.length) * 10) / 10 
      : 0
    
    const bestDay = dailyRatios.length > 0 ? dailyRatios.reduce((best, d) => d.housesPerCleaner > best.housesPerCleaner ? d : best) : null
    const worstDay = dailyRatios.length > 0 ? dailyRatios.reduce((worst, d) => d.housesPerCleaner < worst.housesPerCleaner ? d : worst) : null
    
    return { avgHousesPerCleaner, totalHouses, uniqueCleaners, bestDay, worstDay }
  }, [filteredCleanings])

  // Waterfall data
  const waterfallData = useMemo(() => {
    const done = filteredCleanings.filter(c => c.status === 'Done' && c.startTime && c.endTime)
    if (done.length === 0) return { scheduled: 0, ratingEffect: 0, otherEffect: 0, actual: 0, hasData: false, avgRating: 2 }
    
    let totalScheduledMin = 0
    let totalActualMin = 0
    let ratingEffect = 0
    
    const ratings = done.filter(c => c.rating).map(c => c.rating!)
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 2
    
    done.forEach(c => {
      totalScheduledMin += c.labor > 0 ? c.labor : 0
      const actual = (new Date(c.endTime!).getTime() - new Date(c.startTime!).getTime()) / 60000
      totalActualMin += actual
      // Rating 3 (bueno/limpio) = -5 min, Rating 1 (malo/sucio) = +10 min
      if (c.rating === 3) ratingEffect -= 5
      else if (c.rating === 1) ratingEffect += 10
    })
    
    if (totalScheduledMin === 0) totalScheduledMin = totalActualMin * 0.9
    
    const diff = totalActualMin - totalScheduledMin
    const otherEffect = diff - ratingEffect
    
    return {
      scheduled: Math.round(totalScheduledMin / 60 * 10) / 10,
      ratingEffect: Math.round(ratingEffect / 60 * 10) / 10,
      otherEffect: Math.round(otherEffect / 60 * 10) / 10,
      actual: Math.round(totalActualMin / 60 * 10) / 10,
      hasData: true,
      avgRating: Math.round(avgRating * 10) / 10,
    }
  }, [filteredCleanings])

  // Rating distribution
  const ratingDistribution = useMemo(() => {
    const done = filteredCleanings.filter(c => c.status === 'Done' && c.rating)
    return {
      good: done.filter(c => c.rating === 3).length,
      normal: done.filter(c => c.rating === 2).length,
      bad: done.filter(c => c.rating === 1).length,
      total: done.length,
    }
  }, [filteredCleanings])

  // Day of week - FIXED: Lun=0, Mar=1, ..., Dom=6
  const dayOfWeekStats = useMemo(() => {
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    
    // First group by actual date to calculate daily ratios
    const byDate: Record<string, { dayIdx: number; count: number; duration: number; doneCount: number; cleanerIds: Set<string> }> = {}
    
    filteredCleanings.forEach(c => {
      const jsDay = new Date(c.date + 'T12:00:00').getDay()
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1
      
      if (!byDate[c.date]) byDate[c.date] = { dayIdx, count: 0, duration: 0, doneCount: 0, cleanerIds: new Set() }
      byDate[c.date].count++
      ;(c.cleanerIds || []).forEach(id => byDate[c.date].cleanerIds.add(id))
      if (c.status === 'Done' && c.startTime && c.endTime) {
        byDate[c.date].duration += (new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000
        byDate[c.date].doneCount++
      }
    })
    
    // Now aggregate by day of week
    const dayData: { count: number; totalDuration: number; doneCount: number; ratios: number[] }[] = 
      Array(7).fill(null).map(() => ({ count: 0, totalDuration: 0, doneCount: 0, ratios: [] }))
    
    Object.values(byDate).forEach(day => {
      dayData[day.dayIdx].count += day.count
      dayData[day.dayIdx].totalDuration += day.duration
      dayData[day.dayIdx].doneCount += day.doneCount
      // Calculate this specific date's ratio and store it
      if (day.cleanerIds.size > 0) {
        dayData[day.dayIdx].ratios.push(day.count / day.cleanerIds.size)
      }
    })
    
    return dayNames.map((name, i) => ({
      name,
      count: dayData[i].count,
      avgDuration: dayData[i].doneCount > 0 ? Math.round(dayData[i].totalDuration / dayData[i].doneCount) : 0,
      // Average of daily ratios for this day of week
      housesPerCleaner: dayData[i].ratios.length > 0 
        ? Math.round((dayData[i].ratios.reduce((a, b) => a + b, 0) / dayData[i].ratios.length) * 10) / 10 
        : 0,
    }))
  }, [filteredCleanings])

  // Property stats
  const propertyStats = useMemo(() => {
    if (!data) return []
    
    const propGroups: Record<string, Cleaning[]> = {}
    filteredCleanings.forEach(c => {
      if (!c.propertyText) return
      if (!propGroups[c.propertyText]) propGroups[c.propertyText] = []
      propGroups[c.propertyText].push(c)
    })
    
    return Object.entries(propGroups).map(([propertyText, cleanings]) => {
      const done = cleanings.filter(c => c.status === 'Done')
      const ratings = done.filter(c => c.rating).map(c => c.rating!)
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
      
      const durations = done.filter(c => c.startTime && c.endTime).map(c => {
        return (new Date(c.endTime!).getTime() - new Date(c.startTime!).getTime()) / 60000
      })
      const avgDurationMin = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
      
      const withBoth = done.filter(c => c.startTime && c.endTime && c.labor > 0)
      let efficiencyRate: number | null = null
      if (withBoth.length > 0) {
        const totalEstimated = withBoth.reduce((s, c) => s + c.labor, 0)
        const totalActual = withBoth.reduce((s, c) => s + (new Date(c.endTime!).getTime() - new Date(c.startTime!).getTime()) / 60000, 0)
        if (totalActual > 0) efficiencyRate = Math.round((totalEstimated / totalActual) * 100)
      }
      
      const withTimes = done.filter(c => c.scheduledTime && c.startTime)
      const onTime = withTimes.filter(c => Math.abs(new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime()) <= 15 * 60000)
      const onTimeRate = withTimes.length > 0 ? Math.round((onTime.length / withTimes.length) * 100) : null
      
      const propData = data.byProperty.find(p => p.propertyText === propertyText)
      const totalCleaners = cleanings.reduce((s, c) => s + (c.cleanerCount || 0), 0)
      const avgCleaners = cleanings.length > 0 ? Math.round((totalCleaners / cleanings.length) * 10) / 10 : 0
      
      return {
        propertyText, total: cleanings.length, avgRating, avgDurationMin, efficiencyRate, onTimeRate,
        incidents: propData?.incidents || 0, inventory: propData?.inventory || 0, cleanings, avgCleaners,
      }
    }).sort((a, b) => b.total - a.total)
  }, [data, filteredCleanings])

  // Labor Analysis - Calculate optimal Horas-Hombre per property
  const laborAnalysis = useMemo(() => {
    if (!data) return []
    
    // Efficiency factors by team size
    const getEfficiency = (cleaners: number) => {
      if (cleaners <= 1) return 1.0
      if (cleaners === 2) return 0.85
      if (cleaners === 3) return 0.75
      return 0.65
    }
    
    // Group all cleanings by property (use all data, not filtered)
    const byProperty: Record<string, { 
      propertyText: string
      laborFromAirtable: number
      samples: { durationMin: number; cleaners: number; rating: number | null }[] 
    }> = {}
    
    data.cleanings.forEach(c => {
      if (!c.propertyText) return
      if (!byProperty[c.propertyText]) {
        byProperty[c.propertyText] = { 
          propertyText: c.propertyText, 
          laborFromAirtable: c.labor || 0,
          samples: [] 
        }
      }
      // Only use completed cleanings with times and cleaners
      if (c.status === 'Done' && c.startTime && c.endTime && (c.cleanerCount || 0) > 0) {
        const durationMin = (new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000
        byProperty[c.propertyText].samples.push({
          durationMin,
          cleaners: c.cleanerCount || 1,
          rating: c.rating,
        })
      }
    })
    
    return Object.values(byProperty).map(prop => {
      const validSamples = prop.samples.filter(s => s.durationMin > 15 && s.durationMin < 480) // 15min to 8hrs
      
      if (validSamples.length === 0) {
        return {
          propertyText: prop.propertyText,
          laborActual: prop.laborFromAirtable,
          horasHombreSugeridas: null,
          avgDurationMin: null,
          avgCleaners: null,
          samples: 0,
          diferencia: null,
        }
      }
      
      // Calculate Horas-Hombre from each sample, then average
      const horasHombreList = validSamples.map(s => {
        const eff = getEfficiency(s.cleaners)
        // HH = duration * cleaners * efficiency
        // Adjust for rating: rating 3 means house was clean so real HH is higher
        const ratingAdj = s.rating === 3 ? 1.1 : s.rating === 1 ? 0.9 : 1.0
        return (s.durationMin / 60) * s.cleaners * eff * ratingAdj
      })
      
      const avgHH = horasHombreList.reduce((a, b) => a + b, 0) / horasHombreList.length
      const avgDuration = validSamples.reduce((a, s) => a + s.durationMin, 0) / validSamples.length
      const avgCleaners = validSamples.reduce((a, s) => a + s.cleaners, 0) / validSamples.length
      
      const sugeridoMin = Math.round(avgHH * 60)
      const diferencia = prop.laborFromAirtable > 0 ? sugeridoMin - prop.laborFromAirtable : null
      
      return {
        propertyText: prop.propertyText,
        laborActual: prop.laborFromAirtable,
        horasHombreSugeridas: sugeridoMin,
        avgDurationMin: Math.round(avgDuration),
        avgCleaners: Math.round(avgCleaners * 10) / 10,
        samples: validSamples.length,
        diferencia,
      }
    }).filter(p => p.samples > 0).sort((a, b) => b.samples - a.samples)
  }, [data])

  // Export Labor Analysis to CSV
  const exportLaborAnalysis = () => {
    const headers = ['Propiedad', 'Labor Actual (min)', 'HH Sugeridas (min)', 'Diferencia', 'Duración Prom (min)', 'Cleaners Prom', 'Muestras']
    const rows = laborAnalysis.map(p => [
      `"${p.propertyText}"`,
      p.laborActual || '',
      p.horasHombreSugeridas || '',
      p.diferencia || '',
      p.avgDurationMin || '',
      p.avgCleaners || '',
      p.samples,
    ].join(','))
    
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `labor_analysis_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const hasFilters = selectedProperty !== 'all' || dateFrom || dateTo
  const totalHours = Math.round(filteredMetrics.totalDurationMin / 60 * 10) / 10
  const lateHours = Math.round(filteredMetrics.totalLateMinutes / 60 * 10) / 10

  // Export to CSV (opens in Excel)
  const exportToExcel = () => {
    const fmt = (v?: string | null) => {
      if (!v) return ''
      try { return new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }
      catch { return '' }
    }
    
    const escape = (str: string) => {
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }
    
    const headers = ['Fecha', 'Propiedad', 'Cleaners (#)', 'Cleaners (nombres)', 'Rating', 'Inicio Prog.', 'Inicio Real', 'Fin Prog.', 'Fin Real', 'Duración (min)', 'Puntualidad', 'Estado']
    
    const rows = filteredCleanings.map(c => {
      const duration = c.startTime && c.endTime 
        ? Math.round((new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000)
        : ''
      const isLate = c.scheduledTime && c.startTime
        ? (new Date(c.startTime).getTime() - new Date(c.scheduledTime).getTime()) > 15 * 60000
        : false
      
      return [
        c.date,
        escape(c.propertyText || ''),
        c.cleanerCount || 0,
        escape(c.cleanerNames || ''),
        c.rating || '',
        fmt(c.scheduledTime),
        fmt(c.startTime),
        fmt(c.estimatedEndTime),
        fmt(c.endTime),
        duration,
        isLate ? 'Tarde' : (c.startTime ? 'OK' : ''),
        c.status,
      ].join(',')
    })
    
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `limpiezas_${dateFrom || period}_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-black text-[20px]" style={{ color: C.ink }}>Estadísticas</h2>
            <p className="text-[12px] font-medium" style={{ color: C.muted }}>{filteredCleanings.length} limpiezas · {filteredMetrics.done} completadas</p>
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1.5px solid ${C.border}` }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className="px-3 py-1.5 text-[11px] font-bold transition-all"
                style={{ background: period === p.key ? C.primary : C.white, color: period === p.key ? 'white' : C.slate }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap items-center p-3 rounded-2xl" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium outline-none"
            style={{ border: `1.5px solid ${C.border}`, background: C.white, minWidth: 160 }}>
            <option value="all">Todas las propiedades</option>
            {properties.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" style={{ color: C.muted }} />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-2 py-1.5 rounded-xl text-[11px] font-medium outline-none"
              style={{ border: `1.5px solid ${C.border}`, background: C.white }} />
            <span className="text-[11px]" style={{ color: C.muted }}>→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-2 py-1.5 rounded-xl text-[11px] font-medium outline-none"
              style={{ border: `1.5px solid ${C.border}`, background: C.white }} />
          </div>
          {hasFilters && (
            <button onClick={() => { setSelectedProperty('all'); setDateFrom(''); setDateTo('') }}
              className="text-[11px] font-bold px-2 py-1" style={{ color: C.red }}>Limpiar</button>
          )}
        </div>
      </div>

      {/* Row 1: Completadas, Duración Total, Retrasos, Incidentes, Rupturas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={<TrendingUp className="w-3.5 h-3.5" />} label="Completadas" value={`${filteredMetrics.done}`} subtitle={`de ${filteredMetrics.total}`} color={C.green} />
        <KpiCard icon={<Timer className="w-3.5 h-3.5" />} label="Duración Total" value={`${totalHours}h`} subtitle="horas trabajadas" color={C.blue} />
        <div className="p-3 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${C.red}15`, color: C.red }}><AlertTriangle className="w-3.5 h-3.5" /></div>
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Retrasos</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="font-black text-[22px] leading-none" style={{ color: C.red }}>{filteredMetrics.lateStarts}</p>
            <p className="text-[11px] font-bold" style={{ color: C.amber }}>({filteredMetrics.lateRate}%)</p>
          </div>
          <p className="text-[9px] font-medium mt-0.5" style={{ color: C.muted }}>{lateHours}h de retraso · &gt;15m tarde</p>
        </div>
        <div className="p-3 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${C.amber}15`, color: C.amber }}><AlertCircle className="w-3.5 h-3.5" /></div>
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Incidentes</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="font-black text-[22px] leading-none" style={{ color: C.amber }}>{filteredIncidents.open}</p>
            <p className="text-[11px] font-medium" style={{ color: C.green }}>+{filteredIncidents.closed} cerrados</p>
          </div>
          <p className="text-[9px] font-medium mt-0.5" style={{ color: C.muted }}>abiertos</p>
        </div>
        <div className="p-3 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${C.red}15`, color: C.red }}><Package className="w-3.5 h-3.5" /></div>
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Rupturas</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="font-black text-[22px] leading-none" style={{ color: C.red }}>{filteredInventory.outOfStock}</p>
            <p className="text-[11px] font-medium" style={{ color: C.amber }}>+{filteredInventory.low} bajo</p>
          </div>
          <p className="text-[9px] font-medium mt-0.5" style={{ color: C.muted }}>sin stock</p>
        </div>
      </div>

      {/* Row 2: Rating, Puntualidad, Casas/Cleaner, Duración Promedio */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Star className="w-3.5 h-3.5" />} label="Rating Promedio" value={filteredMetrics.avgRating?.toFixed(1) || '--'} subtitle="condición casas" color={filteredMetrics.avgRating && filteredMetrics.avgRating >= 2.5 ? C.green : C.amber} />
        <KpiCard icon={<Zap className="w-3.5 h-3.5" />} label="Puntualidad" value={filteredMetrics.onTimeRate !== null ? `${filteredMetrics.onTimeRate}%` : '--'} subtitle="a tiempo ±15m" color={filteredMetrics.onTimeRate && filteredMetrics.onTimeRate >= 70 ? C.green : C.amber} />
        <KpiCard icon={<Activity className="w-3.5 h-3.5" />} label="Casas/Cleaner" value={productivityStats.avgHousesPerCleaner.toFixed(1)} subtitle="promedio diario" color={C.primary} />
        <KpiCard icon={<Clock className="w-3.5 h-3.5" />} label="Duración Promedio" value={filteredMetrics.avgDurationMin ? `${Math.floor(filteredMetrics.avgDurationMin / 60)}h ${filteredMetrics.avgDurationMin % 60}m` : '--'} subtitle="por limpieza" color={C.blue} />
      </div>

      {/* Cleanings Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: C.primary }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Limpiezas ({filteredCleanings.length})</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:scale-105"
              style={{ background: C.green, color: 'white' }}>
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
            <p className="text-[10px]" style={{ color: C.muted }}>Clic para ver detalle</p>
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0" style={{ background: C.bg }}>
              <tr>
                <th className="px-4 py-2 text-left font-bold" style={{ color: C.muted }}>Fecha</th>
                <th className="px-3 py-2 text-left font-bold" style={{ color: C.muted }}>Propiedad</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Cleaners</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Rating</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Tiempo</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Puntualidad</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredCleanings.slice(0, 100).map((c) => {
                const duration = c.startTime && c.endTime ? Math.round((new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000) : null
                const isLate = c.scheduledTime && c.startTime ? (new Date(c.startTime).getTime() - new Date(c.scheduledTime).getTime()) > 15 * 60000 : false
                const cleanerCount = c.cleanerCount || 0
                
                return (
                  <tr key={c.id} className="cursor-pointer hover:bg-gray-50 transition-colors" style={{ borderBottom: `1px solid ${C.border}` }} onClick={() => setSelectedCleaning(c)}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: C.ink }}>{c.date}</td>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: C.slate }}>{c.propertyText}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" 
                        style={{ background: cleanerCount > 0 ? C.primaryLight : C.bg, color: cleanerCount > 0 ? C.primary : C.muted }}
                        title={c.cleanerNames || c.staffListText}>
                        <Users className="w-3 h-3" /> {cleanerCount}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {c.rating ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: c.rating >= 2.5 ? '#DCFCE7' : '#FEF3C7', color: c.rating >= 2.5 ? C.green : C.amber }}>{c.rating}⭐</span>
                      ) : '--'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium" style={{ color: C.slate }}>{duration ? `${Math.floor(duration / 60)}h${duration % 60}m` : '--'}</td>
                    <td className="px-3 py-2.5 text-center">
                      {isLate ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#FEE2E2', color: C.red }}>Tarde</span>
                       : c.startTime ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#DCFCE7', color: C.green }}>OK</span> : '--'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[10px] font-bold" style={{ color: c.status === 'Done' ? C.green : C.slate }}>{c.status === 'Done' ? '✓' : c.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Chart */}
        <div className="rounded-2xl overflow-hidden p-4" style={{ background: `linear-gradient(135deg, ${C.primary}08, ${C.blue}08)`, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4" style={{ color: C.primary }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Limpiezas por Día</p>
            <div className="flex-1" />
            <div className="flex items-center gap-3 text-[9px]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: `linear-gradient(180deg, ${C.primary}, ${C.blue})` }} /> Limpiezas</span>
              <span className="flex items-center gap-1"><span className="w-6 h-1 rounded" style={{ background: C.amber }} /> Tiempo</span>
            </div>
          </div>
          <DailyChart data={dailyStats} />
        </div>

        {/* Day of Week */}
        <div className="rounded-2xl overflow-hidden p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4" style={{ color: C.teal }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Por Día de Semana</p>
          </div>
          <div className="flex items-center gap-3 mb-2 text-[9px] font-bold uppercase" style={{ color: C.muted }}>
            <span className="w-8"></span>
            <span className="flex-1">Limpiezas</span>
            <span className="w-14 text-center">Tiempo</span>
            <span className="w-14 text-center">Casas/Cl</span>
          </div>
          <DayOfWeekChart data={dayOfWeekStats} />
        </div>
      </div>

      {/* Productivity & Ratings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl overflow-hidden p-4" style={{ background: `linear-gradient(135deg, ${C.green}10, ${C.teal}10)`, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4" style={{ color: C.green }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Productividad (Casas/Cleaner)</p>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-xl" style={{ background: C.white }}>
              <p className="text-[24px] font-black" style={{ color: C.primary }}>{productivityStats.avgHousesPerCleaner.toFixed(1)}</p>
              <p className="text-[10px] font-medium" style={{ color: C.muted }}>Promedio</p>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: C.white }}>
              <p className="text-[24px] font-black" style={{ color: C.green }}>{productivityStats.bestDay?.housesPerCleaner.toFixed(1) || '--'}</p>
              <p className="text-[10px] font-medium" style={{ color: C.muted }}>Mejor día</p>
              {productivityStats.bestDay && <p className="text-[8px]" style={{ color: C.slate }}>{productivityStats.bestDay.date.slice(5)}</p>}
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: C.white }}>
              <p className="text-[24px] font-black" style={{ color: C.amber }}>{productivityStats.worstDay?.housesPerCleaner.toFixed(1) || '--'}</p>
              <p className="text-[10px] font-medium" style={{ color: C.muted }}>Menor día</p>
              {productivityStats.worstDay && <p className="text-[8px]" style={{ color: C.slate }}>{productivityStats.worstDay.date.slice(5)}</p>}
            </div>
          </div>
          <div className="flex justify-between text-[10px] p-2 rounded-lg" style={{ background: C.white }}>
            <span style={{ color: C.muted }}>Total casas: <b style={{ color: C.ink }}>{productivityStats.totalHouses}</b></span>
            <span style={{ color: C.muted }}>Cleaners únicos: <b style={{ color: C.ink }}>{productivityStats.uniqueCleaners}</b></span>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4" style={{ color: C.amber }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Distribución de Ratings</p>
          </div>
          <RatingChart data={ratingDistribution} />
        </div>
      </div>

      {/* Waterfall Chart */}
      <div className="rounded-2xl overflow-hidden p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4" style={{ color: C.blue }} />
          <p className="font-bold text-[13px]" style={{ color: C.ink }}>Análisis de Horas: Programado vs Real</p>
        </div>
        <WaterfallChart data={waterfallData} lateStats={{ lateRate: filteredMetrics.lateRate, lateHours }} />
      </div>

      {/* Properties Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4" style={{ color: C.primary }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Propiedades ({propertyStats.length})</p>
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0" style={{ background: C.bg }}>
              <tr>
                <th className="px-4 py-2 text-left font-bold" style={{ color: C.muted }}>Propiedad</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Limpiezas</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>~Cleaners</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Rating</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Tiempo</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Puntualidad</th>
              </tr>
            </thead>
            <tbody>
              {propertyStats.map((prop) => (
                <tr key={prop.propertyText} className="cursor-pointer hover:bg-gray-50" style={{ borderBottom: `1px solid ${C.border}` }} onClick={() => setSelectedPropertyDetail(prop.propertyText)}>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: C.ink }}>{prop.propertyText}</td>
                  <td className="px-3 py-2.5 text-center font-bold" style={{ color: C.slate }}>{prop.total}</td>
                  <td className="px-3 py-2.5 text-center"><span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: C.primaryLight, color: C.primary }}>~{prop.avgCleaners}</span></td>
                  <td className="px-3 py-2.5 text-center">{prop.avgRating ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: prop.avgRating >= 2.5 ? '#DCFCE7' : '#FEF3C7', color: prop.avgRating >= 2.5 ? C.green : C.amber }}>{prop.avgRating.toFixed(1)}⭐</span> : '--'}</td>
                  <td className="px-3 py-2.5 text-center font-medium" style={{ color: C.slate }}>{prop.avgDurationMin ? `${Math.floor(prop.avgDurationMin / 60)}h${prop.avgDurationMin % 60}m` : '--'}</td>
                  <td className="px-3 py-2.5 text-center"><Badge value={prop.onTimeRate} suffix="%" goodThreshold={70} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Labor Analysis Section */}
      <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.purple}08, ${C.primary}08)`, border: `1px solid ${C.border}` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4" style={{ color: C.purple }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Análisis de Labor (Horas-Hombre)</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportLaborAnalysis} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:scale-105"
              style={{ background: C.purple, color: 'white' }}>
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>
        </div>
        
        {/* Explanation */}
        <div className="px-4 py-3" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
          <p className="text-[11px] mb-2" style={{ color: C.slate }}>
            <b>Fórmula:</b> HH = Duración × Cleaners × Factor de Eficiencia
          </p>
          <div className="flex gap-4 text-[10px]" style={{ color: C.muted }}>
            <span>1 cleaner: <b style={{ color: C.ink }}>100%</b></span>
            <span>2 cleaners: <b style={{ color: C.ink }}>85%</b></span>
            <span>3 cleaners: <b style={{ color: C.ink }}>75%</b></span>
            <span>4+ cleaners: <b style={{ color: C.ink }}>65%</b></span>
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0" style={{ background: C.bg }}>
              <tr>
                <th className="px-4 py-2 text-left font-bold" style={{ color: C.muted }}>Propiedad</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Labor Actual</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>HH Sugeridas</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Diferencia</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Duración Prom</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>~Cleaners</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Muestras</th>
              </tr>
            </thead>
            <tbody>
              {laborAnalysis.map((p) => {
                const diffColor = p.diferencia === null ? C.muted : p.diferencia > 15 ? C.red : p.diferencia < -15 ? C.green : C.slate
                const diffBg = p.diferencia === null ? 'transparent' : p.diferencia > 15 ? '#FEE2E2' : p.diferencia < -15 ? '#DCFCE7' : 'transparent'
                
                return (
                  <tr key={p.propertyText} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: C.ink }}>{p.propertyText}</td>
                    <td className="px-3 py-2.5 text-center font-medium" style={{ color: p.laborActual ? C.slate : C.muted }}>
                      {p.laborActual ? `${Math.floor(p.laborActual / 60)}h ${p.laborActual % 60}m` : 'Sin definir'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-bold" style={{ color: C.purple }}>
                        {p.horasHombreSugeridas ? `${Math.floor(p.horasHombreSugeridas / 60)}h ${p.horasHombreSugeridas % 60}m` : '--'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {p.diferencia !== null ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: diffBg, color: diffColor }}>
                          {p.diferencia > 0 ? '+' : ''}{p.diferencia}m
                        </span>
                      ) : <span style={{ color: C.muted }}>--</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium" style={{ color: C.slate }}>
                      {p.avgDurationMin ? `${Math.floor(p.avgDurationMin / 60)}h ${p.avgDurationMin % 60}m` : '--'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: C.primaryLight, color: C.primary }}>
                        {p.avgCleaners}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium" style={{ color: C.muted }}>{p.samples}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {laborAnalysis.length === 0 && (
          <p className="text-center py-8 text-[12px]" style={{ color: C.muted }}>No hay suficientes datos para analizar</p>
        )}
      </div>

      {/* Modals */}
      {selectedPropertyDetail && (
        <PropertyDetailModal propertyText={selectedPropertyDetail} cleanings={propertyStats.find(p => p.propertyText === selectedPropertyDetail)?.cleanings || []} onClose={() => setSelectedPropertyDetail(null)} onSelectCleaning={setSelectedCleaning} />
      )}
      {selectedCleaning && (
        <CleaningDetailModal cleaning={selectedCleaning} onClose={() => setSelectedCleaning(null)} />
      )}
    </div>
  )
}

function DailyChart({ data }: { data: { date: string; count: number; avgDuration: number; housesPerCleaner: number }[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null)
  if (!data.length) return <p className="text-center py-8 text-[12px]" style={{ color: C.muted }}>Sin datos</p>
  
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const maxDuration = Math.max(...data.map(d => d.avgDuration), 1)
  
  // Chart dimensions
  const chartWidth = 100 // percentage based
  const chartHeight = 120
  const paddingX = 12 // percentage
  const usableWidth = chartWidth - paddingX * 2
  
  // Calculate line path points
  const linePoints = data.map((d, i) => {
    const x = paddingX + (i / Math.max(data.length - 1, 1)) * usableWidth
    const y = chartHeight - (d.avgDuration / maxDuration) * chartHeight + 10
    return { x, y }
  })
  
  // Create smooth SVG path
  const linePath = linePoints.length > 1 
    ? `M ${linePoints[0].x} ${linePoints[0].y} ` + linePoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : ''
  
  return (
    <div className="relative h-[200px]">
      {/* Y-axis labels left (count) */}
      <div className="absolute left-0 top-2 h-[130px] flex flex-col justify-between text-[9px] font-bold" style={{ color: C.primary, width: 28 }}>
        <span>{maxCount}</span>
        <span>{Math.round(maxCount / 2)}</span>
        <span>0</span>
      </div>
      
      {/* Y-axis labels right (duration) */}
      <div className="absolute right-0 top-2 h-[130px] flex flex-col justify-between text-[9px] font-bold text-right" style={{ color: C.amber, width: 50 }}>
        <span>{Math.floor(maxDuration / 60)}h{String(maxDuration % 60).padStart(2, '0')}m</span>
        <span>{Math.floor(maxDuration / 2 / 60)}h{String(Math.round(maxDuration / 2) % 60).padStart(2, '0')}m</span>
        <span>0m</span>
      </div>
      
      {/* Chart area */}
      <div className="absolute left-8 right-14 top-2 h-[130px]">
        {/* SVG for trend line - rendered BEHIND bars */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 140" preserveAspectRatio="none">
          {linePath && (
            <path d={linePath} fill="none" stroke={C.amber} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
        
        {/* Bars */}
        <div className="relative flex items-end justify-between h-full gap-1 px-1">
          {data.map((d) => {
            const barHeight = (d.count / maxCount) * 120
            const dotY = 130 - (d.avgDuration / maxDuration) * 120
            
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center relative" style={{ minWidth: 16, maxWidth: 40 }}>
                {/* Bar */}
                <div 
                  className="w-full rounded-t-lg cursor-pointer transition-all hover:scale-105 hover:brightness-110" 
                  style={{ 
                    height: Math.max(barHeight, 4), 
                    background: `linear-gradient(180deg, ${C.primary}, ${C.blue})`, 
                    marginTop: 'auto', 
                    boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                  }}
                  onMouseEnter={(e) => { 
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltip({ 
                      x: rect.left + rect.width / 2, 
                      y: rect.top - 10, 
                      content: `📅 ${d.date}\n🏠 ${d.count} limpiezas\n⏱️ ${Math.floor(d.avgDuration / 60)}h${String(d.avgDuration % 60).padStart(2, '0')}m prom.\n👤 ${d.housesPerCleaner} casas/cleaner` 
                    }) 
                  }}
                  onMouseLeave={() => setTooltip(null)} 
                />
                {/* Dot on line */}
                <div 
                  className="absolute w-2.5 h-2.5 rounded-full border-2 border-white z-10" 
                  style={{ background: C.amber, top: dotY - 5, left: '50%', transform: 'translateX(-50%)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} 
                />
              </div>
            )
          })}
        </div>
      </div>
      
      {/* X-axis labels */}
      <div className="absolute left-8 right-14 bottom-0 flex justify-between px-1">
        {data.length <= 8 ? data.map(d => (
          <span key={d.date} className="text-[9px] font-medium flex-1 text-center" style={{ color: C.slate }}>
            {d.date.slice(5)}
          </span>
        )) : (
          <>
            <span className="text-[9px] font-medium" style={{ color: C.slate }}>{data[0]?.date.slice(5)}</span>
            <span className="text-[9px] font-medium" style={{ color: C.slate }}>{data[Math.floor(data.length / 2)]?.date.slice(5)}</span>
            <span className="text-[9px] font-medium" style={{ color: C.slate }}>{data[data.length - 1]?.date.slice(5)}</span>
          </>
        )}
      </div>
      
      {/* Tooltip */}
      {tooltip && (
        <div 
          className="fixed z-50 px-3 py-2 rounded-xl text-[11px] font-medium whitespace-pre-line pointer-events-none" 
          style={{ 
            background: C.ink, 
            color: 'white', 
            left: tooltip.x, 
            top: tooltip.y, 
            transform: 'translate(-50%, -100%)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)' 
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}

function DayOfWeekChart({ data }: { data: { name: string; count: number; avgDuration: number; housesPerCleaner: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const colors = [C.blue, C.teal, C.green, C.amber, C.primary, C.purple, C.red]
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-3">
          <span className="text-[11px] font-bold w-8" style={{ color: C.ink }}>{d.name}</span>
          <div className="flex-1 h-5 rounded-lg overflow-hidden relative" style={{ background: C.bg }}>
            <div className="h-full rounded-lg" style={{ width: `${(d.count / maxCount) * 100}%`, background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]}CC)`, minWidth: d.count > 0 ? 30 : 0 }} />
            {d.count > 0 && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">{d.count}</span>}
          </div>
          <span className="text-[9px] font-medium w-14 text-center" style={{ color: C.muted }}>{d.avgDuration > 0 ? `${Math.floor(d.avgDuration / 60)}h${d.avgDuration % 60}m` : '--'}</span>
          <span className="text-[9px] font-bold w-10 text-center" style={{ color: d.housesPerCleaner > 0 ? C.primary : C.muted }}>{d.housesPerCleaner > 0 ? d.housesPerCleaner.toFixed(1) : '--'}</span>
        </div>
      ))}
    </div>
  )
}

function RatingChart({ data }: { data: { good: number; normal: number; bad: number; total: number } }) {
  if (data.total === 0) return <p className="text-center py-8 text-[12px]" style={{ color: C.muted }}>Sin ratings</p>
  const items = [
    { label: 'Bueno (3⭐)', value: data.good, pct: Math.round((data.good / data.total) * 100), color: C.green },
    { label: 'Normal (2⭐)', value: data.normal, pct: Math.round((data.normal / data.total) * 100), color: C.amber },
    { label: 'Malo (1⭐)', value: data.bad, pct: Math.round((data.bad / data.total) * 100), color: C.red },
  ]
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold" style={{ color: C.ink }}>{item.label}</span>
            <span className="text-[12px] font-black" style={{ color: item.color }}>{item.value} ({item.pct}%)</span>
          </div>
          <div className="h-5 rounded-full overflow-hidden" style={{ background: C.bg }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(item.pct, 5)}%`, background: `linear-gradient(90deg, ${item.color}40, ${item.color})` }} />
          </div>
        </div>
      ))}
      <p className="text-center text-[10px] pt-2 font-medium" style={{ color: C.muted }}>Total: {data.total} con rating</p>
    </div>
  )
}

function WaterfallChart({ data, lateStats }: { data: { scheduled: number; ratingEffect: number; otherEffect: number; actual: number; hasData?: boolean; avgRating?: number }; lateStats: { lateRate: number; lateHours: number } }) {
  if (!data.hasData || (data.scheduled === 0 && data.actual === 0)) return <p className="text-center py-8 text-[12px]" style={{ color: C.muted }}>Sin datos suficientes</p>
  
  // Scale: make effects more dramatic by using smaller base height
  const baseH = 80
  const effectScale = 4
  const scheduledH = baseH
  const ratingH = Math.max(Math.abs(data.ratingEffect) * effectScale * 15, 25)
  const otherH = Math.max(Math.abs(data.otherEffect) * effectScale * 8, 25)
  const actualH = baseH * (data.actual / Math.max(data.scheduled, 0.1))
  
  return (
    <div className="flex items-end justify-around h-[280px] px-4 gap-6 pt-4">
      {/* Programado */}
      <div className="flex flex-col items-center flex-1">
        <div className="relative w-full flex justify-center" style={{ height: 160 }}>
          <div className="w-20 rounded-xl relative overflow-hidden" style={{ height: scheduledH, background: `linear-gradient(180deg, ${C.blue}, ${C.blue}CC)`, position: 'absolute', bottom: 0, boxShadow: `0 4px 12px ${C.blue}40` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[14px] font-black text-white">{data.scheduled}h</span>
          </div>
        </div>
        <p className="text-[12px] font-bold mt-3" style={{ color: C.ink }}>Programado</p>
        <p className="text-[9px]" style={{ color: C.muted }}>Total horas</p>
      </div>

      {/* Rating */}
      <div className="flex flex-col items-center flex-1">
        <div className="relative w-full flex justify-center" style={{ height: 160 }}>
          <div className="w-20 rounded-xl relative overflow-hidden" style={{ height: ratingH, background: `linear-gradient(180deg, ${data.ratingEffect >= 0 ? C.red : C.green}, ${data.ratingEffect >= 0 ? C.red : C.green}CC)`, position: 'absolute', bottom: 40, boxShadow: `0 4px 12px ${data.ratingEffect >= 0 ? C.red : C.green}40` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[12px] font-black text-white">{data.ratingEffect >= 0 ? '+' : ''}{data.ratingEffect}h</span>
          </div>
        </div>
        <p className="text-[12px] font-bold mt-3" style={{ color: C.ink }}>Rating</p>
        <p className="text-[9px]" style={{ color: data.ratingEffect >= 0 ? C.red : C.green }}>{data.ratingEffect >= 0 ? '↑ Aumenta' : '↓ Reduce'}</p>
        <div className="mt-2 text-center p-2 rounded-lg w-full" style={{ background: C.bg }}>
          <p className="text-[9px]" style={{ color: C.muted }}>Prog: <b>2.0</b> | Real: <b style={{ color: C.primary }}>{data.avgRating}</b></p>
          <p className="text-[7px] mt-0.5" style={{ color: C.slate }}>Rating 3=limpio=-5min, Rating 1=sucio=+10min</p>
        </div>
      </div>

      {/* Otros */}
      <div className="flex flex-col items-center flex-1">
        <div className="relative w-full flex justify-center" style={{ height: 160 }}>
          <div className="w-20 rounded-xl relative overflow-hidden" style={{ height: otherH, background: `linear-gradient(180deg, ${data.otherEffect >= 0 ? C.amber : C.green}, ${data.otherEffect >= 0 ? C.amber : C.green}CC)`, position: 'absolute', bottom: 40, boxShadow: `0 4px 12px ${data.otherEffect >= 0 ? C.amber : C.green}40` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[12px] font-black text-white">{data.otherEffect >= 0 ? '+' : ''}{data.otherEffect}h</span>
          </div>
        </div>
        <p className="text-[12px] font-bold mt-3" style={{ color: C.ink }}>Otros</p>
        <p className="text-[9px]" style={{ color: data.otherEffect >= 0 ? C.amber : C.green }}>{data.otherEffect >= 0 ? '↑ Aumenta' : '↓ Reduce'}</p>
        <div className="mt-2 text-center p-2 rounded-lg w-full" style={{ background: C.bg }}>
          <p className="text-[9px]" style={{ color: C.muted }}>Retrasos: <b style={{ color: C.red }}>{lateStats.lateRate}%</b></p>
          <p className="text-[9px]" style={{ color: C.muted }}>Horas retraso: <b style={{ color: C.red }}>{lateStats.lateHours}h</b></p>
        </div>
      </div>

      {/* Real */}
      <div className="flex flex-col items-center flex-1">
        <div className="relative w-full flex justify-center" style={{ height: 160 }}>
          <div className="w-20 rounded-xl relative overflow-hidden" style={{ height: actualH, background: `linear-gradient(180deg, ${C.primary}, ${C.primary}CC)`, position: 'absolute', bottom: 0, boxShadow: `0 4px 12px ${C.primary}40` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[14px] font-black text-white">{data.actual}h</span>
          </div>
        </div>
        <p className="text-[12px] font-bold mt-3" style={{ color: C.ink }}>Real</p>
        <p className="text-[9px]" style={{ color: C.muted }}>Total horas</p>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, subtitle, color }: { icon: React.ReactNode; label: string; value: string; subtitle: string; color: string }) {
  return (
    <div className="p-3 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${color}15`, color }}>{icon}</div>
        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</p>
      </div>
      <p className="font-black text-[22px] leading-none" style={{ color }}>{value}</p>
      <p className="text-[9px] font-medium mt-0.5" style={{ color: C.muted }}>{subtitle}</p>
    </div>
  )
}

function Badge({ value, suffix = '', goodThreshold = 80 }: { value: number | null; suffix?: string; goodThreshold?: number }) {
  if (value === null) return <span style={{ color: C.muted }}>--</span>
  const color = value >= goodThreshold ? C.green : value >= 50 ? C.amber : C.red
  const bg = value >= goodThreshold ? '#DCFCE7' : value >= 50 ? '#FEF3C7' : '#FEE2E2'
  return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: bg, color }}>{value}{suffix}</span>
}

function PropertyDetailModal({ propertyText, cleanings, onClose, onSelectCleaning }: { propertyText: string; cleanings: Cleaning[]; onClose: () => void; onSelectCleaning: (c: Cleaning) => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden" style={{ background: C.white, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div><p className="font-black text-[16px]" style={{ color: C.ink }}>{propertyText}</p><p className="text-[11px]" style={{ color: C.muted }}>{cleanings.length} limpiezas</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.bg }}><X className="w-4 h-4" style={{ color: C.slate }} /></button>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {cleanings.map(c => {
            const duration = c.startTime && c.endTime ? Math.round((new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000) : null
            return (
              <button key={c.id} onClick={() => onSelectCleaning(c)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold" style={{ color: C.ink }}>{c.date}</span>
                    {c.rating && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: c.rating >= 2.5 ? '#DCFCE7' : '#FEF3C7', color: c.rating >= 2.5 ? C.green : C.amber }}>{c.rating}⭐</span>}
                    {(c.cleanerCount || 0) > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: C.primaryLight, color: C.primary }}>{c.cleanerCount} 👤</span>}
                  </div>
                  <p className="text-[10px] truncate" style={{ color: C.muted }}>{c.cleanerNames || c.staffListText || 'Sin asignar'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold" style={{ color: c.status === 'Done' ? C.green : C.slate }}>{c.status === 'Done' ? '✓' : c.status}</p>
                  {duration && <p className="text-[10px]" style={{ color: C.muted }}>{Math.floor(duration / 60)}h {duration % 60}m</p>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CleaningDetailModal({ cleaning, onClose }: { cleaning: Cleaning; onClose: () => void }) {
  const duration = cleaning.startTime && cleaning.endTime ? Math.round((new Date(cleaning.endTime).getTime() - new Date(cleaning.startTime).getTime()) / 60000) : null
  const isLate = cleaning.scheduledTime && cleaning.startTime ? (new Date(cleaning.startTime).getTime() - new Date(cleaning.scheduledTime).getTime()) > 15 * 60000 : false
  const lateMin = cleaning.scheduledTime && cleaning.startTime ? Math.round((new Date(cleaning.startTime).getTime() - new Date(cleaning.scheduledTime).getTime()) / 60000) : 0
  const fmt = (v?: string | null) => { if (!v) return '--:--'; try { return new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) } catch { return '--:--' } }
  
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.8)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: C.white }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div><p className="font-black text-[16px]" style={{ color: C.ink }}>{cleaning.propertyText}</p><p className="text-[11px]" style={{ color: C.muted }}>{cleaning.cleaningId} · {cleaning.date}</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.bg }}><X className="w-4 h-4" style={{ color: C.slate }} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <InfoBox label="Equipo" value={cleaning.cleanerNames || cleaning.staffListText || 'Sin asignar'} />
            <InfoBox label="Estado" value={cleaning.status} color={cleaning.status === 'Done' ? C.green : undefined} />
            <InfoBox label="Inicio Prog." value={fmt(cleaning.scheduledTime)} />
            <InfoBox label="Inicio Real" value={fmt(cleaning.startTime)} color={cleaning.startTime ? C.green : undefined} />
            <InfoBox label="Fin Prog." value={fmt(cleaning.estimatedEndTime)} />
            <InfoBox label="Fin Real" value={fmt(cleaning.endTime)} color={cleaning.endTime ? C.green : undefined} />
          </div>
          {(cleaning.cleanerCount || 0) > 0 && <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: C.primaryLight }}><span className="text-[12px] font-medium" style={{ color: C.slate }}>Cleaners asignados</span><span className="font-bold text-[14px]" style={{ color: C.primary }}>{cleaning.cleanerCount} 👤</span></div>}
          {cleaning.labor > 0 && <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: C.bg }}><span className="text-[12px] font-medium" style={{ color: C.slate }}>Tiempo estimado (Labor)</span><span className="font-bold text-[14px]" style={{ color: C.blue }}>{Math.floor(cleaning.labor / 60)}h {cleaning.labor % 60}m</span></div>}
          {cleaning.rating && <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: cleaning.rating >= 2.5 ? '#DCFCE7' : '#FEF3C7' }}><Star className="w-5 h-5" style={{ color: cleaning.rating >= 2.5 ? C.green : C.amber }} /><span className="font-black text-[18px]" style={{ color: cleaning.rating >= 2.5 ? C.green : C.amber }}>{cleaning.rating}</span><span className="text-[12px] font-medium" style={{ color: C.slate }}>{cleaning.rating === 3 ? 'Bueno' : cleaning.rating === 2 ? 'Normal' : 'Malo'}</span></div>}
          {duration && <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: C.bg }}><span className="text-[12px] font-medium" style={{ color: C.slate }}>Duración total</span><span className="font-bold text-[14px]" style={{ color: C.ink }}>{Math.floor(duration / 60)}h {duration % 60}m</span></div>}
          {isLate && <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: '#FEE2E2' }}><span className="text-[12px] font-medium" style={{ color: C.red }}>Retraso al inicio</span><span className="font-bold text-[14px]" style={{ color: C.red }}>+{lateMin} min</span></div>}
          <a href={`https://shineup-ops.vercel.app/?cleaning=${cleaning.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white font-bold text-[12px]" style={{ background: C.primary }}><ExternalLink className="w-4 h-4" /> Ver en Ops</a>
        </div>
      </div>
    </div>
  )
}

function InfoBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="p-2 rounded-xl" style={{ background: C.bg }}><p className="text-[8px] font-bold uppercase tracking-wide mb-0.5" style={{ color: C.muted }}>{label}</p><p className="font-bold text-[12px]" style={{ color: color || C.ink }}>{value}</p></div>
}
