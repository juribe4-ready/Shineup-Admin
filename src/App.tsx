import { useEffect, useState } from 'react'
import { supabase, Profile } from './supabase'
import LoginPage from './components/LoginPage'
import Layout, { PageKey } from './components/Layout'
import PlanningPage from './components/PlanningPage'
import UsersPage from './components/UsersPage'
import OperationsPage from './components/OperationsPage'
import AnalysisPage from './components/AnalysisPage'
import CommandCenterPage from './components/CommandCenterPage'
import ImportPage from './components/ImportPage'
import SettingsPage from './components/SettingsPage'
import RulesPage from './components/RulesPage'
import SquadBlocksPage from './components/SquadBlocksPage'
import HomePage from './components/HomePage'
import SquadsPage from './components/SquadsPage'

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<PageKey>('home')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadProfile(data.session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data || null)
    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!profile) return <LoginPage />

  if (!profile.active) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Inter', sans-serif", background: '#F8FAFC', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 32, maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ fontSize: 28 }}>🚫</span>
          </div>
          <h2 style={{ color: '#0F172A', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Cuenta Desactivada</h2>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>Tu acceso ha sido desactivado. Contacta al administrador si crees que es un error.</p>
          <button onClick={handleSignOut} style={{ background: '#6366F1', color: 'white', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Cerrar Sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <Layout profile={profile} page={page} onNavigate={setPage} onSignOut={handleSignOut}>
      {page === 'home'              && <HomePage profile={profile} onNavigate={setPage} />}
      {page === 'cco_monitoring'   && <OperationsPage profile={profile} initialTab="live" />}
      {page === 'cco_incidents'    && <OperationsPage profile={profile} initialTab="incidents" />}
      {page === 'cco_ruptures'     && <OperationsPage profile={profile} initialTab="inventory" />}
      {page === 'plan_week'        && <PlanningPage />}
      {page === 'plan_predispatch' && <ComingSoon title="Pre-dispatch" />}
      {page === 'plan_field'       && <ComingSoon title="Field" />}
      {page === 'tars_rules'       && <RulesPage />}
      {page === 'system_settings' && <SettingsPage />}
      {page === 'tars_squads'      && <SquadsPage />}
      {page === 'tars_blocks'      && <SquadBlocksPage />}
      {page === 'earn_cascade'     && <AnalysisPage initialTab="cascade" />}
      {page === 'earn_stats'       && <AnalysisPage initialTab="stats" />}
      {page === 'earn_billing'     && <AnalysisPage initialTab="billing" />}
      {page === 'command'          && <CommandCenterPage />}
      {page === 'users'            && <UsersPage profile={profile} onSignOut={handleSignOut} />}
      {page === 'import'           && <ImportPage />}
    </Layout>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', color: '#94A3B8', fontFamily: "'Inter', sans-serif" }}>
      <p style={{ fontSize: 14, fontWeight: 600 }}>{title} — coming soon</p>
      <p style={{ fontSize: 12, marginTop: 4 }}>This page is part of the planned roadmap</p>
    </div>
  )
}
