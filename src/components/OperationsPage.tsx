import { Profile } from '../supabase'
import DashboardPage from './DashboardPage'
import IncidentsPage from './IncidentsPage'
import InventoryPage from './InventoryPage'
import { Radio, AlertTriangle, Package } from 'lucide-react'
import { useState, useEffect } from 'react'

const C = {
  primary: '#6366F1', ink: '#0F172A', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', red: '#EF4444', amber: '#F59E0B',
}

type Tab = 'live' | 'incidents' | 'inventory'

interface DashboardStats {
  total: number; done: number; inProgress: number; programmed: number; opened: number
}

interface Props { profile: Profile }

const todayDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

export default function OperationsPage({ profile }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('live')
  const [date, setDate] = useState(todayDate())
  const [dateChanged, setDateChanged] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isToday, setIsToday] = useState(true)
  const [incidentCount, setIncidentCount] = useState(0)
  const [inventoryCount, setInventoryCount] = useState(0)
  // lastUpdated removed

  // Fetch incidents + inventory counts for the selected date
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [incRes, invRes] = await Promise.all([
          fetch('/api/getReports?type=incidents'),
          fetch('/api/getReports?type=inventory'),
        ])
        if (incRes.ok) {
          const incidents = await incRes.json()
          setIncidentCount((incidents || []).filter((i: any) => {
            const d = i.creationDate ? new Date(i.creationDate).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : null
            return d === date
          }).length)
        }
        if (invRes.ok) {
          const inventory = await invRes.json()
          setInventoryCount((inventory || []).filter((i: any) => {
            const d = i.date ? (i.date.includes('T') ? new Date(i.date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : i.date) : null
            return d === date
          }).length)
        }
      } catch {}
    }
    loadCounts()
  }, [date, dateChanged])

  // Fetch stats for the tab badge
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/getDashboard?date=${date}`)
        if (r.ok) {
          const d = await r.json()
          setStats(d.stats)
          setLastRefresh(new Date())
          setIsToday(true)
        }
      } catch {}
    }
    load()
    const iv = setInterval(load, 120000)
    return () => clearInterval(iv)
  }, [date, dateChanged])

  const pct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  return (
    <div>
      {/* Tab Bar row — tabs a la izquierda, fecha a la derecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
      <div style={{
        display: 'flex', gap: 6,
        background: C.white, padding: 5,
        borderRadius: 16, border: `1px solid ${C.border}`,
        alignItems: 'center', flex: '0 0 auto',
      }}>

        {/* MONITOREO tab — rico con stats */}
        <button
          onClick={() => setActiveTab('live')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 11, border: 'none', cursor: 'pointer',
            background: activeTab === 'live'
              ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
              : 'transparent',
            color: activeTab === 'live' ? 'white' : C.muted,
            fontWeight: 600, fontSize: 13,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            transition: 'all 0.2s',
            boxShadow: activeTab === 'live' ? '0 4px 12px #10B98140' : 'none',
          }}
        >
          {/* Live dot */}
          <div style={{ position: 'relative', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Radio style={{ width: 15, height: 15 }} />
            {isToday && (
              <div style={{
                position: 'absolute', top: -2, right: -2,
                width: 6, height: 6, borderRadius: '50%',
                background: activeTab === 'live' ? 'white' : C.green,
                boxShadow: activeTab === 'live' ? '0 0 0 2px #059669' : '0 0 0 2px white',
                animation: 'livepulse 2s infinite',
              }} />
            )}
          </div>
          <span>Monitoreo</span>

          {/* Stats pills — solo si hay datos */}
          {stats && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
              {/* Total / Completado */}
              <div style={{
                background: activeTab === 'live' ? 'rgba(255,255,255,0.2)' : C.bg,
                borderRadius: 8, padding: '2px 8px',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>{stats.done}/{stats.total}</span>
                <span style={{ fontSize: 10, opacity: 0.8 }}>{pct}%</span>
              </div>
              {/* En progreso badge */}
              {stats.inProgress > 0 && (
                <div style={{
                  background: activeTab === 'live' ? 'rgba(255,255,255,0.2)' : '#EFF6FF',
                  color: activeTab === 'live' ? 'white' : '#2563EB',
                  borderRadius: 8, padding: '2px 7px',
                  fontSize: 11, fontWeight: 700,
                }}>
                  ▶ {stats.inProgress}
                </div>
              )}
            </div>
          )}
        </button>

        {/* INCIDENTES */}
        <button
          onClick={() => setActiveTab('incidents')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 11, border: 'none', cursor: 'pointer',
            background: activeTab === 'incidents'
              ? `linear-gradient(135deg, ${C.amber} 0%, ${C.amber}dd 100%)`
              : 'transparent',
            color: activeTab === 'incidents' ? 'white' : C.muted,
            fontWeight: 600, fontSize: 13,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            transition: 'all 0.2s',
            boxShadow: activeTab === 'incidents' ? `0 4px 12px ${C.amber}40` : 'none',
          }}
        >
          <AlertTriangle style={{ width: 15, height: 15 }} />
          Incidentes
          {incidentCount > 0 && (
            <span style={{
              background: activeTab === 'incidents' ? 'rgba(255,255,255,0.25)' : C.bg,
              borderRadius: 8, padding: '1px 7px', fontSize: 11, fontWeight: 800,
            }}>{incidentCount}</span>
          )}
        </button>

        {/* RUPTURAS */}
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 11, border: 'none', cursor: 'pointer',
            background: activeTab === 'inventory'
              ? `linear-gradient(135deg, ${C.red} 0%, ${C.red}dd 100%)`
              : 'transparent',
            color: activeTab === 'inventory' ? 'white' : C.muted,
            fontWeight: 600, fontSize: 13,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            transition: 'all 0.2s',
            boxShadow: activeTab === 'inventory' ? `0 4px 12px ${C.red}40` : 'none',
          }}
        >
          <Package style={{ width: 15, height: 15 }} />
          Rupturas
          {inventoryCount > 0 && (
            <span style={{
              background: activeTab === 'inventory' ? 'rgba(255,255,255,0.25)' : C.bg,
              borderRadius: 8, padding: '1px 7px', fontSize: 11, fontWeight: 800,
            }}>{inventoryCount}</span>
          )}
        </button>
      </div>{/* end tabs pill */}

      {/* Date controls — derecha */}
      {activeTab === 'live' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setDateChanged(true) }}
            style={{ height: 38, padding: '0 12px', borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 13, fontWeight: 500, color: C.ink, outline: 'none', fontFamily: "'Inter', sans-serif" }} />
          <button onClick={() => { setDate(todayDate()); setDateChanged(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 12,
              border: `1.5px solid ${date === todayDate() ? C.primary : C.border}`,
              background: date === todayDate() ? '#EEF2FF' : C.white,
              color: date === todayDate() ? C.primary : C.muted,
              cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
            📅 Hoy
          </button>
          <button onClick={() => setDateChanged(c => !c)}
            style={{ width: 38, height: 38, borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🔄
          </button>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: C.muted }}>
              Actualizado {lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
      </div>{/* end tab bar row */}

      <style>{`
        @keyframes livepulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>

      {activeTab === 'live'      && <DashboardPage profile={profile} externalDate={date} />}
      {activeTab === 'incidents' && <IncidentsPage />}
      {activeTab === 'inventory' && <InventoryPage />}
    </div>
  )
}
