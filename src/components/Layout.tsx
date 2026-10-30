import { useState, useEffect } from 'react'
import { Profile } from '../supabase'
import {
  Target, Radio, TrendingUp, BarChart3, Activity, CalendarDays, ListChecks, HardHat,
  AlertTriangle, Package, Users, Upload, Settings, SlidersHorizontal, Layers, CalendarClock,
  DollarSign, LogOut,
} from 'lucide-react'

const C = {
  side: '#1E293B',
  primary: '#6366F1',
  ink: '#0F172A',
  muted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  green: '#10B981',
}

export type PageKey =
  | 'home'
  | 'command'
  | 'cco_monitoring'
  | 'scorecard'
  | 'earn_stats'
  | 'earn_cascade'
  | 'plan_week'
  | 'plan_predispatch'
  | 'plan_field'
  | 'cco_incidents'
  | 'cco_ruptures'
  | 'users'
  | 'import'
  | 'system_settings'
  | 'tars_rules'
  | 'tars_squads'
  | 'tars_blocks'
  | 'earn_billing'

interface NavItem { key: PageKey; label: string; Icon: any }
interface NavGroup { key: string; label: string; world: 'os' | 'admin'; Icon: any; items: NavItem[] }

// Estructura: Operating System (Traction · Data · Process) y Admin (configuración)
const GROUPS: NavGroup[] = [
  { key: 'traction', label: 'Traction', world: 'os', Icon: Target, items: [
    { key: 'command', label: 'Command Center', Icon: Target },
    { key: 'cco_monitoring', label: 'Monitoring', Icon: Radio },
  ] },
  { key: 'data', label: 'Data', world: 'os', Icon: BarChart3, items: [
    { key: 'scorecard', label: 'Scorecard', Icon: TrendingUp },
    { key: 'earn_stats', label: 'Stats', Icon: BarChart3 },
    { key: 'earn_cascade', label: 'Weekly Cascade', Icon: Activity },
  ] },
  { key: 'process', label: 'Process', world: 'os', Icon: ListChecks, items: [
    { key: 'plan_week', label: 'Week Launch', Icon: CalendarDays },
    { key: 'plan_predispatch', label: 'Pre-dispatch', Icon: ListChecks },
    { key: 'plan_field', label: 'Field', Icon: HardHat },
    { key: 'cco_incidents', label: 'Incidents', Icon: AlertTriangle },
    { key: 'cco_ruptures', label: 'Ruptures', Icon: Package },
  ] },
  { key: 'admin', label: 'Admin', world: 'admin', Icon: Settings, items: [
    { key: 'users', label: 'Users', Icon: Users },
    { key: 'import', label: 'Import', Icon: Upload },
    { key: 'system_settings', label: 'Settings', Icon: Settings },
    { key: 'tars_rules', label: 'Rules', Icon: SlidersHorizontal },
    { key: 'tars_squads', label: 'Squads', Icon: Layers },
    { key: 'tars_blocks', label: 'Squad Blocks', Icon: CalendarClock },
    { key: 'earn_billing', label: 'Billing', Icon: DollarSign },
  ] },
]

const PAGE_TITLES: Record<PageKey, string> = {
  home: 'Command Center', command: 'Command Center', cco_monitoring: 'Monitoring',
  scorecard: 'Scorecard', earn_stats: 'Stats', earn_cascade: 'Weekly Cascade',
  plan_week: 'Week Launch', plan_predispatch: 'Pre-dispatch', plan_field: 'Field',
  cco_incidents: 'Incidents', cco_ruptures: 'Ruptures',
  users: 'Users', import: 'Import', system_settings: 'Settings',
  tars_rules: 'Rules', tars_squads: 'Squads', tars_blocks: 'Squad Blocks', earn_billing: 'Billing',
}

const PAGE_SUBTITLES: Record<PageKey, string> = {
  home: 'Today & this week', command: 'Today & this week at a glance', cco_monitoring: 'Live cleanings map & status',
  scorecard: 'Trends, the week and the day', earn_stats: 'Productivity & performance stats', earn_cascade: 'Plan vs real, weekly cost cascade',
  plan_week: 'Launch the week & assign squads', plan_predispatch: 'Staff, equipment & warnings — night before', plan_field: 'Team hours: cleaning, travel & idle',
  cco_incidents: 'Reported issues', cco_ruptures: 'Inventory breaks',
  users: 'User management', import: 'Turno · Guesty · Hospitable', system_settings: 'Company info & general preferences',
  tars_rules: 'Prime time, STR-only days, ESD calibration', tars_squads: 'Team roster, hours & capacity', tars_blocks: 'Structural capacity calendar',
  earn_billing: 'Payment status & Turno import',
}

interface Props {
  profile: Profile
  page: PageKey
  onNavigate: (p: PageKey) => void
  onSignOut: () => void
  children: React.ReactNode
  badges?: Partial<Record<PageKey, number>>
}

const worldStyle = (w: 'os' | 'admin') => w === 'os'
  ? { bg: 'rgba(129,140,248,0.22)', fg: '#E0E7FF' }
  : { bg: 'rgba(251,191,36,0.16)', fg: '#FEF3C7' }

export default function Layout({ profile, page, onNavigate, onSignOut, children, badges = {} }: Props) {
  const collapsed = false // el menú no se contrae
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [sheet, setSheet] = useState<string | null>(null)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const go = (p: PageKey) => { onNavigate(p); setSheet(null) }

  // 'monitor' solo ve Monitoring: se filtra todo lo demás antes de pintar el menú.
  const groups = GROUPS
    .map(g => ({ ...g, items: profile.role === 'monitor' ? g.items.filter(i => i.key === 'cco_monitoring') : g.items }))
    .filter(g => g.items.length > 0)
  const osGroups = groups.filter(g => g.world === 'os')
  const adminGroups = groups.filter(g => g.world === 'admin')
  const activeGroup = groups.find(g => g.items.some(i => i.key === page || (page === 'home' && i.key === 'command')))
  const sideW = collapsed ? 72 : 244
  const eff: PageKey = page === 'home' ? 'command' : page

  const NavBtn = ({ item }: { item: NavItem }) => {
    const active = eff === item.key
    const badge = badges[item.key]
    return (
      <button onClick={() => go(item.key)} title={collapsed ? item.label : undefined}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '7px 8px' : '5px 10px', margin: '0', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
          background: active ? 'rgba(129,140,248,0.30)' : 'transparent',
          color: active ? '#FFFFFF' : '#D5DDEA', fontSize: 12.5, fontWeight: active ? 600 : 500, transition: 'background .15s',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
        <item.Icon style={{ width: 16, height: 16, flexShrink: 0, opacity: active ? 1 : 0.75 }} />
        {!collapsed && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}
        {!collapsed && badge ? <span style={{ background: '#EF4444', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 9 }}>{badge}</span> : null}
      </button>
    )
  }

  const WorldHeader = ({ w, label }: { w: 'os' | 'admin'; label: string }) => collapsed
    ? <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '12px 8px' }} />
    : <div style={{ margin: '10px 0 2px', padding: '5px 10px', borderRadius: 8, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', background: worldStyle(w).bg, color: worldStyle(w).fg }}>{label}</div>

  const GroupBlock = ({ g }: { g: NavGroup }) => (
    <div>
      {!collapsed && g.world === 'os' && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A8B3C7', padding: '6px 12px 2px' }}>{g.label}</div>}
      <div style={{ marginLeft: collapsed ? 0 : 16, paddingLeft: collapsed ? 0 : 8, borderLeft: collapsed ? 'none' : '1.5px solid rgba(255,255,255,0.12)', marginTop: g.world === 'admin' ? 6 : 0 }}>
        {g.items.map(i => <NavBtn key={i.key} item={i} />)}
      </div>
    </div>
  )

  const initials = profile.initials || (profile.full_name || 'A').slice(0, 1)

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', background: C.bg, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", overflow: 'hidden' }}>

      {/* SIDEBAR (escritorio) */}
      {!isMobile && (
        <div style={{ width: sideW, minWidth: sideW, background: C.side, display: 'flex', flexDirection: 'column', transition: 'width .25s cubic-bezier(.4,0,.2,1)', overflow: 'hidden' }}>
          <div style={{ padding: collapsed ? '14px 10px 10px' : '14px 18px 10px', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {collapsed ? (
              <span style={{ flex: 1, textAlign: 'center', color: 'white', fontSize: 22, fontWeight: 800 }}>S<span style={{ color: '#FBBF24' }}>U</span></span>
            ) : (
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', color: 'white', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>Shine<span style={{ color: '#FBBF24' }}>UP</span></span>
                <span style={{ display: 'block', color: '#C7D2FE', fontSize: 13, fontWeight: 700, marginTop: 3 }}>Admin</span>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '2px 12px 8px', scrollbarWidth: 'none' as any }}>
            {osGroups.length > 0 && <WorldHeader w="os" label="OPERATING SYSTEM" />}
            {osGroups.map(g => <GroupBlock key={g.key} g={g} />)}
            {adminGroups.length > 0 && <WorldHeader w="admin" label="ADMIN" />}
            {adminGroups.map(g => <GroupBlock key={g.key} g={g} />)}
          </div>

          <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: C.primary, color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</div>
            {!collapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.full_name?.split(' ')[0] || 'Admin'}</p>
                  <p style={{ fontSize: 11, color: '#A8B3C7' }}>{profile.role}</p>
                </div>
                <button onClick={onSignOut} title="Sign out" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: 7, borderRadius: 8, display: 'flex' }}><LogOut style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.6)' }} /></button>
              </>
            )}
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR (móvil) */}
      {isMobile && (
        <div style={{ height: 56, background: C.side, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', flexShrink: 0 }}>
          <span style={{ color: 'white', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Shine<span style={{ color: '#FBBF24' }}>UP</span></span>
          <span style={{ color: '#C7D2FE', fontSize: 12, fontWeight: 700, marginTop: 3, flex: 1 }}>Admin</span>
          <button onClick={onSignOut} title="Sign out" style={{ width: 30, height: 30, borderRadius: 9, background: C.primary, color: 'white', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>{initials}</button>
        </div>
      )}

      {/* CONTENIDO */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!isMobile && (
          <div style={{ height: 64, background: C.white, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>{PAGE_TITLES[eff]}</p>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{PAGE_SUBTITLES[eff]}</p>
            </div>
            <div style={{ fontSize: 13, color: C.ink, background: C.bg, padding: '8px 14px', borderRadius: 10, fontWeight: 500, border: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ECFDF5', padding: '8px 14px', borderRadius: 10, border: '1px solid #A7F3D0' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>En vivo</span>
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 24 }}>
          {isMobile && <p style={{ fontSize: 18, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em', marginBottom: 12 }}>{PAGE_TITLES[eff]}</p>}
          {children}
        </div>
      </div>

      {/* BARRA INFERIOR + SUBMENÚ (móvil) */}
      {isMobile && (
        <>
          {sheet && (
            <>
              <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 40 }} />
              {(() => {
                const g = groups.find(x => x.key === sheet)
                if (!g) return null
                const ws = worldStyle(g.world)
                return (
                  <div style={{ position: 'fixed', left: 10, right: 10, bottom: 74, background: C.side, borderRadius: 18, padding: '10px 12px 12px', zIndex: 50, boxShadow: '0 -8px 30px rgba(15,23,42,.35)', maxHeight: '70vh', overflowY: 'auto' }}>
                    <div style={{ margin: '4px 0 6px', padding: '6px 10px', borderRadius: 8, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', background: ws.bg, color: ws.fg }}>{g.label.toUpperCase()}</div>
                    {g.items.map(i => {
                      const on = eff === i.key
                      return (
                        <button key={i.key} onClick={() => go(i.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 10px', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', background: on ? 'rgba(129,140,248,0.30)' : 'transparent', color: on ? 'white' : '#E2E8F0', fontSize: 14, fontWeight: on ? 600 : 500 }}>
                          <i.Icon style={{ width: 18, height: 18, opacity: 0.85 }} />{i.label}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </>
          )}
          <div style={{ height: 66, background: C.white, borderTop: `1px solid ${C.border}`, display: 'flex', flexShrink: 0, position: 'relative', zIndex: 60 }}>
            {groups.map(g => {
              const on = sheet === g.key || (!sheet && activeGroup?.key === g.key)
              const color = g.world === 'admin' ? (on ? '#B45309' : '#C08A3E') : (on ? '#4F46E5' : '#94A3B8')
              return (
                <button key={g.key} onClick={() => setSheet(s => s === g.key ? null : g.key)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 10, fontWeight: 600, position: 'relative' }}>
                  {on && <span style={{ position: 'absolute', top: 0, width: 22, height: 3, borderRadius: 9, background: color }} />}
                  <g.Icon style={{ width: 20, height: 20 }} />{g.label}
                </button>
              )
            })}
          </div>
        </>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.7; transform:scale(1.1) } }`}</style>
    </div>
  )
}
