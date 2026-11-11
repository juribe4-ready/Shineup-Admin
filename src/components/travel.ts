// Traslado = tiempo entre el fin de una casa y el inicio de la siguiente del MISMO squad (mismos cleaners) en el día.
// Sin reglas: todo hueco entre dos casas consecutivas del squad es traslado.
export interface TCl { id: string; propertyText: string; status: string; startTime?: string | null; endTime?: string | null; laborStaff?: { id: string; name?: string }[] }
export interface Seg { kind: 'clean' | 'travel'; s: number; e: number; label: string; open?: boolean }
export interface SquadRow { key: string; label: string; segs: Seg[]; cleanMs: number; travelMs: number; trips: { from: string; to: string; ms: number }[] }

export function squadTravel(cleanings: TCl[], now: number): SquadRow[] {
  const groups: Record<string, TCl[]> = {}
  for (const c of cleanings) {
    if (!c.startTime) continue
    const ids = (c.laborStaff || []).map(x => x.id).sort()
    if (!ids.length) continue
    ;(groups[ids.join('+')] ||= []).push(c)
  }
  const rows: SquadRow[] = []
  for (const [key, cs] of Object.entries(groups)) {
    cs.sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
    const names = (cs[0].laborStaff || []).map(x => (x.name || '').split(' ')[0]).filter(Boolean).join(' + ')
    const segs: Seg[] = []; const trips: SquadRow['trips'] = []
    let cleanMs = 0, travelMs = 0
    cs.forEach((c, i) => {
      const s = new Date(c.startTime!).getTime(); const open = !c.endTime; const e = c.endTime ? new Date(c.endTime).getTime() : now
      segs.push({ kind: 'clean', s, e, label: c.propertyText || 'Casa', open }); cleanMs += Math.max(0, e - s)
      const n = cs[i + 1]
      if (n && c.endTime) {
        const ns = new Date(n.startTime!).getTime(); const gap = ns - e
        if (gap > 0) {
          segs.push({ kind: 'travel', s: e, e: ns, label: '' }); travelMs += gap; trips.push({ from: c.propertyText, to: n.propertyText, ms: gap })
        }
      }
    })
    rows.push({ key, label: names || 'Squad', segs, cleanMs, travelMs, trips })
  }
  return rows.sort((a, b) => a.segs[0].s - b.segs[0].s)
}
export const fmtMin = (ms: number) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m} min` }
