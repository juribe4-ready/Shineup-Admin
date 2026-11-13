// Reports (solo lectura): margen por día, ranking de casas/clientes, comparar e historial de casa.
// Se usa desde getDashboard.js (?action=reports&kind=...). Solo campos de Airtable que ya se usan en el resto de la app.
const BASE = 'appBwnoxgyIXILe6M';
const TOKEN = process.env.AIRTABLE_TOKEN;
const AT = `https://api.airtable.com/v0/${BASE}`;
const CLEAN = `${AT}/tblabOdNknnjrYUU1`;
const STAFF = `${AT}/tblgHwN1wX6u3ZtNY`;
const TURNOS = `${AT}/Turnos`;
const H = () => ({ Authorization: `Bearer ${TOKEN}` });

const dAdd = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
const monthEnd = (d) => { const x = new Date(d.slice(0, 7) + '-01T12:00:00Z'); x.setUTCMonth(x.getUTCMonth() + 1); x.setUTCDate(0); return x.toISOString().slice(0, 10); };
const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const r2 = (x) => x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;
const todayET = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

async function all(url) {
  let recs = [], off = null, pages = 0;
  do {
    const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}pageSize=100${off ? `&offset=${off}` : ''}`, { headers: H() });
    if (!r.ok) throw new Error(`Airtable ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json(); recs = recs.concat(d.records || []); off = d.offset || null; pages++;
  } while (off && pages < 80);
  return recs;
}
const between = (field, a, b) => `AND(IS_AFTER({${field}},'${dAdd(a, -1)}'),IS_BEFORE({${field}},'${dAdd(b, 1)}'))`;
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const urls = (t) => (t ? String(t).split('\n').map(u => u.trim()).filter(Boolean) : []);

async function loadStaffClients() {
  const get = (withRate) => all(`${STAFF}?fields[]=Name&fields[]=Role${withRate ? `&fields[]=${encodeURIComponent('Cost/Hour')}` : ''}`);
  const [staffRecs, clientRecs] = await Promise.all([get(true).catch(() => get(false)), all(`${AT}/Clients`).catch(() => [])]);
  const staff = {};
  for (const r of staffRecs) { const v = Number(r.fields?.['Cost/Hour']); staff[r.id] = { name: r.fields?.Name || '', cleaner: String(r.fields?.Role || '').toLowerCase().includes('cleaner'), rate: Number.isFinite(v) && v > 0 ? v : 0 }; }
  const clientName = {};
  for (const c of clientRecs) { const f = c.fields || {}; const n = f['Full name'] || f['Name'] || f['Client Name'] || f['First Name'] || f['full name'] || null; if (n) clientName[c.id] = n; }
  return { staff, clientName };
}

function toRow(r, staff, clientName, withMedia) {
  const f = r.fields || {};
  const ids = (Array.isArray(f['Assigned Staff']) ? f['Assigned Staff'] : []).filter(id => staff[id]?.cleaner);
  const raw = Array.isArray(f['Client']) && f['Client'].length ? f['Client'][f['Client'].length - 1] : null;
  const client = raw ? (/^rec[A-Za-z0-9]{8,}$/.test(raw) ? (clientName[raw] || raw) : raw) : (f['Client Name Text'] || null);
  let d = null;
  if (f['Start Time'] && f['End Time']) { const h = (new Date(f['End Time']) - new Date(f['Start Time'])) / 3600000; if (h > 0 && h < 16) d = h; }
  const row = {
    id: r.id, date: String(f['Date'] || '').slice(0, 10), status: f['Status'] || '', done: f['Status'] === 'Done',
    price: Number(f['Price']) || 0, d, ids, n: ids.length || Number(f['#Cleaners']) || 1,
    squad: ids.map(id => (staff[id].name || '').split(' ')[0]).sort().join(' + '),
    sched: f['Scheduled Time'] || null, start: f['Start Time'] || null, end: f['End Time'] || null,
    client, property: f['Property Text'] || null, type: f['Cleaning Type Text'] || null,
  };
  row.cost = d ? ids.reduce((t, id) => t + (staff[id].rate || 0) * d, 0) : 0; // costo estimado: horas limpiando × Cost/Hour de los asignados
  if (withMedia) {
    let m = urls(f['ClosingMediaURLs']);
    if (!m.length) { const raw2 = f['Photos & Videos']; m = Array.isArray(raw2) ? raw2.filter(p => p && p.url).map(p => p.url) : []; }
    row.media = m;
  }
  return row;
}
const valid = (row) => row.date && row.status !== 'Cancelled';

function agg(rows) {
  const done = rows.filter(c => c.done);
  const wd = done.filter(c => c.d !== null);
  const hh = wd.reduce((t, c) => t + c.d * c.n, 0);
  const ingreso = done.reduce((t, c) => t + c.price, 0);
  const costo = wd.reduce((t, c) => t + c.cost, 0);
  const sched = done.filter(c => c.sched && c.start);
  let late = 0; for (const c of sched) if ((new Date(c.start) - new Date(c.sched)) / 60000 > 15) late++;
  return {
    limpiezas: done.length, ingreso: r2(ingreso), costo: r2(costo), margen: r2(ingreso - costo), mgPct: ingreso > 0 ? r2((ingreso - costo) / ingreso * 100) : null,
    hh: r2(hh), mgHH: hh > 0 ? r2((ingreso - costo) / hh) : null,
    durProm: wd.length ? r2(wd.reduce((t, c) => t + c.d, 0) / wd.length) : null,
    onTime: sched.length ? r2((1 - late / sched.length) * 100) : null,
  };
}

// ── Margen por día ─────────────────────────────────────────────
async function margin(q) {
  const { from, to } = q;
  if (!okDate(from) || !okDate(to) || from > to) return { status: 400, body: { error: 'rango invalido' } };
  const span = diffDays(from, to) + 1;
  const isMonth = from.slice(8) === '01' && monthEnd(from) === to;
  let pFrom, pTo;
  if (isMonth) { pTo = dAdd(from, -1); pFrom = pTo.slice(0, 7) + '-01'; } else { pFrom = dAdd(from, -span); pTo = dAdd(from, -1); }
  const filtered = !!(q.squad || q.client || q.property);
  const [{ staff, clientName }, cl, tr] = await Promise.all([
    loadStaffClients(),
    all(`${CLEAN}?filterByFormula=${encodeURIComponent(between('Date', pFrom, to))}`),
    all(`${TURNOS}?filterByFormula=${encodeURIComponent(between('Fecha', pFrom, to))}`).catch(() => []),
  ]);
  let rows = cl.map(r => toRow(r, staff, clientName)).filter(valid);
  if (q.squad) rows = rows.filter(c => [...c.ids].sort().join('+') === q.squad);
  if (q.client) rows = rows.filter(c => c.client === q.client);
  if (q.property) rows = rows.filter(c => c.property === q.property);
  const today = todayET();
  const turnoByDay = {};
  for (const r of tr) {
    const day = String(r.fields?.['Fecha'] || '').slice(0, 10);
    const sid = Array.isArray(r.fields?.['Persona']) ? r.fields['Persona'][0] : null;
    if (!day || !sid || !staff[sid]?.cleaner || !r.fields?.['Inicio']) continue;
    const st = Date.parse(r.fields['Inicio']); let en = r.fields['Fin'] ? Date.parse(r.fields['Fin']) : NaN;
    if (isNaN(en)) { if (day === today) en = Date.now(); else continue; }
    const h = Math.max(0, en - st) / 3600000;
    const t = turnoByDay[day] || (turnoByDay[day] = { h: 0, cost: 0 });
    t.h += h; t.cost += h * (staff[sid].rate || 0);
  }
  const durs = rows.filter(c => c.done && c.d !== null).map(c => c.d);
  const avgDur = durs.length ? durs.reduce((t, x) => t + x, 0) / durs.length : 2.5;
  const rates = Object.values(staff).filter(x => x.cleaner && x.rate > 0).map(x => x.rate);
  const avgRate = rates.length ? rates.reduce((t, x) => t + x, 0) / rates.length : 0;
  const estCost = (c) => (c.ids.length ? c.ids.reduce((t, id) => t + (staff[id].rate || 0), 0) : avgRate * (c.n || 1)) * avgDur;
  const build = (a, b) => {
    const days = [];
    for (let d = a; d <= b; d = dAdd(d, 1)) {
      const cs = rows.filter(c => c.date === d), done = cs.filter(c => c.done), wd = done.filter(c => c.d !== null);
      const cobrado = done.reduce((t, c) => t + c.price, 0);
      const hh = wd.reduce((t, c) => t + c.d * c.n, 0);
      const costB = wd.reduce((t, c) => t + c.cost, 0);
      const t = turnoByDay[d];
      const useTurno = !filtered && t && t.cost > 0;
      const costo = useTurno ? t.cost : costB;
      const pend = d >= today ? cs.filter(c => !c.done) : [];
      const pc = pend.reduce((t, c) => t + c.price, 0), pk = pend.reduce((t, c) => t + estCost(c), 0);
      const proy = pend.length ? { cobrado: r2(pc), costo: r2(pk), margen: r2(pc - pk), limpiezas: pend.length } : null;
      days.push({ date: d, proy, cobrado: r2(cobrado), costo: r2(costo), margen: r2(cobrado - costo), limpiezas: done.length, programadas: cs.length, hh: r2(hh), horas: r2(useTurno ? t.h : hh), fuente: done.length || useTurno ? (useTurno ? 'turnos' : 'est.') : '' });
    }
    return days;
  };
  const sum = (days) => {
    const s = days.reduce((m, d) => ({ cobrado: m.cobrado + d.cobrado, costo: m.costo + d.costo, limpiezas: m.limpiezas + d.limpiezas, horas: m.horas + d.horas, hh: m.hh + d.hh }), { cobrado: 0, costo: 0, limpiezas: 0, horas: 0, hh: 0 });
    const margen = s.cobrado - s.costo;
    return { cobrado: r2(s.cobrado), costo: r2(s.costo), margen: r2(margen), mgPct: s.cobrado > 0 ? r2(margen / s.cobrado * 100) : null, limpiezas: s.limpiezas, horas: r2(s.horas), hh: r2(s.hh), mgHH: s.hh > 0 ? r2(margen / s.hh) : null };
  };
  const days = build(from, to), prevDays = build(pFrom, pTo);
  return { body: { today, avgDur: r2(avgDur), from, to, prevFrom: pFrom, prevTo: pTo, isMonth, filtered, days, prevDays, total: sum(days), prevTotal: sum(prevDays),
    options: { clients: [...new Set(rows.filter(c => c.date >= from).map(c => c.client).filter(Boolean))].sort(), properties: [...new Set(rows.filter(c => c.date >= from).map(c => c.property).filter(Boolean))].sort() },
    debug: { avgDurProyeccion: r2(avgDur), tarifaPromedio: r2(avgRate), cleaningsLeidas: cl.length, turnosLeidos: tr.length, diasConTurno: Object.keys(turnoByDay).length, nota: filtered ? 'Con filtros el costo usa horas limpiando (estimado)' : 'Costo = turnos pagados; sin turnos = horas limpiando (est.)' } } };
}

// ── Ranking / lista de casas o clientes ──────────────────────────
async function rank(q) {
  const { from, to } = q; const entity = q.entity === 'client' ? 'client' : 'property';
  if (!okDate(from) || !okDate(to) || from > to) return { status: 400, body: { error: 'rango invalido' } };
  const span = diffDays(from, to) + 1; const pFrom = dAdd(from, -span), pTo = dAdd(from, -1);
  const lookFrom = dAdd(to, -120) < pFrom ? dAdd(to, -120) : pFrom;
  const [{ staff, clientName }, cl] = await Promise.all([loadStaffClients(), all(`${CLEAN}?filterByFormula=${encodeURIComponent(between('Date', lookFrom, to))}`)]);
  const rows = cl.map(r => toRow(r, staff, clientName)).filter(valid);
  const today = todayET();
  const groups = {};
  for (const c of rows) { const k = c[entity]; if (!k) continue; (groups[k] ||= []).push(c); }
  const list = Object.entries(groups).map(([name, rs]) => {
    const cur = rs.filter(c => c.date >= from && c.date <= to), prev = rs.filter(c => c.date >= pFrom && c.date <= pTo);
    const past = rs.filter(c => c.done && c.date <= today).sort((a, b) => b.date.localeCompare(a.date));
    const a = agg(cur), p = agg(prev);
    const last = past[0]?.date || null;
    return { name, client: entity === 'property' ? (rs.find(c => c.client)?.client || '') : '', last, ago: last ? diffDays(last, today) : null, ...a, prevMargen: p.margen, prevLimpiezas: p.limpiezas };
  }).filter(x => x.last || x.limpiezas);
  return { body: { from, to, pFrom, pTo, entity, rows: list, debug: { clientesSinNombre: [...new Set(rows.map(c => c.client).filter(Boolean))].filter(n => /^rec[A-Za-z0-9]{8,}$/.test(n)).length, cleaningsLeidas: cl.length, ventana: [lookFrom, to], nota: 'Costo estimado = horas limpiando × Cost/Hour de los cleaners asignados. Casas sin limpiezas en 120 días no salen.' } } };
}

// ── Lista liviana para el buscador (solo campos básicos, último año) ───
async function houses(q) {
  const to = todayET(), from = dAdd(to, -365);
  const { clientName } = await loadStaffClients();
  const f = ['Date', 'Status', 'Property Text', 'Client', 'Client Name Text'].map(x => `fields[]=${encodeURIComponent(x)}`).join('&');
  const cl = await all(`${CLEAN}?${f}&filterByFormula=${encodeURIComponent(between('Date', from, dAdd(to, 30)))}`);
  const m = {};
  for (const r of cl) {
    const x = r.fields || {}; const p = x['Property Text']; if (!p || x['Status'] === 'Cancelled') continue;
    const raw = Array.isArray(x['Client']) && x['Client'].length ? x['Client'][x['Client'].length - 1] : null;
    const client = raw ? (/^rec[A-Za-z0-9]{8,}$/.test(raw) ? (clientName[raw] || raw) : raw) : (x['Client Name Text'] || '');
    const d = String(x['Date'] || '').slice(0, 10);
    const e = m[p] || (m[p] = { name: p, client, last: null });
    if (client && !e.client) e.client = client;
    if (x['Status'] === 'Done' && d <= to && (!e.last || d > e.last)) e.last = d;
  }
  return { body: { houses: Object.values(m).sort((a, b) => a.name.localeCompare(b.name)) } };
}

// ── Historial de una casa ───────────────────────────────────────
async function house(q) {
  const name = String(q.property || '').trim(); if (!name) return { status: 400, body: { error: 'falta property' } };
  const { staff, clientName } = await loadStaffClients();
  const cl = await all(`${CLEAN}?filterByFormula=${encodeURIComponent(`{Property Text}='${esc(name)}'`)}&sort[0][field]=Date&sort[0][direction]=desc`);
  const rows = cl.map(r => toRow(r, staff, clientName, true)).filter(valid).sort((a, b) => b.date.localeCompare(a.date));
  const today = todayET();
  const visits = rows.map(c => ({ id: c.id, date: c.date, status: c.status, squad: c.squad, n: c.n, dur: r2(c.d), price: c.price, cost: r2(c.cost), margen: c.done ? r2(c.price - c.cost) : null, start: c.start, end: c.end, sched: c.sched, type: c.type, photos: c.media || [] }));
  const done = rows.filter(c => c.done && c.date <= today);
  const next = rows.filter(c => !c.done && c.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  const w90 = rows.filter(c => c.date > dAdd(today, -90) && c.date <= today), p90 = rows.filter(c => c.date > dAdd(today, -180) && c.date <= dAdd(today, -90));
  const top = (key) => { const m = {}; done.forEach(c => { const k = key(c); if (k) m[k] = (m[k] || 0) + 1; }); const e = Object.entries(m).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : null; };
  const wd = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return { body: { property: name, client: rows.find(c => c.client)?.client || '', total: done.length, first: done.length ? done[done.length - 1].date : null, last: done[0]?.date || null, next: next ? { date: next.date, sched: next.sched } : null,
    s90: agg(w90), p90: agg(p90), common: { type: top(c => c.type), weekday: top(c => wd[new Date(c.date + 'T12:00:00Z').getUTCDay()]), squad: top(c => c.squad) }, visits } };
}

// ── Filas de limpiezas (tabla) para un rango y filtro opcional ───
async function visitsKind(q) {
  const { from, to } = q;
  if (!okDate(from) || !okDate(to) || from > to) return { status: 400, body: { error: 'rango invalido' } };
  const { staff, clientName } = await loadStaffClients();
  const cl = await all(`${CLEAN}?filterByFormula=${encodeURIComponent(between('Date', from, to))}`);
  let rows = cl.map(r => toRow(r, staff, clientName, true)).filter(valid);
  if (q.property) rows = rows.filter(c => c.property === q.property);
  if (q.client) rows = rows.filter(c => c.client === q.client);
  rows.sort((a, b) => b.date.localeCompare(a.date) || String(a.sched || '').localeCompare(String(b.sched || '')));
  const total = rows.length;
  const visits = rows.slice(0, 800).map(c => ({ id: c.id, date: c.date, property: c.property, client: c.client, status: c.status, squad: c.squad, n: c.n, dur: r2(c.d), price: c.price, cost: r2(c.cost), margen: c.done && c.d !== null ? r2(c.price - c.cost) : null,
    start: c.start, end: c.end, sched: c.sched, type: c.type, photos: c.media || [] }));
  const names = [...new Set(rows.map(c => c.client).filter(Boolean))];
  return { body: { from, to, total, visits, debug: { filasLeidas: cl.length, mostradas: visits.length, clientesSinNombre: names.filter(n => /^rec[A-Za-z0-9]{8,}$/.test(n)).length, clientesEjemplo: names.slice(0, 5) } } };
}

// ── Comparar casas/clientes elegidos ────────────────────────────
async function compare(q) {
  const { from, to } = q; const entity = q.entity === 'client' ? 'client' : 'property';
  const names = String(q.names || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 6);
  if (!okDate(from) || !okDate(to) || from > to || !names.length) return { status: 400, body: { error: 'faltan datos' } };
  const span = diffDays(from, to) + 1; const pFrom = dAdd(from, -span), pTo = dAdd(from, -1);
  const { staff, clientName } = await loadStaffClients();
  const dateF = between('Date', pFrom, to);
  const f = entity === 'property' ? `AND(${dateF},OR(${names.map(n => `{Property Text}='${esc(n)}'`).join(',')}))` : dateF;
  const cl = await all(`${CLEAN}?filterByFormula=${encodeURIComponent(f)}`);
  const rows = cl.map(r => toRow(r, staff, clientName)).filter(valid);
  const today = todayET();
  const out = names.map(n => {
    const rs = rows.filter(c => c[entity] === n);
    const cur = rs.filter(c => c.date >= from && c.date <= to), prev = rs.filter(c => c.date >= pFrom && c.date <= pTo);
    const past = rs.filter(c => c.done && c.date <= today).sort((a, b) => b.date.localeCompare(a.date));
    return { name: n, client: entity === 'property' ? (rs.find(c => c.client)?.client || '') : '', last: past[0]?.date || null, ...agg(cur), prevMargen: agg(prev).margen };
  });
  return { body: { from, to, pFrom, pTo, entity, items: out } };
}

export async function handleReports(req, res) {
  try {
    const q = req.query || {};
    const fn = { margin, rank, houses, house, compare, visits: visitsKind }[q.kind];
    if (!fn) return res.status(400).json({ error: 'kind desconocido' });
    const out = await fn(q);
    return res.status(out.status || 200).json(out.body);
  } catch (e) { console.error('[reports]', e); return res.status(500).json({ error: e.message }); }
}
