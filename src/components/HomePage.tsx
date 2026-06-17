import { useState, useEffect } from 'react'
import { Profile } from '../supabase'
import {
  CalendarDays, Settings, MapPin, Receipt, BarChart3,
  CheckCircle2, Clock, AlertTriangle, RefreshCw
} from 'lucide-react'
import { PageKey } from './Layout'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', greenLight: '#ECFDF5',
  amber: '#F59E0B', amberLight: '#FFFBEB',
  red: '#EF4444', redLight: '#FEF2F2',
  blue: '#3B82F6', blueLight: '#EFF6FF',
}

interface Props {
  profile: Profile
  onNavigate: (p: PageKey) => void
}

const todayDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

function getMonday(d: Date) {
  const dow = (d.getDay() + 6) % 7
  const m = new Date(d)
  m.setDate(d.getDate() - dow)
  return m
}

interface DashboardCleaning {
  id: string
  propertyText: string
  status: string
  scheduledTime: string | null
  staffListText: string
}

interface BillingSummary {
  unpaidAmount: number; unpaidCount: number
  invoicedAmount: number; invoicedCount: number
  paidAmount: number; paidCount: number
  totalRevenue: number; total: number
}

export default function HomePage({ profile, onNavigate }: Props) {
  const [loading, setLoading] = useState(true)
  const [cleanings, setCleanings] = useState<DashboardCleaning[]>([])
  const [stats, setStats] = useState({ total: 0, done: 0, inProgress: 0, programmed: 0, opened: 0 })
  const [billing, setBilling] = useState<BillingSummary | null>(null)
  const [weekCapacityPct, setWeekCapacityPct] = useState<number | null>(null)
  const [strCount, setStrCount] = useState(0)
  const [flexCount, setFlexCount] = useState(0)
  const [incidentCount, setIncidentCount] = useState(0)

  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there'
  const today = todayDate()
  const todayLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const load = async () => {
    setLoading(true)
    try {
      const monday = getMonday(new Date())
      const monStr = monday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

      const [dashRes, billRes, squadRes, incRes] = await Promise.all([
        fetch(`/api/getDashboard?date=${today}`),
        fetch(`/api/getReports?type=billing&dateFrom=${today}&dateTo=${today}`),
        fetch(`/api/getSquads?weekStart=${monStr}`),
        fetch('/api/getReports?type=incidents'),
      ])

      if (dashRes.ok) {
        const d = await dashRes.json()
        setCleanings(d.cleanings || [])
        setStats(d.stats || stats)
      }
      if (billRes.ok) {
        const b = await billRes.json()
        setBilling(b.summary || null)
      }
      if (squadRes.ok) {
        const s = await squadRes.json()
        const squads = s.squads || []
        const blocks = s.blocks || []
        if (squads.length > 0) {
          const totalCapacity = squads.reduce((sum: number, sq: any) => sum + ((sq.endHour - sq.startHour) || 8), 0) * 7
          const usedHours = blocks.reduce((sum: number, b: any) => {
            const toMin = (t: string) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m }
            return sum + Math.max(0, (toMin(b.endTime) - toMin(b.startTime)) / 60)
          }, 0)
          setWeekCapacityPct(totalCapacity > 0 ? Math.round((usedHours / totalCapacity) * 100) : 0)
          setStrCount(blocks.filter((b: any) => b.type === 'STR' || b.type === 'Appointment').length)
          setFlexCount(blocks.filter((b: any) => b.type !== 'STR' && b.type !== 'Appointment').length)
        }
      }
      if (incRes.ok) {
        const incidents = await incRes.json()
        setIncidentCount((incidents || []).filter((i: any) => {
          const d = i.creationDate ? new Date(i.creationDate).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : null
          return d === today
        }).length)
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const fmtMoney = (n: number) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'

  const upcoming = cleanings
    .filter(c => c.status !== 'Done')
    .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
    .slice(0, 5)

  return (
    <div style={{ maxWidth: 980, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 2px' }}>{todayLabel}</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>Good day, {firstName}</h1>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.white, color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw style={{ width: 13, height: 13 }} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Today metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Cleanings today" value={stats.total} />
        <MetricCard label="In progress" value={stats.inProgress} color={C.blue} />
        <MetricCard label="Open incidents" value={incidentCount} color={incidentCount > 0 ? C.amber : undefined} />
        <MetricCard label="Done" value={stats.done} color={C.green} />
      </div>

      {/* Billing snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <BillingCard label="Unpaid" amount={billing?.unpaidAmount || 0} count={billing?.unpaidCount || 0} color={C.amber} bg={C.amberLight} />
        <BillingCard label="Invoiced" amount={billing?.invoicedAmount || 0} count={billing?.invoicedCount || 0} color={C.ink} bg={C.bg} />
        <BillingCard label="Collected today" amount={billing?.paidAmount || 0} count={billing?.paidCount || 0} color={C.green} bg={C.greenLight} />
        <BillingCard label="Total generated" amount={billing?.totalRevenue || 0} count={billing?.total || 0} color={C.primary} bg={C.primaryLight} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Today's schedule */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>Today's schedule</p>
            <button onClick={() => onNavigate('cco_monitoring')} style={{ fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              View all →
            </button>
          </div>
          {loading ? (
            <p style={{ fontSize: 13, color: C.muted }}>Loading…</p>
          ) : upcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: C.muted }}>No cleanings pending for today.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {upcoming.map(c => {
                const isWarn = !c.staffListText || c.staffListText === 'Sin asignar'
                const Icon = c.status === 'In Progress' ? Clock : isWarn ? AlertTriangle : CheckCircle2
                const iconColor = c.status === 'In Progress' ? C.blue : isWarn ? C.amber : C.green
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: C.bg }}>
                    <Icon style={{ width: 16, height: 16, color: iconColor, flexShrink: 0 }} />
                    <p style={{ fontSize: 13, color: C.ink, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.propertyText || 'Unnamed property'} {c.staffListText ? `— ${c.staffListText}` : ''}
                    </p>
                    <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmtTime(c.scheduledTime)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* This week */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 12px' }}>This week</p>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.muted }}>Capacity used</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{weekCapacityPct ?? '—'}%</span>
            </div>
            <div style={{ height: 6, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${weekCapacityPct ?? 0}%`, background: C.primary, borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Row label="STR blocks" value={strCount} />
            <Row label="Flex / other" value={flexCount} />
          </div>
        </div>
      </div>

      {/* Quick links */}
      <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 10px' }}>Jump to</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        <QuickLink Icon={MapPin}     label="OCC live map"   onClick={() => onNavigate('cco_monitoring')} />
        <QuickLink Icon={CalendarDays} label="Plan the week" onClick={() => onNavigate('plan_week')} />
        <QuickLink Icon={Settings}   label="TARS rules"      onClick={() => onNavigate('tars_rules')} />
        <QuickLink Icon={Receipt}    label="Billing"         onClick={() => onNavigate('earn_billing')} />
        <QuickLink Icon={BarChart3}  label="North Star"      onClick={() => onNavigate('command')} />
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} .animate-spin{animation:spin 1s linear infinite}`}</style>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: C.bg, borderRadius: 12, padding: '12px 14px' }}>
      <p style={{ fontSize: 12, color: C.muted, margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: color || C.ink, margin: 0 }}>{value}</p>
    </div>
  )
}

function BillingCard({ label, amount, count, color, bg }: { label: string; amount: number; count: number; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '10px 14px' }}>
      <p style={{ fontSize: 11, color: C.muted, margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color, margin: 0 }}>${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
      <p style={{ fontSize: 10.5, color: C.muted, margin: '2px 0 0' }}>{count} cleanings</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{value}</span>
    </div>
  )
}

function QuickLink({ Icon, label, onClick }: { Icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 7,
      padding: '14px 14px', borderRadius: 12, border: `1px solid ${C.border}`,
      background: C.white, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
      <Icon style={{ width: 18, height: 18, color: C.primary }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{label}</span>
    </button>
  )
}
