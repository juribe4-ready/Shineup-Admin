import { useMemo, useState } from 'react'
import { C, Card, Seg, Err, Loading, btn, money, pctS, todayET, addDays, fmtShort, useApi, useIsMobile } from './shared'
import HistoryView, { Nav, presetRange } from './HistoryView'
const norm = (x: string) => (x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

type Sort = 'margen' | 'mgPct' | 'limpiezas' | 'ingreso' | 'stale'
const SORTS: [Sort, string][] = [['margen', 'Margen $'], ['mgPct', 'Margen %'], ['limpiezas', 'Limpiezas'], ['ingreso', 'Ingreso'], ['stale', 'Más tiempo sin limpiar']]

export default function RankTab({ entity, onDebug, nav, clearNav }: { entity: 'property' | 'client'; onDebug: (d: any) => void; nav?: Nav | null; clearNav?: () => void }) {
  const mobile = useIsMobile()
  const isHouse = entity === 'property'
  const [days, setDays] = useState('30')
  const [sort, setSort] = useState<Sort>('margen')
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Nav | null>(null)
  const open = (name: string) => setSel({ ...presetRange('all'), ...(isHouse ? { property: name } : { client: name }) })
  const [nonce, setNonce] = useState(0)
  const to = addDays(todayET(), -1), from = addDays(to, -(Number(days) - 1))
  const rank = useApi('rank', { entity, from, to, fresh: nonce || undefined }, [entity, from, to, nonce], onDebug)
  const list = useApi(isHouse ? 'houses' : null, {}, [isHouse], onDebug)

  const rows: any[] = useMemo(() => {
    const r = [...(rank.data?.rows || [])]
    if (sort === 'stale') return r.filter(x => x.last).sort((a, b) => (b.ago ?? 0) - (a.ago ?? 0))
    return r.filter(x => x.limpiezas > 0).sort((a, b) => ((b[sort] ?? -1e9) - (a[sort] ?? -1e9)))
  }, [rank.data, sort])
  const options: { name: string; client: string; last: string | null }[] = useMemo(() => {
    if (isHouse) return list.data?.houses || []
    return (rank.data?.rows || []).map((r: any) => ({ name: r.name, client: '', last: r.last }))
  }, [isHouse, list.data, rank.data])
  const hits = useMemo(() => { const toks = norm(q).split(/\s+/).filter(Boolean); if (!toks.length) return []; return options.filter(o => { const h = norm(o.name + ' ' + (o.client || '')); return toks.every(t => h.includes(t)) }).slice(0, 8) }, [q, options])
  const ago = (d: string | null) => d ? Math.round((new Date(todayET() + 'T12:00:00Z').getTime() - new Date(d + 'T12:00:00Z').getTime()) / 86400000) : null

  const active = nav || sel
  if (active) return <HistoryView key={JSON.stringify(active)} init={active} onDebug={onDebug} backLabel={nav ? 'Margen' : isHouse ? 'Casas' : 'Clientes'} onBack={() => { if (nav) clearNav?.(); else setSel(null) }} />

  const shown = rows.slice(0, page * 10)
  const maxM = Math.max(1, ...rows.map(r => r.margen || 0))
  return <div>
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={isHouse ? '🔍 Busca una casa por nombre o cliente…' : '🔍 Busca un cliente…'}
        style={{ width: '100%', height: 48, borderRadius: 12, border: `1.5px solid ${q ? C.primary : C.border}`, padding: '0 14px', fontSize: 15, boxSizing: 'border-box', boxShadow: q ? '0 0 0 3px #E0E7FF' : 'none', outline: 'none' }} />
      {q.trim() && <Card style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 54, padding: 4, boxShadow: '0 10px 30px rgba(15,23,42,.12)' }}>
        {hits.length === 0 && <div style={{ padding: 12, fontSize: 13, color: C.muted }}>Sin resultados{isHouse && list.loading ? ' (cargando lista…)' : ''}</div>}
        {hits.map(h => <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}><b style={{ fontSize: 14 }}>{h.name}</b><div style={{ fontSize: 11, color: C.muted }}>{[h.client, h.last ? `última: ${fmtShort(h.last)} · hace ${ago(h.last)} d` : 'sin limpiezas terminadas'].filter(Boolean).join(' · ')}</div></div>
          <button onClick={() => open(h.name)} style={{ ...btn(), background: C.primary, color: '#fff', borderColor: C.primary, fontWeight: 700, height: 34 }}>🕘 Ver historial ›</button>
        </div>)}
      </Card>}
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
      <Seg items={[['30', '30 días'], ['90', '90 días']]} value={days} onChange={v => { setDays(v); setPage(1) }} />
      <span style={{ fontSize: 12, color: C.muted }}>Ordenar:</span>
      {SORTS.map(([k, t]) => <button key={k} style={btn(sort === k)} onClick={() => { setSort(k); setPage(1) }}>{t}</button>)}
      <button style={{ ...btn(), marginLeft: 'auto' }} onClick={() => setSel({ ...presetRange('90') })}>📋 Ver todas las limpiezas</button>
      <button style={btn()} onClick={() => setNonce(n => n + 1)} title="Vuelve a calcular">⟳ Actualizar</button>
    </div>
    <Err msg={rank.err} /><Loading on={rank.loading} />
    {rank.data && <Card>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}><b style={{ fontSize: 14 }}>Ranking de {isHouse ? 'casas' : 'clientes'} · últimos {days} días</b><span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>rojo = margen bajo 50% · costo estimado por horas limpiando</span></div>
      {mobile ? <div>{shown.map((r, i) => <div key={r.name} onClick={() => open(r.name)} style={{ padding: '10px 0', borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span style={{ color: C.muted, fontWeight: 700, width: 20 }}>{i + 1}</span><b style={{ color: C.primaryDark, flex: 1 }}>{r.name}</b><b style={{ color: C.green }}>{money(r.margen)}</b></div>
        <div style={{ fontSize: 11.5, color: C.muted, marginLeft: 28 }}>{[r.client, `${r.limpiezas} limp.`, `${pctS(r.mgPct)} margen`, r.last ? `última hace ${r.ago} d` : ''].filter(Boolean).join(' · ')}</div></div>)}</div>
        : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['#', isHouse ? 'Casa' : 'Cliente', 'Última limpieza', 'Limp.', 'Cobrado', 'Margen', 'Mg %', ''].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 10, color: C.muted, padding: 8, background: C.bg, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>)}</tr></thead>
          <tbody>{shown.map((r, i) => { const low = (r.mgPct ?? 100) < 50; return <tr key={r.name} style={{ borderTop: '1px solid #F1F5F9' }}>
            <td style={{ padding: 8, color: C.muted, fontWeight: 700, width: 34 }}>{i + 1}</td>
            <td style={{ padding: 8 }}><b style={{ color: C.primaryDark }}>{r.name}</b>{isHouse && r.client && <span style={{ color: C.muted }}> · {r.client}</span>}</td>
            <td style={{ padding: 8 }}>{r.last ? fmtShort(r.last) : '—'} <span style={{ color: C.muted }}>{r.last ? `· hace ${r.ago} d` : ''}</span></td>
            <td style={{ padding: 8 }}>{r.limpiezas}</td><td style={{ padding: 8 }}>{money(r.ingreso)}</td>
            <td style={{ padding: 8, minWidth: 200 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, height: 6, borderRadius: 6, background: '#EEF2F7', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${Math.max(2, Math.min(100, (r.margen || 0) / maxM * 100))}%`, background: low ? '#EF4444' : C.bar }} /></div><b style={{ color: C.green }}>{money(r.margen)}</b></div></td>
            <td style={{ padding: 8 }}><span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: low ? C.redBg : C.greenBg, color: low ? C.red : C.green }}>{pctS(r.mgPct)}</span></td>
            <td style={{ padding: 8, whiteSpace: 'nowrap' }}><button onClick={() => open(r.name)} style={{ background: 'none', border: 'none', color: C.primary, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Ver historial ›</button></td></tr> })}</tbody></table></div>}
      {rows.length === 0 && <div style={{ padding: 16, fontSize: 13, color: C.muted }}>Sin limpiezas terminadas en este periodo ({(rank.data?.rows || []).length} {isHouse ? 'casas' : 'clientes'} leídos en total). Prueba con 90 días.</div>}
      {shown.length < rows.length && <button onClick={() => setPage(p => p + 1)} style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', color: C.primary, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Ver las siguientes 10 ›</button>}
    </Card>}
  </div>
}

