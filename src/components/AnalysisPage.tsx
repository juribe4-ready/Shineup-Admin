import { useState, useEffect } from 'react'
import { TrendingUp, BarChart3, Users, Clock, DollarSign } from 'lucide-react'
import DashboardExecutive from './DashboardExecutive'
import StatsPage from './StatsPage'
import BillingPage from './BillingPage'

const C = {
  primary: '#6366F1',
  ink: '#0F172A',
  muted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  amber: '#F59E0B',
  green: '#10B981',
}

type Tab = 'cascade' | 'stats' | 'billing' | 'cleaners' | 'trends'

interface Props { initialTab?: Tab }

export default function AnalysisPage({ initialTab = 'cascade' }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  const tabs: { key: Tab; label: string; Icon: any; ready: boolean; color?: string }[] = [
    { key: 'cascade', label: 'Weekly Cascade', Icon: TrendingUp,  ready: true },
    { key: 'stats',   label: 'Stats',          Icon: BarChart3,   ready: true },
    { key: 'billing', label: 'Billing',        Icon: DollarSign,  ready: true, color: C.green },
    { key: 'cleaners',label: 'By Cleaner',     Icon: Users,       ready: false },
    { key: 'trends',  label: 'Trends',         Icon: Clock,       ready: false },
  ]

  return (
    <div>
      {/* Tab Bar */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 24,
        background: C.white,
        padding: 6,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        width: 'fit-content'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => tab.ready && setActiveTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              cursor: tab.ready ? 'pointer' : 'not-allowed',
              background: activeTab === tab.key 
                ? `linear-gradient(135deg, ${tab.color || C.amber} 0%, ${tab.color ? tab.color + 'cc' : '#D97706'} 100%)`
                : 'transparent',
              color: activeTab === tab.key ? 'white' : tab.ready ? C.muted : '#D1D5DB',
              fontWeight: 600,
              fontSize: 13,
              transition: 'all 0.2s',
              boxShadow: activeTab === tab.key ? `0 4px 12px ${C.amber}40` : 'none',
              opacity: tab.ready ? 1 : 0.5
            }}
          >
            <tab.Icon style={{ width: 16, height: 16 }} />
            {tab.label}
            {!tab.ready && <span style={{ fontSize: 9, background: '#E5E7EB', color: '#6B7280', padding: '2px 6px', borderRadius: 4 }}>Próx</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'cascade' && <DashboardExecutive />}
      {activeTab === 'stats' && <StatsPage />}
      {activeTab === 'billing' && <BillingPage />}
      {activeTab === 'cleaners' && (
        <div style={{ 
          background: C.white, 
          borderRadius: 24, 
          padding: 48, 
          textAlign: 'center',
          border: `1px solid ${C.border}`
        }}>
          <Users style={{ width: 48, height: 48, color: C.muted, margin: '0 auto 16px' }} />
          <h3 style={{ color: C.ink, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Productividad por Cleaner
          </h3>
          <p style={{ color: C.muted, fontSize: 14 }}>
            Próximamente: Ranking, velocidad y ratings por cleaner
          </p>
        </div>
      )}
      {activeTab === 'trends' && (
        <div style={{ 
          background: C.white, 
          borderRadius: 24, 
          padding: 48, 
          textAlign: 'center',
          border: `1px solid ${C.border}`
        }}>
          <Clock style={{ width: 48, height: 48, color: C.muted, margin: '0 auto 16px' }} />
          <h3 style={{ color: C.ink, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Tendencias
          </h3>
          <p style={{ color: C.muted, fontSize: 14 }}>
            Próximamente: Gráficos de tendencia mensuales y anuales
          </p>
        </div>
      )}
    </div>
  )
}
