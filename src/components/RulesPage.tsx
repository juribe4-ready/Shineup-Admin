import { useState, useEffect } from 'react'
import { Clock, Calendar, TrendingUp, Plus, X, Save, RefreshCw } from 'lucide-react'

const C = {
  primary: '#6366F1', primaryLight: '#EEF2FF',
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', white: '#FFFFFF',
  amber: '#F59E0B', amberLight: '#FFFBEB',
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

interface TARSConfig {
  primeStart: string
  primeEnd: string
  routeBufferPct: number
  minRatePrimeTime: number
  minRateFlex: number
  esdWeeks: number
  maxFlexPct: number
  dynamicBufferThreshold: number
  strOnlyDays: number[]
  strOnlyDates: string[]
}

const DEFAULT_CONFIG: TARSConfig = {
  primeStart: '10:00',
  primeEnd: '16:00',
  routeBufferPct: 25,
  minRatePrimeTime: 50,
  minRateFlex: 35,
  esdWeeks: 8,
  maxFlexPct: 40,
  dynamicBufferThreshold: 80,
  strOnlyDays: [6],
  strOnlyDates: [],
}

export default function RulesPage() {
  const [config, setConfig] = useState<TARSConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    fetch('/api/getReports?type=tarsConfig')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.config) setConfig({ ...DEFAULT_CONFIG, ...d.config }) })
      .catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/getReports?type=tarsConfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      })
      const d = await r.json()
      if (r.ok && d.ok) { setSaved(true); showToast('TARS config saved'); setTimeout(() => setSaved(false), 2000) }
      else showToast(d.error ? `Error: ${d.error.slice(0, 120)}` : 'Error saving')
    } catch (e: any) { showToast(`Error: ${e.message}`) }
    finally { setSaving(false) }
  }

  const toggleDay = (d: number) => {
    setConfig(c => ({
      ...c,
      strOnlyDays: c.strOnlyDays.includes(d)
        ? c.strOnlyDays.filter(x => x !== d)
        : [...c.strOnlyDays, d]
    }))
  }

  const addDate = () => {
    if (!newDate || config.strOnlyDates.includes(newDate)) return
    setConfig(c => ({ ...c, strOnlyDates: [...c.strOnlyDates, newDate].sort() }))
    setNewDate('')
  }

  const removeDate = (d: string) => setConfig(c => ({ ...c, strOnlyDates: c.strOnlyDates.filter(x => x !== d) }))

  const set = (k: keyof TARSConfig, v: any) => setConfig(c => ({ ...c, [k]: v }))

  const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ maxWidth: 820, fontFamily: "'Inter', sans-serif" }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: C.ink, color: 'white', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Clock style={{ width: 20, height: 20, color: C.primary }} />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>TARS Core — Rules</p>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Capacity, revenue & routing rules — defined once, enforced everywhere</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.primary} 0%, #4F46E5 100%)`, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" /> : <Save style={{ width: 14, height: 14 }} />}
          {saved ? 'Saved!' : 'Save config'}
        </button>
      </div>

      {/* Prime time */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Clock style={{ width: 16, height: 16, color: C.primary }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>Prime time window</p>
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>STR-priority hours — flex rates apply outside this window</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start</p>
            <input type="time" value={config.primeStart} onChange={e => set('primeStart', e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>End</p>
            <input type="time" value={config.primeEnd} onChange={e => set('primeEnd', e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Min rate prime ($/hr)</p>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 14 }}>$</span>
              <input type="number" value={config.minRatePrimeTime} onChange={e => set('minRatePrimeTime', +e.target.value)}
                style={{ width: '100%', height: 38, padding: '0 10px 0 22px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Min rate flex ($/hr)</p>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 14 }}>$</span>
              <input type="number" value={config.minRateFlex} onChange={e => set('minRateFlex', +e.target.value)}
                style={{ width: '100%', height: 38, padding: '0 10px 0 22px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#EEEDFE', borderRadius: 10, fontSize: 12, color: '#534AB7' }}>
          Flex jobs in prime time require ≥ ${config.minRatePrimeTime}/hr per cleaner. Outside prime time, ${config.minRateFlex}/hr applies. Route buffer below reserves capacity for travel between jobs.
        </div>
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Route buffer (%)</p>
          <input type="number" min={0} max={50} value={config.routeBufferPct} onChange={e => set('routeBufferPct', +e.target.value)}
            style={{ width: 140, height: 38, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* STR-only days */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Calendar style={{ width: 16, height: 16, color: C.primary }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>STR-only days</p>
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>No flex jobs on these days — all capacity reserved for STR</span>
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Recurring weekly</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {DAYS.map((day, i) => (
            <button key={day} onClick={() => toggleDay(i)}
              style={{
                padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${config.strOnlyDays.includes(i) ? C.primary : C.border}`,
                background: config.strOnlyDays.includes(i) ? C.primaryLight : C.white,
                color: config.strOnlyDays.includes(i) ? C.primary : C.muted,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
              {DAY_SHORT[i]}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Specific dates (holidays, post-holiday)</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            style={{ height: 38, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none' }} />
          <button onClick={addDate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${C.primary}`, background: C.primaryLight, color: C.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus style={{ width: 14, height: 14 }} /> Add date
          </button>
        </div>
        {config.strOnlyDates.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {config.strOnlyDates.map(d => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.amberLight, border: `1px solid ${C.amber}30`, borderRadius: 8, padding: '4px 10px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.amber }}>{fmtDate(d)}</span>
                <button onClick={() => removeDate(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  <X style={{ width: 12, height: 12, color: C.amber }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ESD calibration */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <TrendingUp style={{ width: 16, height: 16, color: C.primary }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 }}>ESD calibration — Estimated Service Duration</p>
        </div>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
          Base formula: <code style={{ background: C.bg, padding: '1px 6px', borderRadius: 4, fontSize: 12, color: C.ink }}>18×Beds + 23×Bathrooms + 0.05×SqFt</code> minutes — then corrected by historical actuals per property.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>History window (weeks)</p>
            <input type="number" min={2} max={24} value={config.esdWeeks} onChange={e => set('esdWeeks', +e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max flex capacity (%)</p>
            <input type="number" min={10} max={80} value={config.maxFlexPct} onChange={e => set('maxFlexPct', +e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dynamic buffer trigger (%)</p>
            <input type="number" min={50} max={100} value={config.dynamicBufferThreshold} onChange={e => set('dynamicBufferThreshold', +e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ marginTop: 12, padding: '12px 14px', background: C.bg, borderRadius: 10, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          <strong style={{ color: C.ink }}>How correction works:</strong> After each cleaning, TARS computes <code style={{ background: C.white, padding: '0 4px', borderRadius: 4 }}>factor = actual_hours / ESD_base</code>. The rolling average of this factor over the last {config.esdWeeks} weeks becomes the property's correction multiplier. A factor &lt; 1 means the property is consistently faster than the formula predicts. Factor &gt; 1 means it always takes longer.
        </div>
      </div>

      {/* Config preview */}
      <div style={{ background: '#EEEDFE', border: '1px solid #AFA9EC', borderRadius: 16, padding: '16px 20px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#3C3489', marginBottom: 10 }}>Config preview — what TARS will enforce</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#534AB7' }}>
          <div>Prime time: <strong style={{ color: '#3C3489' }}>{config.primeStart} – {config.primeEnd}</strong></div>
          <div>Min rate prime: <strong style={{ color: '#3C3489' }}>${config.minRatePrimeTime}/hr</strong></div>
          <div>Min rate flex: <strong style={{ color: '#3C3489' }}>${config.minRateFlex}/hr</strong></div>
          <div>Route buffer: <strong style={{ color: '#3C3489' }}>{config.routeBufferPct}%</strong></div>
          <div>STR-only days/week: <strong style={{ color: '#3C3489' }}>{config.strOnlyDays.map(d => DAY_SHORT[d]).join(', ') || 'none'}</strong></div>
          <div>ESD history: <strong style={{ color: '#3C3489' }}>{config.esdWeeks} weeks</strong></div>
          <div>Max flex capacity: <strong style={{ color: '#3C3489' }}>{config.maxFlexPct}%</strong></div>
          <div>Specific STR dates: <strong style={{ color: '#3C3489' }}>{config.strOnlyDates.length} added</strong></div>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} .animate-spin{animation:spin 1s linear infinite}`}</style>
    </div>
  )
}
