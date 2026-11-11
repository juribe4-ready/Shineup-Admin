import { useState, useEffect } from 'react'
import { BarChart3, Users, Home } from 'lucide-react'
import StatsPage from './StatsPage'
import BillingPage from './BillingPage'
import ProfitReport from './ProfitReport'

const C = { ink: '#0F172A', muted: '#94A3B8', border: '#E2E8F0', white: '#FFFFFF', amber: '#F59E0B' }

type Tab = 'stats' | 'client' | 'property' | 'billing'
interface Props { initialTab?: Tab }

export default function AnalysisPage({ initialTab = 'stats' }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  // Billing vive solo, sin barra de pestañas
  if (initialTab === 'billing') return <BillingPage />

  const tabs: { key: Tab; label: string; Icon: any }[] = [
    { key: 'stats', label: 'Stats', Icon: BarChart3 },
    { key: 'client', label: 'Por cliente', Icon: Users },
    { key: 'property', label: 'Por casa', Icon: Home },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: C.white, padding: 6, borderRadius: 16, border: `1px solid ${C.border}`, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: activeTab === tab.key ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'transparent',
              color: activeTab === tab.key ? 'white' : C.muted, fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
              boxShadow: activeTab === tab.key ? `0 4px 12px ${C.amber}40` : 'none',
            }}>
            <tab.Icon style={{ width: 16, height: 16 }} />{tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'stats' && <StatsPage />}
      {activeTab === 'client' && <ProfitReport by="client" />}
      {activeTab === 'property' && <ProfitReport by="property" />}
    </div>
  )
}
