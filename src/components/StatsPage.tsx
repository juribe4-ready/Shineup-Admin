import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Clock, Star, Zap, AlertTriangle, AlertCircle, Package,
  ExternalLink, X, Filter, ChevronDown, ChevronUp, Home
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
  byTeam: {
    staffListText: string
    total: number
    done: number
    avgRating: number | null
    avgDurationMin: number | null
    onTimeRate: number | null
    efficiencyRate: number | null
  }[]
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
  const [period, setPeriod] = useState('7d')
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [selectedCleaning, setSelectedCleaning] = useState<Cleaning | null>(null)
  const [selectedPropertyDetail, setSelectedPropertyDetail] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showAllTeams, setShowAllTeams] = useState(false)

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

  const teams = useMemo(() => {
    if (!data) return []
    return [...new Set(data.cleanings.map(c => c.staffListText).filter(Boolean))].sort()
  }, [data])

  const filteredCleanings = useMemo(() => {
    if (!data) return []
    return data.cleanings.filter(c => {
      if (selectedProperty !== 'all' && c.propertyText !== selectedProperty) return false
      if (selectedTeam !== 'all' && c.staffListText !== selectedTeam) return false
      return true
    })
  }, [data, selectedProperty, selectedTeam])

  // Recalculate metrics for filtered data
  const filteredMetrics = useMemo(() => {
    const cleanings = filteredCleanings
    const done = cleanings.filter(c => c.status === 'Done')
    
    // Puntualidad: started within ±15 min of scheduled
    const withTimes = done.filter(c => c.scheduledTime && c.startTime)
    const onTime = withTimes.filter(c => {
      const diff = Math.abs(new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime())
      return diff <= 15 * 60000
    })
    const onTimeRate = withTimes.length > 0 ? Math.round((onTime.length / withTimes.length) * 100) : null
    
    // Retrasos: started >15 min late
    const lateStarts = withTimes.filter(c => {
      return (new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime()) > 15 * 60000
    }).length
    
    // Overtime: finished >15 min after estimated
    const withEstimates = done.filter(c => c.endTime && c.estimatedEndTime)
    const overtime = withEstimates.filter(c => {
      return (new Date(c.endTime!).getTime() - new Date(c.estimatedEndTime!).getTime()) > 15 * 60000
    }).length
    
    // Rating
    const ratings = done.filter(c => c.rating).map(c => c.rating!)
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
    
    // Duration
    const durations = done.filter(c => c.startTime && c.endTime).map(c => {
      return (new Date(c.endTime!).getTime() - new Date(c.startTime!).getTime()) / 60000
    })
    const avgDurationMin = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
    
    return { total: cleanings.length, done: done.length, onTimeRate, lateStarts, overtime, avgRating, avgDurationMin }
  }, [filteredCleanings])

  // Property stats with efficiency calculation
  const propertyStats = useMemo(() => {
    if (!data) return []
    
    const propGroups: Record<string, Cleaning[]> = {}
    data.cleanings.forEach(c => {
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
      
      // Efficiency: estimated duration vs actual duration
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
      
      // Puntualidad
      const withTimes = done.filter(c => c.scheduledTime && c.startTime)
      const onTime = withTimes.filter(c => {
        const diff = Math.abs(new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime())
        return diff <= 15 * 60000
      })
      const onTimeRate = withTimes.length > 0 ? Math.round((onTime.length / withTimes.length) * 100) : null
      
      // Find incidents/inventory for this property from data.byProperty
      const propData = data.byProperty.find(p => p.propertyText === propertyText)
      
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
      }
    }).sort((a, b) => b.total - a.total)
  }, [data])

  // Team stats with better efficiency calculation
  const teamStats = useMemo(() => {
    if (!data) return []
    
    const teamGroups: Record<string, Cleaning[]> = {}
    data.cleanings.forEach(c => {
      const team = c.staffListText || 'Sin asignar'
      if (!teamGroups[team]) teamGroups[team] = []
      teamGroups[team].push(c)
    })
    
    return Object.entries(teamGroups).map(([staffListText, cleanings]) => {
      const done = cleanings.filter(c => c.status === 'Done')
      const ratings = done.filter(c => c.rating).map(c => c.rating!)
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
      
      const durations = done.filter(c => c.startTime && c.endTime).map(c => {
        return (new Date(c.endTime!).getTime() - new Date(c.startTime!).getTime()) / 60000
      })
      const avgDurationMin = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
      
      // Efficiency: estimated vs actual
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
      
      // Puntualidad
      const withTimes = done.filter(c => c.scheduledTime && c.startTime)
      const onTime = withTimes.filter(c => {
        const diff = Math.abs(new Date(c.startTime!).getTime() - new Date(c.scheduledTime!).getTime())
        return diff <= 15 * 60000
      })
      const onTimeRate = withTimes.length > 0 ? Math.round((onTime.length / withTimes.length) * 100) : null
      
      // Score for ranking: 40% rating + 30% efficiency + 30% puntualidad
      const ratingScore = avgRating ? (avgRating / 3) * 40 : 0
      const effScore = efficiencyRate ? Math.min(efficiencyRate / 100, 1.5) * 30 : 0
      const puntScore = onTimeRate ? (onTimeRate / 100) * 30 : 0
      const score = ratingScore + effScore + puntScore
      
      return { staffListText, total: done.length, avgRating, avgDurationMin, efficiencyRate, onTimeRate, score }
    }).sort((a, b) => b.score - a.score)
  }, [data])

  const totalTeamCleanings = teamStats.reduce((s, t) => s + t.total, 0)
  const displayedTeams = showAllTeams ? teamStats : teamStats.slice(0, 10)

  const hasFilters = selectedProperty !== 'all' || selectedTeam !== 'all'

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-[20px]" style={{ color: C.ink }}>Estadísticas</h2>
          <p className="text-[12px] font-medium" style={{ color: C.muted }}>
            {data?.cleanings.length || 0} limpiezas · {data?.summary.done || 0} completadas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1.5px solid ${C.border}` }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className="px-3 py-1.5 text-[11px] font-bold transition-all"
                style={{ background: period === p.key ? C.primary : C.white, color: period === p.key ? 'white' : C.slate }}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
            style={{ background: hasFilters ? C.primaryLight : C.white, color: hasFilters ? C.primary : C.slate, border: `1.5px solid ${hasFilters ? C.primary : C.border}` }}>
            <Filter className="w-3 h-3" /> Filtros {hasFilters && '•'}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-2 flex-wrap items-center p-3 rounded-2xl" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium outline-none"
            style={{ border: `1.5px solid ${C.border}`, minWidth: 150 }}>
            <option value="all">Todas las propiedades</option>
            {properties.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium outline-none"
            style={{ border: `1.5px solid ${C.border}`, minWidth: 150 }}>
            <option value="all">Todos los equipos</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setSelectedProperty('all'); setSelectedTeam('all') }}
              className="text-[11px] font-bold" style={{ color: C.red }}>Limpiar</button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<TrendingUp className="w-3.5 h-3.5" />} label="Completadas" value={`${filteredMetrics.done}`} subtitle={`de ${filteredMetrics.total}`} color={C.green} />
        <KpiCard icon={<Star className="w-3.5 h-3.5" />} label="Rating" value={filteredMetrics.avgRating?.toFixed(1) || '--'} subtitle="promedio" color={filteredMetrics.avgRating && filteredMetrics.avgRating >= 2.5 ? C.green : C.amber} />
        <KpiCard icon={<Clock className="w-3.5 h-3.5" />} label="Duración" value={filteredMetrics.avgDurationMin ? `${Math.floor(filteredMetrics.avgDurationMin / 60)}h ${filteredMetrics.avgDurationMin % 60}m` : '--'} subtitle="promedio" color={C.blue} />
        <KpiCard icon={<Zap className="w-3.5 h-3.5" />} label="Puntualidad" value={filteredMetrics.onTimeRate !== null ? `${filteredMetrics.onTimeRate}%` : '--'} subtitle="a tiempo ±15m" color={filteredMetrics.onTimeRate && filteredMetrics.onTimeRate >= 70 ? C.green : C.amber} />
        <KpiCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Retrasos" value={String(filteredMetrics.lateStarts)} subtitle=">15m tarde" color={filteredMetrics.lateStarts > 0 ? C.red : C.green} />
        <KpiCard icon={<Clock className="w-3.5 h-3.5" />} label="Overtime" value={String(filteredMetrics.overtime)} subtitle=">15m extra" color={filteredMetrics.overtime > 0 ? C.amber : C.green} />
      </div>

      {/* Incidentes y Rupturas Activas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4" style={{ color: C.amber }} />
            <p className="text-[12px] font-bold" style={{ color: C.ink }}>Incidentes Activos</p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="font-black text-[28px] leading-none" style={{ color: C.amber }}>{data?.incidents.open || 0}</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: C.muted }}>Abiertos</p>
            </div>
            <div className="h-8 w-px" style={{ background: C.border }} />
            <div>
              <p className="font-black text-[28px] leading-none" style={{ color: C.green }}>{data?.incidents.closed || 0}</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: C.muted }}>Cerrados</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4" style={{ color: C.red }} />
            <p className="text-[12px] font-bold" style={{ color: C.ink }}>Rupturas de Inventario</p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="font-black text-[28px] leading-none" style={{ color: C.red }}>{data?.inventory.outOfStock || 0}</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: C.muted }}>Sin Stock</p>
            </div>
            <div className="h-8 w-px" style={{ background: C.border }} />
            <div>
              <p className="font-black text-[28px] leading-none" style={{ color: C.amber }}>{data?.inventory.low || 0}</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: C.muted }}>Bajo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Propiedades */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4" style={{ color: C.primary }} />
            <p className="font-bold text-[13px]" style={{ color: C.ink }}>Propiedades</p>
          </div>
          <p className="text-[11px]" style={{ color: C.muted }}>Clic para ver detalle</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ background: C.bg }}>
                <th className="px-4 py-2 text-left font-bold" style={{ color: C.muted }}>Propiedad</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Limpiezas</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Rating</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Tiempo</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Puntualidad</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Eficiencia</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Incidentes</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Rupturas</th>
              </tr>
            </thead>
            <tbody>
              {propertyStats.map((prop, idx) => (
                <tr key={prop.propertyText} 
                  className="cursor-pointer hover:bg-gray-50 transition-colors" 
                  style={{ borderBottom: `1px solid ${C.border}` }}
                  onClick={() => setSelectedPropertyDetail(prop.propertyText)}>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: C.ink }}>{prop.propertyText}</td>
                  <td className="px-3 py-2.5 text-center font-bold" style={{ color: C.slate }}>{prop.total}</td>
                  <td className="px-3 py-2.5 text-center">
                    {prop.avgRating ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
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
              <tr style={{ background: C.bg }}>
                <td className="px-4 py-2.5 font-black" style={{ color: C.ink }}>TOTAL</td>
                <td className="px-3 py-2.5 text-center font-black" style={{ color: C.primary }}>{data?.cleanings.length || 0}</td>
                <td colSpan={6}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranking de Equipos */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <p className="font-bold text-[13px]" style={{ color: C.ink }}>🏆 Ranking de Equipos</p>
          <p className="text-[11px] font-medium" style={{ color: C.muted }}>Total: {totalTeamCleanings} limpiezas</p>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0" style={{ background: C.bg }}>
              <tr>
                <th className="px-3 py-2 text-left font-bold w-8" style={{ color: C.muted }}>#</th>
                <th className="px-3 py-2 text-left font-bold" style={{ color: C.muted }}>Equipo</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Limpiezas</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Rating</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Tiempo</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Puntualidad</th>
                <th className="px-3 py-2 text-center font-bold" style={{ color: C.muted }}>Eficiencia</th>
              </tr>
            </thead>
            <tbody>
              {displayedTeams.map((team, idx) => (
                <tr key={team.staffListText} className="hover:bg-gray-50 transition-colors" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td className="px-3 py-2.5 font-black" style={{ color: idx < 3 ? C.primary : C.muted }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </td>
                  <td className="px-3 py-2.5 font-semibold" style={{ color: C.ink, maxWidth: 280 }}>
                    <span className="truncate block">{team.staffListText}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold" style={{ color: C.slate }}>{team.total}</td>
                  <td className="px-3 py-2.5 text-center">
                    {team.avgRating ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: team.avgRating >= 2.5 ? '#DCFCE7' : '#FEF3C7', color: team.avgRating >= 2.5 ? C.green : C.amber }}>
                        {team.avgRating.toFixed(1)}⭐
                      </span>
                    ) : '--'}
                  </td>
                  <td className="px-3 py-2.5 text-center font-medium" style={{ color: C.slate }}>
                    {team.avgDurationMin ? `${Math.floor(team.avgDurationMin / 60)}h${team.avgDurationMin % 60}m` : '--'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge value={team.onTimeRate} suffix="%" goodThreshold={70} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge value={team.efficiencyRate} suffix="%" goodThreshold={90} warnThreshold={70} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {teamStats.length > 10 && (
          <button onClick={() => setShowAllTeams(v => !v)}
            className="w-full py-2 text-[11px] font-bold flex items-center justify-center gap-1"
            style={{ borderTop: `1px solid ${C.border}`, color: C.primary, background: C.bg }}>
            {showAllTeams ? <><ChevronUp className="w-3 h-3" /> Ver menos</> : <><ChevronDown className="w-3 h-3" /> Ver todos ({teamStats.length})</>}
          </button>
        )}
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
