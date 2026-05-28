import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react'

const C = {
  primary: '#6366F1',
  primaryLight: '#EEF2FF',
  ink: '#0F172A',
  slate: '#475569',
  muted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  green: '#10B981',
  greenLight: '#D1FAE5',
  red: '#EF4444',
  redLight: '#FEE2E2',
  amber: '#F59E0B',
  amberLight: '#FEF3C7',
  teal: '#14B8A6',
}

interface WeekMetrics {
  week: string
  range: { start: string; end: string }
  hhDisponibles: number
  hhProgramadas: number
  hhReales: number
  casasDistintas: number
  limpiezasTotal: number
  limpiezasDone: number
  cleanersUnicos: number
  hhPromCasa: number
  limpiezasPorCasa: number
  velocidad: number
  onTimeRate: number | null
  ratingPromedio: number | null
}

interface Cascada {
  hhProgramadas: number
  efVelocidad: number
  efVelocidadPct: number
  hhReales: number
  variacionTotal: number
  variacionTotalPct: number | null
}

interface Comparacion {
  hhReales: { current: number; compare: number; delta: number | null }
  casas: { current: number; compare: number; delta: number | null }
  limpiezas: { current: number; compare: number; delta: number | null }
  hhPromCasa: { current: number; compare: number; delta: number | null }
  limpiezasPorCasa: { current: number; compare: number; delta: number | null }
  cleaners: { current: number; compare: number; delta: number | null }
  velocidad: { current: number; compare: number; delta: number | null }
  onTimeRate: { current: number | null; compare: number | null; delta: number | null }
  rating: { current: number | null; compare: number | null; delta: number | null }
}

interface ExecutiveData {
  currentWeek: string
  compareWeek: string
  current: WeekMetrics
  compare: WeekMetrics
  cascada: Cascada
  comparacion: Comparacion
  availableWeeks: string[]
}

export default function DashboardExecutive() {
  const [data, setData] = useState<ExecutiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [compareWeek, setCompareWeek] = useState<string>('')
  const [showWeekDropdown, setShowWeekDropdown] = useState(false)
  const [showCompareDropdown, setShowCompareDropdown] = useState(false)

  const loadData = async (week?: string, compare?: string) => {
    setLoading(true)
    try {
      let url = '/api/getDashboard?action=executive'
      if (week) url += `&week=${week}`
      if (compare) url += `&compareWeek=${compare}`
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setData(json)
        if (!selectedWeek) setSelectedWeek(json.currentWeek)
        if (!compareWeek) setCompareWeek(json.compareWeek)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week)
    setShowWeekDropdown(false)
    loadData(week, compareWeek)
  }

  const handleCompareChange = (week: string) => {
    setCompareWeek(week)
    setShowCompareDropdown(false)
    loadData(selectedWeek, week)
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} />
      </div>
    )
  }

  if (!data) return <div className="text-center py-8" style={{ color: C.muted }}>Error al cargar datos</div>

  const DeltaIndicator = ({ value, inverted = false, suffix = '%' }: { value: number | null; inverted?: boolean; suffix?: string }) => {
    if (value === null) return <span style={{ color: C.muted }}>--</span>
    const isPositive = inverted ? value < 0 : value > 0
    const isNegative = inverted ? value > 0 : value < 0
    const color = isPositive ? C.green : isNegative ? C.red : C.muted
    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color }}>
        <Icon className="w-3 h-3" />
        {value > 0 ? '+' : ''}{value}{suffix}
      </span>
    )
  }

  const formatWeek = (w: string) => {
    const [year, weekPart] = w.split('-W')
    return `Sem ${parseInt(weekPart)} (${year})`
  }

  return (
    <div className="space-y-6">
      {/* Header con selectores */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black" style={{ color: C.ink }}>Dashboard Ejecutivo</h2>
          <p className="text-sm" style={{ color: C.muted }}>Cascada de costos y métricas semanales</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Selector semana actual */}
          <div className="relative">
            <button 
              onClick={() => setShowWeekDropdown(!showWeekDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: C.primary, color: 'white' }}
            >
              {formatWeek(selectedWeek)}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showWeekDropdown && (
              <div className="absolute top-full mt-1 right-0 bg-white rounded-xl shadow-lg border z-50 max-h-64 overflow-auto" style={{ borderColor: C.border }}>
                {data.availableWeeks.map(w => (
                  <button 
                    key={w} 
                    onClick={() => handleWeekChange(w)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                    style={{ color: w === selectedWeek ? C.primary : C.ink, fontWeight: w === selectedWeek ? 700 : 500 }}
                  >
                    {formatWeek(w)}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <span className="text-sm font-medium" style={{ color: C.muted }}>vs</span>
          
          {/* Selector semana comparación */}
          <div className="relative">
            <button 
              onClick={() => setShowCompareDropdown(!showCompareDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: C.bg, color: C.slate, border: `1px solid ${C.border}` }}
            >
              {formatWeek(compareWeek)}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showCompareDropdown && (
              <div className="absolute top-full mt-1 right-0 bg-white rounded-xl shadow-lg border z-50 max-h-64 overflow-auto" style={{ borderColor: C.border }}>
                {data.availableWeeks.map(w => (
                  <button 
                    key={w} 
                    onClick={() => handleCompareChange(w)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                    style={{ color: w === compareWeek ? C.primary : C.ink, fontWeight: w === compareWeek ? 700 : 500 }}
                  >
                    {formatWeek(w)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={() => loadData(selectedWeek, compareWeek)} 
            className="p-2 rounded-xl hover:bg-gray-100"
            style={{ color: C.muted }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerta HH Disponibles hardcodeado */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: C.amberLight, border: `1px solid ${C.amber}` }}>
        <AlertTriangle className="w-4 h-4" style={{ color: C.amber }} />
        <p className="text-xs font-semibold" style={{ color: C.amber }}>
          ⚠️ HH Disponibles hardcodeado en 352h - TODO: Crear tabla de capacidad por día
        </p>
      </div>

      {/* CASCADA PRINCIPAL */}
      <div className="rounded-3xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-6 py-4" style={{ background: C.ink }}>
          <h3 className="text-white font-black text-sm">CASCADA: PLAN VS REAL</h3>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {data.current.range.start} al {data.current.range.end}
          </p>
        </div>
        
        <div className="p-6">
          {/* Flujo visual */}
          <div className="flex items-center justify-between gap-4 mb-8">
            {/* HH Disponibles */}
            <div className="text-center flex-1">
              <div className="w-24 h-24 mx-auto rounded-2xl flex flex-col items-center justify-center" style={{ background: C.bg, border: `2px solid ${C.border}` }}>
                <p className="text-2xl font-black" style={{ color: C.ink }}>{data.current.hhDisponibles}</p>
                <p className="text-xs font-semibold" style={{ color: C.muted }}>HH</p>
              </div>
              <p className="text-xs font-bold mt-2" style={{ color: C.slate }}>DISPONIBLES</p>
              <p className="text-xs" style={{ color: C.muted }}>Capacidad</p>
            </div>

            {/* Flecha con % utilización */}
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold px-2 py-1 rounded" style={{ background: C.amberLight, color: C.amber }}>
                {Math.round((data.current.hhProgramadas / data.current.hhDisponibles) * 100)}%
              </div>
              <div className="w-12 h-0.5 my-1" style={{ background: C.border }} />
              <p className="text-[10px]" style={{ color: C.muted }}>Utilización</p>
            </div>

            {/* HH Programadas */}
            <div className="text-center flex-1">
              <div className="w-24 h-24 mx-auto rounded-2xl flex flex-col items-center justify-center" style={{ background: C.primaryLight, border: `2px solid ${C.primary}` }}>
                <p className="text-2xl font-black" style={{ color: C.primary }}>{data.current.hhProgramadas}</p>
                <p className="text-xs font-semibold" style={{ color: C.primary }}>HH</p>
              </div>
              <p className="text-xs font-bold mt-2" style={{ color: C.slate }}>PROGRAMADAS</p>
              <p className="text-xs" style={{ color: C.muted }}>{data.current.limpiezasTotal} limpiezas</p>
            </div>

            {/* Flecha con % cumplimiento */}
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold px-2 py-1 rounded" style={{ 
                background: data.cascada.variacionTotalPct && data.cascada.variacionTotalPct < -10 ? C.redLight : 
                           data.cascada.variacionTotalPct && data.cascada.variacionTotalPct > 10 ? C.amberLight : C.greenLight,
                color: data.cascada.variacionTotalPct && data.cascada.variacionTotalPct < -10 ? C.red : 
                       data.cascada.variacionTotalPct && data.cascada.variacionTotalPct > 10 ? C.amber : C.green
              }}>
                {data.cascada.variacionTotalPct !== null ? `${data.cascada.variacionTotalPct > 0 ? '+' : ''}${data.cascada.variacionTotalPct}%` : '--'}
              </div>
              <div className="w-12 h-0.5 my-1" style={{ background: C.border }} />
              <p className="text-[10px]" style={{ color: C.muted }}>Variación</p>
            </div>

            {/* HH Reales */}
            <div className="text-center flex-1">
              <div className="w-24 h-24 mx-auto rounded-2xl flex flex-col items-center justify-center" style={{ background: C.greenLight, border: `2px solid ${C.green}` }}>
                <p className="text-2xl font-black" style={{ color: C.green }}>{data.current.hhReales}</p>
                <p className="text-xs font-semibold" style={{ color: C.green }}>HH</p>
              </div>
              <p className="text-xs font-bold mt-2" style={{ color: C.slate }}>REALES</p>
              <p className="text-xs" style={{ color: C.muted }}>{data.current.limpiezasDone} completadas</p>
            </div>
          </div>

          {/* Análisis de variación */}
          <div className="rounded-2xl p-4" style={{ background: C.bg }}>
            <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: C.muted }}>ANÁLISIS DE VARIACIÓN</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: C.border }}>
                <span className="text-sm" style={{ color: C.slate }}>HH Programadas</span>
                <span className="text-sm font-bold" style={{ color: C.ink }}>{data.cascada.hhProgramadas} HH</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: C.border }}>
                <span className="text-sm" style={{ color: C.slate }}>
                  {data.cascada.efVelocidad > 0 ? '❌' : '✅'} Velocidad ({data.cascada.efVelocidadPct > 0 ? 'más lento' : 'más rápido'})
                </span>
                <span className="text-sm font-bold" style={{ color: data.cascada.efVelocidad > 0 ? C.red : C.green }}>
                  {data.cascada.efVelocidad > 0 ? '+' : ''}{data.cascada.efVelocidad} HH ({data.cascada.efVelocidadPct > 0 ? '+' : ''}{data.cascada.efVelocidadPct}%)
                </span>
              </div>
              <div className="flex items-center justify-between py-2 pt-3">
                <span className="text-sm font-bold" style={{ color: C.ink }}>= HH Reales</span>
                <span className="text-sm font-black" style={{ color: C.primary }}>{data.current.hhReales} HH ({data.cascada.variacionTotalPct !== null ? `${data.cascada.variacionTotalPct > 0 ? '+' : ''}${data.cascada.variacionTotalPct}%` : '--'})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MÉTRICAS UNITARIAS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'HH prom/casa', value: data.current.hhPromCasa, unit: 'h', delta: data.comparacion.hhPromCasa.delta, inverted: true, sublabel: 'Eficiencia' },
          { label: 'Casas distintas', value: data.current.casasDistintas, unit: '', delta: data.comparacion.casas.delta, sublabel: 'Churn' },
          { label: 'Limp/Casa', value: data.current.limpiezasPorCasa, unit: '', delta: data.comparacion.limpiezasPorCasa.delta, sublabel: 'Recurrencia' },
          { label: 'Limpiezas', value: data.current.limpiezasTotal, unit: '', delta: data.comparacion.limpiezas.delta, sublabel: 'Volumen' },
          { label: 'Cleaners', value: data.current.cleanersUnicos, unit: '', delta: data.comparacion.cleaners.delta, sublabel: 'Equipo' },
        ].map((m, i) => (
          <div key={i} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: C.muted }}>{m.label}</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-black" style={{ color: C.ink }}>{m.value}{m.unit}</p>
              <DeltaIndicator value={m.delta} inverted={m.inverted} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: C.muted }}>{m.sublabel}</p>
          </div>
        ))}
      </div>

      {/* COMPARACIÓN SEMANA VS SEMANA */}
      <div className="rounded-3xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h3 className="font-black text-sm" style={{ color: C.ink }}>COMPARACIÓN SEMANA VS SEMANA</h3>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>{formatWeek(compareWeek)} → {formatWeek(selectedWeek)}</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: C.bg }}>
                <th className="text-left px-6 py-3 text-xs font-bold" style={{ color: C.muted }}>MÉTRICA</th>
                <th className="text-right px-6 py-3 text-xs font-bold" style={{ color: C.muted }}>{formatWeek(compareWeek)}</th>
                <th className="text-right px-6 py-3 text-xs font-bold" style={{ color: C.muted }}>{formatWeek(selectedWeek)}</th>
                <th className="text-right px-6 py-3 text-xs font-bold" style={{ color: C.muted }}>Δ</th>
                <th className="text-right px-6 py-3 text-xs font-bold" style={{ color: C.muted }}>%</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'HH Reales', key: 'hhReales', unit: 'h', inverted: true },
                { label: 'Casas', key: 'casas', unit: '' },
                { label: 'Limpiezas', key: 'limpiezas', unit: '' },
                { label: 'HH/Casa', key: 'hhPromCasa', unit: 'h', inverted: true },
                { label: 'Limp/Casa', key: 'limpiezasPorCasa', unit: '' },
                { label: 'Cleaners', key: 'cleaners', unit: '' },
                { label: 'Velocidad', key: 'velocidad', unit: 'x', inverted: true },
              ].map((row, i) => {
                const d = data.comparacion[row.key as keyof Comparacion]
                const deltaAbs = d.current - d.compare
                return (
                  <tr key={i} className="border-t" style={{ borderColor: C.border }}>
                    <td className="px-6 py-3 text-sm font-semibold" style={{ color: C.slate }}>{row.label}</td>
                    <td className="px-6 py-3 text-sm text-right" style={{ color: C.muted }}>{d.compare}{row.unit}</td>
                    <td className="px-6 py-3 text-sm text-right font-bold" style={{ color: C.ink }}>{d.current}{row.unit}</td>
                    <td className="px-6 py-3 text-sm text-right font-semibold" style={{ color: deltaAbs > 0 ? (row.inverted ? C.red : C.green) : deltaAbs < 0 ? (row.inverted ? C.green : C.red) : C.muted }}>
                      {deltaAbs > 0 ? '+' : ''}{Math.round(deltaAbs * 10) / 10}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <DeltaIndicator value={d.delta} inverted={row.inverted} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RATIOS / ALERTAS */}
      <div className="rounded-3xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h3 className="font-black text-sm" style={{ color: C.ink }}>RATIOS CLAVE</h3>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>Indicadores para dirigir el barco</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
          {[
            { 
              label: 'Utilización', 
              value: Math.round((data.current.hhProgramadas / data.current.hhDisponibles) * 100), 
              unit: '%', 
              target: '>80%',
              status: (data.current.hhProgramadas / data.current.hhDisponibles) >= 0.8 ? 'good' : (data.current.hhProgramadas / data.current.hhDisponibles) >= 0.7 ? 'warn' : 'bad'
            },
            { 
              label: 'Cumplimiento', 
              value: data.current.limpiezasTotal > 0 ? Math.round((data.current.limpiezasDone / data.current.limpiezasTotal) * 100) : 0, 
              unit: '%', 
              target: '>95%',
              status: (data.current.limpiezasDone / data.current.limpiezasTotal) >= 0.95 ? 'good' : (data.current.limpiezasDone / data.current.limpiezasTotal) >= 0.9 ? 'warn' : 'bad'
            },
            { 
              label: 'Velocidad', 
              value: Math.round(data.current.velocidad * 100), 
              unit: '%', 
              target: '100% ±10%',
              status: data.current.velocidad >= 0.9 && data.current.velocidad <= 1.1 ? 'good' : data.current.velocidad >= 0.8 && data.current.velocidad <= 1.2 ? 'warn' : 'bad'
            },
            { 
              label: 'On-Time', 
              value: data.current.onTimeRate ?? '--', 
              unit: data.current.onTimeRate !== null ? '%' : '', 
              target: '>90%',
              status: data.current.onTimeRate === null ? 'neutral' : data.current.onTimeRate >= 90 ? 'good' : data.current.onTimeRate >= 85 ? 'warn' : 'bad'
            },
          ].map((r, i) => (
            <div key={i} className="rounded-2xl p-4" style={{ 
              background: r.status === 'good' ? C.greenLight : r.status === 'bad' ? C.redLight : r.status === 'warn' ? C.amberLight : C.bg,
              border: `1px solid ${r.status === 'good' ? C.green : r.status === 'bad' ? C.red : r.status === 'warn' ? C.amber : C.border}`
            }}>
              <p className="text-xs font-semibold mb-1" style={{ color: C.muted }}>{r.label}</p>
              <p className="text-2xl font-black" style={{ color: r.status === 'good' ? C.green : r.status === 'bad' ? C.red : r.status === 'warn' ? C.amber : C.ink }}>
                {r.value}{r.unit}
              </p>
              <p className="text-[10px] mt-1" style={{ color: C.muted }}>Target: {r.target}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
