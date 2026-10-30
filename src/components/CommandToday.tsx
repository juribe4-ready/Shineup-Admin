import { useEffect, useState } from 'react'

const C = { primary: '#6366F1', ink: '#0F172A', slate: '#475569', muted: '#94A3B8', border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF', green: '#059669', red: '#DC2626', amber: '#B45309' }
const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }
const lbl: React.CSSProperties = { fontSize: 12, color: '#64748B', fontWeight: 500 }
const big: React.CSSProperties = { fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, margin: '3px 0' }

const todayDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const getMonday = (d: Date) => { const dow = (d.getDay() + 6) % 7; const m = new Date(d); m.setDate(d.getDate() - dow); return m }
const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('en-US')

interface Cl { id: string; propertyText: string; status: string; scheduledTime: string | null; staffListText: string }

const STATUS: Record<string, { t: string; bg: string; fg: string }> = {
  Done: { t: 'Terminada', bg: '#D1FAE5', fg: '#047857' },
  'In Progress': { t: 'En curso', bg: '#EEF0FF', fg: '#4338CA' },
}

export default function CommandToday() {
  const [loading, setLoading] = useState(true)
  const [cleanings, setCleanings] = useState<Cl[]>([])
  const [stats, setStats] = useState({ total: 0, done: 0, inProgress: 0 })
  const [billing, setBilling] = useState<any>(null)
  const [capPct, setCapPct] = useState<number | null>(null)
  const [strCount, setStrCount] = useState(0)
  const [flexCount, setFlexCount] = useState(0)
  const [incToday, setIncToday] = useState(0)

  useEffect(() => {
    const today = todayDate()
    const monStr = getMonday(new Date()).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    ;(async () => {
      try {
        const [d, b, s, i] = await Promise.all([
          fetch(`/api/getDashboard?date=${today}`),
          fetch(`/api/getReports?type=billing&dateFrom=${today}&dateTo=${today}`),
          fetch(`/api/getSquads?weekStart=${monStr}`),
          fetch('/api/getReports?type=incidents'),
        ])
        if (d.ok) { const j = await d.json(); setCleanings(j.cleanings || []); setStats({ total: j.stats?.total || 0, done: j.stats?.done || 0, inProgress: j.stats?.inProgress || 0 }) }
        if (b.ok) { const j = await b.json(); setBilling(j.summary || null) }
        if (s.ok) {
          const j = await s.json(); const squads = j.squads || []; const blocks = j.blocks || []
          if (squads.length > 0) {
            const total = squads.reduce((sum: number, sq: any) => sum + ((sq.endHour - sq.startHour) || 8), 0) * 7
            const toMin = (t: string) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m }
            const used = blocks.reduce((sum: number, bl: any) => sum + Math.max(0, (toMin(bl.endTime) - toMin(bl.startTime)) / 60), 0)
            setCapPct(total > 0 ? Math.round((used / total) * 100) : 0)
            setStrCount(blocks.filter((bl: any) => bl.type === 'STR' || bl.type === 'Appointment').length)
            setFlexCount(blocks.filter((bl: any) => bl.type !== 'STR' && bl.type !== 'Appointment').length)
          }
        }
        if (i.ok) {
          const inc = await i.json()
          setIncToday((inc || []).filter((x: any) => x.creationDate && new Date(x.creationDate).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === today).length)
        }
      } catch {}
      finally { setLoading(false) }
    })()
  }, [])

  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'
  const list = [...cleanings].sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || '')).slice(0, 8)

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: 14, marginBottom: 14 }}>
        <div style={{ ...card, borderColor: '#C7D2FE', background: 'linear-gradient(180deg,#EEF0FF,#fff)' }}>
          <p style={lbl}>Generado hoy</p>
          <p style={big}>{loading ? '…' : money(billing?.totalRevenue || 0)}</p>
          <p style={{ fontSize: 12, color: C.green, fontWeight: 500 }}>{stats.done} de {stats.total} limpiezas terminadas</p>
          <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', margin: '8px 0 6px', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: C.primary }} /></div>
          <p style={lbl}>{stats.inProgress} en curso</p>
        </div>
        <div style={card}>
          <p style={lbl}>Alertas de hoy</p>
          <p style={{ ...big, color: incToday > 0 ? C.amber : C.ink }}>{loading ? '…' : incToday}</p>
          <p style={{ fontSize: 12, color: '#64748B' }}>incidentes reportados hoy</p>
        </div>
        <div style={card}>
          <p style={lbl}>Capacidad de la semana</p>
          <p style={big}>{capPct === null ? '—' : `${capPct}%`}</p>
          <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', margin: '6px 0', overflow: 'hidden' }}><div style={{ width: `${Math.min(capPct || 0, 100)}%`, height: '100%', background: C.primary }} /></div>
          <p style={lbl}>Bloques STR: {strCount} · Flex / otros: {flexCount}</p>
        </div>
        <div style={card}>
          <p style={lbl}>Cobros de hoy</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span style={lbl}>Por cobrar</span><b style={{ color: C.amber }}>{money(billing?.unpaidAmount || 0)}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={lbl}>Facturado</span><b style={{ color: C.ink }}>{money(billing?.invoicedAmount || 0)}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={lbl}>Cobrado</span><b style={{ color: C.green }}>{money(billing?.paidAmount || 0)}</b></div>
        </div>
      </div>

      <div style={card}>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Limpiezas de hoy</p>
        {loading ? <p style={{ fontSize: 13, color: C.muted }}>Cargando…</p> : list.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>No hay limpiezas para hoy.</p> : (
          <div>
            {list.map(c => {
              const st = STATUS[c.status] || { t: 'Programada', bg: '#F1F5F9', fg: '#475569' }
              const unassigned = !c.staffListText || c.staffListText === 'Sin asignar'
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid #F1F5F9`, fontSize: 13 }}>
                  <b style={{ flex: 1, minWidth: 0, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.propertyText || 'Sin nombre'}</b>
                  <span style={{ color: unassigned ? C.amber : '#64748B', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unassigned ? 'Sin asignar' : c.staffListText}</span>
                  <span style={{ color: '#64748B', fontSize: 12, width: 64, textAlign: 'right' }}>{fmtTime(c.scheduledTime)}</span>
                  <span style={{ background: st.bg, color: st.fg, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.t}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
