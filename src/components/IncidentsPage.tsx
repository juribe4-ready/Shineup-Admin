import { useEffect, useState, useMemo } from 'react'
import { AlertCircle, X, RefreshCw, Filter, Check, Loader2 } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  green: '#10B981', red: '#EF4444', amber: '#F59E0B', blue: '#3B82F6',
}
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  'Reported':    { bg: '#FEF3C7', color: '#D97706' },
  'In Progress': { bg: '#DBEAFE', color: '#2563EB' },
  'Closed':      { bg: '#DCFCE7', color: '#059669' },
}
const STATUS_OPTIONS = ['Reported', 'In Progress', 'Closed']

interface Incident {
  id: string; name: string; status: string; creationDate: string | null
  comment: string; propertyName: string; propertyId: string
  photoUrls: string[]; reportedBy: string; closeComment?: string
}
const fmtDT = (v?: string | null) => {
  if (!v) return null
  try {
    const d = new Date(v)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  } catch { return null }
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Incident | null>(null)
  const [statusFilter, setStatusFilter] = useState('Reported')
  const [propFilter, setPropFilter]     = useState('all')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [showFilters, setShowFilters]   = useState(false)
  
  // For status change
  const [editStatus, setEditStatus] = useState<string>('')
  const [closeComment, setCloseComment] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/getReports?type=incidents')
      if (r.ok) setIncidents(await r.json())
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // When selecting an incident, initialize edit state
  useEffect(() => {
    if (selected) {
      setEditStatus(selected.status)
      setCloseComment(selected.closeComment || '')
    }
  }, [selected])

  const handleSaveStatus = async () => {
    if (!selected || editStatus === selected.status) return
    
    setSaving(true)
    try {
      const res = await fetch('/api/updateReport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'incident',
          recordId: selected.id,
          status: editStatus,
          closeComment: editStatus === 'Closed' ? closeComment : undefined,
        }),
      })
      
      if (res.ok) {
        // Update local state
        setIncidents(prev => prev.map(i => 
          i.id === selected.id 
            ? { ...i, status: editStatus, closeComment: editStatus === 'Closed' ? closeComment : i.closeComment }
            : i
        ))
        setSelected(prev => prev ? { ...prev, status: editStatus, closeComment: editStatus === 'Closed' ? closeComment : prev.closeComment } : null)
      } else {
        alert('Error al guardar')
      }
    } catch (err) {
      alert('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const properties = useMemo(() => {
    const names = [...new Set(incidents.map(i => i.propertyName))].sort()
    return names
  }, [incidents])

  const filtered = useMemo(() => incidents.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (propFilter !== 'all' && i.propertyName !== propFilter) return false
    if (dateFrom && i.creationDate && i.creationDate < dateFrom) return false
    if (dateTo && i.creationDate && i.creationDate.slice(0,10) > dateTo) return false
    return true
  }), [incidents, statusFilter, propFilter, dateFrom, dateTo])

  const counts = incidents.reduce((acc, i) => { acc[i.status] = (acc[i.status]||0)+1; return acc }, {} as Record<string,number>)
  const hasFilters = propFilter !== 'all' || dateFrom || dateTo

  const inputStyle = { height: 34, padding: '0 10px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Poppins, sans-serif', color: C.ink, background: C.white, outline: 'none' }

  return (
    <div style={{ fontFamily: 'Poppins, sans-serif' }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: incidents.length, color: C.ink, key: 'all' },
          { label: 'Reported', value: counts['Reported']||0, color: C.amber, key: 'Reported' },
          { label: 'En Progreso', value: counts['In Progress']||0, color: C.blue, key: 'In Progress' },
          { label: 'Cerrados', value: counts['Closed']||0, color: C.green, key: 'Closed' },
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            style={{ background: statusFilter===s.key ? C.primaryLight : C.white, border: `1.5px solid ${statusFilter===s.key ? C.primary : C.border}`, borderRadius: 16, padding: '12px 16px', textAlign: 'left', cursor: 'pointer' }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, flex: 1 }}>
            {statusFilter === 'all' ? 'Todos' : statusFilter} ({filtered.length})
          </p>

          <button onClick={() => setShowFilters(f => !f)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 10, border: `1px solid ${hasFilters ? C.primary : C.border}`, background: hasFilters ? C.primaryLight : C.white, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: hasFilters ? C.primary : C.slate }}>
            <Filter style={{ width: 13, height: 13 }} /> Filtros {hasFilters && '•'}
          </button>
          <button onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.slate }}>
            <RefreshCw style={{ width: 13, height: 13 }} /> Actualizar
          </button>
        </div>

        {showFilters && (
          <div style={{ padding: '12px 20px', background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
              <option value="all">Todas las propiedades</option>
              {properties.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
              <span style={{ fontSize: 12, color: C.muted }}>—</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
            </div>
            {hasFilters && (
              <button onClick={() => { setPropFilter('all'); setDateFrom(''); setDateTo('') }}
                style={{ fontSize: 12, fontWeight: 600, color: C.red, background: 'none', border: 'none', cursor: 'pointer' }}>
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: C.muted }}>
            <AlertCircle style={{ width: 40, height: 40, opacity: 0.2, margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 600 }}>No hay incidentes con estos filtros</p>
          </div>
        ) : (
          <div>
            {filtered.map((inc, idx) => {
              const ss = STATUS_STYLES[inc.status] || STATUS_STYLES['Reported']
              return (
                <button key={inc.id} onClick={() => setSelected(inc)}
                  style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', background: 'none', border: 'none', borderBottom: idx < filtered.length-1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = C.bg}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {inc.photoUrls[0]
                      ? <img src={inc.photoUrls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <AlertCircle style={{ width: 16, height: 16, color: C.muted }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{inc.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.primary }}>{inc.propertyName}</span>
                      {inc.reportedBy && <span style={{ fontSize: 11, color: C.muted }}>· {inc.reportedBy}</span>}
                      {fmtDT(inc.creationDate) && <span style={{ fontSize: 11, color: C.muted }}>· {fmtDT(inc.creationDate)}</span>}
                    </div>
                    {inc.comment && <p style={{ fontSize: 11, color: C.slate, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{inc.comment}</p>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: ss.bg, color: ss.color, flexShrink: 0, marginTop: 2 }}>{inc.status}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,0.7)' }}
          onClick={() => setSelected(null)}>
          <div style={{ width: '100%', maxWidth: 480, background: C.white, borderRadius: 24, overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            {selected.photoUrls[0] && (
              <div style={{ height: 200, overflow: 'hidden' }}>
                <img src={selected.photoUrls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <p style={{ fontSize: 17, fontWeight: 800, color: C.ink }}>{selected.name}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.primary, marginTop: 2 }}>{selected.propertyName}</p>
                </div>
                <button onClick={() => setSelected(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: C.bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X style={{ width: 16, height: 16, color: C.slate }} />
                </button>
              </div>
              
              {/* Status Selector */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Estado</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STATUS_OPTIONS.map(status => {
                    const ss = STATUS_STYLES[status]
                    const isSelected = editStatus === status
                    return (
                      <button key={status} onClick={() => setEditStatus(status)}
                        style={{
                          padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                          background: isSelected ? ss.bg : C.bg,
                          color: isSelected ? ss.color : C.muted,
                          border: `2px solid ${isSelected ? ss.color : 'transparent'}`,
                          cursor: 'pointer',
                        }}>
                        {status === 'Reported' ? 'Reported' : status === 'In Progress' ? 'En Progreso' : 'Cerrado'}
                      </button>
                    )
                  })}
                </div>
              </div>
              
              {/* Close Comment (only when changing to Closed) */}
              {editStatus === 'Closed' && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Comentario de cierre</p>
                  <textarea
                    value={closeComment}
                    onChange={e => setCloseComment(e.target.value)}
                    placeholder="Describe cómo se resolvió..."
                    style={{
                      width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${C.border}`,
                      fontSize: 13, fontFamily: 'Poppins, sans-serif', resize: 'vertical', minHeight: 80,
                      outline: 'none',
                    }}
                  />
                </div>
              )}
              
              {/* Save Button (only if status changed) */}
              {editStatus !== selected.status && (
                <button onClick={handleSaveStatus} disabled={saving}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                    background: C.green, color: 'white', fontSize: 13, fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer', marginBottom: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: saving ? 0.7 : 1,
                  }}>
                  {saving ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <Check style={{ width: 16, height: 16 }} />}
                  {saving ? 'Guardando...' : 'Guardar cambio'}
                </button>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[{ label: 'Registrado por', value: selected.reportedBy||'—' }, { label: 'Fecha y hora', value: fmtDT(selected.creationDate)||'—' }]
                  .map(f => (
                    <div key={f.label} style={{ background: C.bg, borderRadius: 12, padding: '10px 12px' }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{f.label}</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{f.value}</p>
                    </div>
                  ))}
              </div>
              {selected.comment && (
                <div style={{ background: '#FEF3C7', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Comentario</p>
                  <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{selected.comment}</p>
                </div>
              )}
              {selected.closeComment && selected.status === 'Closed' && (
                <div style={{ background: '#DCFCE7', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Comentario de cierre</p>
                  <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{selected.closeComment}</p>
                </div>
              )}
              {selected.photoUrls.length > 1 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Fotos ({selected.photoUrls.length})</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selected.photoUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', display: 'block', border: `1px solid ${C.border}` }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
