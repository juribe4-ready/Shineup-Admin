import { useState, useEffect } from 'react'
import { supabase, Profile } from './supabase'
import LoginPage from './components/LoginPage'
import UsersPage from './components/UsersPage'
import DashboardPage from './components/DashboardPage'
import { LayoutDashboard, Users, LogOut } from 'lucide-react'

const C = {
  primary:     '#6366F1',
  headerBg:    '#1E293B',
  headerMid:   '#334155',
  ink:         '#0F172A',
  muted:       '#94A3B8',
  border:      '#E2E8F0',
  bg:          '#F8FAFC',
}

type Page = 'dashboard' | 'users'

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState<Page>('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data && data.active && (data.role === 'admin' || data.role === 'manager')) {
        setProfile(data as Profile)
      } else {
        await supabase.auth.signOut()
        setProfile(null)
      }
    } catch {}
    finally { setLoading(false) }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.headerBg}, ${C.headerMid})` }}>
      <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  )

  if (!profile) return <LoginPage />

  return (
    <div className="min-h-screen" style={{ background: C.bg, fontFamily: 'Poppins, sans-serif' }}>

      {/* HEADER */}
      <div style={{ background: `linear-gradient(135deg, ${C.headerBg}, ${C.headerMid})` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">
            Shine<span style={{ color: '#FFD700' }}>UP</span>
            <span className="text-[11px] font-semibold text-white/40 ml-2 tracking-widest uppercase hidden sm:inline">Admin</span>
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white font-black text-[12px]" style={{ background: C.primary }}>
                {profile.initials || 'AD'}
              </div>
              <span className="text-white font-semibold text-[13px] hidden sm:block">{profile.full_name?.split(' ')[0] || 'Admin'}</span>
            </div>
            <button onClick={signOut} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-white/60 text-[12px] font-semibold hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Salir</span>
            </button>
          </div>
        </div>

        {/* NAV */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1">
          {[
            { key: 'dashboard' as Page, label: 'Dashboard', Icon: LayoutDashboard },
            { key: 'users' as Page, label: 'Usuarios', Icon: Users },
          ].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setPage(key)}
              className="flex items-center gap-2 px-4 py-3 text-[13px] font-bold transition-colors border-b-2"
              style={{
                color: page === key ? 'white' : 'rgba(255,255,255,0.4)',
                borderColor: page === key ? C.primary : 'transparent'
              }}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {page === 'dashboard' && <DashboardPage profile={profile} />}
        {page === 'users' && <UsersPage profile={profile} onSignOut={signOut} />}
      </div>
    </div>
  )
}
