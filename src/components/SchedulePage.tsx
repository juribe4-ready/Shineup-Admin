import { useCallback, useEffect, useMemo, useState } from 'react'
import { C, Card, Seg, btn, selStyle, todayET, mondayOf, addDays, weekLabel, fmtDow, useIsMobile } from './reports/shared'

const PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9', '#8B5CF6', '#EF4444', '#14B8A6']
type St = 'launched' | 'confirmed' | 'pending'
interface Item { key: string; id: string; date: string; time: string | null; property: string; st: St; cleaners: string[]; cleanerIds: string[]; type: string | null; done: boolean }

const fmtT = (t: string | null) => { if (!t) return ''; const d = new Date(t); if (isNaN(d.getTime())) return String(t); return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) }

async function getJ(url: string) { const r = await fetch(url); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); return j }

export default function SchedulePage() {
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
  const [forWho, setForWho] = useState('all')

  const load = useCallback(async (mon: string) => {
    const sun = addDays(mon, 6)
    const [cal, sum] = await Promise.all([getJ(`/api/getDashboard?action=weekCal&from=${mon}&to=${sun}`), getJ(`/api/getAppointments?action=summary&weekStart=${mon}`)])
    const out: Item[] = []
    for (const c of cal.cleanings || []) if (c.status !== 'Cancelled') out.push({ key: 'c' + c.id, id: c.id, date: c.date, time: c.time, property: c.property, st: 'launched', cleaners: c.cleaners.map((x: any) => x.name.split(' ')[0]), cleanerIds: c.cleaners.map((x: any) => x.id), type: c.type, done: c.status === 'Done' })
    for (const a of sum.appointments || []) {
      if (!a.date || a.relatedCleaning || a.status === 'Scheduled' || a.status === 'Cancelled') continue
      out.push({ key: 'a' + a.id, id: a.id, date: a.date, time: a.time, property: a.propertyName || a.clientName || 'Sin nombre', st: a.status === 'Confirmed' ? 'confirmed' : 'pending', cleaners: [], cleanerIds: [], type: a.cleaningType || null, done: false })
    }
    return { out, raw: { cleanings: (cal.cleanings || []).length, appointments: (sum.appointments || []).length, statuses: [...new Set((sum.appointments || []).map((a: any) => a.status))] } }
  }, [])

  const refresh = useCallback(() => {
    setLoading(true); setErr('')
    load(monday).then(r => { setItems(r.out); setDbg({ semana: [monday, sunday], ...r.raw }) }).catch(e => { setErr(e.message); setDbg({ error: e.message }) }).finally(() => setLoading(false))
    const other = tab === 'this' ? addDays(thisMon, 7) : thisMon
    load(other).then(r => setNextCount({ l: r.out.filter(i => i.st === 'launched').length, c: r.out.filter(i => i.st === 'confirmed').length, p: r.out.filter(i => i.st === 'pending').length })).catch(() => setNextCount(null))
  }, [load, monday, sunday, tab, thisMon])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { getJ('/api/getAppointments?action=defaultStaff').then(j => { const st = j.staff || []; setStaff(st); setSelStaff(st.filter((x: any) => x.defaultAssignment).map((x: any) => x.id)) }).catch(() => {}) }, [])

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const cnt = { l: items.filter(i => i.st === 'launched').length, c: items.filter(i => i.st === 'confirmed').length, p: items.filter(i => i.st === 'pending').length }
  const people = useMemo(() => { const m = new Map<string, string>(); items.forEach(i => i.cleanerIds.forEach((id, k) => m.set(id, i.cleaners[k]))); return [...m.entries()] }, [items])
  const squadKey = (i: Item) => i.cleanerIds.slice().sort().join('+')
  const squadKeys = useMemo(() => [...new Set(items.filter(i => i.st === 'launched' && i.cleanerIds.length).map(squadKey))], [items])
  const color = (i: Item) => i.st !== 'launched' ? '#CBD5E1' : !i.cleanerIds.length ? '#94A3B8' : PALETTE[squadKeys.indexOf(squadKey(i)) % PALETTE.length]
  const perDay = days.map(d => items.filter(i => i.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || '')))
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
    const base: React.CSSProperties = { borderRadius: 8, padding: '5px 7px', marginBottom: 5, fontSize: 11, lineHeight: 1.25, opacity: i.done ? .6 : 1 }
    const st: React.CSSProperties = i.st === 'launched' ? { ...base, background: C.bg, borderLeft: `4px solid ${color(i)}` } : i.st === 'confirmed' ? { ...base, background: C.amberBg, border: `1.5px dashed #F59E0B` } : { ...base, background: '#fff', border: `1.5px dotted ${C.muted}`, color: C.muted }
    return <div key={i.key} style={st}><b style={{ display: 'block', color: i.st === 'pending' ? C.slate : C.ink }}>{i.property}</b><span style={{ color: '#64748B' }}>{[fmtT(i.time), i.cleaners.join(' + ') || (i.st === 'launched' ? 'Sin asignar' : '')].filter(Boolean).join(' · ')}</span></div>
  }
  const confirmedAll = items.filter(i => i.st === 'confirmed')

  return <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
    {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: toast.ok ? C.green : C.red, color: '#fff', padding: '10px 18px', borderRadius: 14, fontWeight: 700, fontSize: 13 }}>{toast.m}</div>}
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Seg items={[['this', 'Esta semana'], ['next', 'Próxima']]} value={tab} onChange={v => setTab(v as any)} />
      <span style={{ fontWeight: 700, fontSize: 14 }}>{weekLabel(monday)}</span>
      <div style={{ marginLeft: 'auto', position: 'relative' }}>
        <button style={{ ...btn(), background: C.primary, color: '#fff', borderColor: C.primary, fontWeight: 700 }} onClick={() => setShareOpen(o => !o)}>📤 Compartir semana ▾</button>
        {shareOpen && <Card style={{ position: 'absolute', right: 0, top: 44, zIndex: 30, width: 260, boxShadow: '0 10px 30px rgba(15,23,42,.15)' }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Para:</div>
          <select value={forWho} onChange={e => setForWho(e.target.value)} style={{ ...selStyle, width: '100%', marginBottom: 10 }}><option value="all">Todo el equipo</option>{people.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          <button style={{ ...btn(), width: '100%', marginBottom: 6 }} onClick={exportPng}>🖼 Imagen PNG (WhatsApp)</button>
          <button style={{ ...btn(), width: '100%' }} onClick={exportPdf}>📄 PDF</button>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Sin dinero. Incluye lanzadas y confirmadas.</div>
        </Card>}
      </div>
    </div>
    <Card style={{ padding: '10px 14px', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
      <span><b style={{ color: C.green }}>{cnt.l}</b> lanzadas</span><span><b style={{ color: C.amber }}>{cnt.c}</b> confirmadas por lanzar</span><span><b style={{ color: C.muted }}>{cnt.p}</b> por confirmar</span>
      {cnt.c > 0 && <button style={{ ...btn(), marginLeft: 'auto', background: C.amberBg, borderColor: '#F59E0B', color: C.amber, fontWeight: 700 }} onClick={() => setLaunch({ ids: confirmedAll.map(i => i.id), label: `las ${confirmedAll.length} confirmadas de la semana` })}>🚀 Lanzar las {cnt.c} confirmadas</button>}
    </Card>
    {err && <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: 10, fontSize: 13 }}>Error: {err}</div>}
    {loading && <div style={{ fontSize: 12, color: C.muted }}>Cargando…</div>}
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
      {days.map((d, k) => { const conf = perDay[k].filter(i => i.st === 'confirmed'); const isT = d === todayET()
        return <div key={d} style={{ background: C.white, border: `1px solid ${isT ? C.primary : C.border}`, boxShadow: isT ? '0 0 0 2px #E0E7FF' : 'none', borderRadius: 12, padding: 8, minHeight: mobile ? 0 : 140 }}>
          <div style={{ textAlign: mobile ? 'left' : 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 6, marginBottom: 6, display: mobile ? 'flex' : 'block', gap: 8, alignItems: 'baseline' }}>
            <b style={{ fontSize: 13 }}>{fmtDow(d)}</b><span style={{ fontSize: 11, color: C.muted }}>{perDay[k].length} limp.</span>
            {conf.length > 0 && <button onClick={() => setLaunch({ ids: conf.map(i => i.id), label: `${conf.length} del ${fmtDow(d)}` })} style={{ display: mobile ? 'inline-block' : 'block', margin: mobile ? '0 0 0 auto' : '4px auto 0', border: '1.5px solid #F59E0B', background: C.amberBg, color: C.amber, borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}>Lanzar {conf.length}</button>}
          </div>
          {perDay[k].map(chip)}{perDay[k].length === 0 && <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: mobile ? 4 : 16 }}>Sin programar</p>}
        </div> })}
    </div>
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: C.slate }}>
      <span><i style={{ display: 'inline-block', width: 14, height: 10, borderLeft: '4px solid #6366F1', background: C.bg, marginRight: 5 }} />Lanzada (color = squad)</span><span><i style={{ display: 'inline-block', width: 14, height: 10, border: '1.5px dashed #F59E0B', background: C.amberBg, marginRight: 5 }} />Confirmada, por lanzar</span><span><i style={{ display: 'inline-block', width: 14, height: 10, border: `1.5px dotted ${C.muted}`, marginRight: 5 }} />Por confirmar</span>
    </div>
    {nextCount && <Card style={{ padding: '10px 14px', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><b>{tab === 'this' ? 'Próxima semana' : 'Esta semana'}:</b> {nextCount.l} lanzadas · {nextCount.c} confirmadas por lanzar · {nextCount.p} por confirmar<button style={{ ...btn(), marginLeft: 'auto' }} onClick={() => setTab(tab === 'this' ? 'next' : 'this')}>Ver ›</button></Card>}
    <button onClick={() => setShowDbg(s => !s)} style={{ alignSelf: 'flex-start', fontSize: 12, color: C.slate, background: 'none', border: 'none', cursor: 'pointer' }}>{showDbg ? '▾' : '▸'} Debug</button>
    {showDbg && <pre style={{ background: C.ink, color: '#E2E8F0', padding: 12, borderRadius: 10, fontSize: 12, overflowX: 'auto' }}>{JSON.stringify(dbg, null, 2)}</pre>}
    {launch && <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ maxWidth: 420, width: '100%' }}>
        <b style={{ fontSize: 16 }}>¿Lanzar {launch.label}?</b>
        <p style={{ fontSize: 13, color: C.slate }}>Se crean <b>{launch.ids.length}</b> limpiezas con estado Scheduled.</p>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', margin: '10px 0 6px' }}>Staff asignado (★ = por defecto)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{staff.map(m => { const on = selStaff.includes(m.id); return <button key={m.id} onClick={() => setSelStaff(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])} style={{ padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${on ? C.primary : C.border}`, background: on ? C.primary : C.bg, color: on ? '#fff' : C.slate, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{m.name.split(' ')[0] || m.initials}{m.defaultAssignment ? ' ★' : ''}</button> })}</div>
        <p style={{ fontSize: 11, color: selStaff.length ? C.muted : C.amber, margin: '6px 0 0' }}>{selStaff.length ? `${selStaff.length} seleccionado(s): ${staff.filter(m => selStaff.includes(m.id)).map(m => m.name.split(' ')[0]).join(', ')}` : '⚠ No hay staff seleccionado'}</p>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', margin: '12px 0 6px' }}>Rating por defecto (condición esperada)</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>{([[3, '😊 Bueno', '#047857'], [2, '😐 Normal', '#B45309'], [1, '😟 Malo', '#B91C1C']] as [number, string, string][]).map(([v, l, c]) => <button key={v} onClick={() => setRating(v)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1.5px solid ${rating === v ? 'transparent' : C.border}`, background: rating === v ? c : C.bg, color: rating === v ? '#fff' : C.slate, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{l}</button>)}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button style={btn()} onClick={() => setLaunch(null)}>Cancelar</button><button disabled={launching} style={{ ...btn(), background: C.primary, color: '#fff', borderColor: C.primary, fontWeight: 700 }} onClick={doLaunch}>{launching ? 'Lanzando…' : 'Lanzar'}</button></div>
      </Card></div>}
  </div>
}
