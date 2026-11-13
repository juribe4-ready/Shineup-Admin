import { useState } from 'react'
import { C, Card } from './reports/shared'
import MarginTab from './reports/MarginTab'
import CompareTab from './reports/CompareTab'
import RankTab from './reports/RankTab'
import type { Nav } from './reports/HistoryView'

type Tab = 'margen' | 'comparar' | 'casas' | 'clientes'
const TABS: [Tab, string][] = [['margen', '💰 Margen'], ['casas', '🏠 Casas'], ['clientes', '👥 Clientes'], ['comparar', '⇄ Comparar']]

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('margen')
  const [dbg, setDbg] = useState<any>(null)
  const [showDbg, setShowDbg] = useState(false)
  const [nav, setNav] = useState<Nav | null>(null)
  const goTab = (t: Tab) => { setNav(null); setTab(t) }
  return <div style={{ maxWidth: 1200, margin: '0 auto' }}>
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
      {TABS.map(([k, t]) => <button key={k} onClick={() => goTab(k)} style={{ height: 40, padding: '0 16px', borderRadius: 999, border: `1.5px solid ${tab === k ? C.primary : C.border}`, background: tab === k ? C.primary : C.white, color: tab === k ? '#fff' : C.slate, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{t}</button>)}
      <button onClick={() => setShowDbg(s => !s)} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>{showDbg ? 'Ocultar' : 'Ver'} detalles técnicos</button>
    </div>
    {showDbg && <Card style={{ marginBottom: 12, background: '#0F172A', border: 'none' }}><pre style={{ margin: 0, color: '#A7F3D0', fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{dbg ? JSON.stringify(dbg, null, 2) : 'Aún no hay consultas.'}</pre></Card>}
    {tab === 'margen' && <MarginTab onDebug={setDbg} onGoDay={a => { setNav(a); setTab('casas') }} />}
    {tab === 'comparar' && <CompareTab onDebug={setDbg} />}
    {tab === 'casas' && <RankTab key="p" entity="property" onDebug={setDbg} nav={nav} clearNav={() => { setNav(null); setTab('margen') }} />}
    {tab === 'clientes' && <RankTab key="c" entity="client" onDebug={setDbg} />}
  </div>
}
