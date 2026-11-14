
// ---------- Calculations ----------
dash.calc('upcoming', { title: 'Upcoming shows', description: 'Confirmed shows and holds from today on, with expected attendance: tickets sold, or 70% of capacity if that is higher.', inputs: ['shows'], fn: (shows) => {
  const today = new Date().toISOString().slice(0, 10);
  return shows.filter((s) => (s.status === 'Confirmed' || s.status === 'Hold') && s.date && s.date >= today)
    .map((s) => ({ show_id: s.id, date: s.date, show: s.show, city: s.city, venue: s.venue, region: s.region || s.country, status: s.status, capacity: s.capacity, tickets: s.tickets,
      expected: Math.max(s.tickets || 0, Math.round((s.capacity || 0) * 0.7)) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
} });

dash.calc('leg', { title: 'Upcoming show windows', description: 'For the next 14, 30, 60 and 90 days: confirmed shows and their expected tickets, plus holds in the same window.', inputs: ['upcoming'], fn: (upcoming) => {
  const out = [];
  for (const days of [14, 30, 60, 90]) {
    const end = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
    const conf = upcoming.filter((u) => u.status === 'Confirmed' && u.date <= end);
    const holds = upcoming.filter((u) => u.status === 'Hold' && u.date <= end);
    out.push({ key: 'next' + days, days, shows: conf.length, expected: conf.reduce((t, u) => t + u.expected, 0), holds: holds.length, expected_holds: holds.reduce((t, u) => t + u.expected, 0),
      first_date: conf.length ? conf[0].date : null, first_city: conf.length ? conf[0].city : '', last_date: conf.length ? conf[conf.length - 1].date : null, last_city: conf.length ? conf[conf.length - 1].city : '' });
  }
  return out;
} });

dash.calc('road_plan', { title: 'Road forecast by product', description: 'Units per 100 tickets from each product’s last 10 shows with sales; forecast need and spare or short for the next 14, 30, 60 and 90 days (with and without holds); and the show where road stock runs out.', inputs: ['products', 'sales', 'shows', 'upcoming'], fn: (products, sales, shows, upcoming) => {
  const today = new Date().toISOString().slice(0, 10);
  const until = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const showById = new Map(shows.map((s) => [s.id, s]));
  const perShow = new Map();
  for (const s of sales) {
    if (s.channel !== 'Show POS' || !s.show_id || !s.product_id) continue;
    const m = perShow.get(s.product_id) || new Map();
    m.set(s.show_id, (m.get(s.show_id) || 0) + s.units - s.refunded);
    perShow.set(s.product_id, m);
  }
  const posShowIds = new Set(sales.filter((s) => s.channel === 'Show POS' && s.show_id).map((s) => s.show_id));
  const posShows = [...posShowIds].map((id) => showById.get(id)).filter((s) => s && s.status === 'Played' && s.tickets > 0 && s.date && s.date < today).sort((a, b) => (a.date < b.date ? 1 : -1));
  const conf = upcoming.filter((u) => u.status === 'Confirmed');
  const both = upcoming.filter((u) => u.status === 'Confirmed' || u.status === 'Hold');
  const sumTo = (arr, n) => arr.filter((u) => u.date <= until(n)).reduce((t, u) => t + u.expected, 0);
  const runOut = (arr, rate, road) => { let cum = 0; for (const u of arr.filter((x) => x.date <= until(180))) { cum += rate * u.expected; if (cum > road) return u; } return null; };
  return products.filter((p) => p.status !== 'Discontinued' && p.category !== 'Bundle').map((p) => {
    const m = perShow.get(p.id);
    if (!m && !(p.road > 0)) return null;
    const firstDate = m ? [...m.keys()].map((id) => showById.get(id)).filter((s) => s && s.date).map((s) => s.date).sort()[0] : null;
    const used = firstDate ? posShows.filter((s) => s.date >= firstDate).slice(0, 10) : [];
    const tickets = used.reduce((t, s) => t + s.tickets, 0);
    const units = used.reduce((t, s) => t + ((m && m.get(s.id)) || 0), 0);
    const rate = tickets > 0 ? units / tickets : 0;
    if (rate === 0 && !(p.road > 0)) return null;
    const road = p.road || 0;
    const o = { product: p.product, product_id: p.id, road, rate, rate_per_100: Math.round(rate * 1000) / 10, shows_used: used.length };
    for (const n of [14, 30, 60, 90]) {
      o['need_' + n] = Math.round(rate * sumTo(conf, n));
      o['need_' + n + '_holds'] = Math.round(rate * sumTo(both, n));
      o['gap_' + n] = road - o['need_' + n];
      o['gap_' + n + '_holds'] = road - o['need_' + n + '_holds'];
    }
    const a = runOut(conf, rate, road), b = runOut(both, rate, road);
    o.runs_out_date = a ? a.date : null; o.runs_out_city = a ? a.city + (a.region ? ', ' + a.region : '') : '';
    o.runs_out_holds_date = b ? b.date : null; o.runs_out_holds_city = b ? b.city + (b.region ? ', ' + b.region : '') : '';
    o.runs_out = a ? a.date + ' ' + a.city : '';
    o.need = o.need_30; o.need_with_holds = o.need_30_holds; o.gap = o.gap_30;
    return o;
  }).filter(Boolean).sort((a, b) => a.gap - b.gap);
} });

dash.calc('road_strip', { title: 'Road stock left after each show', description: 'For each product and each confirmed show or hold in the next 90 days: units forecast to be left after that show, counting confirmed shows only and counting holds too.', inputs: ['road_plan', 'upcoming'], fn: (road_plan, upcoming) => {
  const end = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const shows = upcoming.filter((u) => (u.status === 'Confirmed' || u.status === 'Hold') && u.date <= end);
  const out = [];
  for (const r of road_plan) {
    let conf = 0, all = 0;
    for (const u of shows) {
      const n = (r.rate || 0) * u.expected; all += n; if (u.status === 'Confirmed') conf += n;
      out.push({ product_show: r.product + '|' + u.show_id, product: r.product, show_id: u.show_id, date: u.date, city: u.city, region: u.region || '', status: u.status,
        left_confirmed: u.status === 'Confirmed' ? Math.round(r.road - conf) : null, left_with_holds: Math.round(r.road - all), road: r.road, venue: u.venue || '', expected: u.expected, projected_units: Math.round(n * 10) / 10 });
    }
  }
  return out;
} });

dash.calc('show_days', { title: 'Show days and offers', description: 'Every date from 90 days back to 120 days ahead that has a show (played or confirmed, including shows booked directly) or an offer / hold, with its city and venue. Dates not listed are travel or days off.', inputs: ['shows'], fn: (shows) => {
  const from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10), to = new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 10);
  const m = new Map();
  for (const s of shows) {
    if (!s.date || s.date < from || s.date > to) continue;
    const kind = s.status === 'Played' || s.status === 'Confirmed' ? 'show' : s.status === 'Hold' ? 'offer' : null; if (!kind) continue;
    const prev = m.get(s.date); if (prev && prev.kind === 'show') continue;
    m.set(s.date, { date: s.date, kind, city: s.city, venue: s.venue || '' });
  }
  return [...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
} });

dash.calc('road_history', { title: 'Units sold per show, last 60 days', description: 'Point-of-sale units sold (net of refunds) per product at each show in the last 60 days. For shows since road stock started being tracked (Nov 12, 2026), an estimate of units left after the show: today’s road count plus what sold at later shows.', inputs: ['sales', 'shows', 'products'], fn: (sales, shows, products) => {
  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const showById = new Map(shows.map((x) => [x.id, x])); const nameById = new Map(products.map((p) => [p.id, p.product]));
  const g = new Map();
  for (const s of sales) {
    if (s.channel !== 'Show POS' || !s.show_id || !s.product_id || !s.date || s.date < since) continue;
    const show = showById.get(s.show_id); const name = nameById.get(s.product_id); if (!show || !name) continue;
    const k = name + '|' + s.show_id; const a = g.get(k) || { product_show: k, product: name, show_id: s.show_id, date: show.date || s.date, venue: show.venue || '', tickets: show.tickets, city: show.city, units: 0 };
    a.units += s.units - s.refunded; g.set(k, a);
  }
  const TRACKED_FROM = '2026-11-12'; const today = new Date().toISOString().slice(0, 10);
  const roadNow = new Map(products.map((p) => [p.product, p.road || 0]));
  const rows = [...g.values()];
  for (const a of rows) {
    if (a.date < TRACKED_FROM || a.date >= today) { a.left_after_est = null; continue; }
    const later = rows.filter((b) => b.product === a.product && b.date > a.date).reduce((t, b) => t + b.units, 0);
    a.left_after_est = (roadNow.get(a.product) || 0) + later;
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
} });

dash.calc('stock', { title: 'Stock by location and size', description: 'Road and web stock per product from the last sync, split by size where the product has sizes, with web weeks left from the 8-week pace. Apparel is grouped as soft goods; music and everything else as hard goods.', inputs: ['products', 'web_plan'], fn: (products, web_plan) => {
  const order = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  const web = new Map(web_plan.map((w) => [w.product_id, w]));
  const group = (p) => { const c = p.category || ''; return (/T-Shirt|Hoodie|Sweater|Hat|Apparel|Toque|Beanie|Sock/.test(c) || /tee|shirt|sweater|hoodie|crewneck|hat|toque|beanie|cap\b/i.test(p.product)) ? 'Soft goods' : 'Hard goods'; };
  const rows = [];
  for (const p of products) {
    if (p.status === 'Discontinued' || p.category === 'Bundle' || /bundle/i.test(p.product)) continue;
    for (const [loc, label] of [['road', 'Road'], ['web', 'Web']]) {
      const total = loc === 'road' ? p.road : p.web;
      if (total == null) continue;
      const m = new RegExp(label + '\\s+([^|]*)').exec(p.sizes || '');
      const pairs = m ? [...m[1].matchAll(/([0-9]?X{0,3}[SML]|[0-9]XL)\s*:\s*(-?\d+)/g)] : [];
      const w = web.get(p.id);
      const base = { location: loc, product: p.product, group: group(p), total, per_week: loc === 'web' && w ? w.per_week : null, weeks_left: loc === 'web' && w ? w.weeks_cover : null };
      if (pairs.length) for (const [, size, q] of pairs) rows.push({ ...base, key: loc + '|' + p.product + '|' + size, size, qty: Number(q), sort: order.indexOf(size) });
      else rows.push({ ...base, key: loc + '|' + p.product + '|', size: '', qty: total, sort: 0 });
    }
  }
  return rows;
} });

dash.calc('sales_series', { title: 'Sales by day, week and month', description: 'Gross sales in Canadian dollars and units sold (net of refunds) per day, per week (starting Monday) and per month, split into Shows, Web and Other.', inputs: ['sales'], fn: (sales) => {
  const out = new Map();
  const weekOf = (d) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
  for (const s of sales) {
    if (!s.date) continue;
    const channel = s.channel === 'Show POS' ? 'Shows' : s.channel === 'Web' ? 'Web' : 'Other';
    for (const [grain, period] of [['day', s.date], ['week', weekOf(s.date)], ['month', s.date.slice(0, 7) + '-01']]) {
      const key = grain + '|' + period + '|' + channel;
      const a = out.get(key) || { key, grain, period, channel, gross: 0, units: 0 };
      a.gross += s.gross_cad; a.units += s.units - s.refunded; out.set(key, a);
    }
  }
  return [...out.values()].map((a) => ({ ...a, gross: Math.round(a.gross * 100) / 100 })).sort((a, b) => (a.key < b.key ? -1 : 1));
} });

dash.calc('web_plan', { title: 'Web stock cover', description: 'Web stock, web units sold in the last 8 weeks (net of refunds), weekly pace and weeks of cover per product.', inputs: ['products', 'sales'], fn: (products, sales) => {
  const since = new Date(Date.now() - 56 * 864e5).toISOString().slice(0, 10);
  const u = new Map();
  for (const s of sales) if (s.channel === 'Web' && s.product_id && s.date && s.date >= since) u.set(s.product_id, (u.get(s.product_id) || 0) + s.units - s.refunded);
  return products.filter((p) => p.status !== 'Discontinued' && p.category !== 'Bundle' && ((u.get(p.id) || 0) > 0 || (p.web || 0) !== 0)).map((p) => {
    const units = u.get(p.id) || 0; const perWeek = units / 8;
    return { product: p.product, product_id: p.id, web: p.web || 0, units_8wk: units, per_week: Math.round(perWeek * 10) / 10,
      weeks_cover: perWeek > 0 ? Math.round(((p.web || 0) / perWeek) * 10) / 10 : null };
  }).sort((a, b) => (a.weeks_cover ?? 9999) - (b.weeks_cover ?? 9999));
} });

dash.calc('road_sizes', { title: 'Road stock by size, with run-out shows', description: 'For apparel John carries: units on hand per size, each size’s share of show sales (the product’s own size sales once it has 30 or more sized units, otherwise all apparel together, otherwise a typical tee split), and the first confirmed show, and the first show counting offers and holds, where that size is projected to run out within 180 days.', inputs: ['road_plan', 'upcoming', 'stock', 'size_sales', 'products'], fn: (road_plan, upcoming, stock, size_sales, products) => {
  const ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  const TYPICAL = { XS: 0.02, S: 0.15, M: 0.28, L: 0.28, XL: 0.17, '2XL': 0.07, '3XL': 0.03 };
  const nameById = new Map(products.map((p) => [p.id, p.product]));
  const own = new Map(), shows = new Map(), pool = {};
  for (const r of size_sales) {
    if (r.channel === 'Web' || !r.size || !(r.units > 0)) continue;
    const p = nameById.get(r.product_id); if (!p) continue;
    const m = own.get(p) || {}; m[r.size] = (m[r.size] || 0) + r.units; own.set(p, m);
    if (r.show_id) { const st = shows.get(p) || new Set(); st.add(r.show_id); shows.set(p, st); }
    pool[r.size] = (pool[r.size] || 0) + r.units;
  }
  const sum = (o) => Object.values(o).reduce((t, v) => t + v, 0);
  const until = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
  const conf = upcoming.filter((u) => u.status === 'Confirmed' && u.date <= until), both = upcoming.filter((u) => (u.status === 'Confirmed' || u.status === 'Hold') && u.date <= until);
  const plan = new Map(road_plan.map((r) => [r.product, r]));
  const bySize = new Map();
  for (const x of stock) if (x.location === 'road' && x.size && x.group === 'Soft goods') { const a = bySize.get(x.product) || []; a.push(x); bySize.set(x.product, a); }
  // Apparel with nothing on tour still gets its sizes (at 0), taken from the web store's size list.
  for (const x of stock) if (x.location === 'web' && x.size && x.group === 'Soft goods' && stock.some((y) => y.location === 'road' && y.product === x.product && !y.size)) { const a = bySize.get(x.product) || []; if (!a.some((y) => y.size === x.size)) a.push({ ...x, location: 'road', qty: 0 }); bySize.set(x.product, a); }
  const out = [];
  for (const [product, rows] of bySize) {
    const r = plan.get(product); const rate = r ? r.rate || 0 : 0;
    const o = own.get(product) || {};
    const basis = sum(o) >= 30 ? 'own' : sum(pool) >= 30 ? 'all apparel' : 'typical';
    const src = basis === 'own' ? o : basis === 'all apparel' ? pool : TYPICAL;
    const tot = rows.reduce((t, x) => t + (src[x.size] || 0), 0) || 1;
    const runOut = (arr, qty, share) => { if (qty <= 0) return rate * share > 0 ? { date: 'now', city: '' } : null; let c = 0; for (const u of arr) { c += rate * u.expected * share; if (qty - c < -0.5) return { date: u.date, city: u.city + (u.region ? ', ' + u.region : '') }; } return null; };
    for (const x of rows) {
      const share = (src[x.size] || 0) / tot;
      const a = runOut(conf, x.qty, share), b = runOut(both, x.qty, share);
      out.push({ key: product + '|' + x.size, product, size: x.size, sort: ORDER.indexOf(x.size), qty: x.qty, share: Math.round(share * 1000) / 1000, selling: rate * share > 0, basis, size_units: Math.round(sum(o)), size_shows: (shows.get(product) || new Set()).size,
        runs_out_date: a ? a.date : null, runs_out_city: a ? a.city : '', runs_out_holds_date: b ? b.date : null, runs_out_holds_city: b ? b.city : '' });
    }
  }
  return out.sort((a, b) => (a.product < b.product ? -1 : a.product > b.product ? 1 : a.sort - b.sort));
} });

dash.calc('tour_status', { title: 'Tour stock status', description: 'Each product John carries or sells at shows: units on hand with John; the run total (on hand now + units sold at shows since the current run began, i.e. what he started with plus any top-ups; a run begins after a break of more than 14 days between shows); and the first projected run-out (the product, or any one of its sizes) against confirmed shows. Red if that is within 24 days (3½ weeks), yellow within 90 days (3 months), green otherwise.', inputs: ['road_plan', 'road_sizes', 'upcoming', 'shows', 'sales'], fn: (road_plan, road_sizes, upcoming, shows, sales) => {
  const today = new Date().toISOString().slice(0, 10); const t0 = Date.parse(today + 'T00:00:00Z');
  // Current run: walk back through played shows until a break of more than 14 days.
  const played = shows.filter((x) => x.date && x.date <= today && (x.status === 'Played' || x.status === 'Confirmed')).map((x) => x.date).sort().reverse();
  let runStart = null; for (let i = 0; i < played.length; i++) { if (i === 0) { if ((t0 - Date.parse(played[0] + 'T00:00:00Z')) / 864e5 > 14) break; runStart = played[0]; continue; } if ((Date.parse(played[i - 1] + 'T00:00:00Z') - Date.parse(played[i] + 'T00:00:00Z')) / 864e5 > 14) break; runStart = played[i]; }
  const soldRun = new Map(); if (runStart) for (const s of sales) if (s.channel === 'Show POS' && s.product_id && s.date && s.date >= runStart && s.date <= today) soldRun.set(s.product_id, (soldRun.get(s.product_id) || 0) + s.units - s.refunded);
  const out = [];
  for (const r of road_plan) {
    if (!(r.road > 0) && !(r.rate > 0)) continue;
    const c = [];
    if (!(r.road > 0) && r.rate > 0) c.push({ date: today, where: 'None on tour', size: '' });
    if (r.runs_out_date) c.push({ date: r.runs_out_date, where: r.runs_out_city, size: '' });
    for (const z of road_sizes) if (z.product === r.product && z.runs_out_date) c.push(z.runs_out_date === 'now' ? { date: today, where: 'Out now', size: z.size } : { date: z.runs_out_date, where: z.runs_out_city, size: z.size });
    c.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.size ? 1 : 0) - (b.size ? 1 : 0)));
    const f = c[0] || null; const days = f ? Math.round((Date.parse(f.date + 'T00:00:00Z') - t0) / 864e5) : null;
    const status = days != null && days <= 24 ? 'Red' : days != null && days <= 90 ? 'Yellow' : 'Green';
    const sizes = f ? [...new Set(c.filter((x) => x.date === f.date && x.size).map((x) => x.size))] : [];
    const need = (n) => { const end = new Date(t0 + n * 864e5).toISOString().slice(0, 10); return Math.round((r.rate || 0) * upcoming.filter((u) => u.status === 'Confirmed' && u.date <= end).reduce((t, u) => t + u.expected, 0)); };
    const sold_run = Math.max(0, Math.round(soldRun.get(r.product_id) || 0));
    out.push({ product: r.product, road: r.road || 0, run_start: runStart, sold_run, run_total: Math.max(0, r.road || 0) + sold_run, need_24: need(24), need_90: need(90), status, rank: status === 'Red' ? 0 : status === 'Yellow' ? 1 : 2, first_out: f ? f.date : null, days, where: f ? f.where : '', sizes: sizes.join(', '), has_sales: r.rate > 0 });
  }
  return out.sort((a, b) => a.rank - b.rank || (a.first_out || '9999').localeCompare(b.first_out || '9999') || a.product.localeCompare(b.product));
} });

dash.calc('tour_need', { title: 'Tour stock: have, need, short', description: 'For each product John carries or sells at shows, and for two periods (the next 14 days, and up to the last confirmed show): units on hand with John, units needed for the confirmed shows in that period (units per 100 tickets × expected tickets), units short (for apparel, added up size by size) or spare, and the first show where the product or one of its sizes runs out within that period. Short if anything is short; tight if the spare is under 20% of what is needed; enough otherwise.', inputs: ['road_plan', 'road_sizes', 'upcoming'], fn: (road_plan, road_sizes, upcoming) => {
  const today = new Date().toISOString().slice(0, 10);
  const conf = upcoming.filter((u) => u.status === 'Confirmed' && u.date <= new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10));
  const ends = { d14: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), tour: conf.length ? conf[conf.length - 1].date : today };
  const out = [];
  for (const [range, end] of Object.entries(ends)) {
    const exp = conf.filter((u) => u.date <= end).reduce((t, u) => t + u.expected, 0);
    for (const r of road_plan) {
      const road = Math.max(0, r.road || 0); const rate = r.rate || 0;
      if (!(road > 0) && !(rate > 0)) continue;
      const sizes = road_sizes.filter((z) => z.product === r.product);
      const need = sizes.length ? sizes.reduce((t, z) => t + Math.round(rate * z.share * exp), 0) : Math.round(rate * exp);
      const short = sizes.length ? sizes.reduce((t, z) => t + Math.max(0, Math.round(rate * z.share * exp) - Math.max(0, z.qty)), 0) : Math.max(0, need - road);
      const spare = short > 0 ? 0 : road - need;
      const outs = [];
      if (!(road > 0) && rate > 0) outs.push({ date: today, city: 'now', size: '' });
      if (r.runs_out_date && r.runs_out_date <= end) outs.push({ date: r.runs_out_date, city: r.runs_out_city, size: '' });
      for (const z of sizes) { if (z.runs_out_date === 'now') outs.push({ date: today, city: 'now', size: z.size }); else if (z.runs_out_date && z.runs_out_date <= end) outs.push({ date: z.runs_out_date, city: z.runs_out_city, size: z.size }); }
      outs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.size ? 1 : 0) - (b.size ? 1 : 0)));
      const f = outs[0] || null;
      const fSizes = f ? [...new Set(outs.filter((x) => x.date === f.date && x.size).map((x) => x.size))] : [];
      const status = short > 0 ? 'short' : need > 0 && spare < need * 0.2 ? 'tight' : 'ok';
      out.push({ key: r.product + '|' + range, product: r.product, range, end, on_hand: road, need, short, spare, status, rank: status === 'short' ? 0 : status === 'tight' ? 1 : 2,
        first_out_date: f ? f.date : null, first_out_city: f ? f.city : '', first_out_sizes: fSizes.join(', '), has_sizes: sizes.length > 0 });
    }
  }
  return out.sort((a, b) => a.rank - b.rank || b.short - a.short || (a.first_out_date || '9999').localeCompare(b.first_out_date || '9999') || a.product.localeCompare(b.product));
} });

dash.calc('tour_need_sizes', { title: 'Tour stock by size: have and need', description: 'For each shirt size John carries, and for the same two periods: units on hand, and units needed at the confirmed shows in that period (the product’s units per 100 tickets × expected tickets × that size’s share of show sales).', inputs: ['road_plan', 'road_sizes', 'upcoming'], fn: (road_plan, road_sizes, upcoming) => {
  const today = new Date().toISOString().slice(0, 10);
  const conf = upcoming.filter((u) => u.status === 'Confirmed' && u.date <= new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10));
  const ends = { d14: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), tour: conf.length ? conf[conf.length - 1].date : today };
  const rate = new Map(road_plan.map((r) => [r.product, r.rate || 0]));
  const out = [];
  for (const [range, end] of Object.entries(ends)) {
    const exp = conf.filter((u) => u.date <= end).reduce((t, u) => t + u.expected, 0);
    for (const z of road_sizes) {
      const need = Math.round((rate.get(z.product) || 0) * z.share * exp); const have = Math.max(0, z.qty);
      out.push({ key: z.product + '|' + range + '|' + z.size, product: z.product, range, size: z.size, sort: z.sort, have, need, short: Math.max(0, need - have) });
    }
  }
  return out;
} });

dash.calc('tour_need_sum', { title: 'Tour stock counts', description: 'For each period: how many products are short, tight or covered, and the total units short.', inputs: ['tour_need'], fn: (tour_need) => ['d14', 'tour'].map((range) => {
  const rows = tour_need.filter((r) => r.range === range);
  return { range, end: rows.length ? rows[0].end : null, short_products: rows.filter((r) => r.status === 'short').length, tight_products: rows.filter((r) => r.status === 'tight').length, ok_products: rows.filter((r) => r.status === 'ok').length, short_units: rows.reduce((t, r) => t + r.short, 0) };
}) });

dash.calc('quotes', { title: 'Supplier quotes and invoices by product', description: 'Each supplier document with its product, retail price, unit cost ex-HST, profit per unit and margin at retail, how many months the quantity would last at the last 90 days’ sales pace (shows and web together), and, for open quotes on the same product, the extra cost per extra unit compared with the next smaller quote.', inputs: ['supplier_docs', 'products', 'sales'], fn: (supplier_docs, products, sales) => {
  const prod = new Map(products.map((p) => [p.id, p]));
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const sold = new Map(); for (const s of sales) if (s.product_id && s.date && s.date >= since) sold.set(s.product_id, (sold.get(s.product_id) || 0) + s.units - s.refunded);
  const rows = supplier_docs.map((d) => { const p = prod.get(d.product_id) || {}; const per_month = (sold.get(d.product_id) || 0) / 3; const unit = d.unit_cost ?? (d.subtotal && d.qty ? d.subtotal / d.qty : null);
    return { doc_id: d.doc_id, document: d.document, type: d.type, status: d.status, supplier: d.supplier, number: d.number, date: d.date, due: d.due, run: d.run, product_id: d.product_id, product: p.product || 'Unlinked', price: p.price ?? null,
      qty: d.qty, subtotal: d.subtotal, hst: d.hst, total: d.total, unit_cost: unit != null ? Math.round(unit * 100) / 100 : null, one_time: d.one_time,
      profit_unit: unit != null && p.price ? Math.round((p.price - unit) * 100) / 100 : null, margin: unit != null && p.price ? Math.round(((p.price - unit) / p.price) * 1000) / 10 : null,
      per_month: Math.round(per_month * 10) / 10, months_cover: per_month > 0 && d.qty ? Math.round((d.qty / per_month) * 10) / 10 : null, extra_unit: null, extra_vs: null };
  });
  const open = rows.filter((r) => r.type === 'Quote' && r.status === 'Open');
  for (const r of open) { const smaller = open.filter((o) => o.product_id === r.product_id && o.qty < r.qty && o.subtotal != null).sort((a, b) => b.qty - a.qty)[0];
    if (smaller && r.subtotal != null) { r.extra_unit = Math.round(((r.subtotal - smaller.subtotal) / (r.qty - smaller.qty)) * 100) / 100; r.extra_vs = smaller.qty; } }
  return rows.sort((a, b) => (a.product < b.product ? -1 : a.product > b.product ? 1 : (b.date || '').localeCompare(a.date || '') || (a.qty || 0) - (b.qty || 0)));
} });

dash.calc('reorder', { title: 'Reorder timeline', description: 'First run-out date per product (road against booked shows, counting any single size running out; web against the 8-week pace) and the order-by date after subtracting the lead time in Notion.', inputs: ['products', 'road_plan', 'web_plan', 'road_sizes'], fn: (products, road_plan, web_plan, road_sizes) => {
  const day = 864e5; const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const iso = (d) => d.toISOString().slice(0, 10);
  const road = new Map(road_plan.map((r) => [r.product_id, r]));
  const web = new Map(web_plan.map((r) => [r.product_id, r]));
  const out = [];
  for (const p of products) {
    const r = road.get(p.id), w = web.get(p.id);
    if (!r && !w) continue;
    const cands = [];
    if (r && r.runs_out_date) cands.push({ date: r.runs_out_date, where: 'Road, at ' + r.runs_out_city });
    for (const z of road_sizes) if (z.product === p.product && z.runs_out_date) cands.push({ date: z.runs_out_date === 'now' ? iso(today) : z.runs_out_date, where: 'Road, size ' + z.size + (z.runs_out_date === 'now' ? ' (out now)' : ' at ' + z.runs_out_city) });
    if (w && w.per_week > 0) { const wk = Math.max(0, w.web) / w.per_week; cands.push({ date: iso(new Date(today.getTime() + wk * 7 * day)), where: 'Web store' }); }
    cands.sort((a, b) => (a.date < b.date ? -1 : 1));
    const first = cands[0] || null;
    let order_by = null, status;
    if (!first) status = 'OK';
    else if (p.lead_days == null) status = 'Set lead time';
    else {
      order_by = iso(new Date(new Date(first.date + 'T00:00:00Z').getTime() - p.lead_days * day));
      const daysLeft = (new Date(order_by + 'T00:00:00Z') - today) / day;
      status = daysLeft <= 0 ? 'Order now' : daysLeft <= 30 ? 'Order within 30 days' : 'OK';
    }
    out.push({ product: p.product, product_id: p.id, status, first_out: first ? first.date : null, first_out_where: first ? first.where : 'Not within 180 days', lead_days: p.lead_days, order_by });
  }
  const rank = { 'Order now': 0, 'Order within 30 days': 1, 'Set lead time': 2, 'OK': 3 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || ((a.first_out || '9999') < (b.first_out || '9999') ? -1 : 1));
} });



dash.calc('show_perf', { title: 'Merch per ticket by show', description: 'For played shows with tickets sold: merch gross from point-of-sale sales (or the calendar’s merch gross when no sales are linked) divided by tickets sold.', inputs: ['shows', 'sales'], fn: (shows, sales) => {
  const by = new Map();
  for (const s of sales) {
    if (s.channel !== 'Show POS' || !s.show_id) continue;
    const a = by.get(s.show_id) || { units: 0, gross: 0 }; a.units += s.units - s.refunded; a.gross += s.gross_cad; by.set(s.show_id, a);
  }
  return shows.filter((x) => x.status === 'Played' && x.tickets > 0).map((x) => {
    const a = by.get(x.id);
    const fromSales = a && a.gross > 0;
    const gross = fromSales ? a.gross : (x.merch_gross_cal > 0 ? x.merch_gross_cal : null);
    if (gross == null) return null;
    const region = x.region || (x.country === 'Other' ? 'Outside North America' : x.country);
    return { show_id: x.id, date: x.date, show: x.show, city: x.city, region, tickets: x.tickets, capacity: x.capacity,
      gross: Math.round(gross * 100) / 100, gross_from: fromSales ? 'Sales' : 'Calendar', per_ticket: Math.round((gross / x.tickets) * 100) / 100 };
  }).filter(Boolean).sort((a, b) => (a.date < b.date ? 1 : -1));
} });

