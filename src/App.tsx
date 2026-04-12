import { useEffect, useState } from 'react'
import { supabase, Profile } from './supabase'
import LoginPage from './components/LoginPage'
import Layout, { PageKey } from './components/Layout'
import DashboardPage from './components/DashboardPage'
import PlanningPage from './components/PlanningPage'
import UsersPage from './components/UsersPage'
import BackupPage from './components/BackupPage'
import IncidentsPage from './components/IncidentsPage'
import InventoryPage from './components/InventoryPage'

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState<PageKey>('dashboard')

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Poppins, sans-serif' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!profile) return <LoginPage />

  return (
    <Layout profile={profile} page={page} onNavigate={setPage} onSignOut={handleSignOut}>
      {page === 'dashboard'  && <DashboardPage profile={profile} />}
      {page === 'planning'   && <PlanningPage />}
      {page === 'users'      && <UsersPage profile={profile} onSignOut={handleSignOut} />}
      {page === 'backup'     && <BackupPage />}
      {page === 'incidents'  && <IncidentsPage />}
      {page === 'inventory'  && <InventoryPage />}
    </Layout>
  )
}
