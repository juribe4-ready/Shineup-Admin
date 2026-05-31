import { Profile } from '../supabase'
import DashboardPage from './DashboardPage'
import IncidentsPage from './IncidentsPage'
import InventoryPage from './InventoryPage'
import { Radio, AlertTriangle, Package } from 'lucide-react'
import { useState } from 'react'

const C = {
  primary: '#6366F1',
  ink: '#0F172A',
  muted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  green: '#10B981',
  red: '#EF4444',
  amber: '#F59E0B',
}

type Tab = 'live' | 'incidents' | 'inventory'

interface Props {
  profile: Profile
}

export default function OperationsPage({ profile }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('live')

  const tabs: { key: Tab; label: string; Icon: any; color: string }[] = [
    { key: 'live',      label: 'En Campo',  Icon: Radio,         color: C.green },
    { key: 'incidents', label: 'Incidentes', Icon: AlertTriangle, color: C.amber },
    { key: 'inventory', label: 'Rupturas',   Icon: Package,       color: C.red   },
  ]

  return (
    <div>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 24,
        background: C.white,
        padding: 5,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        width: 'fit-content',
        flexWrap: 'wrap',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 18px',
              borderRadius: 11,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === tab.key
                ? `linear-gradient(135deg, ${tab.color} 0%, ${tab.color}dd 100%)`
                : 'transparent',
              color: activeTab === tab.key ? 'white' : C.muted,
              fontWeight: 600,
              fontSize: 13,
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              transition: 'all 0.2s',
              boxShadow: activeTab === tab.key ? `0 4px 12px ${tab.color}40` : 'none',
            }}
          >
            <tab.Icon style={{ width: 15, height: 15 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content — DashboardPage ya tiene sus propios sub-tabs Ejecutivo/En Vivo */}
      {activeTab === 'live'      && <DashboardPage profile={profile} />}
      {activeTab === 'incidents' && <IncidentsPage />}
      {activeTab === 'inventory' && <InventoryPage />}
    </div>
  )
}
