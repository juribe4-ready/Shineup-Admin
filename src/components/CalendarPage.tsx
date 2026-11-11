import { useEffect, useMemo, useState } from 'react'

const C = { ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF', primary: '#6366F1', green: '#047857', amber: '#B45309' }
const PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9', '#8B5CF6', '#EF4444', '#14B8A6']
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
const iso = (d: Date) => d.toLocaleDateString('en-CA')
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const mondayOf = (d: string) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x) }
const addDays = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x) }
const isoWeek = (d: string) => { const x = new Date(d + 'T12:00:00Z'); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day + 3); const y = x.getUTCFullYear(); const j = new Date(Date.UTC(y, 0, 4)); return 1 + Math.round(((x.getTime() - j.getTime()) / 86400000 - 3 + ((j.getUTCDay() + 6) % 7)) / 7) }
const fmtT = (t: string | null) => t ? new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '—'

interface Cl { id: string; date: string; property: string; time: string | null; status: string; price: number; type: string | null; cleaners: { id: string; name: string }[] }

export default function CalendarPage() {
  const [monday, setMonday] = useState(mondayOf(today()))
  const [data, setData] = useState<Cl[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [squadF, setSquadF] = useState('all')
  const [typeF, setTypeF] = useState('all')
  const [showDebug, setShowDebug] = useState(false)
  const sunday = addDays(monday, 6)

  useEffect(() => {
    let alive = true; setLoading(true); setErr('')
    fetch(`/api/getDashboard?action=weekCal&from=${monday}&to=${sunday}`).then(async r => {
      const j = await r.json(); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); if (alive) setData(j.cleanings || [])
    }).catch(e => alive && setErr(e.message)).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [monday])

  const squadKey = (c: Cl) => c.cleaners.map(x => x.id).sort().join('+') || 'none'
  const squadLabel = (c: Cl) => c.cleaners.map(x => x.name.split(' ')[0]).join(' + ') || 'Sin asignar'
  const squads = useMemo(() => { const m = new Map<string, string>(); for (const c of data) m.set(squadKey(c), squadLabel(c)); return [...m.entries()] }, [data])
  const colorOf = (k: string) => k === 'none' ? '#CBD5E1' : PALETTE[Math.max(0, squads.findIndex(s => s[0] === k)) % PALETTE.length]
  const types = useMemo(() => [...new Set(data.map(c => c.type).filter(Boolean))].sort() as string[], [data])
  const list = data.filter(c => c.status !== 'Cancelled' && (squadF === 'all' || squadKey(c) === squadF) && (typeF === 'all' || c.type === typeF))
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const perDay = days.map(d => list.filter(c => c.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || '')))
  const total = list.reduce((t, c) => t + c.price, 0)
  const avg = list.length / 6
  const sparse = days.filter((_, i) => i < 6 && perDay[i].length < Math.max(1, avg / 2)).length
  const sel: React.CSSProperties = { height: 38, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, background: C.white }
  const nav: React.CSSProperties = { ...sel, cursor: 'pointer', fontWeight: 600 }
  const Tile = ({ l, v, c }: { l: string; v: string; c?: string }) => <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}><p style={{ fontSize: 12, color: '#64748B' }}>{l}</p><p style={{ fontSize: 24, fontWeight: 700, color: c || C.ink, letterSpacing: '-0.02em' }}>{loading ? '…' : v}</p></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setMonday(addDays(monday, -7))} style={nav}>‹</button>
        <div style={{ ...sel, display: 'flex', alignItems: 'center', fontWeight: 700 }}>W{isoWeek(monday)} · {new Date(monday + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – {new Date(sunday + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</div>
        <button onClick={() => setMonday(addDays(monday, 7))} style={nav}>›</button>
        <button onClick={() => setMonday(mondayOf(today()))} style={nav}>Hoy</button>
        <select value={squadF} onChange={e => setSquadF(e.target.value)} style={{ ...sel, marginLeft: 'auto' }}><option value="all">Squad: todos</option>{squads.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={typeF} onChange={e => setTypeF(e.target.value)} style={sel}><option value="all">Servicio: todos</option>{types.map(t => <option key={t} value={t}>{t}</option>)}</select>
      </div>
      {err && <p style={{ color: '#B91C1C', fontSize: 13 }}>Error: {err}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Tile l="Limpiezas" v={String(list.length)} />
        <Tile l="Ingreso programado" v={money(total)} c={C.green} />
        <Tile l="Squads en la semana" v={String(squads.filter(s => s[0] !== 'none').length)} />
        <Tile l="Días con pocas limpiezas" v={String(sparse)} c={sparse ? C.amber : C.ink} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {days.map((d, i) => {
          const isT = d === today(); const rev = perDay[i].reduce((t, c) => t + c.price, 0)
          const thin = i < 6 && perDay[i].length < Math.max(1, avg / 2)
          return (
            <div key={d} style={{ background: thin ? '#FFFBEB' : C.white, border: `1px solid ${isT ? C.primary : thin ? '#FDE68A' : C.border}`, boxShadow: isT ? '0 0 0 2px #E0E7FF' : 'none', borderRadius: 12, padding: 8, minHeight: 120 }}>
              <div style={{ textAlign: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 6, marginBottom: 6 }}>
                <b style={{ fontSize: 13 }}>{new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</b>
                <p style={{ fontSize: 11, color: C.muted }}>{perDay[i].length} limp. · {money(rev)}</p>
              </div>
              {perDay[i].map(c => (
                <div key={c.id} style={{ borderLeft: `4px solid ${colorOf(squadKey(c))}`, borderRadius: 8, background: C.bg, padding: '5px 7px', marginBottom: 5, fontSize: 11, lineHeight: 1.25, opacity: c.status === 'Done' ? .65 : 1 }}>
                  <b style={{ display: 'block', color: C.ink }}>{c.property}</b>
                  <span style={{ color: '#64748B' }}>{fmtT(c.time)} · {squadLabel(c)}</span>
                </div>
              ))}
              {perDay[i].length === 0 && <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 16 }}>Sin programar</p>}
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 11, color: C.muted }}>Color = squad (los cleaners que comparten la limpieza). Las terminadas se ven más tenues. La asignación de squads se hace en Pre-dispatch.</p>
      <button onClick={() => setShowDebug(v => !v)} style={{ alignSelf: 'flex-start', fontSize: 12, color: C.slate, background: 'none', border: 'none', cursor: 'pointer' }}>{showDebug ? '▾' : '▸'} Debug</button>
      {showDebug && <pre style={{ background: C.ink, color: '#E2E8F0', padding: 12, borderRadius: 10, fontSize: 12, overflowX: 'auto' }}>{JSON.stringify({ rango: [monday, sunday], leidas: data.length, mostradas: list.length, sinAsignar: data.filter(c => c.cleaners.length === 0).length, squads: squads.map(s => s[1]) }, null, 2)}</pre>}
    </div>
  )
}
