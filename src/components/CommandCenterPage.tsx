import { useState, useEffect } from 'react'
import { 
  TrendingUp, TrendingDown, Minus, AlertTriangle, 
  DollarSign, Clock, Home, Users, Star, RefreshCw 
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
  pink: '#EC4899',
}

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
        <div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#EC4899', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Calcular North Star: Revenue / HH (placeholder - necesita datos de revenue)
  // Por ahora usamos un mock
  const mockRevenue = 3200 // Revenue de la semana
  const hhReales = data?.current?.hhReales || 125
  const revenuePerHH = hhReales > 0 ? (mockRevenue / hhReales).toFixed(2) : 0
  const revenuePerHHDelta = 8.2 // Mock delta

  const utilizacion = data?.current?.hhDisponibles 
    ? Math.round((data.current.hhProgramadas / data.current.hhDisponibles) * 100) 
    : 0
  const cumplimiento = data?.current?.limpiezasTotal 
    ? Math.round((data.current.limpiezasDone / data.current.limpiezasTotal) * 100) 
    : 0
  const onTime = data?.current?.onTimeRate ?? 0

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>
            Command Center
          </h1>
          <p style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>
            Vista ejecutiva de tu negocio
          </p>
        </div>
        <button 
          onClick={loadData}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.white,
            cursor: 'pointer',
            color: C.slate,
            fontWeight: 500,
            fontSize: 13
          }}
        >
          <RefreshCw style={{ width: 16, height: 16 }} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* North Star Metric */}
      <div style={{
        background: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
        borderRadius: 24,
        padding: 32,
        marginBottom: 24,
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <DollarSign style={{ width: 20, height: 20, opacity: 0.8 }} />
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>
              North Star Metric
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.03em' }}>
              ${revenuePerHH}
            </span>
            <span style={{ fontSize: 20, opacity: 0.8 }}>/ HH</span>
          </div>
          
          <p style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>
            Revenue por Hora-Hombre trabajada
          </p>
          
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 6, 
            background: 'rgba(255,255,255,0.2)', 
            padding: '6px 12px', 
            borderRadius: 20,
            marginTop: 16
          }}>
            <TrendingUp style={{ width: 16, height: 16 }} />
            <span style={{ fontWeight: 600 }}>+{revenuePerHHDelta}%</span>
            <span style={{ opacity: 0.8, fontSize: 12 }}>vs mes anterior</span>
          </div>
        </div>
      </div>

      {/* Alerta TODO */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        background: C.amberLight, 
        border: `1px solid ${C.amber}`,
        borderRadius: 16, 
        padding: '12px 16px',
        marginBottom: 24
      }}>
        <AlertTriangle style={{ width: 20, height: 20, color: C.amber }} />
        <p style={{ color: C.amber, fontSize: 13, fontWeight: 500 }}>
          <strong>TODO:</strong> Integrar datos de Revenue desde facturación para calcular $/HH real
        </p>
      </div>

      {/* KPIs Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: 16,
        marginBottom: 24 
      }}>
        <KPICard 
          icon={Clock}
          label="Utilización"
          value={`${utilizacion}%`}
          target=">80%"
          status={utilizacion >= 80 ? 'good' : utilizacion >= 70 ? 'warn' : 'bad'}
          description="HH Programadas / HH Disponibles"
        />
        <KPICard 
          icon={Home}
          label="Cumplimiento"
          value={`${cumplimiento}%`}
          target=">95%"
          status={cumplimiento >= 95 ? 'good' : cumplimiento >= 90 ? 'warn' : 'bad'}
          description="Limpiezas completadas / programadas"
        />
        <KPICard 
          icon={Clock}
          label="On-Time"
          value={onTime ? `${onTime}%` : '--'}
          target=">90%"
          status={!onTime ? 'neutral' : onTime >= 90 ? 'good' : onTime >= 85 ? 'warn' : 'bad'}
          description="Llegadas a tiempo"
        />
        <KPICard 
          icon={Users}
          label="Returning"
          value="78%"
          target=">70%"
          status="good"
          description="Clientes que repiten"
        />
      </div>

      {/* Quick Stats */}
      <div style={{
        background: C.white,
        borderRadius: 24,
        border: `1px solid ${C.border}`,
        padding: 24
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 16 }}>
          Esta Semana
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          <QuickStat label="Limpiezas" value={data?.current?.limpiezasTotal || 0} />
          <QuickStat label="HH Reales" value={`${data?.current?.hhReales || 0}h`} />
          <QuickStat label="Casas" value={data?.current?.casasDistintas || 0} />
          <QuickStat label="Cleaners" value={data?.current?.cleanersUnicos || 0} />
          <QuickStat label="HH/Casa" value={`${data?.current?.hhPromCasa || 0}h`} />
          <QuickStat label="Limp/Casa" value={data?.current?.limpiezasPorCasa || 0} />
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon: Icon, label, value, target, status, description }: {
  icon: any
  label: string
  value: string
  target: string
  status: 'good' | 'warn' | 'bad' | 'neutral'
  description: string
}) {
  const colors = {
    good: { bg: C.greenLight, border: C.green, text: C.green },
    warn: { bg: C.amberLight, border: C.amber, text: C.amber },
    bad: { bg: C.redLight, border: C.red, text: C.red },
    neutral: { bg: C.bg, border: C.border, text: C.muted }
  }
  const c = colors[status]

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 20,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon style={{ width: 18, height: 18, color: c.text }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.slate }}>{label}</span>
      </div>
      <p style={{ fontSize: 32, fontWeight: 800, color: c.text, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
        Target: {target}
      </p>
      <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
        {description}
      </p>
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
