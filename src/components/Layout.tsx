import { useState, useEffect } from 'react'
import { Profile } from '../supabase'
import {
  CalendarDays, Users, LogOut, ChevronLeft, 
  TrendingUp, Settings, Home, ChevronRight, Radio, LayoutDashboard, Menu, X as XIcon, Upload,
  ChevronDown, HardHat, ListChecks, Layers, CalendarClock, AlertTriangle, Package, DollarSign
} from 'lucide-react'

function AstronautIcon({ style }: { style?: any }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="12" cy="10" r="3.8" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 14.5C5.5 16 5 18 5.5 20.5M17 14.5C18.5 16 19 18 18.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M9 20.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

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
  | 'cco_monitoring'    // CCO — live monitoring
  | 'cco_incidents'     // CCO — incidents
  | 'cco_ruptures'      // CCO — inventory ruptures
  | 'plan_week'         // Plan → Week
  | 'plan_predispatch'  // Plan → Pre-dispatch
  | 'plan_field'        // Plan → Field
  | 'tars_rules'        // TARS OS → Rules
  | 'tars_squads'       // TARS OS → Squads
  | 'tars_blocks'       // TARS OS → Squad Blocks
  | 'earn_cascade'      // Earn → Weekly cascade
  | 'earn_stats'        // Earn → Stats
  | 'earn_billing'      // Earn → Billing
  | 'command'           // Grow → Command Center
  | 'users'             // System → Users
  | 'import'            // System → Import

interface NavItem {
  key: PageKey
  label: string
  sublabel?: string
  Icon: any
  section: 'operate' | 'plan' | 'tars' | 'earn' | 'grow' | 'system'
  badge?: number
  gradient?: string
}

const NAV_ITEMS: NavItem[] = [
  // OPERATE — live, right now, three real pages
  { 
    key: 'cco_monitoring', 
    label: 'Monitoring',
    sublabel: 'Live cleanings map',
    Icon: Radio,        
    section: 'operate',
  },
  { 
    key: 'cco_incidents', 
    label: 'Incidents',
    sublabel: 'Reported issues',
    Icon: AlertTriangle,        
    section: 'operate',
  },
  { 
    key: 'cco_ruptures', 
    label: 'Ruptures',
    sublabel: 'Inventory breaks',
    Icon: Package,        
    section: 'operate',
  },
  // PLAN — three horizons, each its own page
  { 
    key: 'plan_week',   
    label: 'Week', 
    sublabel: 'Launch & assign squads',
    Icon: CalendarDays,    
    section: 'plan',
  },
  { 
    key: 'plan_predispatch',   
    label: 'Pre-dispatch', 
    sublabel: 'Staff, kits & warnings',
    Icon: ListChecks,    
    section: 'plan',
  },
  { 
    key: 'plan_field',   
    label: 'Field', 
    sublabel: 'Clock in/out, day-of',
    Icon: HardHat,    
    section: 'plan',
  },
  // TARS OS — capacity, revenue & routing intelligence
  { 
    key: 'tars_rules',   
    label: 'Rules', 
    sublabel: 'Prime time, ESD, STR days',
    Icon: Settings,    
    section: 'tars',
  },
  { 
    key: 'tars_squads',   
    label: 'Squads', 
    sublabel: 'Team roster & hours',
    Icon: Layers,    
    section: 'tars',
  },
  { 
    key: 'tars_blocks',   
    label: 'Squad Blocks', 
    sublabel: 'Structural calendar',
    Icon: CalendarClock,    
    section: 'tars',
  },
  // EARN — what happened, what it's worth, three real pages
  { 
    key: 'earn_cascade',     
    label: 'Weekly Cascade',  
    sublabel: 'Plan vs real',
    Icon: TrendingUp,       
    section: 'earn',
  },
  { 
    key: 'earn_stats',     
    label: 'Stats',  
    sublabel: 'Productivity',
    Icon: LayoutDashboard,       
    section: 'earn',
  },
  { 
    key: 'earn_billing',     
    label: 'Billing',  
    sublabel: 'Payment status',
    Icon: DollarSign,       
    section: 'earn',
  },
  // GROW — North Star
  { 
    key: 'command',
    label: 'Command Center',
    sublabel: 'North Star',
    Icon: LayoutDashboard,
    section: 'grow',
  },
  // SYSTEM — set once, not checked daily
  { key: 'users',      label: 'Users',    Icon: Users,    section: 'system' },
  { key: 'import',     label: 'Import',   Icon: Upload,   section: 'system' },
]

const PAGE_TITLES: Record<PageKey, string> = {
  cco_monitoring:    'Monitoring',
  cco_incidents:     'Incidents',
  cco_ruptures:      'Ruptures',
  plan_week:         'Week',
  plan_predispatch:  'Pre-dispatch',
  plan_field:        'Field',
  tars_rules:        'TARS OS — Rules',
  tars_squads:       'TARS OS — Squads',
  tars_blocks:       'TARS OS — Squad Blocks',
  earn_cascade:      'Weekly Cascade',
  earn_stats:        'Stats',
  earn_billing:      'Billing',
  command:           'Command Center',
  users:             'Users',
  import:            'Import',
}

const PAGE_SUBTITLES: Record<PageKey, string> = {
  cco_monitoring:    'Live cleanings map & status',
  cco_incidents:     'Reported issues today',
  cco_ruptures:      'Inventory breaks today',
  plan_week:         'Launch the week & assign squads',
  plan_predispatch:  'Staff, equipment & warnings — night before',
  plan_field:        'Clock in/out & day-of execution',
  tars_rules:        'Prime time, STR-only days, ESD calibration',
  tars_squads:       'Team roster, hours & capacity',
  tars_blocks:       'Structural capacity calendar',
  earn_cascade:      'Plan vs real, weekly cost cascade',
  earn_stats:        'Productivity & performance stats',
  earn_billing:      'Payment status & Turno import',
  command:           'North Star & executive KPIs',
  users:             'User management',
  import:            'Turno · Guesty · Hospitable',
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    operate: false, plan: true, tars: true, earn: false, grow: false, system: false,
  })

  const toggleSection = (key: string) => setOpenSections(prev => {
    const isOpen = prev[key]
    const next: Record<string, boolean> = { operate: false, plan: false, tars: false, earn: false, grow: false, system: false }
    next[key] = !isOpen
    return next
  })

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

  const operateItems = NAV_ITEMS.filter(i => i.section === 'operate')
  const planItems     = NAV_ITEMS.filter(i => i.section === 'plan')
  const tarsItems     = NAV_ITEMS.filter(i => i.section === 'tars')
  const earnItems     = NAV_ITEMS.filter(i => i.section === 'earn')
  const growItems     = NAV_ITEMS.filter(i => i.section === 'grow')
  const systemItems   = NAV_ITEMS.filter(i => i.section === 'system')

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
          padding: collapsed ? '16px 16px' : '16px 18px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          minHeight: 60
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
        <div style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          
          {/* Section renderer — collapsible, Booking Koala style */}
          {[
            { key: 'operate', label: 'Operate', items: operateItems, sectionIcon: null as any },
            { key: 'plan',    label: 'Plan',    items: planItems,    sectionIcon: null as any },
            { key: 'tars',    label: 'TARS OS', items: tarsItems,    sectionIcon: AstronautIcon },
            { key: 'earn',    label: 'Earn',    items: earnItems,    sectionIcon: null as any },
            { key: 'grow',    label: 'Grow',    items: growItems,    sectionIcon: null as any },
            { key: 'system',  label: 'System',  items: systemItems,  sectionIcon: null as any },
          ].map((group, gi) => group.items.length > 0 && (
            <div key={group.key}>
              {gi > 0 && (
                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '10px 10px' }} />
              )}
              {!collapsed ? (
                <button
                  onClick={() => toggleSection(group.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', marginBottom: 4, borderRadius: 8,
                    background: openSections[group.key] ? 'rgba(255,255,255,0.05)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {group.sectionIcon && (
                    <group.sectionIcon style={{ width: 15, height: 15, color: '#A5ADFB', flexShrink: 0 }} />
                  )}
                  <span style={{
                    fontSize: 13, fontWeight: 700, letterSpacing: '0.01em',
                    color: group.sectionIcon ? '#C7CCFC' : 'rgba(255,255,255,0.82)',
                    flex: 1, textAlign: 'left',
                  }}>
                    {group.label}
                  </span>
                  <ChevronDown style={{
                    width: 14, height: 14, color: 'rgba(255,255,255,0.4)',
                    transform: openSections[group.key] ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }} />
                </button>
              ) : (
                group.sectionIcon && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', marginBottom: 4 }}>
                    <group.sectionIcon style={{ width: 15, height: 15, color: '#A5ADFB' }} />
                  </div>
                )
              )}
              {(collapsed || openSections[group.key]) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 6, paddingLeft: collapsed ? 0 : 4 }}>
                  {group.items.map(item => (
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
              )}
            </div>
          ))}
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
  return (
    <button 
      onClick={onClick}
      onMouseEnter={() => onHover(item.key)}
      onMouseLeave={() => onHover(null)}
      style={{
        width: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 11, 
        padding: collapsed ? '10px 8px' : '9px 12px',
        paddingLeft: collapsed ? 8 : 9,
        borderRadius: 8, 
        cursor: 'pointer', 
        border: 'none', 
        textAlign: 'left',
        background: active 
          ? 'rgba(99, 102, 241, 0.14)' 
          : hovered 
            ? 'rgba(255,255,255,0.04)' 
            : 'transparent',
        borderLeft: active ? `2.5px solid ${C.primary}` : '2.5px solid transparent',
        transition: 'background 0.15s ease',
        justifyContent: collapsed ? 'center' : 'flex-start',
        position: 'relative',
      }}
    >
      <item.Icon style={{ 
        width: 16.5, 
        height: 16.5, 
        color: active ? '#A5ADFB' : 'rgba(255,255,255,0.45)', 
        flexShrink: 0,
      }} />
      
      {!collapsed && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ 
            fontSize: 12.5, 
            fontWeight: active ? 600 : 500, 
            color: active ? 'white' : 'rgba(255,255,255,0.75)', 
            display: 'block',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}>
            {item.label}
          </span>
          {item.sublabel && (
            <span style={{ 
              fontSize: 10, 
              color: 'rgba(255,255,255,0.35)', 
              display: 'block',
              marginTop: 0.5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
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
          padding: '1px 7px', 
          borderRadius: 9,
          flexShrink: 0,
        }}>
          {badge}
        </span>
      ) : null}
    </button>
  )
}
