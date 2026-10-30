import { useState, useEffect } from 'react'
import { 
  Clock, Home, Users
} from 'lucide-react'

const C = {
  primary: '#6366F1',
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
}

import CommandToday from './CommandToday'

export default function CommandCenterPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/getDashboard?action=executive')
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Calcular North Star: Revenue / HH (placeholder - necesita datos de revenue)
  const mockRevenue = 3200
  const hhReales = data?.current?.hhReales || 125
  const revenuePerHH = hhReales > 0 ? (mockRevenue / hhReales).toFixed(2) : 0

  const utilizacion = data?.current?.hhDisponibles 
    ? Math.round((data.current.hhProgramadas / data.current.hhDisponibles) * 100) 
    : 0
  const cumplimiento = data?.current?.limpiezasTotal 
    ? Math.round((data.current.limpiezasDone / data.current.limpiezasTotal) * 100) 
    : 0
  const onTime = data?.current?.onTimeRate ?? 0

  const northStar = (
    <div style={{ background: '#1E293B', borderRadius: 12, padding: '14px 16px', color: 'white' }}>
      <p style={{ fontSize: 12, fontWeight: 500, opacity: 0.75 }}>North Star · Revenue / HH</p>
      <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: '3px 0' }}>${revenuePerHH}</p>
      <p style={{ fontSize: 11, color: '#FDE68A' }}>Estimado: falta conectar facturación real</p>
    </div>
  )

  const kpis = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
      <KPICard icon={Clock} label="Utilización" value={`${utilizacion}%`} target=">80%" status={utilizacion >= 80 ? 'good' : utilizacion >= 70 ? 'warn' : 'bad'} />
      <KPICard icon={Home} label="Cumplimiento" value={`${cumplimiento}%`} target=">95%" status={cumplimiento >= 95 ? 'good' : cumplimiento >= 90 ? 'warn' : 'bad'} />
      <KPICard icon={Clock} label="On-Time" value={onTime ? `${onTime}%` : '--'} target=">90%" status={!onTime ? 'neutral' : onTime >= 90 ? 'good' : onTime >= 85 ? 'warn' : 'bad'} />
      <KPICard icon={Users} label="Returning" value="78%" target=">70%" status="good" />
    </div>
  )

  const week = (
    <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Esta semana</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <QuickStat label="Limpiezas" value={data?.current?.limpiezasTotal || 0} />
        <QuickStat label="HH reales" value={`${data?.current?.hhReales || 0}h`} />
        <QuickStat label="Casas" value={data?.current?.casasDistintas || 0} />
        <QuickStat label="Cleaners" value={data?.current?.cleanersUnicos || 0} />
        <QuickStat label="HH/casa" value={`${data?.current?.hhPromCasa || 0}h`} />
        <QuickStat label="Limp/casa" value={data?.current?.limpiezasPorCasa || 0} />
      </div>
    </div>
  )

  return <CommandToday extraCard={northStar} kpis={kpis} week={week} onRefresh={loadData} />
}

function KPICard({ icon: Icon, label, value, target, status }: {
  icon: any
  label: string
  value: string
  target: string
  status: 'good' | 'warn' | 'bad' | 'neutral'
}) {
  const colors = {
    good: { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857' },
    warn: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309' },
    bad: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C' },
    neutral: { bg: C.white, border: C.border, text: C.muted }
  }
  const c = colors[status]
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Icon style={{ width: 18, height: 18, color: c.text, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.slate }}>{label}</p>
        <p style={{ fontSize: 11, color: C.muted }}>Meta {target}</p>
      </div>
      <p style={{ fontSize: 24, fontWeight: 700, color: c.text, letterSpacing: '-0.02em' }}>{value}</p>
    </div>
  )
}

function QuickStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>{value}</p>
    </div>
  )
}
