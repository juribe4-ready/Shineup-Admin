import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Clock, Star, Zap, AlertTriangle, AlertCircle, Package,
  ExternalLink, X, Home, Calendar, Users, BarChart3
} from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF', primaryDark: '#4F46E5',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', red: '#EF4444', amber: '#F59E0B', blue: '#3B82F6',
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

  // Filter cleanings by property and date
  const filteredCleanings = useMemo(() => {
    if (!data) return []
    return data.cleanings.filter(c => {
      if (selectedProperty !== 'all' && c.propertyText !== selectedProperty) return false
      if (dateFrom && c.date < dateFrom) return false
      if (dateTo && c.date > dateTo) return false
      return true
    })
  }, [data, selectedProperty, dateFrom, dateTo])

  // Filtered incidents/inventory by property
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

  // Recalculate metrics for filtered data
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

  // Daily stats for bar chart
  const dailyStats = useMemo(() => {
    if (!filteredCleanings.length) return []
    
    const byDate: Record<string, { count: number; totalDuration: number; doneCount: number }> = {}
    filteredCleanings.forEach(c => {
      if (!byDate[c.date]) byDate[c.date] = { count: 0, totalDuration: 0, doneCount: 0 }
      byDate[c.date].count++
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
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredCleanings])

  // Waterfall chart data
  const waterfallData = useMemo(() => {
    const done = filteredCleanings.filter(c => c.status === 'Done' && c.scheduledTime && c.estimatedEndTime && c.startTime && c.endTime)
    
    let totalScheduledMin = 0
    let totalActualMin = 0
    let ratingEffect = 0
    
    done.forEach(c => {
      const scheduled = (new Date(c.estimatedEndTime!).getTime() - new Date(c.scheduledTime!).getTime()) / 60000
      const actual = (new Date(c.endTime!).getTime() - new Date(c.startTime!).getTime()) / 60000
      totalScheduledMin += scheduled
      totalActualMin += actual
      
      // Rating effect: good rating = faster, bad = slower (simplified model)
      if (c.rating === 3) ratingEffect -= 5
      else if (c.rating === 1) ratingEffect += 10
    })
    
    const diff = totalActualMin - totalScheduledMin
    const otherEffect = diff - ratingEffect
    
    return {
      scheduled: Math.round(totalScheduledMin / 60 * 10) / 10,
      ratingEffect: Math.round(ratingEffect / 60 * 10) / 10,
      otherEffect: Math.round(otherEffect / 60 * 10) / 10,
      actual: Math.round(totalActualMin / 60 * 10) / 10,
    }
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
      
      const withBoth = done.filter(c => c.startTime && c.endTime && c.scheduledTime && c.estimatedEndTime)
      let efficiencyRate: number | null = null
      if (withBoth.length > 0) {
        const totalEstimated = withBoth.reduce((s, c) => {
          return s + (new Date(c.estimatedEndTime!).getTime() - new Date(c.scheduledTime!).getTime()) / 60000
        }, 0)
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
      
      // Count cleaners
      const cleanerSet = new Set<string>()
      cleanings.forEach(c => {
        if (c.staffListText) {
          c.staffListText.split(',').forEach(name => cleanerSet.add(name.trim()))
        }
      })
      
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
        cleanerCount: cleanerSet.size,
      }
    }).sort((a, b) => b.total - a.total)
  }, [data, filteredCleanings])

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
      {/* Header with filters always visible */}
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
        
        {/* Filters always visible */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<TrendingUp className="w-3.5 h-3.5" />} label="Completadas" value={`${filteredMetrics.done}`} subtitle={`de ${filteredMetrics.total}`} color={C.green} />
        <KpiCard icon={<Star className="w-3.5 h-3.5" />} label="Rating" value={filteredMetrics.avgRating?.toFixed(1) || '--'} subtitle="promedio" color={filteredMetrics.avgRating && filteredMetrics.avgRating >= 2.5 ? C.green : C.amber} />
        <KpiCard icon={<Clock className="w-3.5 h-3.5" />} label="Duración" value={filteredMetrics.avgDurationMin ? `${Math.floor(filteredMetrics.avgDurationMin / 60)}h ${filteredMetrics.avgDurationMin % 60}m` : '--'} subtitle="promedio" color={C.blue} />
        <KpiCard icon={<Zap className="w-3.5 h-3.5" />} label="Puntualidad" value={filteredMetrics.onTimeRate !== null ? `${filteredMetrics.onTimeRate}%` : '--'} subtitle="a tiempo ±15m" color={filteredMetrics.onTimeRate && filteredMetrics.onTimeRate >= 70 ? C.green : C.amber} />
        <KpiCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Retrasos" value={String(filteredMetrics.lateStarts)} subtitle=">15m tarde" color={filteredMetrics.lateStarts > 0 ? C.red : C.green} />
        <KpiCard icon={<Clock className="w-3.5 h-3.5" />} label="Overtime" value={String(filteredMetrics.overtime)} subtitle=">15m extra" color={filteredMetrics.overtime > 0 ? C.amber : C.green} />
      </div>

      {/* Incidentes y Rupturas */}
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

      {/* Limpiezas (tercera fila, con scroll) */}
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
                const cleanerCount = c.staffListText ? c.staffListText.split(',').length : 0
                
                return (
                  <tr key={c.id} 
                    className="cursor-pointer hover:bg-gray-50 transition-colors" 
                    style={{ borderBottom: `1px solid ${C.border}` }}
                    onClick={() => setSelectedCleaning(c)}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: C.ink }}>{c.date}</td>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: C.slate }}>{c.propertyText}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: C.bg, color: C.slate }}>
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

      {/* Gráfico de barras: Limpiezas por día + Tendencia tiempo promedio */}
      <div className="rounded-2xl overflow-hidden p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4" style={{ color: C.primary }} />
          <p className="font-bold text-[13px]" style={{ color: C.ink }}>Limpiezas por Día</p>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: C.primary }} /> Limpiezas</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 rounded" style={{ background: C.amber }} /> Tiempo prom.</span>
          </div>
        </div>
        <DailyChart data={dailyStats} />
      </div>

      {/* Gráfico de cascada: Tiempo programado vs real */}
      <div className="rounded-2xl overflow-hidden p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4" style={{ color: C.blue }} />
          <p className="font-bold text-[13px]" style={{ color: C.ink }}>Análisis de Horas: Programado vs Real</p>
        </div>
        <WaterfallChart data={waterfallData} />
      </div>

      {/* Propiedades con scroll */}
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
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: C.bg, color: C.slate }}>
                      <Users className="w-3 h-3" /> {prop.cleanerCount}
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

      {/* Property Detail Modal */}
      {selectedPropertyDetail && (
        <PropertyDetailModal 
          propertyText={selectedPropertyDetail}
          cleanings={propertyStats.find(p => p.propertyText === selectedPropertyDetail)?.cleanings || []}
          onClose={() => setSelectedPropertyDetail(null)}
          onSelectCleaning={setSelectedCleaning}
        />
      )}

      {/* Cleaning Detail Modal */}
      {selectedCleaning && (
        <CleaningDetailModal cleaning={selectedCleaning} onClose={() => setSelectedCleaning(null)} />
      )}
    </div>
  )
}

// Daily bar chart component
function DailyChart({ data }: { data: { date: string; count: number; avgDuration: number }[] }) {
  if (!data.length) return <p className="text-center py-8 text-[12px]" style={{ color: C.muted }}>Sin datos</p>
  
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const maxDuration = Math.max(...data.map(d => d.avgDuration), 1)
  
  return (
    <div className="relative h-[160px]">
      <div className="flex items-end justify-between gap-1 h-[140px] px-2">
        {data.map((d, i) => {
          const barHeight = (d.count / maxCount) * 120
          const lineY = 140 - (d.avgDuration / maxDuration) * 120
          const prevLineY = i > 0 ? 140 - (data[i - 1].avgDuration / maxDuration) * 120 : lineY
          
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center relative" style={{ minWidth: 20 }}>
              {/* Bar */}
              <div className="w-full max-w-[24px] rounded-t-md transition-all hover:opacity-80" 
                style={{ height: barHeight, background: C.primary, marginTop: 'auto' }}
                title={`${d.date}: ${d.count} limpiezas, ${Math.floor(d.avgDuration / 60)}h${d.avgDuration % 60}m promedio`} />
              {/* Trend line dot */}
              <div className="absolute w-2 h-2 rounded-full" 
                style={{ background: C.amber, top: lineY - 4, left: '50%', transform: 'translateX(-50%)' }} />
              {/* Trend line segment */}
              {i > 0 && (
                <svg className="absolute pointer-events-none" style={{ top: 0, left: '-50%', width: '100%', height: 140, overflow: 'visible' }}>
                  <line x1="50%" y1={prevLineY} x2="150%" y2={lineY} stroke={C.amber} strokeWidth="2" />
                </svg>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between px-2 mt-1">
        {data.length <= 14 ? data.map(d => (
          <span key={d.date} className="text-[8px] font-medium" style={{ color: C.muted, flex: 1, textAlign: 'center' }}>
            {d.date.slice(5)}
          </span>
        )) : (
          <>
            <span className="text-[9px] font-medium" style={{ color: C.muted }}>{data[0]?.date.slice(5)}</span>
            <span className="text-[9px] font-medium" style={{ color: C.muted }}>{data[data.length - 1]?.date.slice(5)}</span>
          </>
        )}
      </div>
    </div>
  )
}

// Waterfall chart component
function WaterfallChart({ data }: { data: { scheduled: number; ratingEffect: number; otherEffect: number; actual: number } }) {
  const maxVal = Math.max(data.scheduled, data.actual, 0.1)
  const scale = 200 / maxVal
  
  const bars = [
    { label: 'Programado', value: data.scheduled, color: C.blue, isBase: true },
    { label: 'Rating', value: data.ratingEffect, color: data.ratingEffect >= 0 ? C.red : C.green, isBase: false },
    { label: 'Otros', value: data.otherEffect, color: data.otherEffect >= 0 ? C.amber : C.green, isBase: false },
    { label: 'Real', value: data.actual, color: C.primary, isBase: true },
  ]
  
  let runningTotal = data.scheduled
  
  return (
    <div className="flex items-end justify-around h-[180px] px-4 gap-4">
      {bars.map((bar) => {
        let barHeight: number
        let barBottom: number
        
        if (bar.isBase) {
          barHeight = Math.abs(bar.value) * scale
          barBottom = 0
        } else {
          barHeight = Math.abs(bar.value) * scale
          if (bar.value >= 0) {
            barBottom = runningTotal * scale
          } else {
            barBottom = (runningTotal + bar.value) * scale
          }
          runningTotal += bar.value
        }
        
        return (
          <div key={bar.label} className="flex flex-col items-center flex-1">
            <div className="relative w-full flex justify-center" style={{ height: 140 }}>
              <div className="w-12 rounded-t-lg transition-all hover:opacity-80"
                style={{ 
                  height: Math.max(barHeight, 4), 
                  background: bar.color,
                  position: 'absolute',
                  bottom: barBottom,
                }}
                title={`${bar.label}: ${bar.value >= 0 ? '+' : ''}${bar.value}h`} />
            </div>
            <p className="text-[10px] font-bold mt-2" style={{ color: C.ink }}>{bar.label}</p>
            <p className="text-[12px] font-black" style={{ color: bar.color }}>
              {bar.isBase ? `${bar.value}h` : `${bar.value >= 0 ? '+' : ''}${bar.value}h`}
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
            <p className="text-[11px]" style={{ color: C.muted }}>{cleanings.length} limpiezas en el período</p>
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
                  </div>
                  <p className="text-[10px] truncate" style={{ color: C.muted }}>{c.staffListText || 'Sin asignar'}</p>
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
            <InfoBox label="Equipo" value={cleaning.staffListText || 'Sin asignar'} />
            <InfoBox label="Estado" value={cleaning.status} color={cleaning.status === 'Done' ? C.green : undefined} />
            <InfoBox label="Inicio Prog." value={fmt(cleaning.scheduledTime)} />
            <InfoBox label="Inicio Real" value={fmt(cleaning.startTime)} color={cleaning.startTime ? C.green : undefined} />
            <InfoBox label="Fin Prog." value={fmt(cleaning.estimatedEndTime)} />
            <InfoBox label="Fin Real" value={fmt(cleaning.endTime)} color={cleaning.endTime ? C.green : undefined} />
          </div>
          
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
