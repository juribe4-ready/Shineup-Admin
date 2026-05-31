import { useState, useEffect } from 'react'
import { Profile } from '../supabase'
import {
  CalendarDays, Users, LogOut, ChevronLeft, 
  TrendingUp, Settings, Home, ChevronRight, Radio, LayoutDashboard, Menu, X as XIcon
} from 'lucide-react'

const C = {
  sidebarBg:  '#0F172A',
  sidebarHover: '#1E293B',
  primary:    '#6366F1',
  primaryGlow: 'rgba(99, 102, 241, 0.15)',
  ink:        '#0F172A',
  muted:      '#94A3B8',
  border:     '#E2E8F0',
  bg:         '#F8FAFC',
  white:      '#FFFFFF',
  green:      '#10B981',
  red:        '#EF4444',
  amber:      '#F59E0B',
  teal:       '#14B8A6',
}

// Nueva estructura de páginas - De operativo a estratégico
export type PageKey = 
  | 'operations'    // Monitoreo en vivo (día actual) + Incidentes + Rupturas
  | 'planning'      // Lanzador de semana + Calendario
  | 'analysis'      // Cascadas + Productividad + Tendencias  
  | 'command'       // North Star + KPIs ejecutivos
  | 'users'         // Usuarios
  | 'settings'      // Configuración

interface NavItem {
  key: PageKey
  label: string
  sublabel?: string
  Icon: any
  section: 'main' | 'config'
  badge?: number
  gradient?: string
}

const NAV_ITEMS: NavItem[] = [
  // NIVEL OPERATIVO → ESTRATÉGICO
  { 
    key: 'operations', 
    label: 'CCO',
    sublabel: 'Control de Operaciones',
    Icon: Radio,        
    section: 'main',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
  },
  { 
    key: 'planning',   
    label: 'Planificación', 
    sublabel: 'Semana',
    Icon: CalendarDays,    
    section: 'main',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)'
  },
  { 
    key: 'analysis',     
    label: 'Análisis',  
    sublabel: 'Productividad',
    Icon: TrendingUp,       
    section: 'main',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
  },
  { 
    key: 'command',
    label: 'Command Center',
    sublabel: 'North Star',
    Icon: LayoutDashboard,
    section: 'main',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)'
  },
  // CONFIG
  { key: 'users',      label: 'Usuarios',      Icon: Users,     section: 'config' },
  { key: 'settings',   label: 'Configuración', Icon: Settings,  section: 'config' },
]

const PAGE_TITLES: Record<PageKey, string> = {
  operations: 'CCO',
  planning:   'Planificación',
  analysis:   'Análisis',
  command:    'Command Center',
  users:      'Gestión de Usuarios',
  settings:   'Configuración',
}

const PAGE_SUBTITLES: Record<PageKey, string> = {
  operations: 'Centro de Control de Operaciones',
  planning:   'Lanzador y calendario semanal',
  analysis:   'Cascadas, productividad y tendencias',
  command:    'North Star y KPIs ejecutivos',
  users:      'Administración de usuarios',
  settings:   'Configuración del sistema',
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<PageKey | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Close mobile drawer on navigate
  const handleNavigate = (p: PageKey) => {
    onNavigate(p)
    setMobileOpen(false)
  }

  const mainItems   = NAV_ITEMS.filter(i => i.section === 'main')
  const configItems = NAV_ITEMS.filter(i => i.section === 'config')

  const sideW = isMobile ? '0' : collapsed ? '72px' : '240px'

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      background: C.bg, 
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", 
      overflow: 'hidden',
      position: 'relative'
    }}>
    
      {/* MOBILE OVERLAY */}
      {isMobile && mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} 
        />
      )}

      {/* SIDEBAR */}
      <div style={{ 
        width: isMobile ? (mobileOpen ? '240px' : '0') : sideW, 
        minWidth: isMobile ? (mobileOpen ? '240px' : '0') : sideW,
        background: C.sidebarBg, 
        display: 'flex', 
        flexDirection: 'column', 
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)', 
        overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        position: isMobile ? 'fixed' : 'relative',
        top: isMobile ? 0 : undefined,
        left: isMobile ? 0 : undefined,
        height: isMobile ? '100vh' : undefined,
        zIndex: isMobile ? 60 : undefined,
      }}>

        {/* Header */}
        <div style={{ 
          padding: collapsed ? '20px 16px' : '20px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          minHeight: 72
        }}>
          {!collapsed && (
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 10, 
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}>
              <Home className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
          )}
          {!collapsed && (
            <div style={{ flex: 1 }}>
              <span style={{ 
                color: 'white', 
                fontSize: 20, 
                fontWeight: 800, 
                letterSpacing: '-0.02em',
                display: 'block'
              }}>
                Shine<span style={{ color: '#FBBF24' }}>UP</span>
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                Admin Dashboard
              </span>
            </div>
          )}
          <button 
            onClick={() => isMobile ? setMobileOpen(false) : setCollapsed(c => !c)}
            style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 8, 
              background: 'rgba(255,255,255,0.06)', 
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            {isMobile 
              ? <XIcon className="w-4 h-4 text-white/60" strokeWidth={2} />
              : collapsed 
                ? <ChevronRight className="w-4 h-4 text-white/60" strokeWidth={2} />
                : <ChevronLeft className="w-4 h-4 text-white/60" strokeWidth={2} />}
          </button>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          
          {/* Main Navigation */}
          {!collapsed && (
            <p style={{ 
              fontSize: 10, 
              fontWeight: 600, 
              letterSpacing: '0.08em', 
              color: 'rgba(255,255,255,0.3)', 
              textTransform: 'uppercase', 
              padding: '0 8px', 
              marginBottom: 12 
            }}>
              Navegación
            </p>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {mainItems.map(item => (
              <NavBtn 
                key={item.key} 
                item={item} 
                active={page === item.key} 
                collapsed={collapsed} 
                badge={badges[item.key]}
                hovered={hoveredItem === item.key}
                onHover={setHoveredItem}
                onClick={() => handleNavigate(item.key)} 
              />
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 8px' }} />

          {/* Config */}
          {!collapsed && (
            <p style={{ 
              fontSize: 10, 
              fontWeight: 600, 
              letterSpacing: '0.08em', 
              color: 'rgba(255,255,255,0.3)', 
              textTransform: 'uppercase', 
              padding: '0 8px', 
              marginBottom: 12 
            }}>
              Configuración
            </p>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {configItems.map(item => (
              <NavBtn 
                key={item.key} 
                item={item} 
                active={page === item.key} 
                collapsed={collapsed} 
                badge={badges[item.key]}
                hovered={hoveredItem === item.key}
                onHover={setHoveredItem}
                onClick={() => handleNavigate(item.key)} 
              />
            ))}
          </div>
        </div>

        {/* Footer - User Profile */}
        <div style={{ 
          padding: '16px 12px', 
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            padding: collapsed ? '8px 4px' : '10px 12px', 
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            justifyContent: collapsed ? 'center' : 'flex-start'
          }}>
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 10, 
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: 13, 
              fontWeight: 700, 
              color: 'white', 
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
            }}>
              {profile.initials || 'AD'}
            </div>
            {!collapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ 
                    fontSize: 13, 
                    fontWeight: 600, 
                    color: 'white', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}>
                    {profile.full_name?.split(' ')[0] || 'Admin'}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                    {profile.role}
                  </p>
                </div>
                <button 
                  onClick={onSignOut} 
                  style={{ 
                    background: 'rgba(255,255,255,0.06)', 
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer', 
                    padding: 8, 
                    borderRadius: 8, 
                    display: 'flex', 
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                >
                  <LogOut className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ 
          height: 64, 
          background: C.white, 
          borderBottom: `1px solid ${C.border}`, 
          display: 'flex', 
          alignItems: 'center', 
          padding: isMobile ? '0 16px' : '0 24px', 
          gap: isMobile ? 10 : 16, 
          flexShrink: 0 
        }}>
          {/* Mobile hamburger */}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(true)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: C.bg, border: `1px solid ${C.border}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Menu className="w-5 h-5" style={{ color: C.ink }} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {PAGE_TITLES[page]}
            </p>
            {!isMobile && (
              <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {PAGE_SUBTITLES[page]}
              </p>
            )}
          </div>
          
          {!isMobile && (
            <div style={{ 
              fontSize: 13, 
              color: C.ink, 
              background: C.bg, 
              padding: '8px 14px', 
              borderRadius: 10,
              fontWeight: 500,
              border: `1px solid ${C.border}`,
              whiteSpace: 'nowrap'
            }}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', 
            padding: isMobile ? '6px 10px' : '8px 14px', 
            borderRadius: 10,
            border: '1px solid #A7F3D0',
            flexShrink: 0
          }}>
            <div style={{ 
              width: 7, 
              height: 7, 
              borderRadius: '50%', 
              background: C.green,
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>En vivo</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px' }}>
          {children}
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}

interface NavBtnProps {
  item: NavItem
  active: boolean
  collapsed: boolean
  badge?: number
  hovered: boolean
  onHover: (key: PageKey | null) => void
  onClick: () => void
}

function NavBtn({ item, active, collapsed, badge, hovered, onHover, onClick }: NavBtnProps) {
  const showGradient = active && item.gradient
  
  return (
    <button 
      onClick={onClick}
      onMouseEnter={() => onHover(item.key)}
      onMouseLeave={() => onHover(null)}
      style={{
        width: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        padding: collapsed ? '12px 8px' : '12px 14px',
        borderRadius: 12, 
        cursor: 'pointer', 
        border: 'none', 
        textAlign: 'left',
        background: showGradient 
          ? item.gradient 
          : active 
            ? C.primary 
            : hovered 
              ? 'rgba(255,255,255,0.06)' 
              : 'transparent',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        justifyContent: collapsed ? 'center' : 'flex-start',
        boxShadow: active ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Icon container */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s'
      }}>
        <item.Icon style={{ 
          width: 18, 
          height: 18, 
          color: active ? 'white' : 'rgba(255,255,255,0.6)', 
        }} />
      </div>
      
      {!collapsed && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ 
            fontSize: 13, 
            fontWeight: 600, 
            color: active ? 'white' : 'rgba(255,255,255,0.8)', 
            display: 'block',
            whiteSpace: 'nowrap' 
          }}>
            {item.label}
          </span>
          {item.sublabel && (
            <span style={{ 
              fontSize: 10, 
              color: active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', 
              display: 'block',
              marginTop: 1
            }}>
              {item.sublabel}
            </span>
          )}
        </div>
      )}
      
      {!collapsed && badge ? (
        <span style={{ 
          background: '#EF4444', 
          color: 'white', 
          fontSize: 10, 
          fontWeight: 700, 
          padding: '2px 8px', 
          borderRadius: 10,
          boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
        }}>
          {badge}
        </span>
      ) : null}
    </button>
  )
}
