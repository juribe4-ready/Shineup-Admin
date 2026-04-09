import { useState, useEffect } from 'react'
import { supabase, Profile } from '../supabase'
import { Users, Mail, ToggleLeft, ToggleRight, Plus, Search, X, Check, Trash2 } from 'lucide-react'

const C = {
  primary:      '#6366F1',
  primaryDark:  '#4F46E5',
  primaryLight: '#EEF2FF',
  headerBg:     '#1E293B',
  headerMid:    '#334155',
  ink:          '#0F172A',
  slate:        '#475569',
  muted:        '#94A3B8',
  border:       '#E2E8F0',
  bg:           '#F8FAFC',
  white:        '#FFFFFF',
  green:        '#10B981',
  red:          '#EF4444',
  amber:        '#F59E0B',
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:   { bg: '#EDE9FE', color: '#7C3AED' },
  manager: { bg: '#DBEAFE', color: '#2563EB' },
  cleaner: { bg: '#ECFDF5', color: '#059669' },
  client:  { bg: '#FEF3C7', color: '#D97706' },
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', cleaner: 'Cleaner', client: 'Cliente'
}

interface StaffRecord {
  id: string; name: string; email: string; initials: string; role: string
}

interface Props {
  profile: Profile
  onSignOut: () => void
}

export default function UsersPage({ profile: _profile, onSignOut: _onSignOut }: Props) {
  const [users, setUsers]             = useState<Profile[]>([])
  const [staffList, setStaffList]     = useState<StaffRecord[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [showInvite, setShowInvite]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<'cleaner' | 'manager' | 'admin'>('cleaner')
  const [inviting, setInviting]       = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [toast, setToast]             = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null)

  useEffect(() => { loadUsers(); loadStaff() }, [])

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data as Profile[])
    } catch { showToast('Error al cargar usuarios', 'err') }
    finally { setLoading(false) }
  }

  const loadStaff = async () => {
    try {
      const res = await fetch('/api/getStaff')
      if (!res.ok) return
      const data = await res.json()
      setStaffList(data.filter((s: StaffRecord) => s.name))
    } catch {}
  }

  const toggleActive = async (user: Profile) => {
    try {
      const { error } = await supabase.from('profiles').update({ active: !user.active }).eq('id', user.id)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: !u.active } : u))
      showToast(user.active ? 'Usuario desactivado' : 'Usuario activado')
    } catch { showToast('Error al actualizar', 'err') }
  }

  const updateRole = async (user: Profile, newRole: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole as Profile['role'] } : u))
      showToast('Rol actualizado')
    } catch { showToast('Error al actualizar rol', 'err') }
  }

  const updateStaffId = async (user: Profile, staffId: string) => {
    const staff = staffList.find(s => s.id === staffId)
    try {
      const { error } = await supabase.from('profiles').update({
        staff_airtable_id: staffId,
        initials: staff?.initials || user.initials,
        full_name: staff?.name || user.full_name,
      }).eq('id', user.id)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, staff_airtable_id: staffId, initials: staff?.initials || u.initials, full_name: staff?.name || u.full_name } : u))
      setEditingUser(null)
      showToast('Staff vinculado correctamente')
    } catch { showToast('Error al vincular staff', 'err') }
  }

  const deleteUser = async (user: Profile) => {
    try {
      const res = await fetch('/api/deleteUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      if (!res.ok) throw new Error('Error al eliminar')
      setUsers(prev => prev.filter(u => u.id !== user.id))
      setConfirmDelete(null)
      showToast('Usuario eliminado')
    } catch { showToast('Error al eliminar usuario', 'err') }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await fetch('/api/inviteUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al invitar')
      setInviteSuccess(true)
      showToast(`Invitación enviada a ${inviteEmail}`)
      setTimeout(() => { setShowInvite(false); setInviteSuccess(false); setInviteEmail('') }, 2000)
      loadUsers()
    } catch (err: any) {
      showToast(err.message || 'Error al enviar invitación', 'err')
    }
    setInviting(false)
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen" style={{ background: C.bg, fontFamily: 'Poppins, sans-serif' }}>

      {/* TOAST */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-xl text-white text-[13px] font-bold whitespace-nowrap"
          style={{ background: toast.type === 'ok' ? C.green : C.red }}>
          {toast.msg}
        </div>
      )}


      {/* CONTENT */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-black text-[20px] sm:text-[22px]" style={{ color: C.ink }}>Gestión de Usuarios</h2>
            <p className="text-[13px] font-medium mt-0.5" style={{ color: C.muted }}>{users.length} usuarios registrados</p>
          </div>
          <button onClick={() => setShowInvite(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-white font-bold text-[13px] shadow-md active:scale-95 transition-all w-full sm:w-auto"
            style={{ background: C.primary }}>
            <Plus className="w-4 h-4" /> Invitar usuario
          </button>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl text-[13px] font-medium outline-none"
            style={{ fontFamily: 'Poppins, sans-serif', border: `1.5px solid ${C.border}`, background: C.white, color: C.ink }} />
        </div>

        {/* DESKTOP TABLE */}
        <div className="rounded-3xl overflow-hidden shadow-sm hidden sm:block" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="grid grid-cols-12 px-6 py-3 text-[10px] font-black uppercase tracking-widest" style={{ background: C.bg, color: C.muted, borderBottom: `1px solid ${C.border}` }}>
            <div className="col-span-4">Usuario</div>
            <div className="col-span-2">Rol</div>
            <div className="col-span-3">Staff Airtable</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-1 text-right">Acciones</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3" style={{ color: C.muted }}>
              <Users className="w-10 h-10 opacity-30" />
              <p className="text-[13px] font-medium">Sin usuarios</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: C.border }}>
              {filtered.map(user => {
                const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.cleaner
                const linkedStaff = staffList.find(s => s.id === user.staff_airtable_id)
                return (
                  <div key={user.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl flex items-center justify-center font-black text-[13px] shrink-0"
                        style={{ background: roleStyle.bg, color: roleStyle.color }}>
                        {user.initials || user.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[13px] truncate" style={{ color: C.ink }}>{user.full_name || 'Sin nombre'}</p>
                        <p className="text-[11px] font-medium truncate" style={{ color: C.muted }}>{user.email}</p>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <select value={user.role} onChange={e => updateRole(user, e.target.value)}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl outline-none cursor-pointer"
                        style={{ background: roleStyle.bg, color: roleStyle.color, border: 'none', fontFamily: 'Poppins, sans-serif' }}>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="cleaner">Cleaner</option>
                        <option value="client">Cliente</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      {editingUser?.id === user.id ? (
                        <div className="flex items-center gap-2">
                          <select onChange={e => updateStaffId(user, e.target.value)} defaultValue=""
                            className="text-[11px] font-medium px-2 py-1.5 rounded-xl outline-none flex-1"
                            style={{ border: `1.5px solid ${C.primary}`, fontFamily: 'Poppins, sans-serif', color: C.ink }}>
                            <option value="" disabled>Seleccionar...</option>
                            {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.initials})</option>)}
                          </select>
                          <button onClick={() => setEditingUser(null)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
                            <X className="w-3 h-3" style={{ color: C.red }} />
                          </button>
                        </div>
                      ) : linkedStaff ? (
                        <button onClick={() => setEditingUser(user)} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px]"
                            style={{ background: C.primaryLight, color: C.primary }}>{linkedStaff.initials}</div>
                          <span className="text-[12px] font-semibold" style={{ color: C.ink }}>{linkedStaff.name}</span>
                        </button>
                      ) : (
                        <button onClick={() => setEditingUser(user)}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-xl"
                          style={{ background: '#FEF3C7', color: C.amber }}>
                          + Vincular Staff
                        </button>
                      )}
                    </div>
                    <div className="col-span-2">
                      <button onClick={() => toggleActive(user)} className="flex items-center gap-2 active:scale-95 transition-all">
                        {user.active
                          ? <><ToggleRight className="w-6 h-6" style={{ color: C.green }} /><span className="text-[11px] font-bold" style={{ color: C.green }}>Activo</span></>
                          : <><ToggleLeft className="w-6 h-6" style={{ color: C.muted }} /><span className="text-[11px] font-bold" style={{ color: C.muted }}>Inactivo</span></>}
                      </button>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <button onClick={() => setConfirmDelete(user)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors"
                        style={{ color: C.muted }}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* MOBILE CARDS */}
        <div className="space-y-3 sm:hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: C.border, borderTopColor: C.primary }} />
            </div>
          ) : filtered.map(user => {
            const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.cleaner
            const linkedStaff = staffList.find(s => s.id === user.staff_airtable_id)
            return (
              <div key={user.id} className="rounded-3xl p-4 shadow-sm" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-[14px] shrink-0"
                      style={{ background: roleStyle.bg, color: roleStyle.color }}>
                      {user.initials || user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-[14px]" style={{ color: C.ink }}>{user.full_name || 'Sin nombre'}</p>
                      <p className="text-[11px] font-medium" style={{ color: C.muted }}>{user.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setConfirmDelete(user)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: C.muted }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <select value={user.role} onChange={e => updateRole(user, e.target.value)}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl outline-none cursor-pointer"
                    style={{ background: roleStyle.bg, color: roleStyle.color, border: 'none', fontFamily: 'Poppins, sans-serif' }}>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="cleaner">Cleaner</option>
                    <option value="client">Cliente</option>
                  </select>
                  {linkedStaff ? (
                    <button onClick={() => setEditingUser(user)} className="flex items-center gap-1.5"
                      style={{ background: C.primaryLight, color: C.primary, padding: '4px 10px', borderRadius: '10px' }}>
                      <span className="text-[11px] font-bold">{linkedStaff.name}</span>
                    </button>
                  ) : (
                    <button onClick={() => setEditingUser(user)} className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl"
                      style={{ background: '#FEF3C7', color: C.amber }}>+ Vincular
                    </button>
                  )}
                  <button onClick={() => toggleActive(user)} className="flex items-center gap-1.5 ml-auto">
                    {user.active
                      ? <><ToggleRight className="w-5 h-5" style={{ color: C.green }} /><span className="text-[11px] font-bold" style={{ color: C.green }}>Activo</span></>
                      : <><ToggleLeft className="w-5 h-5" style={{ color: C.muted }} /><span className="text-[11px] font-bold" style={{ color: C.muted }}>Inactivo</span></>}
                  </button>
                </div>
                {editingUser?.id === user.id && (
                  <div className="mt-3 flex gap-2">
                    <select onChange={e => updateStaffId(user, e.target.value)} defaultValue=""
                      className="text-[12px] font-medium px-3 py-2 rounded-xl outline-none flex-1"
                      style={{ border: `1.5px solid ${C.primary}`, fontFamily: 'Poppins, sans-serif', color: C.ink }}>
                      <option value="" disabled>Seleccionar staff...</option>
                      {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.initials})</option>)}
                    </select>
                    <button onClick={() => setEditingUser(null)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FEE2E2' }}>
                      <X className="w-4 h-4" style={{ color: C.red }} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* INVITE MODAL */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.7)' }} onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" style={{ background: C.white }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${C.headerBg}, ${C.headerMid})` }}>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-white" />
                <p className="font-black text-[17px] text-white">Invitar Usuario</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            {inviteSuccess ? (
              <div className="px-6 py-10 flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#DCFCE7' }}>
                  <Check className="w-8 h-8" style={{ color: C.green }} />
                </div>
                <p className="font-black text-[17px]" style={{ color: C.ink }}>¡Invitación enviada!</p>
                <p className="text-[13px] text-center" style={{ color: C.muted }}>Le llegará un email a {inviteEmail}</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="px-6 py-6 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Email del usuario</p>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="correo@ejemplo.com" required
                    className="w-full px-4 py-3 rounded-2xl text-[13px] font-medium outline-none"
                    style={{ fontFamily: 'Poppins, sans-serif', border: `1.5px solid ${C.border}`, color: C.ink, background: C.bg }} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: C.muted }}>Rol</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cleaner', 'manager', 'admin'] as const).map(r => (
                      <button key={r} type="button" onClick={() => setInviteRole(r)}
                        className="py-2.5 rounded-2xl text-[12px] font-bold transition-all"
                        style={{
                          border: `1.5px solid ${inviteRole === r ? C.primary : C.border}`,
                          background: inviteRole === r ? C.primaryLight : C.bg,
                          color: inviteRole === r ? C.primary : C.muted
                        }}>
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={inviting}
                  className="w-full py-3.5 rounded-2xl text-white font-black text-[14px] flex items-center justify-center gap-2 active:scale-95 transition-all"
                  style={{ background: C.primary, opacity: inviting ? 0.7 : 1 }}>
                  {inviting ? 'Enviando...' : <><Mail className="w-4 h-4" /> Enviar Invitación</>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.7)' }} onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: C.white }} onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto" style={{ background: '#FEE2E2' }}>
                <Trash2 className="w-7 h-7" style={{ color: C.red }} />
              </div>
              <p className="font-black text-[18px] text-center mb-2" style={{ color: C.ink }}>¿Eliminar usuario?</p>
              <p className="text-[13px] text-center mb-6" style={{ color: C.muted }}>
                Se eliminará <strong>{confirmDelete.full_name || confirmDelete.email}</strong> permanentemente.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 rounded-2xl font-bold text-[13px]"
                  style={{ background: C.bg, color: C.slate }}>
                  Cancelar
                </button>
                <button onClick={() => deleteUser(confirmDelete)}
                  className="flex-1 py-3 rounded-2xl font-bold text-[13px] text-white"
                  style={{ background: C.red }}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
