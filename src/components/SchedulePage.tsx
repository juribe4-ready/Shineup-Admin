import { useCallback, useEffect, useMemo, useState } from 'react'
import NewAppointment from './NewAppointment'
import SchedulePanel from './SchedulePanel'
import ScheduleCasa, { type Hist } from './ScheduleCasa'
import { ORIGIN, TYPE_STYLE, originOf, segOfType, toHM, dayCapacity, type Origin, type Seg as TSeg, type SquadLite } from './scheduleLib'
import { C, Card, Seg, btn, selStyle, todayET, mondayOf, addDays, weekLabel, fmtDow, useIsMobile } from './reports/shared'

const PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9', '#8B5CF6', '#EF4444', '#14B8A6']
type St = 'launched' | 'confirmed' | 'pending'
export interface Item { key: string; id: string; date: string; time: string | null; property: string; st: St; cleaners: string[]; cleanerIds: string[]; type: string | null; done: boolean; started: boolean; origin: Origin; seg: TSeg; std: number; apptId: string | null; rawStatus: string }

const fmtT = (t: string | null) => { if (!t) return ''; const d = new Date(t); if (isNaN(d.getTime())) return String(t); return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) }

async function getJ(url: string) { const r = await fetch(url); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); return j }

export default function SchedulePage({ onOpenDispatch }: { onOpenDispatch?: (f: { date: string; cleaningId: string }) => void }) {
  const mobile = useIsMobile()
  const [tab, setTab] = useState<'this' | 'next'>('this')
  const thisMon = mondayOf(todayET())
  const monday = tab === 'this' ? thisMon : addDays(thisMon, 7)
  const sunday = addDays(monday, 6)
  const [items, setItems] = useState<Item[]>([])
  const [nextCount, setNextCount] = useState<{ l: number; c: number; p: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [dbg, setDbg] = useState<any>(null)
  const [showDbg, setShowDbg] = useState(false)
  const [staff, setStaff] = useState<{ id: string; name: string; initials?: string; defaultAssignment: boolean }[]>([])
  const [selStaff, setSelStaff] = useState<string[]>([])
  const [rating, setRating] = useState(2)
  const [launch, setLaunch] = useState<{ ids: string[]; label: string } | null>(null)
  const [launching, setLaunching] = useState(false)
  const [toast, setToast] = useState<{ m: string; ok: boolean } | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [newAppt, setNewAppt] = useState(false)
  const [forWho, setForWho] = useState('all')
  const [group, setGroup] = useState<'dia' | 'casa' | 'origen'>('dia')
  const [fOrigin, setFOrigin] = useState<'all' | Origin>('all')
  const [fType, setFType] = useState<'all' | TSeg>('all')
  const [sel, setSel] = useState<Item | null>(null)
  const [busy, setBusy] = useState(false)
  const [squads, setSquads] = useState<SquadLite[]>([])
  const [types, setTypes] = useState<{ id: string; name: string }[]>([])
  const [hist, setHist] = useState<Hist[]>([])
  const [histErr, setHistErr] = useState('')
  const [histDbg, setHistDbg] = useState<any>(null)
  const [changes, setChanges] = useState<any[]>([])
  const [undo, setUndo] = useState<{ label: string; run: () => Promise<void> } | null>(null)

  const load = useCallback(async (mon: string) => {
    const sun = addDays(mon, 6)
    const [cal, sum] = await Promise.all([getJ(`/api/getDashboard?action=weekCal&from=${mon}&to=${sun}`), getJ(`/api/getAppointments?action=summary&weekStart=${mon}`)])
    const apptByCleaning = new Map<string, any>()
    for (const a of sum.appointments || []) { const rc = Array.isArray(a.relatedCleaning) ? a.relatedCleaning[0] : a.relatedCleaning; if (rc) apptByCleaning.set(rc, a) }
    const out: Item[] = []; let sinAppt = 0
    for (const c of cal.cleanings || []) if (c.status !== 'Cancelled') {
      const a = apptByCleaning.get(c.id); if (!a) sinAppt++
      out.push({ key: 'c' + c.id, id: c.id, date: c.date, time: c.time, property: c.property, st: 'launched', cleaners: c.cleaners.map((x: any) => x.name.split(' ')[0]), cleanerIds: c.cleaners.map((x: any) => x.id), type: c.type, done: c.status === 'Done', started: c.status === 'In Progress' || c.status === 'Started',
        origin: originOf(a ? (a.sourceRaw || a.source) : ''), seg: segOfType(c.type), std: c.std || 0, apptId: a?.id || null, rawStatus: c.status })
    }
    for (const a of sum.appointments || []) {
      if (!a.date || a.relatedCleaning || a.status === 'Scheduled' || a.status === 'Cancelled') continue
      out.push({ key: 'a' + a.id, id: a.id, date: a.date, time: a.time, property: a.propertyName || a.clientName || 'Sin nombre', st: a.status === 'Confirmed' ? 'confirmed' : 'pending', cleaners: [], cleanerIds: [], type: a.cleaningType || null, done: false, started: false,
        origin: originOf(a.sourceRaw || a.source), seg: segOfType(a.cleaningType), std: (a.labor || 0) / 60, apptId: a.id, rawStatus: a.status || '' })
    }
    const sources: Record<string, number> = {}; (sum.appointments || []).forEach((a: any) => { const k = a.sourceRaw || a.source || '(vacío)'; sources[k] = (sources[k] || 0) + 1 })
    return { out, raw: { cleanings: (cal.cleanings || []).length, appointments: (sum.appointments || []).length, statuses: [...new Set((sum.appointments || []).map((a: any) => a.status))], origenesEnAirtable: sources, lanzadasSinAppointment: sinAppt } }
  }, [])

  const refresh = useCallback(() => {
    setLoading(true); setErr('')
    load(monday).then(r => { setItems(r.out); setDbg({ semana: [monday, sunday], ...r.raw }) }).catch(e => { setErr(e.message); setDbg({ error: e.message }) }).finally(() => setLoading(false))
    const other = tab === 'this' ? addDays(thisMon, 7) : thisMon
    load(other).then(r => setNextCount({ l: r.out.filter(i => i.st === 'launched').length, c: r.out.filter(i => i.st === 'confirmed').length, p: r.out.filter(i => i.st === 'pending').length })).catch(() => setNextCount(null))
  }, [load, monday, sunday, tab, thisMon])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { getJ(`/api/getSquads?weekStart=${monday}`).then(j => { setSquads(j.squads || []) }).catch(() => setSquads([])) }, [monday])
  useEffect(() => { getJ('/api/getReports?type=cleaningTypes').then(j => setTypes((j.cleaningTypes || []).filter((x: any) => x.name))).catch(() => {}) }, [])
  useEffect(() => { getJ('/api/getDashboard?action=casaHist').then(j => { setHist(j.houses || []); setHistDbg(j.debug); setHistErr('') }).catch(e => { setHist([]); setHistErr(e.message) }) }, [])
  useEffect(() => { getJ('/api/getAppointments?action=defaultStaff').then(j => { const st = j.staff || []; setStaff(st); setSelStaff(st.filter((x: any) => x.defaultAssignment).map((x: any) => x.id)) }).catch(() => {}) }, [])

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const cnt = { l: items.filter(i => i.st === 'launched').length, c: items.filter(i => i.st === 'confirmed').length, p: items.filter(i => i.st === 'pending').length }
  const people = useMemo(() => { const m = new Map<string, string>(); items.forEach(i => i.cleanerIds.forEach((id, k) => m.set(id, i.cleaners[k]))); return [...m.entries()] }, [items])
  const squadKey = (i: Item) => i.cleanerIds.slice().sort().join('+')
  const squadKeys = useMemo(() => [...new Set(items.filter(i => i.st === 'launched' && i.cleanerIds.length).map(squadKey))], [items])
  const color = (i: Item) => i.st !== 'launched' ? '#CBD5E1' : !i.cleanerIds.length ? '#94A3B8' : PALETTE[squadKeys.indexOf(squadKey(i)) % PALETTE.length]
  const passes = (i: Item) => (fOrigin === 'all' || i.origin === fOrigin) && (fType === 'all' || i.seg === fType) 
  const shown = items.filter(passes)
  const OR = { T: 0, W: 1, O: 2 }
  const perDay = days.map(d => shown.filter(i => i.date === d).sort((a, b) => OR[a.origin] - OR[b.origin] || a.property.localeCompare(b.property)))
  const oc = { T: items.filter(i => i.origin === 'T').length, W: items.filter(i => i.origin === 'W').length, O: items.filter(i => i.origin === 'O').length }
  const tc = { 'STR': items.filter(i => i.seg === 'STR').length, 'Resid.': items.filter(i => i.seg === 'Resid.').length, 'Deep': items.filter(i => i.seg === 'Deep').length }
  const capDay = days.map(d => { const cap = dayCapacity(squads, d); const used = items.filter(i => i.date === d && i.st !== 'pending').reduce((t, i) => t + i.std, 0); return { d, used, cap: cap.hours, parts: cap.parts, pct: cap.hours > 0 ? used / cap.hours * 100 : null } })
  const houseOrigin = (name: string): Origin | null => items.find(i => i.property.trim().toLowerCase() === name.trim().toLowerCase())?.origin || null

  const showT = (m: string, ok = true) => { setToast({ m, ok }); setTimeout(() => setToast(null), 3500) }

  const doLaunch = async () => {
    if (!launch) return
    setLaunching(true)
    try {
      const r = await fetch('/api/getAppointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentIds: launch.ids, defaultRating: rating, assignedStaffIds: selStaff }) })
      const j = await r.json()
      if (j.success) { showT(`✓ ${j.created} limpiezas creadas`); setLaunch(null); refresh() } else showT(j.error || 'Error al lanzar', false)
    } catch { showT('Error de conexión', false) } finally { setLaunching(false) }
  }

  // ── Editar / cancelar (nunca borra; Dispatch se reinicia con deleteSquadBlock) ──
  const post = async (url: string, body: any) => { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`); return j }
  const log = (what: string, ok: boolean, extra?: any) => setChanges(p => [{ at: new Date().toLocaleTimeString('en-US'), what, ok, ...extra }, ...p].slice(0, 12))
  const resetDispatch = async (cleaningId: string, date: string) => {
    const j = await getJ(`/api/getSquads?weekStart=${mondayOf(date)}`)
    const bl = (j.blocks || []).filter((b: any) => b.cleaningId === cleaningId)
    for (const b of bl) await post('/api/deleteSquadBlock', { blockId: b.id })
    return bl.length
  }
  const armUndo = (label: string, run: () => Promise<void>) => { setUndo({ label, run }); setTimeout(() => setUndo(u => (u && u.label === label ? null : u)), 10000) }
  const guard = async (what: string, fn: () => Promise<void>) => { setBusy(true); try { await fn(); log(what, true) } catch (e: any) { log(what, false, { error: e.message }); showT(e.message || 'Error', false) } finally { setBusy(false) } }
  const apptEdit = (body: any) => post('/api/getAppointments?action=editAppointment', body)
  const clnEdit = (body: any) => post('/api/getAppointments?action=editCleaning', body)

  const onSave = (it: Item, v: { date: string; time: string; typeId?: string }) => guard(`Guardar ${it.property}`, async () => {
    const oldHM = toHM(it.time) || '10:00', oldTypeId = types.find(t => t.name === it.type)?.id
    if (it.st === 'launched') {
      const n = await resetDispatch(it.id, it.date)
      await clnEdit({ id: it.id, date: v.date !== it.date ? v.date : undefined, time: v.time !== oldHM ? v.time : undefined })
      armUndo(`${it.property} movida`, async () => { await clnEdit({ id: it.id, date: it.date, time: oldHM }); refresh() })
      showT(n ? `Movida · se quitó de Dispatch (${n} bloque${n > 1 ? 's' : ''})` : 'Movida')
    } else {
      await apptEdit({ id: it.id, date: v.date !== it.date ? v.date : undefined, time: v.time !== oldHM ? v.time : undefined, cleaningTypeId: v.typeId })
      armUndo(`${it.property} editada`, async () => { await apptEdit({ id: it.id, date: it.date, time: oldHM, cleaningTypeId: v.typeId ? oldTypeId : undefined }); refresh() })
      showT('Guardado')
    }
    setSel(null); refresh()
  })
  const onStatus = (it: Item, status: 'Lead' | 'Cancelled') => guard(`${status === 'Lead' ? 'Devolver a por confirmar' : 'Cancelar appointment'} ${it.property}`, async () => {
    const prev = it.rawStatus || 'Confirmed'
    await apptEdit({ id: it.id, status })
    armUndo(`${it.property} ${status === 'Lead' ? 'devuelta a por confirmar' : 'cancelada'}`, async () => { await apptEdit({ id: it.id, status: prev }); refresh() })
    showT(status === 'Lead' ? 'Devuelta a por confirmar' : 'Appointment cancelado'); setSel(null); refresh()
  })
  const onCancelCleaning = (it: Item) => guard(`Cancelar limpieza ${it.property}`, async () => {
    const n = await resetDispatch(it.id, it.date)
    await clnEdit({ id: it.id, cancel: true })
    if (it.apptId) await apptEdit({ id: it.apptId, status: 'Cancelled', viaCleaning: true })
    armUndo(`${it.property} cancelada`, async () => { await clnEdit({ id: it.id, status: 'Scheduled' }); if (it.apptId) await apptEdit({ id: it.apptId, status: 'Scheduled', viaCleaning: true }); refresh() })
    showT(n ? `Cancelada · se quitó de Dispatch` : 'Cancelada'); setSel(null); refresh()
  })
  const runUndo = async () => { if (!undo) return; const u = undo; setUndo(null); await guard('Deshacer: ' + u.label, u.run) }
  const openDispatch = (it: Item) => { if (onOpenDispatch) onOpenDispatch({ date: it.date, cleaningId: it.id }) }

  // ── Exportar (sin dinero) ────────────────────────────────────
  const shareItems = () => items.filter(i => i.st !== 'pending' && (forWho === 'all' || i.cleanerIds.includes(forWho)))
  const whoLabel = forWho === 'all' ? 'Todo el equipo' : (people.find(p => p[0] === forWho)?.[1] || '')
  const exportPng = () => {
    const list = shareItems(); const W = 1100, rowH = 22
    const cols = days.map(d => list.filter(i => i.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || '')))
    const maxN = Math.max(3, ...cols.map(c => c.length)); const H = 130 + maxN * 54 + 40
    const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; const g = cv.getContext('2d')!; g.scale(2, 2)
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H)
    g.fillStyle = '#4F46E5'; g.fillRect(0, 0, W, 70)
    g.fillStyle = '#fff'; g.font = '700 24px Arial'; g.fillText('ShineUp · Semana ' + weekLabel(monday).replace('W', ''), 24, 34); g.font = '14px Arial'; g.fillText('Para: ' + whoLabel, 24, 56)
    const cw = (W - 48) / 7
    cols.forEach((c, k) => {
      const x = 24 + k * cw; g.fillStyle = '#0F172A'; g.font = '700 14px Arial'; g.fillText(fmtDow(days[k]).replace('.', ''), x + 4, 100); g.fillStyle = '#94A3B8'; g.font = '12px Arial'; g.fillText(c.length + ' limp.', x + 4, 116)
      c.forEach((it, j) => { const y = 128 + j * 54; g.fillStyle = '#F8FAFC'; g.fillRect(x, y, cw - 6, 48); g.fillStyle = color(it); g.fillRect(x, y, 4, 48)
        g.fillStyle = '#0F172A'; g.font = '700 11px Arial'; g.fillText(it.property.slice(0, 20), x + 10, y + 16); g.fillStyle = '#64748B'; g.font = '11px Arial'; g.fillText((fmtT(it.time) + ' ' + (it.st === 'confirmed' ? '(por lanzar)' : '')).trim(), x + 10, y + 31); g.fillText(it.cleaners.join(' + ').slice(0, 22), x + 10, y + 44 - rowH / 2 + 2) })
    })
    cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `ShineUp-semana-${monday}.png`; a.click() }, 'image/png')
    setShareOpen(false)
  }
  const exportPdf = () => {
    const list = shareItems(); const w = window.open('', '_blank'); if (!w) { showT('Permite ventanas emergentes para el PDF', false); return }
    const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
    const body = days.map(d => { const l = list.filter(i => i.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || '')); return `<h3>${esc(fmtDow(d))} <small>${l.length} limpiezas</small></h3>` + (l.length ? '<table>' + l.map(i => `<tr><td style="width:80px">${esc(fmtT(i.time))}</td><td><b>${esc(i.property)}</b></td><td>${esc(i.cleaners.join(' + '))}</td><td>${i.st === 'confirmed' ? 'por lanzar' : ''}</td></tr>`).join('') + '</table>' : '<p class="m">—</p>') }).join('')
    w.document.write(`<html><head><title>ShineUp semana</title><style>body{font-family:Arial;padding:24px;color:#0F172A}h1{margin:0}h3{margin:16px 0 4px;border-bottom:1px solid #ddd}small{color:#888;font-weight:400}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:4px 6px;border-bottom:1px solid #f1f5f9}.m{color:#999}</style></head><body><h1>ShineUp · ${esc(weekLabel(monday))}</h1><p>Para: ${esc(whoLabel)}</p>${body}</body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300); setShareOpen(false)
  }

  const chip = (i: Item) => {
    const ts = TYPE_STYLE[i.seg]; const o = ORIGIN[i.origin]
    const base: React.CSSProperties = { position: 'relative', borderRadius: 8, padding: '5px 26px 5px 7px', marginBottom: 5, fontSize: 11, lineHeight: 1.25, opacity: i.done ? .6 : 1, cursor: 'pointer', background: ts.bg, color: C.ink }
    const st: React.CSSProperties = i.st === 'launched' ? { ...base, border: `1.5px solid ${ts.bd}` } : i.st === 'confirmed' ? { ...base, border: `1.5px dashed ${ts.bd}` } : { ...base, background: '#fff', border: `1.5px dotted ${ts.bd}`, color: C.muted }
    const dot = i.st === 'launched' ? color(i) : null
    return <div key={i.key} style={st} onClick={() => setSel(i)}>
      <span title={o.label} style={{ position: 'absolute', top: 4, right: 4, width: 17, height: 17, borderRadius: 9, background: o.color, color: '#fff', fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i.origin}</span>
      <b style={{ display: 'block', color: i.st === 'pending' ? C.slate : C.ink }}>{i.property}</b>
      <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>{dot && <i title="color del squad" style={{ width: 7, height: 7, borderRadius: 4, background: dot, display: 'inline-block' }} />}
        {i.st === 'launched' ? (i.cleaners.length ? <span title={i.cleaners.join(' + ')} style={{ letterSpacing: .5, fontWeight: 600 }}>{i.cleaners.map(n => n[0]).join(' ')}</span> : <i>sin asignar</i>) : null}
        <span style={{ fontSize: 9.5, fontWeight: 800, color: ts.fg, marginLeft: i.st === 'launched' ? 'auto' : 0 }}>{i.seg}</span></span>
    </div>
  }
  const confirmedAll = items.filter(i => i.st === 'confirmed')

  return <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
    {newAppt && <NewAppointment onClose={() => setNewAppt(false)} onCreated={refresh} />}
    {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: toast.ok ? C.green : C.red, color: '#fff', padding: '10px 18px', borderRadius: 14, fontWeight: 700, fontSize: 13 }}>{toast.m}</div>}
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Seg items={[['this', 'Esta semana'], ['next', 'Próxima']]} value={tab} onChange={v => setTab(v as any)} />
      <span style={{ fontWeight: 700, fontSize: 14 }}>{weekLabel(monday)}</span>
      <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', gap: 8 }}>
        <button style={{ ...btn(), fontWeight: 700 }} onClick={() => setNewAppt(true)}>+ Nuevo appointment</button>
        <button style={{ ...btn(), background: C.primary, color: '#fff', borderColor: C.primary, fontWeight: 700 }} onClick={() => setShareOpen(o => !o)}>Compartir semana ▾</button>
        {shareOpen && <Card style={{ position: 'absolute', right: 0, top: 44, zIndex: 30, width: 260, boxShadow: '0 10px 30px rgba(15,23,42,.15)' }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Para:</div>
          <select value={forWho} onChange={e => setForWho(e.target.value)} style={{ ...selStyle, width: '100%', marginBottom: 10 }}><option value="all">Todo el equipo</option>{people.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          <button style={{ ...btn(), width: '100%', marginBottom: 6 }} onClick={exportPng}>Imagen PNG (WhatsApp)</button>
          <button style={{ ...btn(), width: '100%' }} onClick={exportPdf}>PDF</button>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Sin dinero. Incluye lanzadas y confirmadas.</div>
        </Card>}
      </div>
    </div>
    <Card style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: mobile ? 8 : 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Group label="Agrupar"><Pills value={group} onChange={v => setGroup(v as any)} items={[['dia', 'Día'], ['casa', 'Casa'], ['origen', 'Origen']]} /></Group>
        <Group label="Origen"><Pills value={fOrigin} onChange={v => setFOrigin(v as any)} items={[['all', `Todos ${items.length}`], ...(['T', 'W', 'O'] as Origin[]).map(o => [o, `${ORIGIN[o].label} ${oc[o]}`, ORIGIN[o].color] as [string, string, string])]} /></Group>
        <Group label="Tipo"><Pills value={fType} onChange={v => setFType(v as any)} items={[['all', 'Todos'], ...(['STR', 'Resid.', 'Deep'] as TSeg[]).map(t => [t, `${t} ${tc[t as 'STR']}`, TYPE_STYLE[t].bd] as [string, string, string])]} /></Group>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>{(['T', 'W', 'O'] as Origin[]).map((o, k) => <span key={o} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{k > 0 && '·'}<b>{oc[o]}</b><Dot o={o} /></span>)}</span>
        <span><b style={{ color: C.green }}>{cnt.l}</b> lanzadas</span><span><b style={{ color: C.amber }}>{cnt.c}</b> confirmadas por lanzar</span><span><b style={{ color: C.muted }}>{cnt.p}</b> por confirmar</span>
        {cnt.c > 0 && <button style={{ ...btn(), marginLeft: 'auto', background: C.amberBg, borderColor: '#F59E0B', color: C.amber, fontWeight: 700 }} onClick={() => setLaunch({ ids: confirmedAll.map(i => i.id), label: `las ${confirmedAll.length} confirmadas de la semana` })}>Lanzar las {cnt.c} confirmadas</button>}
      </div>
    </Card>
    {err && <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: 10, fontSize: 13 }}>Error: {err}</div>}
    {loading && <div style={{ fontSize: 12, color: C.muted }}>Cargando…</div>}
    {group !== 'dia' ? <ScheduleCasa items={shown} days={days} hist={hist} mobile={mobile} groupBy={group === 'casa' ? 'casa' : 'origen'} onOpen={setSel} histErr={histErr} originOfHouse={houseOrigin} /> :
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
      {days.map((d, k) => { const conf = perDay[k].filter(i => i.st === 'confirmed'); const isT = d === todayET(); const cp = capDay[k]
        return <div key={d} style={{ background: C.white, border: `1px solid ${isT ? C.primary : C.border}`, boxShadow: isT ? '0 0 0 2px #E0E7FF' : 'none', borderRadius: 12, padding: 8, minHeight: mobile ? 0 : 140 }}>
          <div style={{ textAlign: mobile ? 'left' : 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 6, marginBottom: 6 }}>
            <div style={{ display: mobile ? 'flex' : 'block', gap: 8, alignItems: 'baseline' }}>
              <b style={{ fontSize: 13 }}>{fmtDow(d)}</b> <span style={{ fontSize: 11, color: C.muted }}>{perDay[k].length} limp.</span>
              {conf.length > 0 && <button onClick={() => setLaunch({ ids: conf.map(i => i.id), label: `${conf.length} del ${fmtDow(d)}` })} style={{ display: mobile ? 'inline-block' : 'block', margin: mobile ? '0 0 0 auto' : '4px auto 0', border: '1.5px solid #F59E0B', background: C.amberBg, color: C.amber, borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}>Lanzar {conf.length}</button>}
            </div>
            <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, cp.pct || 0)}%`, height: '100%', background: (cp.pct || 0) > 100 ? C.red : (cp.pct || 0) >= 50 ? '#10B981' : '#94A3B8' }} /></div>
            <div title={cp.parts.map(x => `${x.squad}: ${x.people} personas = ${x.hours} h`).join('\n') || 'Sin squads con equipo ese día'} style={{ fontSize: 10.5, color: C.slate, marginTop: 2 }}>{cp.cap > 0 ? `${cp.used.toFixed(0)} h / ${cp.cap.toFixed(0)} h · ${Math.round(cp.pct || 0)}%` : `${cp.used.toFixed(0)} h · sin equipo`}</div>
          </div>
          {perDay[k].map(chip)}{perDay[k].length === 0 && <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: mobile ? 4 : 16 }}>Sin programar</p>}
        </div> })}
    </div>}
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: C.slate, alignItems: 'center' }}>
      {(['T', 'W', 'O'] as Origin[]).map(o => <span key={o} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Dot o={o} />{ORIGIN[o].label}</span>)}
      {(['STR', 'Resid.', 'Deep'] as TSeg[]).map(t => <span key={t} style={{ background: TYPE_STYLE[t].bg, color: TYPE_STYLE[t].fg, border: `1px solid ${TYPE_STYLE[t].bd}`, borderRadius: 6, padding: '0 6px', fontWeight: 700 }}>{t}</span>)}
      <span>Borde punteado = por lanzar · sólido = lanzada · punto de color = squad · barra = horas estándar ÷ capacidad del equipo</span>
    </div>
    {nextCount && <Card style={{ padding: '10px 14px', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><b>{tab === 'this' ? 'Próxima semana' : 'Esta semana'}:</b> {nextCount.l} lanzadas · {nextCount.c} confirmadas por lanzar · {nextCount.p} por confirmar<button style={{ ...btn(), marginLeft: 'auto' }} onClick={() => setTab(tab === 'this' ? 'next' : 'this')}>Ver ›</button></Card>}
    <button onClick={() => setShowDbg(s => !s)} style={{ alignSelf: 'flex-start', fontSize: 12, color: C.slate, background: 'none', border: 'none', cursor: 'pointer' }}>{showDbg ? '▾' : '▸'} Debug</button>
    {showDbg && <pre style={{ background: C.ink, color: '#E2E8F0', padding: 12, borderRadius: 10, fontSize: 12, overflowX: 'auto' }}>{JSON.stringify({ ...dbg, historial: histDbg || histErr, squads: squads.map(q => ({ n: q.name, tipo: q.type, h: `${q.startHour}-${q.endHour}`, miembros: q.defaultMemberIds.length })), capacidadPorDia: capDay.map(c => ({ d: c.d, usadasH: Math.round(c.used * 10) / 10, capH: c.cap, equipo: c.parts })), cambiosRecientes: changes }, null, 2)}</pre>}
    {undo && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 120, background: C.ink, color: '#fff', padding: '10px 14px', borderRadius: 14, fontSize: 13, display: 'flex', gap: 12, alignItems: 'center' }}>{undo.label}<button onClick={runUndo} style={{ background: 'none', border: 'none', color: '#A5B4FC', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>Deshacer</button></div>}
    {sel && <SchedulePanel item={sel} mobile={mobile} types={types} busy={busy} onClose={() => setSel(null)} onSave={onSave} onStatus={onStatus} onCancelCleaning={onCancelCleaning} onDispatch={openDispatch} />}
    {launch && <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ maxWidth: 420, width: '100%' }}>
        <b style={{ fontSize: 16 }}>¿Lanzar {launch.label}?</b>
        <p style={{ fontSize: 13, color: C.slate }}>Se crean <b>{launch.ids.length}</b> limpiezas con estado Scheduled.</p>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', margin: '10px 0 6px' }}>Staff asignado (★ = por defecto)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{staff.map(m => { const on = selStaff.includes(m.id); return <button key={m.id} onClick={() => setSelStaff(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])} style={{ padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${on ? C.primary : C.border}`, background: on ? C.primary : C.bg, color: on ? '#fff' : C.slate, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{m.name.split(' ')[0] || m.initials}{m.defaultAssignment ? ' ★' : ''}</button> })}</div>
        <p style={{ fontSize: 11, color: selStaff.length ? C.muted : C.amber, margin: '6px 0 0' }}>{selStaff.length ? `${selStaff.length} seleccionado(s): ${staff.filter(m => selStaff.includes(m.id)).map(m => m.name.split(' ')[0]).join(', ')}` : 'No hay staff seleccionado'}</p>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', margin: '12px 0 6px' }}>Rating por defecto (condición esperada)</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>{([[3, 'Bueno', '#047857'], [2, 'Normal', '#B45309'], [1, 'Malo', '#B91C1C']] as [number, string, string][]).map(([v, l, c]) => <button key={v} onClick={() => setRating(v)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1.5px solid ${rating === v ? 'transparent' : C.border}`, background: rating === v ? c : C.bg, color: rating === v ? '#fff' : C.slate, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{l}</button>)}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button style={btn()} onClick={() => setLaunch(null)}>Cancelar</button><button disabled={launching} style={{ ...btn(), background: C.primary, color: '#fff', borderColor: C.primary, fontWeight: 700 }} onClick={doLaunch}>{launching ? 'Lanzando…' : 'Lanzar'}</button></div>
      </Card></div>}
  </div>
}

const Group = ({ label, children }: { label: string; children: any }) => <div><div style={{ fontSize: 10.5, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>{label}</div>{children}</div>
const Pills = ({ items, value, onChange }: { items: ([string, string] | [string, string, string])[]; value: string; onChange: (v: string) => void }) => <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: 10, padding: 3, gap: 2, maxWidth: '100%', overflowX: 'auto' }}>
  {items.map(([k, l, c]) => { const on = value === k; return <button key={k} onClick={() => onChange(on && k !== 'all' && items[0][0] === 'all' ? 'all' : k)} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? '#fff' : 'transparent', color: on ? C.ink : C.slate, boxShadow: on ? '0 1px 3px rgba(15,23,42,.15)' : 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{c && <i style={{ width: 8, height: 8, borderRadius: 4, background: c, display: 'inline-block' }} />}{l}</button> })}
</div>
const Dot = ({ o }: { o: Origin }) => <span style={{ width: 17, height: 17, borderRadius: 9, background: ORIGIN[o].color, color: '#fff', fontSize: 9.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{o}</span>
