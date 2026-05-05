import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Clock, Star, Zap, AlertTriangle,
  ExternalLink, X, Filter
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
    efficiencyRate: number | null
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
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Último mes' },
  { key: 'ytd', label: 'Este año (YTD)' },
]

export default function StatsPage() {
  const [period, setPeriod] = useState('7d')
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [selectedCleaning, setSelectedCleaning] = useState<Cleaning | null>(null)
  const [showFilters, setShowFilters] = useState(false)

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

  const hasFilters = selectedProperty !== 'all' || selectedTeam !== 'all'

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} />
      </div>
    )
  }

  const summary = data?.summary || { total: 0, done: 0, avgRating: null, avgDurationMin: null, onTimeRate: null, efficiencyRate: null, lateStarts: 0, overtime: 0 }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-black text-[22px]" style={{ color: C.ink }}>Estadísticas</h2>
          <p className="text-[13px] font-medium" style={{ color: C.muted }}>
            {data?.cleanings.length || 0} limpiezas en el período
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Period selector */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1.5px solid ${C.border}` }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className="px-4 py-2 text-[12px] font-bold transition-all"
                style={{
                  background: period === p.key ? C.primary : C.white,
                  color: period === p.key ? 'white' : C.slate,
                }}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold"
            style={{ background: hasFilters ? C.primaryLight : C.white, color: hasFilters ? C.primary : C.slate, border: `1.5px solid ${hasFilters ? C.primary : C.border}` }}>
            <Filter className="w-3.5 h-3.5" /> Filtros {hasFilters && '•'}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-3 flex-wrap items-center p-4 rounded-2xl" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}
            className="px-3 py-2 rounded-xl text-[12px] font-medium outline-none"
            style={{ border: `1.5px solid ${C.border}`, minWidth: 180 }}>
            <option value="all">Todas las propiedades</option>
            {properties.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
            className="px-3 py-2 rounded-xl text-[12px] font-medium outline-none"
            style={{ border: `1.5px solid ${C.border}`, minWidth: 180 }}>
            <option value="all">Todos los equipos</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setSelectedProperty('all'); setSelectedTeam('all') }}
              className="text-[12px] font-bold" style={{ color: C.red }}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KpiCard icon={<TrendingUp />} label="Completadas" value={`${summary.done}/${summary.total}`} color={C.green} />
        <KpiCard icon={<Star />} label="Rating Prom." value={summary.avgRating?.toFixed(1) || '--'} suffix="⭐" color={summary.avgRating && summary.avgRating >= 2.5 ? C.green : C.amber} />
        <KpiCard icon={<Clock />} label="Tiempo Prom." value={summary.avgDurationMin ? `${Math.floor(summary.avgDurationMin / 60)}h ${summary.avgDurationMin % 60}m` : '--'} color={C.blue} />
        <KpiCard icon={<Zap />} label="Puntualidad" value={summary.onTimeRate !== null ? `${summary.onTimeRate}%` : '--'} color={summary.onTimeRate && summary.onTimeRate >= 80 ? C.green : C.amber} />
        <KpiCard icon={<AlertTriangle />} label="Retrasos" value={String(summary.lateStarts)} color={summary.lateStarts > 0 ? C.red : C.green} />
        <KpiCard icon={<Clock />} label="Overtime" value={String(summary.overtime)} color={summary.overtime > 0 ? C.amber : C.green} />
      </div>

      {/* Incidentes y Rupturas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Incidentes</p>
          <div className="flex items-center gap-4">
            <div>
              <p className="font-black text-[28px]" style={{ color: C.amber }}>{data?.incidents.open || 0}</p>
              <p className="text-[11px] font-medium" style={{ color: C.muted }}>Abiertos</p>
            </div>
            <div className="h-10 w-px" style={{ background: C.border }} />
            <div>
              <p className="font-black text-[28px]" style={{ color: C.green }}>{data?.incidents.closed || 0}</p>
              <p className="text-[11px] font-medium" style={{ color: C.muted }}>Cerrados</p>
            </div>
            <div className="h-10 w-px" style={{ background: C.border }} />
            <div>
              <p className="font-black text-[28px]" style={{ color: C.ink }}>{data?.incidents.total || 0}</p>
              <p className="text-[11px] font-medium" style={{ color: C.muted }}>Total</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Rupturas de Inventario</p>
          <div className="flex items-center gap-4">
            <div>
              <p className="font-black text-[28px]" style={{ color: C.red }}>{data?.inventory.outOfStock || 0}</p>
              <p className="text-[11px] font-medium" style={{ color: C.muted }}>Sin Stock</p>
            </div>
            <div className="h-10 w-px" style={{ background: C.border }} />
            <div>
              <p className="font-black text-[28px]" style={{ color: C.amber }}>{data?.inventory.low || 0}</p>
              <p className="text-[11px] font-medium" style={{ color: C.muted }}>Bajo</p>
            </div>
            <div className="h-10 w-px" style={{ background: C.border }} />
            <div>
              <p className="font-black text-[28px]" style={{ color: C.green }}>{data?.inventory.optimal || 0}</p>
              <p className="text-[11px] font-medium" style={{ color: C.muted }}>Óptimo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ranking de Equipos */}
      {data?.byTeam && data.byTeam.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
            <p className="font-bold text-[14px]" style={{ color: C.ink }}>Ranking de Equipos</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ background: C.bg }}>
                  <th className="px-4 py-2 text-left font-bold" style={{ color: C.muted }}>#</th>
                  <th className="px-4 py-2 text-left font-bold" style={{ color: C.muted }}>Equipo</th>
                  <th className="px-4 py-2 text-center font-bold" style={{ color: C.muted }}>Limpiezas</th>
                  <th className="px-4 py-2 text-center font-bold" style={{ color: C.muted }}>Rating</th>
                  <th className="px-4 py-2 text-center font-bold" style={{ color: C.muted }}>Tiempo Prom.</th>
                  <th className="px-4 py-2 text-center font-bold" style={{ color: C.muted }}>Puntualidad</th>
                  <th className="px-4 py-2 text-center font-bold" style={{ color: C.muted }}>Eficiencia</th>
                </tr>
              </thead>
              <tbody>
                {data.byTeam.map((team, idx) => (
                  <tr key={team.staffListText} className="hover:bg-gray-50 transition-colors" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td className="px-4 py-3 font-black" style={{ color: idx < 3 ? C.primary : C.muted }}>
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: C.ink }}>{team.staffListText}</td>
                    <td className="px-4 py-3 text-center font-medium" style={{ color: C.slate }}>{team.done}/{team.total}</td>
                    <td className="px-4 py-3 text-center">
                      {team.avgRating ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={{ background: team.avgRating >= 2.5 ? '#DCFCE7' : '#FEF3C7', color: team.avgRating >= 2.5 ? C.green : C.amber }}>
                          {team.avgRating.toFixed(1)} ⭐
                        </span>
                      ) : '--'}
                    </td>
                    <td className="px-4 py-3 text-center font-medium" style={{ color: C.slate }}>
                      {team.avgDurationMin ? `${Math.floor(team.avgDurationMin / 60)}h ${team.avgDurationMin % 60}m` : '--'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {team.onTimeRate !== null ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={{ background: team.onTimeRate >= 80 ? '#DCFCE7' : '#FEF3C7', color: team.onTimeRate >= 80 ? C.green : C.amber }}>
                          {team.onTimeRate}%
                        </span>
                      ) : '--'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {team.efficiencyRate !== null ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={{ background: team.efficiencyRate >= 100 ? '#DCFCE7' : team.efficiencyRate >= 80 ? '#FEF3C7' : '#FEE2E2', color: team.efficiencyRate >= 100 ? C.green : team.efficiencyRate >= 80 ? C.amber : C.red }}>
                          {team.efficiencyRate}%
                        </span>
                      ) : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lista de Limpiezas */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
          <p className="font-bold text-[14px]" style={{ color: C.ink }}>
            Limpiezas ({filteredCleanings.length})
          </p>
          <p className="text-[11px]" style={{ color: C.muted }}>Doble clic para ver detalle</p>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {filteredCleanings.map(c => {
            const durationMin = c.startTime && c.endTime
              ? Math.round((new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60000)
              : null
            const isLate = c.scheduledTime && c.startTime
              ? (new Date(c.startTime).getTime() - new Date(c.scheduledTime).getTime()) > 15 * 60000
              : false
            
            return (
              <button key={c.id}
                onDoubleClick={() => setSelectedCleaning(c)}
                className="w-full flex items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-gray-50"
                style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[13px] truncate" style={{ color: C.ink }}>{c.propertyText}</p>
                    {c.rating && (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: c.rating >= 2.5 ? '#DCFCE7' : '#FEF3C7', color: c.rating >= 2.5 ? C.green : C.amber }}>
                        {c.rating}⭐
                      </span>
                    )}
                    {isLate && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#FEE2E2', color: C.red }}>
                        TARDE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px]" style={{ color: C.muted }}>
                    {c.date} · {c.staffListText || 'Sin asignar'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-bold" style={{ color: c.status === 'Done' ? C.green : C.slate }}>
                    {c.status === 'Done' ? '✓ Completada' : c.status}
                  </p>
                  {durationMin && (
                    <p className="text-[11px]" style={{ color: C.muted }}>{Math.floor(durationMin / 60)}h {durationMin % 60}m</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modal de detalle de limpieza */}
      {selectedCleaning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: 'rgba(15,23,42,0.7)' }} onClick={() => setSelectedCleaning(null)}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: C.white }}
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div>
                <p className="font-black text-[17px]" style={{ color: C.ink }}>{selectedCleaning.propertyText}</p>
                <p className="text-[12px]" style={{ color: C.muted }}>{selectedCleaning.cleaningId}</p>
              </div>
              <button onClick={() => setSelectedCleaning(null)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.bg }}>
                <X className="w-4 h-4" style={{ color: C.slate }} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoBox label="Fecha" value={selectedCleaning.date} />
                <InfoBox label="Equipo" value={selectedCleaning.staffListText || 'Sin asignar'} />
                <InfoBox label="Inicio Prog." value={fmt(selectedCleaning.scheduledTime)} />
                <InfoBox label="Inicio Real" value={fmt(selectedCleaning.startTime)} color={selectedCleaning.startTime ? C.green : undefined} />
                <InfoBox label="Fin Prog." value={fmt(selectedCleaning.estimatedEndTime)} />
                <InfoBox label="Fin Real" value={fmt(selectedCleaning.endTime)} color={selectedCleaning.endTime ? C.green : undefined} />
              </div>
              {selectedCleaning.rating && (
                <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: selectedCleaning.rating >= 2.5 ? '#DCFCE7' : '#FEF3C7' }}>
                  <Star className="w-5 h-5" style={{ color: selectedCleaning.rating >= 2.5 ? C.green : C.amber }} />
                  <span className="font-black text-[18px]" style={{ color: selectedCleaning.rating >= 2.5 ? C.green : C.amber }}>{selectedCleaning.rating}</span>
                  <span className="text-[12px] font-medium" style={{ color: C.slate }}>
                    {selectedCleaning.rating === 3 ? 'Bueno' : selectedCleaning.rating === 2 ? 'Normal' : 'Malo'}
                  </span>
                </div>
              )}
              {(() => {
                const durationMin = selectedCleaning.startTime && selectedCleaning.endTime
                  ? Math.round((new Date(selectedCleaning.endTime).getTime() - new Date(selectedCleaning.startTime).getTime()) / 60000)
                  : null
                const isLate = selectedCleaning.scheduledTime && selectedCleaning.startTime
                  ? (new Date(selectedCleaning.startTime).getTime() - new Date(selectedCleaning.scheduledTime).getTime()) > 15 * 60000
                  : false
                const lateMin = selectedCleaning.scheduledTime && selectedCleaning.startTime
                  ? Math.round((new Date(selectedCleaning.startTime).getTime() - new Date(selectedCleaning.scheduledTime).getTime()) / 60000)
                  : 0
                
                return (
                  <div className="space-y-2">
                    {durationMin && (
                      <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: C.bg }}>
                        <span className="text-[12px] font-medium" style={{ color: C.slate }}>Duración total</span>
                        <span className="font-bold text-[14px]" style={{ color: C.ink }}>{Math.floor(durationMin / 60)}h {durationMin % 60}m</span>
                      </div>
                    )}
                    {isLate && (
                      <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: '#FEE2E2' }}>
                        <span className="text-[12px] font-medium" style={{ color: C.red }}>Retraso al inicio</span>
                        <span className="font-bold text-[14px]" style={{ color: C.red }}>+{lateMin} min</span>
                      </div>
                    )}
                  </div>
                )
              })()}
              <a href={`https://shineup-ops.vercel.app/?cleaning=${selectedCleaning.id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white font-bold text-[13px]"
                style={{ background: C.primary }}>
                <ExternalLink className="w-4 h-4" /> Ver en Ops
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, suffix, color }: { icon: React.ReactNode; label: string; value: string; suffix?: string; color: string }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          {icon && <div style={{ color, width: 14, height: 14 }}>{icon}</div>}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</p>
      </div>
      <p className="font-black text-[24px] leading-none" style={{ color }}>
        {value}{suffix && <span className="text-[16px] ml-1">{suffix}</span>}
      </p>
    </div>
  )
}

function InfoBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-2.5 rounded-xl" style={{ background: C.bg }}>
      <p className="text-[9px] font-bold uppercase tracking-wide mb-0.5" style={{ color: C.muted }}>{label}</p>
      <p className="font-bold text-[13px]" style={{ color: color || C.ink }}>{value}</p>
    </div>
  )
}

const fmt = (v?: string | null) => {
  if (!v) return '--:--'
  try { return new Date(v).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '--:--' }
}
