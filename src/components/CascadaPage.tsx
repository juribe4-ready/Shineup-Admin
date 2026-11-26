import { useEffect, useMemo, useState } from 'react'
import { C, Card, Seg, Err, Loading, useIsMobile, todayET, weekLabel } from './reports/shared'
import { SEGS, weekM, avgM, sel, decomp, curve, CAP_H, type WeekRaw, type SegKey, type WeekM } from './cascadeMath'

type Mode = SegKey | 'Todos'
type Cmp = 'prev' | 'avg4' | 'best'
const CMP: Record<Cmp, string> = { prev: 'la semana pasada', avg4: 'el promedio de 4 semanas', best: 'tu mejor semana' }
const GREEN = '#047857', RED = '#B91C1C'
const f2 = (n: number | null | undefined) => n === null || n === undefined ? '—' : n.toFixed(2)
const usd = (n: number | null | undefined, d = 2) => n === null || n === undefined ? '—' : '$' + n.toFixed(d)
const pc = (n: number | null | undefined) => n === null || n === undefined ? '—' : Math.round(n * 100) + '%'
const sg = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2)
const k$ = (n: number) => '$' + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n))

export default function CascadaPage() {
  const mobile = useIsMobile()
  const [raw, setRaw] = useState<any>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode>('STR')
  const [cmp, setCmp] = useState<Cmp>('prev')
  const [showDbg, setShowDbg] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/getDashboard?action=cascadeData&weeks=14').then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); setRaw(j) }).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [])

  const segs: SegKey[] = mode === 'Todos' ? SEGS : [mode]
  const m = useMemo(() => {
    if (!raw) return null
    const weeks: WeekRaw[] = raw.weeks
    const done = weeks.filter(w => !w.cur && !w.future)
    const curW = weeks.find(w => w.cur)
    const useCur = !!curW && curW.elapsed >= 1
    const B: WeekRaw | undefined = useCur ? curW : done[done.length - 1]
    const base = done.filter(w => w.mon < (B?.mon || ''))
    if (!B || !base.length) return { empty: true as const }
    const prev = base[base.length - 1], last4 = base.slice(-4)
    const Rof = (w: WeekRaw) => sel(weekM(w), segs).R || 0
    const best = base.reduce((a, b) => Rof(b) > Rof(a) ? b : a, base[0])
    const mB = weekM(B)
    const mA: WeekM = cmp === 'prev' ? weekM(prev) : cmp === 'avg4' ? avgM(last4.map(weekM)) : weekM(best)
    const mAvg = avgM(last4.map(weekM))
    const todayIdx = useCur ? Math.max(0, Math.round((new Date(todayET() + 'T12:00:00Z').getTime() - new Date(B.mon + 'T12:00:00Z').getTime()) / 86400000)) : null
    const cB = curve(B, segs, todayIdx)
    const curveOf = (w: WeekRaw) => curve(w, segs, null).cum
    const cPrev = curveOf(prev)
    const cAvg = [0, 1, 2, 3, 4, 5, 6].map(d => last4.reduce((t, w) => t + curveOf(w)[d], 0) / last4.length)
    const cBest = curveOf(best)
    const baseCum = cmp === 'prev' ? cPrev : cmp === 'avg4' ? cAvg : cBest
    const d = decomp(mA, mB, segs)
    // historial: cada semana cerrada (y la actual) contra la anterior
    const seq = [...done.slice(-8), ...(useCur ? [B] : [])]
    const hist = seq.map((w, i) => { const pw = i > 0 ? seq[i - 1] : done[done.length - 9] || null; const dd = pw ? decomp(weekM(pw), weekM(w), segs) : null; return { w, R: sel(weekM(w), segs).R, d: dd, partial: w.cur } })
    return { empty: false as const, B, prev, best, mA, mB, mAvg, d, cB, baseCum, cPrev, cAvg, cBest, hist, todayIdx, useCur, baseClose: baseCum[6] }
  }, [raw, mode, cmp]) // eslint-disable-line

  if (err) return <Err msg={err} />
  if (loading || !raw) return <Loading on />
  if (!m || m.empty) return <Card>Aún no hay semanas cerradas suficientes para comparar.</Card>

  const { B, d, cB, baseCum, mA, mB, mAvg } = m
  const A = sel(mA, segs), Bs = sel(mB, segs), V = sel(mAvg, segs)
  const close = cB.closeAt, pct = m.baseClose > 0 ? (close - m.baseClose) / m.baseClose * 100 : null
  const modeName = mode === 'Todos' ? 'El negocio' : mode
  const closing = !!B.cur
  const headline = pct === null ? `${modeName}: sin datos para comparar` : `${modeName} ${closing ? 'va a cerrar' : 'cerró'} la semana en ${k$(close)}, ${Math.abs(pct).toFixed(1)}% ${pct < 0 ? 'abajo' : 'arriba'} de ${CMP[cmp]}`
  const labelA = cmp === 'prev' ? 'Semana pasada' : cmp === 'avg4' ? 'Prom. 4 sem.' : 'Mejor semana'
  const labelB = closing ? 'Esta semana (a hoy)' : 'Última semana'

  // ── Capítulo 1: curva ──
  const W = 640, H = 210, pad = { l: 40, r: 10, t: 12, b: 24 }
  const maxY = Math.max(1, ...cB.cum, ...baseCum, ...m.cPrev, ...m.cAvg) * 1.08
  const X = (i: number) => pad.l + i * (W - pad.l - pad.r) / 6, Y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / maxY)
  const line = (a: number[], upto = 6, from = 0) => a.slice(from, upto + 1).map((v, i) => `${i + from === from ? 'M' : 'L'}${X(i + from).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const ti = m.todayIdx
  const DN = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  // ── Capítulo 2: cascada + matriz ──
  const eff = d?.effects || []
  const cols = [{ k: 'start', label: labelA }, ...eff.map(e => ({ k: e.key, label: e.label })), { k: 'end', label: labelB }]
  const N = cols.length
  const levels: number[] = []; if (d) { let acc = d.Ra; levels.push(acc); eff.forEach(e => { acc += e.val; levels.push(acc) }) }
  const lo0 = d ? Math.min(...levels, d.Rb) : 0, hi0 = d ? Math.max(...levels, d.Rb) : 1, padv = Math.max(0.5, (hi0 - lo0) * .35)
  const lo = lo0 - padv, hi = hi0 + padv
  const pos = (v: number) => (v - lo) / (hi - lo) * 100
  const gridCols = mobile ? '1fr' : `150px repeat(${N}, minmax(0,1fr)) 92px`
  const pill = (txt: string, good: boolean | null) => <span style={{ display: 'inline-block', background: good === null ? '#F1F5F9' : good ? '#DCFCE7' : C.redBg, color: good === null ? C.slate : good ? GREEN : RED, borderRadius: 999, padding: '2px 9px', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>{txt}</span>
  const effOf = (k: string) => eff.find(e => e.key === k)
  type Row = { label: string; sub?: boolean; fk?: string; a: string; b: string; v: string }
  const rows: Row[] = []
  const typeRows = (fn: (k: SegKey) => Row) => SEGS.forEach(k => rows.push(fn(k)))
  const secRow = (label: string, fk: string, a: string, b: string, v: string) => rows.push({ label, fk, a, b, v })
  const subRow = (label: string, a: string, b: string, v: string) => rows.push({ label, sub: true, a, b, v })
  secRow('Carga · cuánto de la capacidad se factura', 'carga', pc(A.c), pc(Bs.c), pc(V.c))
  subRow('HH facturadas', f2(A.hh), f2(Bs.hh), f2(V.hh)); subRow('Cleaners activos', String(Math.round(mA.cleaners * 10) / 10), String(mB.cleaners), String(Math.round(mAvg.cleaners * 10) / 10))
  subRow(`HH disponibles (cleaners × ${CAP_H})`, f2(A.cap), f2(Bs.cap), f2(V.cap)); subRow('Limpiezas medidas', String(Math.round(A.n * 10) / 10), String(Math.round(Bs.n)), String(Math.round(V.n * 10) / 10))
  if (mode === 'Todos') {
    const sh = (w: WeekM, k: SegKey) => { const tot = SEGS.reduce((t, x) => t + w.byType[x].hh, 0); return tot > 0 ? w.byType[k].hh / tot : null }
    secRow('Mezcla · peso de cada tipo (en HH)', 'mezcla', pc(sh(mA, 'STR')), pc(sh(mB, 'STR')), pc(sh(mAvg, 'STR')))
    typeRows(k => ({ label: `Peso ${k}`, sub: true, a: pc(sh(mA, k)), b: pc(sh(mB, k)), v: pc(sh(mAvg, k)) }))
  }
  secRow(mode === 'Todos' ? 'Precio · $ por HH estándar (dentro de cada tipo)' : 'Precio · $ por HH estándar', 'precio', usd(A.p), usd(Bs.p), usd(V.p))
  if (mode === 'Todos') typeRows(k => { const g = (w: WeekM) => { const x = w.byType[k]; return x.std > 0 ? x.rev / x.std : null }; return { label: `Precio ${k}`, sub: true, a: usd(g(mA)), b: usd(g(mB)), v: usd(g(mAvg)) } })
  else { subRow('Ingreso', usd(A.rev, 0), usd(Bs.rev, 0), usd(V.rev, 0)); subRow('HH estándar (Labor)', f2(A.std), f2(Bs.std), f2(V.std)); subRow('Ingreso por limpieza', usd(A.n ? A.rev / A.n : null, 0), usd(Bs.n ? Bs.rev / Bs.n : null, 0), usd(V.n ? V.rev / V.n : null, 0)) }
  secRow(mode === 'Todos' ? 'Ritmo · HH reales ÷ estándar (dentro de cada tipo)' : 'Ritmo · HH reales ÷ HH estándar', 'ritmo', pc(A.r), pc(Bs.r), pc(V.r))
  if (mode === 'Todos') typeRows(k => { const g = (w: WeekM) => { const x = w.byType[k]; return x.std > 0 ? x.hh / x.std : null }; return { label: `Ritmo ${k}`, sub: true, a: pc(g(mA)), b: pc(g(mB)), v: pc(g(mAvg)) } })
  else { subRow('HH reales', f2(A.hh), f2(Bs.hh), f2(V.hh)); subRow('HH estándar', f2(A.std), f2(Bs.std), f2(V.std)); subRow('Real vs estándar por limpieza', A.n ? `${(A.hh / A.n).toFixed(1)} vs ${(A.std / A.n).toFixed(1)} h` : '—', Bs.n ? `${(Bs.hh / Bs.n).toFixed(1)} vs ${(Bs.std / Bs.n).toFixed(1)} h` : '—', V.n ? `${(V.hh / V.n).toFixed(1)} vs ${(V.std / V.n).toFixed(1)} h` : '—') }
  const pillFor = (fk: string, r: Row) => { const e = effOf(fk); return e ? pill(`${r.a} → ${r.b}`, Math.abs(e.val) < 0.005 ? null : e.val > 0) : null }

  const noteBox = (t: string) => <div style={{ fontSize: 11.5, color: C.slate, background: C.bg, borderRadius: 8, padding: '6px 9px', marginTop: 8 }}>{t}</div>

  const dbg = { modo: mode, segmentosUsados: segs, comparacion: cmp, semanaB: B.mon, semanaA: cmp === 'prev' ? m.prev.mon : cmp === 'best' ? m.best.mon : 'promedio 4 previas', capacidadB: mB.cap, capacidadA: mA.cap, A: { ...A }, B: { ...Bs },
    efectos: eff.map(e => ({ [e.key]: +e.val.toFixed(4) })), sumaEfectos: d ? +eff.reduce((t, e) => t + e.val, 0).toFixed(6) : null, deltaRevPAH: d ? +d.dR.toFixed(6) : null, cuadra: d?.ok, nota: d?.note,
    cierreProyectado: Math.round(close), baseCierre: Math.round(m.baseClose), diaHoyIdx: m.todayIdx, tiposDeAirtable: raw.types, lecturaApi: raw.debug }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <Seg items={[['STR', 'STR'], ['Relleno', 'Relleno'], ['Deep', 'Deep'], ['Todos', 'Todos']]} value={mode} onChange={v => setMode(v as Mode)} />
      <Seg items={[['prev', 'Semana pasada'], ['avg4', 'Prom. 4 sem.'], ['best', 'Mejor semana']]} value={cmp} onChange={v => setCmp(v as Cmp)} />
      <span style={{ fontSize: 12, color: C.muted }}>{weekLabel(B.mon)}</span>
    </div>
    <Card style={{ padding: '18px 18px' }}>
      <div style={{ fontSize: mobile ? 20 : 26, fontWeight: 800, color: C.ink, lineHeight: 1.2 }}>{headline}</div>
      {mode !== 'Todos' && <div style={{ fontSize: 12.5, color: C.slate, marginTop: 6 }}>{mode === 'STR' ? 'Tu negocio principal.' : mode === 'Relleno' ? 'Horas de relleno (residencial / standard fuera de ventana).' : 'Deep cleaning va aparte: su precio y su ritmo no se mezclan con STR.'} La proyección suma lo ya terminado más lo programado que falta.</div>}
    </Card>

    <Card>
      <div style={{ fontWeight: 800, fontSize: 15 }}>1 · ¿Cómo vamos?</div>
      <div style={{ fontSize: 12, color: C.slate, margin: '2px 0 6px' }}>Ingreso acumulado por día · esta semana (real + proyección) contra {CMP[cmp]}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {[0, .25, .5, .75, 1].map(f => <g key={f}><line x1={pad.l} x2={W - pad.r} y1={Y(maxY / 1.08 * f)} y2={Y(maxY / 1.08 * f)} stroke="#EEF2F7" /><text x={pad.l - 5} y={Y(maxY / 1.08 * f) + 3} fontSize="9.5" fill="#94A3B8" textAnchor="end">{k$(maxY / 1.08 * f)}</text></g>)}
        {DN.map((l, i) => <text key={i} x={X(i)} y={H - 7} fontSize="10" fill="#64748B" textAnchor="middle">{l}</text>)}
        <path d={line(baseCum)} fill="none" stroke="#94A3B8" strokeWidth="2" />
        {cmp !== 'prev' && <path d={line(m.cPrev)} fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="2 3" />}
        {ti !== null && ti > 0 ? <><path d={line(cB.cum, ti - 1)} fill="none" stroke="#4F46E5" strokeWidth="3" /><path d={line(cB.cum, 6, ti - 1)} fill="none" stroke="#4F46E5" strokeWidth="3" strokeDasharray="6 4" /></> : <path d={line(cB.cum)} fill="none" stroke="#4F46E5" strokeWidth="3" />}
        <circle cx={X(6)} cy={Y(cB.cum[6])} r="4" fill="#4F46E5" /><text x={X(6) - 6} y={Y(cB.cum[6]) + (baseCum[6] > cB.cum[6] ? 15 : -8)} fontSize="11" fontWeight="700" fill="#4F46E5" textAnchor="end">{k$(cB.cum[6])}</text>
        <circle cx={X(6)} cy={Y(baseCum[6])} r="3" fill="#94A3B8" /><text x={X(6) - 6} y={Y(baseCum[6]) + (baseCum[6] > cB.cum[6] ? -8 : 14)} fontSize="10.5" fill="#64748B" textAnchor="end">{k$(baseCum[6])}</text>
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: C.slate, flexWrap: 'wrap' }}><span><b style={{ color: '#4F46E5' }}>━</b> Esta semana (línea punteada = proyección de lo programado)</span><span><b style={{ color: '#94A3B8' }}>━</b> {CMP[cmp]}</span></div>
    </Card>

    <Card>
      <div style={{ fontWeight: 800, fontSize: 15 }}>2 · ¿Por qué?</div>
      <div style={{ fontSize: 12, color: C.slate, margin: '2px 0 10px' }}>Ingreso por HH disponible: <b>{usd(A.R)}</b> → <b>{usd(Bs.R)}</b> {d && <>({sg(d.dR)}). </>}Cada barra es un factor; los números de abajo son los que la explican.</div>
      {!d ? <div style={{ fontSize: 13, color: C.slate }}>No hay datos medibles suficientes en una de las dos semanas (se necesitan limpiezas terminadas con duración y Labor estándar).</div> : <>
        {!mobile && <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'end' }}>
          <div />
          {cols.map((c, i) => { const isEnd = c.k === 'start' || c.k === 'end'; const e = effOf(c.k)
            const y0 = isEnd ? lo : Math.min(levels[i - 1], levels[i]), y1 = isEnd ? (c.k === 'start' ? d.Ra : d.Rb) : Math.max(levels[i - 1], levels[i])
            const top = isEnd ? y1 : Math.max(levels[i - 1], levels[i])
            return <div key={c.k} style={{ position: 'relative', height: 190, margin: '0 6px' }}>
              <div style={{ position: 'absolute', left: '12%', right: '12%', bottom: `${isEnd ? 0 : pos(y0)}%`, height: `${isEnd ? pos(y1) : Math.max(1.5, pos(y1) - pos(y0))}%`, background: isEnd ? '#6366F1' : (e!.val >= 0 ? '#10B981' : '#EF4444'), borderRadius: 5 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: `calc(${pos(top)}% + 4px)`, textAlign: 'center', fontSize: 12.5, fontWeight: 800, color: isEnd ? C.ink : e!.val >= 0 ? GREEN : RED }}>{isEnd ? usd(y1) : sg(e!.val)}</div>
            </div> })}
          <div />
        </div>}
        {!mobile && <div style={{ display: 'grid', gridTemplateColumns: gridCols, borderTop: `2px solid ${C.border}`, marginTop: 4 }}>
          <div />{cols.map(c => <div key={c.k} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: C.slate, padding: '5px 2px' }}>{c.label}</div>)}<div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: C.muted, padding: '5px 2px' }}>Prom. 4 sem.</div>
        </div>}
        {!mobile && rows.map((r, ri) => { const fi = r.fk ? cols.findIndex(c => c.k === r.fk) : -1
          return <div key={ri} style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', borderTop: r.sub ? 'none' : `1px solid ${C.border}`, padding: r.sub ? '1px 0' : '7px 0 2px', background: r.sub ? '#FAFBFD' : 'transparent' }}>
            <div style={{ fontSize: r.sub ? 11.5 : 12.5, fontWeight: r.sub ? 500 : 800, color: r.sub ? C.slate : C.ink, paddingLeft: r.sub ? 12 : 0 }}>{r.label}</div>
            {cols.map((c, ci) => <div key={c.k} style={{ textAlign: 'center', fontSize: r.sub ? 11.5 : 13, fontWeight: r.sub ? 500 : 800, color: r.sub ? C.slate : C.ink }}>
              {ci === 0 ? r.a : ci === N - 1 ? r.b : (ci === fi ? pillFor(r.fk!, r) : '')}</div>)}
            <div style={{ textAlign: 'center', fontSize: r.sub ? 11.5 : 12.5, color: C.muted, fontWeight: r.sub ? 500 : 700 }}>{r.v}</div>
          </div> })}
        {mobile && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EEF2FF', borderRadius: 10, padding: '8px 10px', fontWeight: 800 }}><span style={{ fontSize: 12.5 }}>Ingreso por HH disponible</span><span>{usd(A.R)} → {usd(Bs.R)}</span></div>
          {rows.filter(r => !r.sub).map(sec => { const idx = rows.indexOf(sec); const kids: Row[] = []; for (let j = idx + 1; j < rows.length && rows[j].sub; j++) kids.push(rows[j]); const e = effOf(sec.fk!)
            return <div key={sec.fk} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}><b style={{ fontSize: 13 }}>{sec.label}</b>{e && pill(sg(e.val), Math.abs(e.val) < 0.005 ? null : e.val > 0)}</div>
              <div style={{ fontSize: 15, fontWeight: 800, margin: '4px 0' }}>{sec.a} → {sec.b} <span style={{ fontSize: 11.5, fontWeight: 600, color: C.muted }}>· prom. {sec.v}</span></div>
              {kids.map((k, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.slate, padding: '2px 0', gap: 8 }}><span>{k.label}</span><span>{k.a} → {k.b} <span style={{ color: C.muted }}>({k.v})</span></span></div>)}
            </div> })}
        </div>}
        {noteBox('Los factores se multiplican: Carga × Precio ÷ Ritmo = ingreso por HH disponible. Las barras suman exacto la diferencia (el eje de la gráfica está recortado, no empieza en 0). Ritmo más bajo = más rápido que el estándar = suma.')}
        {mode === 'Todos' && noteBox('Precio y Ritmo se miden dentro de cada tipo para que un deep cleaning no los contamine; el cambio de mezcla (más o menos deep/relleno) se ve en su propia barra.')}
      </>}
    </Card>

    <Card>
      <div style={{ fontWeight: 800, fontSize: 15 }}>3 · ¿Y en otras semanas?</div>
      <div style={{ fontSize: 12, color: C.slate, margin: '2px 0 8px' }}>Cada semana contra la anterior: cuánto cambió el ingreso por HH disponible y qué factor lo movió.</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 520 }}>
          <thead><tr style={{ color: C.muted, fontSize: 11.5 }}><th style={{ textAlign: 'left', padding: 4 }}>Semana</th><th>$/HH disp.</th><th>Cambio</th><th>Carga</th>{mode === 'Todos' && <th>Mezcla</th>}<th>Precio</th><th>Ritmo</th></tr></thead>
          <tbody>{[...m.hist].reverse().map(h => { const big = h.d ? [...h.d.effects].sort((a, b) => Math.abs(b.val) - Math.abs(a.val))[0].key : ''
            const cell = (k: string) => { const e = h.d?.effects.find(x => x.key === k); return <td style={{ textAlign: 'center', fontWeight: big === k ? 800 : 500, color: !e ? C.muted : Math.abs(e.val) < 0.005 ? C.slate : e.val > 0 ? GREEN : RED, background: big === k ? '#F8FAFC' : 'transparent' }}>{e ? sg(e.val) : '—'}</td> }
            return <tr key={h.w.mon} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ padding: '6px 4px', fontWeight: 700 }}>{weekLabel(h.w.mon).split('·')[0]}{h.partial && <span style={{ color: C.muted, fontWeight: 500 }}> (en curso)</span>}</td><td style={{ textAlign: 'center' }}>{usd(h.R)}</td><td style={{ textAlign: 'center', fontWeight: 800, color: !h.d ? C.muted : h.d.dR >= 0 ? GREEN : RED }}>{h.d ? sg(h.d.dR) : '—'}</td>{cell('carga')}{mode === 'Todos' && cell('mezcla')}{cell('precio')}{cell('ritmo')}</tr> })}</tbody>
        </table>
      </div>
    </Card>

    <button onClick={() => setShowDbg(s => !s)} style={{ alignSelf: 'flex-start', fontSize: 12, color: C.slate, background: 'none', border: 'none', cursor: 'pointer' }}>{showDbg ? '▾' : '▸'} Debug</button>
    {showDbg && <pre style={{ background: C.ink, color: '#E2E8F0', padding: 12, borderRadius: 10, fontSize: 12, overflowX: 'auto' }}>{JSON.stringify(dbg, null, 2)}</pre>}
  </div>
}
