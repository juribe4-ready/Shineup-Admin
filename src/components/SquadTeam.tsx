import { useCallback, useEffect, useMemo, useState } from 'react'
import { C, Card, Seg, btn, selStyle, Err, Loading, todayET, mondayOf, addDays, weekLabel, fmtDow } from './reports/shared'

interface SquadT { id: string; name: string; color: string; type: string; startHour: number; endHour: number; defaultMemberIds: string[]; dayOverrides: Record<string, { staffIds?: string[] }> }
interface Person { id: string; name: string; role: string }

async function getJ(url: string) { const r = await fetch(url); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); return j }
async function postJ(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.ok === false || j.error) throw new Error(j.error || `HTTP ${r.status}`)
  return j
}

export default function SquadTeam() {
  const [squads, setSquads] = useState<SquadT[]>([])
  const [staff, setStaff] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [mode, setMode] = useState<'fijo' | 'dia'>('fijo')
  const [toast, setToast] = useState<{ m: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [squadId, setSquadId] = useState('')
  const [monday, setMonday] = useState(mondayOf(todayET()))
  const [extra, setExtra] = useState<string[]>([])

  const say = (m: string, ok = true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const [s, st] = await Promise.all([getJ('/api/getSquads'), getJ('/api/getStaff')])
      const list: SquadT[] = (s.squads || []).filter((x: SquadT) => x.name)
      setSquads(list)
      setStaff((Array.isArray(st) ? st : []).map((x: any) => ({ id: x.id, name: x.name, role: String(x.role || '') })))
      setSquadId(prev => prev || list[0]?.id || '')
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const nameOf = useMemo(() => { const m: Record<string, string> = {}; staff.forEach(p => { m[p.id] = p.name }); return m }, [staff])
  const cleaners = useMemo(() => staff.filter(p => /cleaner/i.test(p.role)).sort((a, b) => a.name.localeCompare(b.name)), [staff])
  const squadOf = (pid: string, exceptId: string) => squads.find(s => s.id !== exceptId && s.defaultMemberIds.includes(pid))

  const saveMembers = async (sq: SquadT, ids: string[]) => {
    const before = sq.defaultMemberIds
    setSquads(list => list.map(x => x.id === sq.id ? { ...x, defaultMemberIds: ids } : x))
    setBusy(true)
    try { await postJ('/api/getSquads', { squadId: sq.id, memberIds: ids }); say(`${sq.name}: equipo guardado`) }
    catch (e: any) { setSquads(list => list.map(x => x.id === sq.id ? { ...x, defaultMemberIds: before } : x)); say(e.message, false) }
    finally { setBusy(false) }
  }

  const sq = squads.find(s => s.id === squadId) || null
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const rosterOn = (s: SquadT, d: string) => s.dayOverrides?.[d]?.staffIds ?? s.defaultMemberIds
  const rowIds = useMemo(() => {
    if (!sq) return []
    const set = new Set<string>([...sq.defaultMemberIds, ...extra])
    for (const d of days) for (const id of rosterOn(sq, d)) set.add(id)
    return [...set]
  }, [sq, extra, monday])

  const toggleDay = async (s: SquadT, d: string, pid: string) => {
    const cur = rosterOn(s, d)
    const next = cur.includes(pid) ? cur.filter(x => x !== pid) : [...cur, pid]
    if (next.length === 0) { say('Ese día se quedaría sin nadie; agrega a otra persona antes de quitar a esta', false); return }
    const prev = s.dayOverrides
    setSquads(list => list.map(x => x.id === s.id ? { ...x, dayOverrides: { ...x.dayOverrides, [d]: { ...(x.dayOverrides?.[d] || {}), staffIds: next } } } : x))
    setBusy(true)
    try {
      const j = await postJ('/api/getReports?type=squadRoster', { squadId: s.id, date: d, staffIds: next })
      say(j.cleaningCount ? `Guardado · ${j.updated || 0} de ${j.cleaningCount} limpiezas de ese día actualizadas` : 'Guardado')
    } catch (e: any) { setSquads(list => list.map(x => x.id === s.id ? { ...x, dayOverrides: prev } : x)); say(e.message, false) }
    finally { setBusy(false) }
  }

  const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: C.primaryLight, color: C.primaryDark, borderRadius: 999, padding: '5px 6px 5px 11px', fontSize: 12.5, fontWeight: 600, margin: '0 6px 6px 0' }
  const lab: React.CSSProperties = { fontSize: 11, color: C.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }

  return (
    <div style={{ opacity: busy ? .7 : 1 }}>
      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: toast.ok ? C.ink : C.red, color: '#fff', padding: '10px 18px', borderRadius: 14, fontWeight: 700, fontSize: 13 }}>{toast.m}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Seg items={[['fijo', 'Equipo fijo'], ['dia', 'Por día']]} value={mode} onChange={v => setMode(v as any)} />
        <button onClick={load} style={btn()}>Recargar</button>
      </div>
      <Loading on={loading} />
      <Err msg={err} />

      {mode === 'fijo' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {squads.map(s => {
            const free = cleaners.filter(p => !s.defaultMemberIds.includes(p.id))
            return (
              <Card key={s.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <b style={{ fontSize: 14 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.color, marginRight: 8 }} />{s.name}</b>
                  <span style={{ fontSize: 11.5, color: C.slate }}>{s.type} · {s.startHour}–{s.endHour} h</span>
                </div>
                <div style={lab}>Integrantes ({s.defaultMemberIds.length})</div>
                <div>
                  {s.defaultMemberIds.length === 0 && <span style={{ fontSize: 12.5, color: C.muted }}>Sin integrantes todavía</span>}
                  {s.defaultMemberIds.map(id => (
                    <span key={id} style={chip}>{nameOf[id] || id}
                      <button onClick={() => saveMembers(s, s.defaultMemberIds.filter(x => x !== id))} disabled={busy} title="Quitar" style={{ border: 'none', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, padding: '0 4px' }}>✕</button>
                    </span>
                  ))}
                </div>
                <select value="" disabled={busy} onChange={e => { if (e.target.value) saveMembers(s, [...s.defaultMemberIds, e.target.value]) }} style={{ ...selStyle, marginTop: 6, width: '100%', maxWidth: 'none', boxSizing: 'border-box' }}>
                  <option value="">+ Agregar cleaner…</option>
                  {free.map(p => { const o = squadOf(p.id, s.id); return <option key={p.id} value={p.id}>{p.name}{o ? ` — ya está en ${o.name}` : ''}</option> })}
                </select>
              </Card>
            )
          })}
          {!loading && squads.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No hay squads activos. Créalos en la pestaña Squads.</div>}
          <Card style={{ background: C.bg, borderStyle: 'dashed' }}>
            <div style={{ fontSize: 12, color: C.slate, lineHeight: 1.6 }}>Cada cambio se guarda al momento. Un cleaner puede estar en más de un squad; si ya está en otro te lo dice en la lista. El equipo fijo se usa cuando se asigna un squad a una limpieza nueva; las limpiezas ya asignadas no cambian.</div>
          </Card>
        </div>
      )}

      {mode === 'dia' && sq && (
        <Card>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <select value={squadId} onChange={e => { setSquadId(e.target.value); setExtra([]) }} style={selStyle}>{squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <button onClick={() => setMonday(addDays(monday, -7))} style={btn()}>‹</button>
            <b style={{ fontSize: 13.5 }}>{weekLabel(monday)}</b>
            <button onClick={() => setMonday(addDays(monday, 7))} style={btn()}>›</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
              <thead><tr><th style={{ textAlign: 'left', padding: 8, fontSize: 11, color: C.slate }}> </th>{days.map(d => <th key={d} style={{ padding: 8, fontSize: 11, color: C.slate, fontWeight: 600, textTransform: 'capitalize' }}>{fmtDow(d)}</th>)}</tr></thead>
              <tbody>
                {rowIds.map(pid => (
                  <tr key={pid} style={{ borderTop: `1px solid ${C.bg}` }}>
                    <td style={{ padding: 8, fontWeight: 600 }}>{nameOf[pid] || pid}{!sq.defaultMemberIds.includes(pid) && <span style={{ fontSize: 10.5, color: C.muted, marginLeft: 6 }}>solo días sueltos</span>}</td>
                    {days.map(d => {
                      const on = rosterOn(sq, d).includes(pid)
                      return <td key={d} style={{ textAlign: 'center', padding: 4 }}><button disabled={busy} onClick={() => toggleDay(sq, d, pid)} style={{ width: 34, height: 28, borderRadius: 8, border: `1.5px solid ${on ? C.primary : C.border}`, background: on ? C.primaryLight : C.white, color: on ? C.primaryDark : C.muted, fontWeight: 700, cursor: 'pointer' }}>{on ? '✓' : '—'}</button></td>
                    })}
                  </tr>
                ))}
                {rowIds.length === 0 && <tr><td colSpan={8} style={{ padding: 12, color: C.muted, fontSize: 13 }}>Este squad no tiene equipo. Agrégalo en "Equipo fijo" o con la lista de abajo.</td></tr>}
              </tbody>
            </table>
          </div>
          <select value="" onChange={e => { if (e.target.value) setExtra(x => [...x, e.target.value]) }} style={{ ...selStyle, marginTop: 10 }}>
            <option value="">+ Agregar otra persona a días sueltos…</option>
            {cleaners.filter(p => !rowIds.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ background: C.amberBg, color: C.amber, borderRadius: 8, padding: '8px 10px', fontSize: 12, marginTop: 10 }}>Un clic cambia solo ese día y no toca el equipo fijo. También actualiza las limpiezas que ese squad ya tenga ese día (igual que en Squad Blocks).</div>
        </Card>
      )}
    </div>
  )
}
