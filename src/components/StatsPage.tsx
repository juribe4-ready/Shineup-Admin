import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Clock, Star, Zap, AlertTriangle, AlertCircle, Package,
  ExternalLink, X, Home, Calendar, Users, BarChart3, Activity
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
  labor: number
}

interface StatsData {
  cleanings: Cleaning[]
  summary: {
    total: number
    done: number
    avgRating: number | null
    avgDurationMin: number | null
    onTimeRate: number | null
    lateStarts: number
    overtime: number
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
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
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
      if (dateFrom && c.date < dateFrom) return false
      if (dateTo && c.date > dateTo) return false
      return true
    })
  }, [data, selectedProperty, dateFrom, dateTo])

  const filteredIncidents = useMemo(() => {
    if (!data) return { open: 0, closed: 0 }
    if (selectedProperty === 'all') return data.incidents
    const prop = data.byProperty.find(p => p.propertyText === selectedProperty)
    return { open: prop?.incidents || 0, closed: 0 }
  }, [data, selectedProperty])

  const filteredInventory = useMemo(() => {
    if (!data) return { outOfStock: 0, low: 0 }
    if (selectedProperty === 'all') return data.inventory
    const prop = data.byProperty.find(p => p.propertyText === selectedProperty)
    return { outOfStock: 0, low: prop?.inventory || 0 }
  }, [data, selectedProperty])

  const filteredMetrics = useMemo(() => {
    const cleanings = filteredCleanings
    const done = cleanings.filter(c => c.status === 'Done')
    
    const withTimes = done.filter(c => c.scheduledTime && c.startTime)
    const onTime = withTimes.filter(c => {
      const diff = Math.abs(new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime())
      return diff <= 15 * 60000
    })
    const onTimeRate = withTimes.length > 0 ? Math.round((onTime.length / withTimes.length) * 100) : null
    
    const lateStarts = withTimes.filter(c => {
      return (new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime()) > 15 * 60000
    }).length
    
    const withEstimates = done.filter(c => c.endTime && c.estimatedEndTime)
    const overtime = withEstimates.filter(c => {
      return (new Date(c.endTime!).getTime() - new Date(c.estimatedEndTime!).getTime()) > 15 * 60000
    }).length
    
    const ratings = done.filter(c => c.rating).map(c => c.rating!)
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
    
    const durations = done.filter(c => c.startTime && c.endTime).map(c => {
      return (new Date(c.endTime!).getTime() - new Date(c.startTime!).getTime()) / 60000
    })
    const avgDurationMin = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
    
    return { total: cleanings.length, done: done.length, onTimeRate, lateStarts, overtime, avgRating, avgDurationMin }
  }, [filteredCleanings])

  // Daily stats
  const dailyStats = useMemo(() => {
    if (!filteredCleanings.length) return []
    
    const byDate: Record<string, { count: number; totalDuration: number; doneCount: number; totalCleaners: number; totalLabor: number }> = {}
    filteredCleanings.forEach(c => {
      if (!byDate[c.date]) byDate[c.date] = { count: 0, totalDuration: 0, doneCount: 0, totalCleaners: 0, totalLabor: 0 }
      byDate[c.date].count++
      byDate[c.date].totalCleaners += c.cleanerCount || 0
      byDate[c.date].totalLabor += c.labor || 0
      if (c.status === 'Done' && c.startTime && c.endTime) {
        const dur = (new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000
        byDate[c.date].totalDuration += dur
        byDate[c.date].doneCount++
      }
    })
    
    return Object.entries(byDate)
      .map(([date, stats]) => ({
        date,
        count: stats.count,
        avgDuration: stats.doneCount > 0 ? Math.round(stats.totalDuration / stats.doneCount) : 0,
        cleaners: stats.totalCleaners,
        housesPerCleaner: stats.totalCleaners > 0 ? Math.round((stats.count / stats.totalCleaners) * 10) / 10 : 0,
        totalLabor: stats.totalLabor,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredCleanings])

  // Waterfall data - using labor
  const waterfallData = useMemo(() => {
    const done = filteredCleanings.filter(c => c.status === 'Done' && c.startTime && c.endTime)
    
    if (done.length === 0) return { scheduled: 0, ratingEffect: 0, otherEffect: 0, actual: 0, hasData: false }
    
    let totalScheduledMin = 0
    let totalActualMin = 0
    let ratingEffect = 0
    
    done.forEach(c => {
      // Use labor as scheduled time, or estimate from actual if no labor
      const laborMin = c.labor > 0 ? c.labor : 0
      totalScheduledMin += laborMin
      
      const actual = (new Date(c.endTime!).getTime() - new Date(c.startTime!).getTime()) / 60000
      totalActualMin += actual
      
      if (c.rating === 3) ratingEffect -= 5
      else if (c.rating === 1) ratingEffect += 10
    })
    
    // If no labor data, estimate scheduled from actual
    if (totalScheduledMin === 0) {
      totalScheduledMin = totalActualMin * 0.9 // Assume 90% efficiency baseline
    }
    
    const diff = totalActualMin - totalScheduledMin
    const otherEffect = diff - ratingEffect
    
    return {
      scheduled: Math.round(totalScheduledMin / 60 * 10) / 10,
      ratingEffect: Math.round(ratingEffect / 60 * 10) / 10,
      otherEffect: Math.round(otherEffect / 60 * 10) / 10,
      actual: Math.round(totalActualMin / 60 * 10) / 10,
      hasData: true,
    }
  }, [filteredCleanings])

  // Productivity stats
  const productivityStats = useMemo(() => {
    if (!dailyStats.length) return { avgHousesPerCleaner: 0, totalHouses: 0, totalCleanerDays: 0, bestDay: null, worstDay: null }
    
    const totalHouses = dailyStats.reduce((s, d) => s + d.count, 0)
    const totalCleaners = dailyStats.reduce((s, d) => s + d.cleaners, 0)
    const avgHousesPerCleaner = totalCleaners > 0 ? Math.round((totalHouses / totalCleaners) * 10) / 10 : 0
    
    const withCleaners = dailyStats.filter(d => d.cleaners > 0)
    const bestDay = withCleaners.length > 0 ? withCleaners.reduce((best, d) => d.housesPerCleaner > best.housesPerCleaner ? d : best) : null
    const worstDay = withCleaners.length > 0 ? withCleaners.reduce((worst, d) => d.housesPerCleaner < worst.housesPerCleaner ? d : worst) : null
    
    return { avgHousesPerCleaner, totalHouses, totalCleanerDays: totalCleaners, bestDay, worstDay }
  }, [dailyStats])

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
        const totalActual = withBoth.reduce((s, c) => {
          return s + (new Date(c.endTime!).getTime() - new Date(c.startTime!).getTime()) / 60000
        }, 0)
        if (totalActual > 0) {
          efficiencyRate = Math.round((totalEstimated / totalActual) * 100)
        }
      }
      
      const withTimes = done.filter(c => c.scheduledTime && c.startTime)
      const onTime = withTimes.filter(c => {
        const diff = Math.abs(new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime())
        return diff <= 15 * 60000
      })
      const onTimeRate = withTimes.length > 0 ? Math.round((onTime.length / withTimes.length) * 100) : null
      
      const propData = data.byProperty.find(p => p.propertyText === propertyText)
      
      const totalCleaners = cleanings.reduce((s, c) => s + (c.cleanerCount || 0), 0)
      const avgCleaners = cleanings.length > 0 ? Math.round((totalCleaners / cleanings.length) * 10) / 10 : 0
      
      return {
        propertyText,
        total: cleanings.length,
        avgRating,
        avgDurationMin,
        efficiencyRate,
        onTimeRate,
        incidents: propData?.incidents || 0,
        inventory: propData?.inventory || 0,
        cleanings,
        avgCleaners,
      }
    }).sort((a, b) => b.total - a.total)
  }, [data, filteredCleanings])

  // Rating distribution
  const ratingDistribution = useMemo(() => {
    const done = filteredCleanings.filter(c => c.status === 'Done' && c.rating)
    const good = done.filter(c => c.rating === 3).length
    const normal = done.filter(c => c.rating === 2).length
    const bad = done.filter(c => c.rating === 1).length
    const total = done.length
    return { good, normal, bad, total }
  }, [filteredCleanings])

  // Day of week distribution
  const dayOfWeekStats = useMemo(() => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const counts = [0, 0, 0, 0, 0, 0, 0]
    const durations = [0, 0, 0, 0, 0, 0, 0]
    const doneCounts = [0, 0, 0, 0, 0, 0, 0]
    
    filteredCleanings.forEach(c => {
      const d = new Date(c.date).getDay()
      counts[d]++
      if (c.status === 'Done' && c.startTime && c.endTime) {
        durations[d] += (new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000
        doneCounts[d]++
      }
    })
    
    return days.map((name, i) => ({
      name,
      count: counts[i],
      avgDuration: doneCounts[i] > 0 ? Math.round(durations[i] / doneCounts[i]) : 0,
    }))
  }, [filteredCleanings])

  const hasFilters = selectedProperty !== 'all' || dateFrom || dateTo

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
            <p className="text-[12px] font-medium" style={{ color: C.muted }}>
              {filteredCleanings.length} limpiezas · {filteredMetrics.done} completadas
            </p>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<TrendingUp className="w-3.5 h-3.5" />} label="Completadas" value={`${filteredMetrics.done}`} subtitle={`de ${filteredMetrics.total}`} color={C.green} />
        <KpiCard icon={<Star className="w-3.5 h-3.5" />} label="Rating" value={filteredMetrics.avgRating?.toFixed(1) || '--'} subtitle="promedio" color={filteredMetrics.avgRating && filteredMetrics.avgRating >= 2.5 ? C.green : C.amber} />
        <KpiCard icon={<Clock className="w-3.5 h-3.5" />} label="Duración" value={filteredMetrics.avgDurationMin ? `${Math.floor(filteredMetrics.avgDurationMin / 60)}h ${filteredMetrics.avgDurationMin % 60}m` : '--'} subtitle="promedio" color={C.blue} />
        <KpiCard icon={<Zap className="w-3.5 h-3.5" />} label="Puntualidad" value={filteredMetrics.onTimeRate !== null ? `${filteredMetrics.onTimeRate}%` : '--'} subtitle="a tiempo ±15m" color={filteredMetrics.onTimeRate && filteredMetrics.onTimeRate >= 70 ? C.green : C.amber} />
        <KpiCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Retrasos" value={String(filteredMetrics.lateStarts)} subtitle=">15m tarde" color={filteredMetrics.lateStarts > 0 ? C.red : C.green} />
        <KpiCard icon={<Activity className="w-3.5 h-3.5" />} label="Casas/Cleaner" value={productivityStats.avgHousesPerCleaner.toFixed(1)} subtitle="promedio diario" color={C.primary} />
      </div>

      {/* Incidents & Inventory */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4" style={{ color: C.amber }} />
            <p className="text-[12px] font-bold" style={{ color: C.ink }}>Incidentes {selectedProperty !== 'all' && `(${selectedProperty})`}</p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="font-black text-[28px] leading-none" style={{ color: C.amber }}>{filteredIncidents.open}</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: C.muted }}>Abiertos</p>
            </div>
            {selectedProperty === 'all' && (
              <>
                <div className="h-8 w-px" style={{ background: C.border }} />
                <div>
                  <p className="font-black text-[28px] leading-none" style={{ color: C.green }}>{filteredIncidents.closed}</p>
                  <p className="text-[10px] font-medium mt-1" style={{ color: C.muted }}>Cerrados</p>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="p-4 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4" style={{ color: C.red }} />
            <p className="text-[12px] font-bold" style={{ color: C.ink }}>Rupturas {selectedProperty !== 'all' && `(${selectedProperty})`}</p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="font-black text-[28px] leading-none" style={{ color: C.red }}>{filteredInventory.outOfStock}</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: C.muted }}>Sin Stock</p>
            </div>
            <div className="h-8 w-px" style={{ background: C.border }} />
            <div>
              <p className="font-black text-[28px] leading-none" style={{ color: C.amber }}>{filteredInventory.low}</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: C.muted }}>Bajo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cleanings Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: C.primary }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Limpiezas ({filteredCleanings.length})</p>
          </div>
          <p className="text-[10px]" style={{ color: C.muted }}>Clic para ver detalle</p>
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
                const duration = c.startTime && c.endTime 
                  ? Math.round((new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000)
                  : null
                const isLate = c.scheduledTime && c.startTime
                  ? (new Date(c.startTime).getTime() - new Date(c.scheduledTime).getTime()) > 15 * 60000
                  : false
                const cleanerCount = c.cleanerCount || 0
                
                return (
                  <tr key={c.id} 
                    className="cursor-pointer hover:bg-gray-50 transition-colors" 
                    style={{ borderBottom: `1px solid ${C.border}` }}
                    onClick={() => setSelectedCleaning(c)}>
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
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: c.rating >= 2.5 ? '#DCFCE7' : '#FEF3C7', color: c.rating >= 2.5 ? C.green : C.amber }}>
                          {c.rating}⭐
                        </span>
                      ) : '--'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium" style={{ color: C.slate }}>
                      {duration ? `${Math.floor(duration / 60)}h${duration % 60}m` : '--'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isLate ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#FEE2E2', color: C.red }}>Tarde</span>
                      ) : c.startTime ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#DCFCE7', color: C.green }}>OK</span>
                      ) : '--'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[10px] font-bold" style={{ color: c.status === 'Done' ? C.green : C.slate }}>
                        {c.status === 'Done' ? '✓' : c.status}
                      </span>
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
        {/* Daily Chart - More Visual */}
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

        {/* Day of Week Distribution */}
        <div className="rounded-2xl overflow-hidden p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4" style={{ color: C.teal }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Por Día de Semana</p>
          </div>
          <DayOfWeekChart data={dayOfWeekStats} />
        </div>
      </div>

      {/* Productivity & Ratings Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Productivity Summary */}
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
            <span style={{ color: C.muted }}>Cleaner-días: <b style={{ color: C.ink }}>{productivityStats.totalCleanerDays}</b></span>
          </div>
        </div>

        {/* Rating Distribution */}
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
        <WaterfallChart data={waterfallData} />
      </div>

      {/* Properties Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4" style={{ color: C.primary }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Propiedades ({propertyStats.length})</p>
          </div>
          <p className="text-[10px]" style={{ color: C.muted }}>Clic para ver detalle</p>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0" style={{ background: C.bg }}>
              <tr>
                <th className="px-4 py-2 text-left font-bold" style={{ color: C.muted }}>Propiedad</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Limpiezas</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Cleaners</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Rating</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Tiempo</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Puntualidad</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Eficiencia</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Incidentes</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Rupturas</th>
              </tr>
            </thead>
            <tbody>
              {propertyStats.map((prop) => (
                <tr key={prop.propertyText} 
                  className="cursor-pointer hover:bg-gray-50 transition-colors" 
                  style={{ borderBottom: `1px solid ${C.border}` }}
                  onClick={() => setSelectedPropertyDetail(prop.propertyText)}>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: C.ink }}>{prop.propertyText}</td>
                  <td className="px-3 py-2.5 text-center font-bold" style={{ color: C.slate }}>{prop.total}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: C.primaryLight, color: C.primary }}>
                      ~{prop.avgCleaners}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {prop.avgRating ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: prop.avgRating >= 2.5 ? '#DCFCE7' : '#FEF3C7', color: prop.avgRating >= 2.5 ? C.green : C.amber }}>
                        {prop.avgRating.toFixed(1)}⭐
                      </span>
                    ) : '--'}
                  </td>
                  <td className="px-3 py-2.5 text-center font-medium" style={{ color: C.slate }}>
                    {prop.avgDurationMin ? `${Math.floor(prop.avgDurationMin / 60)}h${prop.avgDurationMin % 60}m` : '--'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge value={prop.onTimeRate} suffix="%" goodThreshold={70} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge value={prop.efficiencyRate} suffix="%" goodThreshold={90} warnThreshold={70} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {prop.incidents > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#FEF3C7', color: C.amber }}>{prop.incidents}</span>
                    ) : <span style={{ color: C.muted }}>0</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {prop.inventory > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#FEE2E2', color: C.red }}>{prop.inventory}</span>
                    ) : <span style={{ color: C.muted }}>0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedPropertyDetail && (
        <PropertyDetailModal 
          propertyText={selectedPropertyDetail}
          cleanings={propertyStats.find(p => p.propertyText === selectedPropertyDetail)?.cleanings || []}
          onClose={() => setSelectedPropertyDetail(null)}
          onSelectCleaning={setSelectedCleaning}
        />
      )}

      {selectedCleaning && (
        <CleaningDetailModal cleaning={selectedCleaning} onClose={() => setSelectedCleaning(null)} />
      )}
    </div>
  )
}

// Daily Chart - More Visual
function DailyChart({ data }: { data: { date: string; count: number; avgDuration: number; housesPerCleaner: number }[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null)
  
  if (!data.length) return <p className="text-center py-8 text-[12px]" style={{ color: C.muted }}>Sin datos</p>
  
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const maxDuration = Math.max(...data.map(d => d.avgDuration), 1)
  
  return (
    <div className="relative h-[180px]">
      <div className="absolute left-0 top-0 h-[140px] flex flex-col justify-between text-[8px] font-bold" style={{ color: C.primary, width: 24 }}>
        <span>{maxCount}</span>
        <span>{Math.round(maxCount / 2)}</span>
        <span>0</span>
      </div>
      <div className="absolute right-0 top-0 h-[140px] flex flex-col justify-between text-[8px] font-bold text-right" style={{ color: C.amber, width: 40 }}>
        <span>{Math.floor(maxDuration / 60)}h{maxDuration % 60}m</span>
        <span>{Math.floor(maxDuration / 2 / 60)}h{Math.round(maxDuration / 2) % 60}m</span>
        <span>0m</span>
      </div>
      
      <div className="flex items-end justify-between gap-1 h-[140px] px-12">
        {data.map((d, i) => {
          const barHeight = (d.count / maxCount) * 120
          const lineY = 140 - (d.avgDuration / maxDuration) * 120
          const prevLineY = i > 0 ? 140 - (data[i - 1].avgDuration / maxDuration) * 120 : lineY
          
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center relative" style={{ minWidth: 14 }}>
              <div 
                className="w-full max-w-[22px] rounded-t-lg cursor-pointer transition-all hover:scale-105" 
                style={{ 
                  height: barHeight, 
                  background: `linear-gradient(180deg, ${C.primary}, ${C.blue})`,
                  marginTop: 'auto',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTooltip({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 10,
                    content: `📅 ${d.date}\n🏠 ${d.count} limpiezas\n⏱️ ${Math.floor(d.avgDuration / 60)}h${d.avgDuration % 60}m prom.\n👤 ${d.housesPerCleaner} casas/cleaner`
                  })
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              <div className="absolute w-3 h-3 rounded-full border-2 border-white" 
                style={{ background: C.amber, top: lineY - 6, left: '50%', transform: 'translateX(-50%)', boxShadow: '0 2px 4px rgba(245,158,11,0.4)' }} />
              {i > 0 && (
                <svg className="absolute pointer-events-none" style={{ top: 0, left: '-50%', width: '100%', height: 140, overflow: 'visible' }}>
                  <line x1="50%" y1={prevLineY} x2="150%" y2={lineY} stroke={C.amber} strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
            </div>
          )
        })}
      </div>
      
      <div className="flex justify-between px-12 mt-2">
        {data.length <= 10 ? data.map(d => (
          <span key={d.date} className="text-[8px] font-bold" style={{ color: C.slate, flex: 1, textAlign: 'center' }}>
            {d.date.slice(5)}
          </span>
        )) : (
          <>
            <span className="text-[9px] font-bold" style={{ color: C.slate }}>{data[0]?.date.slice(5)}</span>
            <span className="text-[9px] font-bold" style={{ color: C.slate }}>{data[Math.floor(data.length / 2)]?.date.slice(5)}</span>
            <span className="text-[9px] font-bold" style={{ color: C.slate }}>{data[data.length - 1]?.date.slice(5)}</span>
          </>
        )}
      </div>
      
      {tooltip && (
        <div className="fixed z-50 px-3 py-2 rounded-xl text-[11px] font-medium whitespace-pre-line pointer-events-none"
          style={{ 
            background: C.ink, 
            color: 'white', 
            left: tooltip.x, 
            top: tooltip.y, 
            transform: 'translate(-50%, -100%)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
          }}>
          {tooltip.content}
        </div>
      )}
    </div>
  )
}

// Day of Week Chart
function DayOfWeekChart({ data }: { data: { name: string; count: number; avgDuration: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const colors = [C.red, C.amber, C.green, C.teal, C.blue, C.primary, C.purple]
  
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-3">
          <span className="text-[11px] font-bold w-8" style={{ color: C.ink }}>{d.name}</span>
          <div className="flex-1 h-6 rounded-lg overflow-hidden relative" style={{ background: C.bg }}>
            <div 
              className="h-full rounded-lg transition-all"
              style={{ 
                width: `${(d.count / maxCount) * 100}%`, 
                background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]}CC)`,
                minWidth: d.count > 0 ? 30 : 0,
              }} 
            />
            {d.count > 0 && (
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">{d.count}</span>
            )}
          </div>
          <span className="text-[10px] font-medium w-12 text-right" style={{ color: C.muted }}>
            {d.avgDuration > 0 ? `${Math.floor(d.avgDuration / 60)}h${d.avgDuration % 60}m` : '--'}
          </span>
        </div>
      ))}
    </div>
  )
}

// Rating Chart
function RatingChart({ data }: { data: { good: number; normal: number; bad: number; total: number } }) {
  if (data.total === 0) return <p className="text-center py-8 text-[12px]" style={{ color: C.muted }}>Sin ratings</p>
  
  const items = [
    { label: 'Bueno (3⭐)', value: data.good, pct: Math.round((data.good / data.total) * 100), color: C.green, bg: '#DCFCE7' },
    { label: 'Normal (2⭐)', value: data.normal, pct: Math.round((data.normal / data.total) * 100), color: C.amber, bg: '#FEF3C7' },
    { label: 'Malo (1⭐)', value: data.bad, pct: Math.round((data.bad / data.total) * 100), color: C.red, bg: '#FEE2E2' },
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
            <div className="h-full rounded-full transition-all flex items-center justify-end pr-2" 
              style={{ width: `${Math.max(item.pct, 5)}%`, background: `linear-gradient(90deg, ${item.bg}, ${item.color}40)`, borderRight: `3px solid ${item.color}` }}>
            </div>
          </div>
        </div>
      ))}
      <p className="text-center text-[10px] pt-2 font-medium" style={{ color: C.muted }}>Total: {data.total} con rating</p>
    </div>
  )
}

// Waterfall Chart
function WaterfallChart({ data }: { data: { scheduled: number; ratingEffect: number; otherEffect: number; actual: number; hasData?: boolean } }) {
  if (!data.hasData || (data.scheduled === 0 && data.actual === 0)) {
    return <p className="text-center py-8 text-[12px]" style={{ color: C.muted }}>Sin datos suficientes para calcular</p>
  }
  
  const maxVal = Math.max(data.scheduled, data.actual, 0.1) * 1.2
  const scale = 120 / maxVal
  
  const bars = [
    { label: 'Programado', value: data.scheduled, cumStart: 0, color: C.blue, isTotal: true },
    { label: 'Rating', value: data.ratingEffect, cumStart: data.scheduled, color: data.ratingEffect >= 0 ? C.red : C.green, isTotal: false },
    { label: 'Otros', value: data.otherEffect, cumStart: data.scheduled + data.ratingEffect, color: data.otherEffect >= 0 ? C.amber : C.green, isTotal: false },
    { label: 'Real', value: data.actual, cumStart: 0, color: C.primary, isTotal: true },
  ]
  
  return (
    <div className="flex items-end justify-around h-[200px] px-4 gap-4 pt-4">
      {bars.map((bar) => {
        const barHeight = Math.abs(bar.value) * scale
        const barBottom = bar.isTotal ? 0 : (bar.value >= 0 ? bar.cumStart * scale : (bar.cumStart + bar.value) * scale)
        
        return (
          <div key={bar.label} className="flex flex-col items-center flex-1">
            <div className="relative w-full flex justify-center" style={{ height: 140 }}>
              <div 
                className="w-16 rounded-xl transition-all hover:scale-105 cursor-pointer relative overflow-hidden"
                style={{ 
                  height: Math.max(barHeight, 12), 
                  background: `linear-gradient(180deg, ${bar.color}, ${bar.color}CC)`,
                  position: 'absolute',
                  bottom: barBottom,
                  boxShadow: `0 4px 12px ${bar.color}40`,
                }}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white drop-shadow">
                  {bar.isTotal ? `${bar.value}h` : `${bar.value >= 0 ? '+' : ''}${bar.value}h`}
                </span>
              </div>
            </div>
            <p className="text-[11px] font-bold mt-3" style={{ color: C.ink }}>{bar.label}</p>
            <p className="text-[9px] font-medium" style={{ color: bar.isTotal ? C.muted : (bar.value >= 0 ? C.red : C.green) }}>
              {bar.isTotal ? 'Total' : (bar.value >= 0 ? '↑ Aumenta' : '↓ Reduce')}
            </p>
          </div>
        )
      })}
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

function Badge({ value, suffix = '', goodThreshold = 80, warnThreshold = 50 }: { value: number | null; suffix?: string; goodThreshold?: number; warnThreshold?: number }) {
  if (value === null) return <span style={{ color: C.muted }}>--</span>
  const color = value >= goodThreshold ? C.green : value >= warnThreshold ? C.amber : C.red
  const bg = value >= goodThreshold ? '#DCFCE7' : value >= warnThreshold ? '#FEF3C7' : '#FEE2E2'
  return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: bg, color }}>{value}{suffix}</span>
}

function PropertyDetailModal({ propertyText, cleanings, onClose, onSelectCleaning }: { 
  propertyText: string; cleanings: Cleaning[]; onClose: () => void; onSelectCleaning: (c: Cleaning) => void 
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden" style={{ background: C.white, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div>
            <p className="font-black text-[16px]" style={{ color: C.ink }}>{propertyText}</p>
            <p className="text-[11px]" style={{ color: C.muted }}>{cleanings.length} limpiezas</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.bg }}>
            <X className="w-4 h-4" style={{ color: C.slate }} />
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {cleanings.map(c => {
            const duration = c.startTime && c.endTime 
              ? Math.round((new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000)
              : null
            return (
              <button key={c.id} onClick={() => onSelectCleaning(c)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold" style={{ color: C.ink }}>{c.date}</span>
                    {c.rating && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: c.rating >= 2.5 ? '#DCFCE7' : '#FEF3C7', color: c.rating >= 2.5 ? C.green : C.amber }}>
                        {c.rating}⭐
                      </span>
                    )}
                    {(c.cleanerCount || 0) > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: C.primaryLight, color: C.primary }}>
                        {c.cleanerCount} 👤
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] truncate" style={{ color: C.muted }}>{c.cleanerNames || c.staffListText || 'Sin asignar'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold" style={{ color: c.status === 'Done' ? C.green : C.slate }}>
                    {c.status === 'Done' ? '✓' : c.status}
                  </p>
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
  const duration = cleaning.startTime && cleaning.endTime 
    ? Math.round((new Date(cleaning.endTime).getTime() - new Date(cleaning.startTime).getTime()) / 60000)
    : null
  const isLate = cleaning.scheduledTime && cleaning.startTime
    ? (new Date(cleaning.startTime).getTime() - new Date(cleaning.scheduledTime).getTime()) > 15 * 60000
    : false
  const lateMin = cleaning.scheduledTime && cleaning.startTime
    ? Math.round((new Date(cleaning.startTime).getTime() - new Date(cleaning.scheduledTime).getTime()) / 60000)
    : 0
  
  const fmt = (v?: string | null) => {
    if (!v) return '--:--'
    try { return new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }
    catch { return '--:--' }
  }
  
  // Estimated end from API (already calculated with labor)
  const estEndDisplay = fmt(cleaning.estimatedEndTime)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.8)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: C.white }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div>
            <p className="font-black text-[16px]" style={{ color: C.ink }}>{cleaning.propertyText}</p>
            <p className="text-[11px]" style={{ color: C.muted }}>{cleaning.cleaningId} · {cleaning.date}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.bg }}>
            <X className="w-4 h-4" style={{ color: C.slate }} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <InfoBox label="Equipo" value={cleaning.cleanerNames || cleaning.staffListText || 'Sin asignar'} />
            <InfoBox label="Estado" value={cleaning.status} color={cleaning.status === 'Done' ? C.green : undefined} />
            <InfoBox label="Inicio Prog." value={fmt(cleaning.scheduledTime)} />
            <InfoBox label="Inicio Real" value={fmt(cleaning.startTime)} color={cleaning.startTime ? C.green : undefined} />
            <InfoBox label="Fin Prog." value={estEndDisplay} />
            <InfoBox label="Fin Real" value={fmt(cleaning.endTime)} color={cleaning.endTime ? C.green : undefined} />
          </div>
          
          {(cleaning.cleanerCount || 0) > 0 && (
            <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: C.primaryLight }}>
              <span className="text-[12px] font-medium" style={{ color: C.slate }}>Cleaners asignados</span>
              <span className="font-bold text-[14px]" style={{ color: C.primary }}>{cleaning.cleanerCount} 👤</span>
            </div>
          )}
          
          {cleaning.labor > 0 && (
            <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: C.bg }}>
              <span className="text-[12px] font-medium" style={{ color: C.slate }}>Tiempo estimado (Labor)</span>
              <span className="font-bold text-[14px]" style={{ color: C.blue }}>{Math.floor(cleaning.labor / 60)}h {cleaning.labor % 60}m</span>
            </div>
          )}
          
          {cleaning.rating && (
            <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: cleaning.rating >= 2.5 ? '#DCFCE7' : '#FEF3C7' }}>
              <Star className="w-5 h-5" style={{ color: cleaning.rating >= 2.5 ? C.green : C.amber }} />
              <span className="font-black text-[18px]" style={{ color: cleaning.rating >= 2.5 ? C.green : C.amber }}>{cleaning.rating}</span>
              <span className="text-[12px] font-medium" style={{ color: C.slate }}>
                {cleaning.rating === 3 ? 'Bueno' : cleaning.rating === 2 ? 'Normal' : 'Malo'}
              </span>
            </div>
          )}
          
          {duration && (
            <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: C.bg }}>
              <span className="text-[12px] font-medium" style={{ color: C.slate }}>Duración total</span>
              <span className="font-bold text-[14px]" style={{ color: C.ink }}>{Math.floor(duration / 60)}h {duration % 60}m</span>
            </div>
          )}
          
          {isLate && (
            <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: '#FEE2E2' }}>
              <span className="text-[12px] font-medium" style={{ color: C.red }}>Retraso al inicio</span>
              <span className="font-bold text-[14px]" style={{ color: C.red }}>+{lateMin} min</span>
            </div>
          )}
          
          <a href={`https://shineup-ops.vercel.app/?cleaning=${cleaning.id}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white font-bold text-[12px]"
            style={{ background: C.primary }}>
            <ExternalLink className="w-4 h-4" /> Ver en Ops
          </a>
        </div>
      </div>
    </div>
  )
}

function InfoBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-2 rounded-xl" style={{ background: C.bg }}>
      <p className="text-[8px] font-bold uppercase tracking-wide mb-0.5" style={{ color: C.muted }}>{label}</p>
      <p className="font-bold text-[12px]" style={{ color: color || C.ink }}>{value}</p>
    </div>
  )
}
