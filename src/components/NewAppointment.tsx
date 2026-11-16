import { useEffect, useMemo, useState } from 'react'
import { C, btn, selStyle, useIsMobile, addDays, todayET } from './reports/shared'

interface Prop { id: string; name: string; defaultStart: string | null }
interface Res { name: string; ok: boolean; reason?: string }

async function getJ(url: string) { const r = await fetch(url); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); return j }
const hhmm = (t: string | null) => { if (!t) return '10:00 am (por defecto)'; const [h, m] = t.split(':').map(Number); if (isNaN(h)) return t; return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}` }

export default function NewAppointment({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const mobile = useIsMobile()
  const [date, setDate] = useState(addDays(todayET(), 1))
  const [typeId, setTypeId] = useState('')
  const [types, setTypes] = useState<{ id: string; name: string }[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [source, setSource] = useState('Turno')
  const [existing, setExisting] = useState<string[]>([])
  const [picked, setPicked] = useState<Prop[]>([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<Res[]>([])

  useEffect(() => {
    Promise.all([getJ(`/api/getReports?type=apptOptions&date=${date}`), getJ('/api/getReports?type=cleaningTypes')])
      .then(([o, t]) => {
        setProps(o.properties || []); setSources(o.sources || []); setExisting(o.existing || [])
        setTypes((t.cleaningTypes || []).filter((x: any) => x.name)); if (o.error) setErr(o.error)
      }).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])
  // al cambiar la fecha solo se vuelve a consultar qué casas ya tienen appointment ese día
  useEffect(() => { if (!loading) getJ(`/api/getReports?type=apptOptions&date=${date}`).then(o => setExisting(o.existing || [])).catch(() => {}) }, [date])

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return props.filter(p => !picked.some(x => x.id === p.id) && p.name.toLowerCase().includes(s)).slice(0, 8)
  }, [q, props, picked])

  const canSave = !!date && !!typeId && picked.length > 0 && !!source && !saving

  const create = async () => {
    setSaving(true); setErr('')
    try {
      const r = await fetch('/api/getReports?type=createAppointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, cleaningTypeId: typeId, source, properties: picked.map(p => ({ propertyId: p.id, name: p.name })) }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      const res: Res[] = j.results || []
      setDone(d => [...res, ...d])
      const okNames = new Set(res.filter(x => x.ok).map(x => x.name))
      setPicked(p => p.filter(x => !okNames.has(x.name)))
      if (res.some(x => x.ok)) onCreated()
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  const lab: React.CSSProperties = { fontSize: 11, color: C.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }
  const box: React.CSSProperties = mobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '92vh', borderRadius: '18px 18px 0 0' }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 560, maxHeight: '90vh', borderRadius: 16 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 90 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...box, background: C.white, overflowY: 'auto', padding: 18, boxShadow: '0 20px 50px rgba(15,23,42,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <b style={{ fontSize: 17 }}>Nuevo appointment</b>
          <button onClick={onClose} style={{ ...btn(), width: 34, padding: 0 }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: C.slate, marginBottom: 14 }}>Solo 4 datos. La hora sale de la casa; el cliente lo llena Airtable. Se crea con estado <b>Confirmed</b>, que es el que toma el Schedule para crear el cleaning.</div>
        {err && <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        {loading && <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Cargando casas…</div>}

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div><div style={lab}>Fecha</div><input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={{ ...selStyle, width: '100%', maxWidth: 'none', boxSizing: 'border-box' }} /></div>
          <div><div style={lab}>Tipo de limpieza</div>
            <select value={typeId} onChange={e => setTypeId(e.target.value)} style={{ ...selStyle, width: '100%', maxWidth: 'none', boxSizing: 'border-box' }}><option value="">Elegir…</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={lab}>Casa (puedes agregar varias)</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar casa…" style={{ ...selStyle, width: '100%', maxWidth: 'none', boxSizing: 'border-box' }} />
          {matches.length > 0 && <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
            {matches.map(p => <div key={p.id} onClick={() => { setPicked(x => [...x, p]); setQ('') }} style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', borderBottom: `1px solid ${C.bg}` }}>{p.name}</div>)}
          </div>}
          {q.trim() && matches.length === 0 && !loading && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Sin resultados ({props.length} casas cargadas)</div>}
          <div style={{ marginTop: 8 }}>
            {picked.map(p => <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.primaryLight, color: C.primaryDark, borderRadius: 999, padding: '5px 6px 5px 11px', fontSize: 12.5, fontWeight: 600, margin: '0 6px 6px 0' }}>{p.name}
              <button onClick={() => setPicked(x => x.filter(y => y.id !== p.id))} style={{ border: 'none', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, padding: '0 4px' }}>✕</button></span>)}
          </div>
        </div>

        <div style={{ marginTop: 6 }}>
          <div style={lab}>Origen</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sources.map(s => <button key={s} onClick={() => setSource(s)} style={{ ...btn(source === s), height: 34 }}>{s}</button>)}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Opciones del campo Source de Airtable.</div>
        </div>

        {picked.length > 0 && (
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginTop: 14 }}>
            <div style={lab}>Lo que se completa solo</div>
            {picked.map(p => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, padding: '4px 0' }}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: C.slate }}>{hhmm(p.defaultStart)} · Confirmed</span>
            </div>)}
            {picked.some(p => existing.includes(p.id)) && <div style={{ background: C.amberBg, color: C.amber, borderRadius: 8, padding: '8px 10px', fontSize: 12, marginTop: 8 }}>Ya existe un appointment ese día para: {picked.filter(p => existing.includes(p.id)).map(p => p.name).join(', ')}. Si lo creas, quedará duplicado.</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button onClick={create} disabled={!canSave} style={{ ...btn(), background: canSave ? C.primary : C.border, borderColor: canSave ? C.primary : C.border, color: canSave ? '#fff' : C.muted, fontWeight: 700, cursor: canSave ? 'pointer' : 'default' }}>{saving ? 'Creando…' : `Crear ${picked.length || ''} appointment${picked.length === 1 ? '' : 's'}`}</button>
          <button onClick={onClose} style={btn()}>Cerrar</button>
        </div>

        {done.length > 0 && <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <div style={lab}>Creados ahora</div>
          {done.map((r, i) => <div key={i} style={{ fontSize: 12.5, padding: '2px 0', color: r.ok ? C.green : C.red }}>{r.ok ? '✓' : '✕'} {r.name}{!r.ok && r.reason ? ` — ${r.reason}` : ''}</div>)}
        </div>}
      </div>
    </div>
  )
}
