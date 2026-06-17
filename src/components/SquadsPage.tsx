import { useState, useEffect } from 'react'
import { Plus, X, Save, Trash2, RefreshCw, Layers } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', greenLight: '#ECFDF5',
  red: '#EF4444', redLight: '#FEF2F2',
}

const SWATCHES = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6', '#F97316']

interface Squad {
  id: string
  name: string
  color: string
  type: string
  active: boolean
  startHour: number
  endHour: number
}

const emptyForm = { name: '', color: SWATCHES[0], type: 'Weekday', startHour: 8, endHour: 18 }

export default function SquadsPage() {
  const [squads, setSquads] = useState<Squad[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500) }

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/getSquads')
      const d = await r.json()
      setSquads(d.squads || [])
    } catch { showToast('Error loading squads', 'err') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true) }
  const openEdit = (s: Squad) => { setForm({ name: s.name, color: s.color, type: s.type, startHour: s.startHour, endHour: s.endHour }); setEditingId(s.id); setShowForm(true) }

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Name required', 'err'); return }
    if (form.endHour <= form.startHour) { showToast('End hour must be after start hour', 'err'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/getSquads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId: editingId, ...form })
      })
      const d = await r.json()
      if (!r.ok) { showToast(d.error || 'Error saving', 'err'); return }
      showToast(editingId ? 'Squad updated' : 'Squad created')
      setShowForm(false)
      load()
    } catch { showToast('Error saving', 'err') }
    finally { setSaving(false) }
  }

  const handleDeactivate = async (id: string) => {
    setSaving(true)
    try {
      await fetch('/api/getSquads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', squadId: id })
      })
      showToast('Squad deactivated')
      setConfirmDelete(null)
      setShowForm(false)
      load()
    } catch { showToast('Error deactivating', 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 820, fontFamily: "'Inter', sans-serif" }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: toast.type === 'ok' ? C.ink : C.red, color: 'white', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layers style={{ width: 20, height: 20, color: C.primary }} />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>Squads</p>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Team roster, hours & capacity — the inventory Plan consumes</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ marginLeft: 'auto', width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw style={{ width: 14, height: 14, color: C.muted }} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.primary} 0%, #4F46E5 100%)`, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus style={{ width: 15, height: 15 }} /> New squad
        </button>
      </div>

      {/* Empty state */}
      {!loading && squads.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: C.bg, borderRadius: 16, border: `1px dashed ${C.border}` }}>
          <Layers style={{ width: 32, height: 32, color: C.muted, margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 4px' }}>No squads yet</p>
          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>Create your first squad to start assigning cleanings in Plan → Week.</p>
          <button onClick={openCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: C.primary, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus style={{ width: 15, height: 15 }} /> Create squad
          </button>
        </div>
      )}

      {/* Squad list grouped by type */}
      {squads.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { label: 'Weekday', items: squads.filter(s => s.type === 'Weekday') },
            { label: 'Weekend', items: squads.filter(s => s.type === 'Weekend') },
            { label: 'Flexible', items: squads.filter(s => s.type === 'Flexible') },
          ].map(group => group.items.length > 0 && (
            <div key={group.label}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                {group.label} <span style={{ color: C.muted, fontWeight: 500 }}>({group.items.length})</span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {group.items.map(s => (
                  <div key={s.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0, flex: 1 }}>{s.name}</p>
                    </div>
                    <p style={{ fontSize: 12, color: C.muted, margin: '0 0 12px' }}>
                      {String(s.startHour).padStart(2, '0')}:00 – {String(s.endHour).padStart(2, '0')}:00 · {s.endHour - s.startHour}h/day
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(s)}
                        style={{ flex: 1, height: 30, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, color: C.slate, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Edit
                      </button>
                      {confirmDelete === s.id ? (
                        <button onClick={() => handleDeactivate(s.id)} disabled={saving}
                          style={{ height: 30, padding: '0 10px', borderRadius: 8, border: `1.5px solid ${C.red}`, background: C.redLight, color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          Confirm
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDelete(s.id)}
                          style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }}>
          <div style={{ background: C.white, borderRadius: 18, padding: 24, width: 380, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>{editingId ? 'Edit squad' : 'New squad'}</p>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X style={{ width: 18, height: 18, color: C.muted }} />
              </button>
            </div>

            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</p>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Elite"
              style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }} />

            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {SWATCHES.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? `2.5px solid ${C.ink}` : '2.5px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>

            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {['Weekday', 'Weekend', 'Flexible'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  style={{ flex: 1, height: 36, borderRadius: 9, border: `1.5px solid ${form.type === t ? C.primary : C.border}`, background: form.type === t ? C.primaryLight : C.white, color: form.type === t ? C.primary : C.muted, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start hour</p>
                <input type="number" min={0} max={23} value={form.startHour} onChange={e => setForm(f => ({ ...f, startHour: +e.target.value }))}
                  style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>End hour</p>
                <input type="number" min={1} max={24} value={form.endHour} onChange={e => setForm(f => ({ ...f, endHour: +e.target.value }))}
                  style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.primary} 0%, #4F46E5 100%)`, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" /> : <Save style={{ width: 14, height: 14 }} />}
              {editingId ? 'Save changes' : 'Create squad'}
            </button>

            {editingId && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                {confirmDelete === editingId ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <p style={{ flex: 1, fontSize: 11.5, color: C.red, margin: 0, alignSelf: 'center' }}>¿Desactivar este squad?</p>
                    <button onClick={() => setConfirmDelete(null)}
                      style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, color: C.slate, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button onClick={() => handleDeactivate(editingId)} disabled={saving}
                      style={{ height: 32, padding: '0 14px', borderRadius: 8, border: `1.5px solid ${C.red}`, background: C.redLight, color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Confirmar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(editingId)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 9, border: `1.5px solid ${C.red}30`, background: C.redLight, color: C.red, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                    <Trash2 style={{ width: 13, height: 13 }} />
                    Desactivar squad
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} .animate-spin{animation:spin 1s linear infinite}`}</style>
    </div>
  )
}
