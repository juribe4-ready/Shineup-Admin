// Helpers compartidos del Schedule (origen, tipo, colores, horas)
export type Origin = 'T' | 'W' | 'O'
export type Seg = 'STR' | 'Resid.' | 'Deep' | '—'
export const ORIGIN: Record<Origin, { label: string; color: string }> = {
  T: { label: 'Turno', color: '#4F46E5' }, W: { label: 'Web', color: '#0D9488' }, O: { label: 'Others', color: '#64748B' },
}
// Misma paleta que Dispatch / SquadBlocks
export const TYPE_STYLE: Record<Seg, { bg: string; bd: string; fg: string }> = {
  'STR': { bg: '#ECFDF5', bd: '#10B981', fg: '#047857' },
  'Resid.': { bg: '#EFF6FF', bd: '#3B82F6', fg: '#1D4ED8' },
  'Deep': { bg: '#FEF3C7', bd: '#F59E0B', fg: '#B45309' },
  '—': { bg: '#F8FAFC', bd: '#CBD5E1', fg: '#64748B' },
}
export const originOf = (src: string | null | undefined): Origin => /turno/i.test(src || '') ? 'T' : /web/i.test(src || '') ? 'W' : 'O'
export const segOfType = (t: string | null | undefined): Seg => !t ? '—' : /deep/i.test(t) ? 'Deep' : /str/i.test(t) ? 'STR' : 'Resid.'
export const toHM = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const d = new Date(iso); if (isNaN(d.getTime())) return /^\d{2}:\d{2}/.test(iso) ? iso.slice(0, 5) : ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' })
}
export const fmt12 = (hm: string) => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}` }
export const dowOf = (d: string) => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7 // 0 = lunes

// Capacidad de un dia: personas del roster de cada squad x ventana del squad
export interface SquadLite { id: string; name: string; type: string; startHour: number; endHour: number; defaultMemberIds: string[]; dayOverrides: Record<string, { staffIds: string[] }> }
export function dayCapacity(squads: SquadLite[], date: string) {
  const dw = dowOf(date); const parts: { squad: string; people: number; hours: number }[] = []
  for (const s of squads) {
    const weekend = /week.?end|fin/i.test(s.type || ''), weekday = /week.?day|sem/i.test(s.type || '')
    const ov = s.dayOverrides?.[date]
    if (!ov) { if (weekend && dw < 5) continue; if (weekday && !weekend && dw >= 5) continue }
    const ids = ov ? (ov.staffIds || []) : (s.defaultMemberIds || [])
    const win = Math.max(0, (s.endHour ?? 18) - (s.startHour ?? 8))
    if (ids.length && win) parts.push({ squad: s.name, people: ids.length, hours: ids.length * win })
  }
  return { hours: parts.reduce((t, p) => t + p.hours, 0), parts }
}
