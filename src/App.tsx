import { useState, useEffect } from 'react'
import { supabase, Profile } from './supabase'
import LoginPage from './components/LoginPage'
import UsersPage from './components/UsersPage'

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0097A7, #00BCD4)' }}>
      <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  )

  if (!profile) return <LoginPage />

  return <UsersPage profile={profile} onSignOut={signOut} />
}
