import { useState } from 'react'
import { Profile } from '../supabase'
import {
  CalendarDays, Users, AlertCircle,
  Package, Download, LogOut, ChevronLeft, Menu, BarChart3, Activity
} from 'lucide-react'

const C = {
  sidebarBg:  '#1E293B',
  sidebarMid: '#334155',
  primary:    '#6366F1',
  ink:        '#0F172A',
  muted:      '#94A3B8',
  border:     '#E2E8F0',
  bg:         '#F8FAFC',
  white:      '#FFFFFF',
  green:      '#10B981',
  red:        '#EF4444',
  amber:      '#F59E0B',
}

export type PageKey = 'dashboard' | 'stats' | 'planning' | 'users' | 'incidents' | 'inventory' | 'backup'

interface NavItem {
  key: PageKey
  label: string
  Icon: any
  section: 'ops' | 'admin'
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Monitoreo',     Icon: Activity,        section: 'ops' },
  { key: 'stats',     label: 'Estadísticas',  Icon: BarChart3,       section: 'ops' },
  { key: 'planning',  label: 'Planificación', Icon: CalendarDays,    section: 'ops' },
  { key: 'incidents', label: 'Incidentes',    Icon: AlertCircle,     section: 'ops' },
  { key: 'inventory', label: 'Rupturas',      Icon: Package,         section: 'ops' },
  { key: 'users',     label: 'Usuarios',      Icon: Users,           section: 'admin' },
  { key: 'backup',    label: 'Media Backup',  Icon: Download,        section: 'admin' },
]

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: 'Monitoreo',
  stats:     'Estadísticas',
  planning:  'Planificación',
  incidents: 'Incidentes',
  inventory: 'Rupturas de Inventario',
  users:     'Gestión de Usuarios',
  backup:    'Media Backup',
}

interface Props {
  profile: Profile
  page: PageKey
  onNavigate: (p: PageKey) => void
  onSignOut: () => void
  children: React.ReactNode
  badges?: Partial<Record<PageKey, number>>
}

export default function Layout({ profile, page, onNavigate, onSignOut, children, badges = {} }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const opsItems  = NAV_ITEMS.filter(i => i.section === 'ops')
  const adminItems = NAV_ITEMS.filter(i => i.section === 'admin')

  const sideW = collapsed ? '56px' : '220px'

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, fontFamily: 'Poppins, sans-serif', overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <div style={{ width: sideW, minWidth: sideW, background: C.sidebarBg, display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setCollapsed(c => !c)}
            style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {collapsed
              ? <Menu className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              : <ChevronLeft className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />}
          </button>
          {!collapsed && (
            <span style={{ color: 'white', fontSize: 18, fontWeight: 900, whiteSpace: 'nowrap' }}>
              Shine<span style={{ color: '#FFD700' }}>UP</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {/* Ops section */}
          {!collapsed && <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>Operaciones</p>}
          {opsItems.map(item => <NavBtn key={item.key} item={item} active={page === item.key} collapsed={collapsed} badge={badges[item.key]} onClick={() => onNavigate(item.key)} />)}

          {/* Admin section */}
          <div style={{ height: 16 }} />
          {!collapsed && <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>Administración</p>}
          {adminItems.map(item => <NavBtn key={item.key} item={item} active={page === item.key} collapsed={collapsed} badge={badges[item.key]} onClick={() => onNavigate(item.key)} />)}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {profile.initials || 'AD'}
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.full_name?.split(' ')[0] || 'Admin'}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{profile.role}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={onSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                <LogOut className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ height: 52, background: C.white, borderBottom: `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, flex: 1 }}>{PAGE_TITLES[page]}</p>
          <div style={{ fontSize: 12, color: C.muted, background: C.bg, padding: '4px 10px', borderRadius: 6 }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ECFDF5', padding: '3px 10px', borderRadius: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>En vivo</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function NavBtn({ item, active, collapsed, badge, onClick }: { item: NavItem; active: boolean; collapsed: boolean; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
        borderRadius: 8, cursor: 'pointer', marginBottom: 2, border: 'none', textAlign: 'left',
        background: active ? '#6366F1' : 'transparent', transition: 'background 0.15s',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
      <item.Icon style={{ width: 16, height: 16, color: active ? 'white' : 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
      {!collapsed && <span style={{ fontSize: 13, fontWeight: 500, color: active ? 'white' : 'rgba(255,255,255,0.7)', flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}
      {!collapsed && badge ? <span style={{ background: '#EF4444', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{badge}</span> : null}
    </button>
  )
}
