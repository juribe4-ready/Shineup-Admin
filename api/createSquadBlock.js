// Shared duration-estimation engine.
//
// IMPORTANT: this file lives in api/_lib/ — the underscore prefix means Vercel does NOT
// treat it as a serverless function/route. It's plain shared code, imported by other
// /api/*.js files. This does not count against the 12-function limit.
//
// Every tunable number lives in TARS config (the Standards/TARS_CONFIG record edited from
// RulesPage.tsx) — nothing here is hardcoded. The values below are only fallback DEFAULTS,
// used if a config key happens to be missing (e.g. before Juan saves Reglas for the first
// time after this feature ships).
export const DURATION_DEFAULTS = {
  roundToMinutes: 15,           // round wall-clock duration up to the nearest N minutes
  minDurationMinutes: 45,       // floor — no job is ever estimated shorter than this
  ratingAdjustBadMinutes: 30,   // ADDED to duration if the property's last rating was "Malo"
  ratingAdjustGoodMinutes: 30,  // SUBTRACTED from duration if last rating was "Bueno"
  travelBufferMinutes: 20,      // gap reserved between two consecutive jobs for the same squad
  // Labor Base formula: Labor Base (total man-minutes for a property, BEFORE correction) =
  // a×Beds + b×Bathrooms + c×SqFt. Confirmed by Juan from the live Airtable formula:
  // 18×Beds + 23×Bathrooms + 0.05×SqFt.
  laborMinutesPerBed: 18,
  laborMinutesPerBathroom: 23,
  laborMinutesPerSqFt: 0.05,
  // Reference band for Properties."Labor Correction Factor" — ONE number, a ± percentage
  // tolerance around 1.0 (e.g. 25 means the expected band is 0.75–1.25). NOT enforced/clamped
  // automatically — just used to flag outliers in the recalc preview (e.g. a typo like 5
  // instead of 1.05), so Juan notices and decides, rather than the system silently fixing it.
  laborFactorAlertPct: 25,
}

// Labor Base = total man-minutes for the job BEFORE the per-property correction factor.
export function computeLaborBaseMinutes(beds, bathrooms, sqft, config = {}) {
  const perBed = config.laborMinutesPerBed ?? DURATION_DEFAULTS.laborMinutesPerBed
  const perBath = config.laborMinutesPerBathroom ?? DURATION_DEFAULTS.laborMinutesPerBathroom
  const perSqFt = config.laborMinutesPerSqFt ?? DURATION_DEFAULTS.laborMinutesPerSqFt
  return Math.round((perBed * (beds || 0)) + (perBath * (bathrooms || 0)) + (perSqFt * (sqft || 0)))
}

// Final Labor = Labor Base × Labor Correction Factor. THIS is what every other part of the
// app reads from Properties.Labor (pricing, HH Programadas, Pre-dispatch sequencing, etc.) —
// the correction factor is never re-derived here, just applied. A missing/blank factor on a
// property means "not calibrated yet" → treated as neutral (1.0), not zero.
export function computeFinalLaborMinutes(laborBaseMinutes, correctionFactor) {
  const factor = (correctionFactor === undefined || correctionFactor === null || correctionFactor === '') ? 1 : Number(correctionFactor)
  return Math.round((laborBaseMinutes || 0) * (Number.isFinite(factor) ? factor : 1))
}

// Returns the [min, max] band the Factor is expected to sit in, derived from the single
// ± percentage tolerance in config (e.g. 25 → [0.75, 1.25]).
export function getLaborFactorBand(config = {}) {
  const pct = config.laborFactorAlertPct ?? DURATION_DEFAULTS.laborFactorAlertPct
  return { min: Math.round((1 - pct / 100) * 100) / 100, max: Math.round((1 + pct / 100) * 100) / 100 }
}

// Airtable's Rating field is a select string like "Normal", "Bueno", "Malo" — this turns it
// into a 1/2/3 scale (1=Malo, 2=Normal, 3=Bueno) the same way every existing consumer does.
export function resolveRating(raw) {
  if (!raw) return undefined
  const s = String(raw).toLowerCase()
  if (s.includes('bueno')) return 3
  if (s.includes('normal')) return 2
  if (s.includes('malo')) return 1
  return undefined
}

// laborMinutes: total MAN-minutes for the job (Property.Labor — total work, not per-person)
// cleanerCount: number of staff with role 'cleaner' assigned to this job
// ratingVal: 1 (Malo) | 2 (Normal) | 3 (Bueno) | undefined — from resolveRating()
// config: the TARS config object loaded from Standards — every tunable is read from here first
export function computeJobDurationMinutes(laborMinutes, cleanerCount, ratingVal, config = {}) {
  const roundTo = config.roundToMinutes ?? DURATION_DEFAULTS.roundToMinutes
  const minDuration = config.minDurationMinutes ?? DURATION_DEFAULTS.minDurationMinutes
  const badAdj = config.ratingAdjustBadMinutes ?? DURATION_DEFAULTS.ratingAdjustBadMinutes
  const goodAdj = config.ratingAdjustGoodMinutes ?? DURATION_DEFAULTS.ratingAdjustGoodMinutes

  const effectiveCleaners = Math.max(cleanerCount || 0, 1)
  const minutesRaw = (laborMinutes || 0) / effectiveCleaners
  const minutesRounded = Math.ceil(minutesRaw / roundTo) * roundTo
  const ratingAdj = ratingVal === 1 ? badAdj : ratingVal === 3 ? -goodAdj : 0
  return Math.max(minutesRounded + ratingAdj, minDuration)
}

export function getTravelBufferMinutes(config = {}) {
  return config.travelBufferMinutes ?? DURATION_DEFAULTS.travelBufferMinutes
}

// Convenience for the Pre-dispatch sequencer: given an ordered list of jobs for one
// squad/day, returns each job's computed start/end Date, chained back-to-back with the
// travel buffer in between. dayStart is a Date for the squad's first job start time.
export function sequenceJobs(jobs, dayStart, config = {}) {
  const bufferMin = getTravelBufferMinutes(config)
  let cursor = new Date(dayStart)
  return jobs.map(job => {
    const durationMin = computeJobDurationMinutes(job.laborMinutes, job.cleanerCount, job.ratingVal, config)
    const start = new Date(cursor)
    const end = new Date(start.getTime() + durationMin * 60000)
    cursor = new Date(end.getTime() + bufferMin * 60000)
    return { ...job, start, end, durationMin }
  })
}
