import { useEffect, useMemo, useState } from 'react'
import { squadTravel, fmtMin, TCl } from './travel'

const C = { ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF', green: '#047857', red: '#B91C1C', amber: '#B45309', primary: '#6366F1' }
const hm = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })

export default function SquadTimeline({ date }: { date: string }) {
  const [cleanings, setCleanings] = useState<TCl[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  useEffect(() => {
    let alive = true; setLoading(true)
    const load = () => fetch(`/api/getDashboard?date=${date}`).then(r => r.ok ? r.json() : null).then(j => { if (alive && j) setCleanings(j.cleanings || []) }).catch(() => {}).finally(() => alive && setLoading(false))
    load(); const iv = setInterval(load, 120000)
    return () => { alive = false; clearInterval(iv) }
  }, [date])

  const rows = useMemo(() => squadTravel(cleanings, now), [cleanings, now])
  const range = useMemo(() => {
    if (!rows.length) return null
    const s = Math.min(...rows.map(r => r.segs[0].s)), e = Math.max(...rows.map(r => r.segs[r.segs.length - 1].e))
    const pad = 20 * 60000; return { s: s - pad, e: Math.max(e + pad, s + 3 * 3600000) }
  }, [rows])
  const trips = rows.flatMap(r => r.trips)
  const travel = rows.reduce((t, r) => t + r.travelMs, 0), clean = rows.reduce((t, r) => t + r.cleanMs, 0)
  const avg = trips.length ? travel / trips.length : 0
  const pct = clean + travel > 0 ? Math.round(travel / (clean + travel) * 100) : 0
  const col = { clean: C.primary, travel: '#F59E0B' }
  const box: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }
  const Tile = ({ l, v, s, c }: { l: string; v: string; s?: string; c?: string }) => <div style={{ ...box, padding: '10px 14px' }}><p style={{ fontSize: 12, color: '#64748B' }}>{l}</p><p style={{ fontSize: 22, fontWeight: 700, color: c || C.ink, letterSpacing: '-0.02em' }}>{loading ? '…' : v}</p>{s && <p style={{ fontSize: 11, color: C.muted }}>{s}</p>}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Tile l="Traslado promedio" v={trips.length ? fmtMin(avg) : '—'} s={`entre casas · meta V/TO ~5 min`} c={avg > 15 * 60000 ? C.red : avg > 8 * 60000 ? C.amber : C.green} />
        <Tile l="Tiempo en traslados" v={trips.length ? `${pct}%` : '—'} s="de limpiando + traslado" c={pct > 20 ? C.amber : C.ink} />
        <Tile l="Traslados hoy" v={String(trips.length)} s={fmtMin(travel) + ' en total'} />
      </div>
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>Línea de tiempo por squad</b>
          <span style={{ fontSize: 11, color: C.muted }}><span style={{ color: col.clean }}>●</span> limpiando · <span style={{ color: col.travel }}>●</span> traslado (fin de una casa → inicio de la siguiente)</span>
        </div>
        {loading && !rows.length && <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p>}
        {!loading && !rows.length && <p style={{ fontSize: 13, color: C.muted }}>Aún no hay limpiezas iniciadas con cleaners asignados.</p>}
        {range && (
          <>
            {rows.map(r => {
              const span = range.e - range.s
              return (
                <div key={r.key} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <b style={{ fontSize: 13 }}>{r.label}</b>
                    <span style={{ fontSize: 11, color: C.muted }}>{r.trips.length ? `${r.trips.length} traslado${r.trips.length > 1 ? 's' : ''} · ${fmtMin(r.travelMs)}` : 'sin traslados aún'} · {fmtMin(r.cleanMs)} limpiando</span>
                  </div>
                  <div style={{ position: 'relative', height: 26, borderRadius: 8, background: '#EEF2F7', overflow: 'hidden' }}>
                    {r.segs.map((g, i) => (
                      <div key={i} title={`${g.kind === 'clean' ? g.label : 'Traslado'} · ${hm(g.s)}–${hm(g.e)} (${fmtMin(g.e - g.s)})`}
                        style={{ position: 'absolute', left: `${(g.s - range.s) / span * 100}%`, width: `${Math.max(0.6, (g.e - g.s) / span * 100)}%`, top: 0, bottom: 0, background: col[g.kind], opacity: g.open ? .75 : 1, color: g.kind === 'clean' ? '#fff' : '#7C2D12', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {g.kind === 'clean' ? g.label : fmtMin(g.e - g.s)}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted }}><span>{hm(range.s)}</span><span>{hm((range.s + range.e) / 2)}</span><span>{hm(range.e)}</span></div>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse' }}>
                <thead><tr>{['Squad', 'Traslados', 'Total', 'Promedio', 'Más largo'].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 10, color: C.muted, padding: 8, background: C.bg, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>)}</tr></thead>
                <tbody>{rows.map(r => { const a = r.trips.length ? r.travelMs / r.trips.length : 0; const mx = r.trips.slice().sort((x, y) => y.ms - x.ms)[0]
                  return <tr key={r.key}><td style={{ padding: 8, borderTop: '1px solid #F1F5F9', fontSize: 12.5 }}>{r.label}</td><td style={{ padding: 8, borderTop: '1px solid #F1F5F9', fontSize: 12.5 }}>{r.trips.length}</td><td style={{ padding: 8, borderTop: '1px solid #F1F5F9', fontSize: 12.5 }}>{fmtMin(r.travelMs)}</td>
                    <td style={{ padding: 8, borderTop: '1px solid #F1F5F9', fontSize: 12.5, color: a > 15 * 60000 ? C.red : a > 8 * 60000 ? C.amber : C.green }}>{r.trips.length ? fmtMin(a) : '—'}</td>
                    <td style={{ padding: 8, borderTop: '1px solid #F1F5F9', fontSize: 12.5 }}>{mx ? `${fmtMin(mx.ms)} · ${mx.from} → ${mx.to}` : '—'}</td></tr> })}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
