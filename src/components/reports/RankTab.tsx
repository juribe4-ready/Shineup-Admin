import { useMemo, useRef, useState } from 'react'
import { C, Card, Tile, Seg, Delta, Err, Loading, btn, money, money1, pctS, hm, todayET, addDays, fmtShort, useApi, useIsMobile } from './shared'

type Sort = 'margen' | 'mgPct' | 'limpiezas' | 'ingreso' | 'stale'
const SORTS: [Sort, string][] = [['margen', 'Margen $'], ['mgPct', 'Margen %'], ['limpiezas', 'Limpiezas'], ['ingreso', 'Ingreso'], ['stale', 'Más tiempo sin limpiar']]

export default function RankTab({ entity, onDebug }: { entity: 'property' | 'client'; onDebug: (d: any) => void }) {
  const mobile = useIsMobile()
  const isHouse = entity === 'property'
  const [days, setDays] = useState('30')
  const [sort, setSort] = useState<Sort>('margen')
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<{ name: string; view: 'ficha' | 'historial' } | null>(null)
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
  const hits = useMemo(() => { const s = q.trim().toLowerCase(); if (!s) return []; return options.filter(o => o.name.toLowerCase().includes(s) || (o.client || '').toLowerCase().includes(s)).slice(0, 8) }, [q, options])
  const ago = (d: string | null) => d ? Math.round((new Date(todayET() + 'T12:00:00Z').getTime() - new Date(d + 'T12:00:00Z').getTime()) / 86400000) : null

  if (sel) return isHouse ? <HouseView name={sel.name} view={sel.view} onBack={() => setSel(null)} onDebug={onDebug} /> : <ClientView name={sel.name} onBack={() => setSel(null)} onDebug={onDebug} />

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
          <button onClick={() => setSel({ name: h.name, view: 'historial' })} style={{ ...btn(), background: C.primary, color: '#fff', borderColor: C.primary, fontWeight: 700, height: 34 }}>🕘 Historial</button>
          <button onClick={() => setSel({ name: h.name, view: 'ficha' })} style={{ ...btn(), height: 34, color: C.primaryDark, fontWeight: 700 }}>Ficha ›</button>
        </div>)}
      </Card>}
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
      <Seg items={[['30', '30 días'], ['90', '90 días']]} value={days} onChange={v => { setDays(v); setPage(1) }} />
      <span style={{ fontSize: 12, color: C.muted }}>Ordenar:</span>
      {SORTS.map(([k, t]) => <button key={k} style={btn(sort === k)} onClick={() => { setSort(k); setPage(1) }}>{t}</button>)}
      <button style={{ ...btn(), marginLeft: 'auto' }} onClick={() => setNonce(n => n + 1)} title="Vuelve a calcular">⟳ Actualizar</button>
    </div>
    <Err msg={rank.err} /><Loading on={rank.loading} />
    {rank.data && <Card>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}><b style={{ fontSize: 14 }}>Ranking de {isHouse ? 'casas' : 'clientes'} · últimos {days} días</b><span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>rojo = margen bajo 50% · costo estimado por horas limpiando</span></div>
      {mobile ? <div>{shown.map((r, i) => <div key={r.name} onClick={() => setSel({ name: r.name, view: 'historial' })} style={{ padding: '10px 0', borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}>
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
            <td style={{ padding: 8, whiteSpace: 'nowrap' }}><button onClick={() => setSel({ name: r.name, view: 'historial' })} style={{ background: 'none', border: 'none', color: C.primary, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Ver historial ›</button></td></tr> })}</tbody></table></div>}
      {rows.length === 0 && <div style={{ padding: 16, fontSize: 13, color: C.muted }}>Sin limpiezas terminadas en este periodo.</div>}
      {shown.length < rows.length && <button onClick={() => setPage(p => p + 1)} style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', color: C.primary, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Ver las siguientes 10 ›</button>}
    </Card>}
  </div>
}

const isVideo = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u)

function Photo({ u, i }: { u: string; i: number }) {
  const [bad, setBad] = useState(false)
  const tile: React.CSSProperties = { height: 84, borderRadius: 9, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#475569', textDecoration: 'none', overflow: 'hidden' }
  if (isVideo(u) || bad) return <a href={u} target="_blank" rel="noreferrer" style={tile}>{isVideo(u) ? '▶ Video' : '📷'} {i + 1}</a>
  return <a href={u} target="_blank" rel="noreferrer" style={tile}><img src={u} alt={`foto ${i + 1}`} loading="lazy" onError={() => setBad(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></a>
}

function HouseView({ name, view: view0, onBack, onDebug }: { name: string; view: 'ficha' | 'historial'; onBack: () => void; onDebug: (d: any) => void }) {
  const mobile = useIsMobile()
  const [view, setView] = useState<'ficha' | 'historial'>(view0)
  const { data, loading, err } = useApi('house', { property: name }, [name], onDebug)
  const [filter, setFilter] = useState<'all' | 'photos' | 'done' | 'sched'>('all')
  const [year, setYear] = useState('')
  const [pg, setPg] = useState(1)
  const [selId, setSelId] = useState<string | null>(null)
  const histRef = useRef<HTMLDivElement>(null)
  const visits: any[] = data?.visits || []
  const years = [...new Set(visits.map(v => v.date.slice(0, 4)))]
  const f = visits.filter(v => (filter === 'all' || (filter === 'photos' && v.photos.length) || (filter === 'done' && v.status === 'Done') || (filter === 'sched' && v.status !== 'Done')) && (!year || v.date.startsWith(year)))
  const per = view === 'ficha' ? 5 : 8
  const pages = Math.max(1, Math.ceil(f.length / per))
  const cur = visits.find(v => v.id === selId) || f[0]
  const s = data?.s90, p = data?.p90
  const today = todayET()
  return <div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
      <button onClick={onBack} style={{ ...btn(), color: C.primaryDark, fontWeight: 700 }}>‹ {view === 'ficha' ? 'Casas' : 'Volver'}</button>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{name}</div>{data?.client && <span style={{ color: C.muted, fontSize: 13 }}>· {data.client}</span>}
      <Seg items={[['historial', 'Historial'], ['ficha', 'Ficha']]} value={view} onChange={v => { setView(v as 'ficha' | 'historial'); setPg(1) }} />
    </div>
    <Err msg={err} /><Loading on={loading} />
    {data && <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <Tile label="Última limpieza" value={data.last ? fmtShort(data.last) : '—'} color={C.green} sub={data.last ? `hace ${Math.round((new Date(today + 'T12:00:00Z').getTime() - new Date(data.last + 'T12:00:00Z').getTime()) / 86400000)} días` : ''} w={170} />
        <Tile label="Próxima" value={data.next ? fmtShort(data.next.date) : '—'} sub={data.next ? 'programada' : 'sin programar'} w={130} />
        <Tile label="Limpiezas (total)" value={String(data.total)} sub={data.first ? `desde ${data.first}` : ''} w={130} />
        <Tile label="Margen 90 d" value={money(s?.margen)} color={C.green} sub={pctS(s?.mgPct)}><Delta cur={s?.margen} prev={p?.margen} /></Tile>
        <Tile label="Duración prom." value={hm(s?.durProm)} w={130}><Delta cur={s?.durProm} prev={p?.durProm} kind="num" good="down" /></Tile>
        <Tile label="Mg / HH" value={money1(s?.mgHH)} w={110} />
      </div>
      <div ref={histRef} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Card style={{ flex: '1.5 1 380px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}><b style={{ fontSize: 14 }}>{view === 'ficha' ? 'Visitas recientes' : 'Historial de la casa'}</b>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([['all', 'Todas'], ['done', 'Terminadas'], ['photos', 'Con fotos'], ['sched', 'Programadas']] as [typeof filter, string][]).map(([k, t]) => <button key={k} style={{ ...btn(filter === k), height: 30, fontSize: 12 }} onClick={() => { setFilter(k); setPg(1) }}>{t}</button>)}
              <select value={year} onChange={e => { setYear(e.target.value); setPg(1) }} style={{ ...btn(), height: 30, fontSize: 12 }}><option value="">Todos los años</option>{years.map(y => <option key={y}>{y}</option>)}</select>
            </span></div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: mobile ? 420 : 0 }}>
            <thead><tr>{['Fecha', 'Squad', 'Duración', 'Cobro', 'Margen', 'Fotos', 'Estado', ''].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 10, color: C.muted, padding: 7, background: C.bg, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>{f.slice((pg - 1) * per, pg * per).map(v => { const on = cur?.id === v.id; return <tr key={v.id} onClick={() => setSelId(v.id)} style={{ borderTop: '1px solid #F1F5F9', background: on ? C.primaryLight : 'transparent', cursor: 'pointer' }}>
              <td style={{ padding: 7, fontWeight: 700 }}>{fmtShort(v.date)}</td><td style={{ padding: 7 }}>{v.squad || '—'}</td><td style={{ padding: 7 }}>{hm(v.dur)}</td><td style={{ padding: 7 }}>{money(v.price)}</td>
              <td style={{ padding: 7, color: C.green, fontWeight: 600 }}>{v.margen === null ? '—' : money(v.margen)}</td><td style={{ padding: 7 }}>📷 {v.photos.length}</td>
              <td style={{ padding: 7 }}><span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: v.status === 'Done' ? C.greenBg : C.amberBg, color: v.status === 'Done' ? C.green : C.amber }}>{v.status}</span></td>
              <td style={{ padding: 7, color: C.primary, fontWeight: 700 }}>{on ? 'Viendo ›' : 'Abrir ›'}</td></tr> })}</tbody></table></div>
          {f.length === 0 && <div style={{ padding: 14, fontSize: 13, color: C.muted }}>Sin visitas con este filtro.</div>}
          {view === 'ficha' && f.length > per && <div style={{ textAlign: 'center', marginTop: 8 }}><span style={{ fontSize: 12, color: C.muted }}>Usa «Historial» arriba para ver las {f.length} visitas</span></div>}
          {view === 'historial' && pages > 1 && <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>{Array.from({ length: Math.min(pages, 8) }, (_, i) => i + 1).map(n => <button key={n} onClick={() => setPg(n)} style={{ ...btn(pg === n), height: 28, padding: '0 10px' }}>{n}</button>)}{pages > 8 && <span style={{ fontSize: 12, color: C.muted, alignSelf: 'center' }}>… {pages}</span>}</div>}
        </Card>
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cur && <Card style={{ borderColor: '#C7D2FE' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><b style={{ fontSize: 14 }}>Visita del {fmtShort(cur.date)}</b><span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: cur.status === 'Done' ? C.greenBg : C.amberBg, color: cur.status === 'Done' ? C.green : C.amber }}>{cur.status}</span></div>
            <div style={{ fontSize: 11.5, color: C.muted, margin: '2px 0 8px' }}>{[cur.squad, cur.type, cur.dur ? hm(cur.dur) : ''].filter(Boolean).join(' · ')}</div>
            {cur.photos.length > 0 ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>{cur.photos.slice(0, 6).map((u: string, i: number) => <Photo key={u + i} u={u} i={i} />)}</div> : <div style={{ fontSize: 12.5, color: C.muted, padding: '10px 0' }}>Esta visita no tiene fotos guardadas.</div>}
            {cur.photos.length > 6 && <details style={{ marginTop: 8 }}><summary style={{ cursor: 'pointer', color: C.primary, fontWeight: 700, fontSize: 13 }}>Ver las {cur.photos.length} fotos ›</summary><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>{cur.photos.slice(6).map((u: string, i: number) => <Photo key={u + i} u={u} i={i + 6} />)}</div></details>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>{[['Cobro', money(cur.price)], ['Costo (est.)', money(cur.cost)], ['Margen', cur.margen === null ? '—' : money(cur.margen)]].map(([l, v]) => <div key={l} style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '6px 10px' }}><div style={{ fontSize: 11, color: '#64748B' }}>{l}</div><b>{v}</b></div>)}</div>
          </Card>}
          <Card><b style={{ fontSize: 14 }}>Detalles de la casa</b>
            <table style={{ width: '100%', marginTop: 6, fontSize: 13 }}><tbody>{[['Cliente', data.client], ['Servicio más común', data.common.type], ['Día más común', data.common.weekday], ['Squad que más la limpia', data.common.squad], ['Primera limpieza', data.first], ['Total de limpiezas', String(data.total)]].map(([l, v]) => <tr key={l} style={{ borderTop: '1px solid #F1F5F9' }}><td style={{ padding: '6px 0', color: '#64748B', width: '48%' }}>{l}</td><td style={{ fontWeight: 700 }}>{v || '—'}</td></tr>)}</tbody></table>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Datos salen de las limpiezas ya registradas en Airtable.</div></Card>
        </div>
      </div>
    </>}
  </div>
}

function ClientView({ name, onBack, onDebug }: { name: string; onBack: () => void; onDebug: (d: any) => void }) {
  const to = addDays(todayET(), -1), from = addDays(to, -89)
  const hs = useApi('rank', { entity: 'property', from, to }, [from, to], onDebug)
  const cs = useApi('rank', { entity: 'client', from, to }, [from, to], onDebug)
  const me = (cs.data?.rows || []).find((r: any) => r.name === name)
  const houses = (hs.data?.rows || []).filter((r: any) => r.client === name && r.limpiezas > 0).sort((a: any, b: any) => b.margen - a.margen)
  return <div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><button onClick={onBack} style={{ ...btn(), color: C.primaryDark, fontWeight: 700 }}>‹ Clientes</button><div style={{ fontSize: 18, fontWeight: 800 }}>{name}</div><span style={{ color: C.muted, fontSize: 12 }}>últimos 90 días</span></div>
    <Err msg={hs.err || cs.err} /><Loading on={hs.loading || cs.loading} />
    {me && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
      <Tile label="Cobrado" value={money(me.ingreso)} /><Tile label="Margen" value={money(me.margen)} color={C.green} sub={pctS(me.mgPct)}><Delta cur={me.margen} prev={me.prevMargen} /></Tile>
      <Tile label="Limpiezas" value={String(me.limpiezas)}><Delta cur={me.limpiezas} prev={me.prevLimpiezas} kind="num" /></Tile><Tile label="Margen / HH" value={money1(me.mgHH)} /><Tile label="Última limpieza" value={me.last ? fmtShort(me.last) : '—'} /></div>}
    <Card><b style={{ fontSize: 14 }}>Casas de este cliente</b>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 6 }}><thead><tr>{['Casa', 'Última', 'Limp.', 'Cobrado', 'Margen', 'Mg %'].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 10, color: C.muted, padding: 8, background: C.bg, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
        <tbody>{houses.map((h: any) => <tr key={h.name} style={{ borderTop: '1px solid #F1F5F9' }}><td style={{ padding: 8, fontWeight: 700, color: C.primaryDark }}>{h.name}</td><td style={{ padding: 8 }}>{h.last ? fmtShort(h.last) : '—'}</td><td style={{ padding: 8 }}>{h.limpiezas}</td><td style={{ padding: 8 }}>{money(h.ingreso)}</td><td style={{ padding: 8, color: C.green, fontWeight: 700 }}>{money(h.margen)}</td><td style={{ padding: 8 }}>{pctS(h.mgPct)}</td></tr>)}</tbody></table></div>
      {houses.length === 0 && !hs.loading && <div style={{ padding: 12, fontSize: 13, color: C.muted }}>Sin casas con limpiezas terminadas en 90 días.</div>}</Card>
  </div>
}
