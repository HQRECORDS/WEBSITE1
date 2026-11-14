
const S = window.jmState;
if (S.tsRange !== 'd14' && S.tsRange !== 'tour') S.tsRange = 'tour';
// ---------- Pins: checked products sit at the top of every inventory view (saved in this browser) ----------
const PIN_KEY = 'jm-pinned-products';
const PIN_DRAWS = ['ov-cards', 'tour-gauges', 'road-multiples', 'road-grid', 'stock-list'];
const pinSet = () => { if (!window.jmPins) { let a = []; try { a = JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); } catch (e) { a = []; } window.jmPins = new Set(Array.isArray(a) ? a : []); } return window.jmPins; };
const isPinned = (p) => pinSet().has(p);
const pinFirst = (arr, nameOf) => { const P = pinSet(); return arr.filter((x) => P.has(nameOf(x))).concat(arr.filter((x) => !P.has(nameOf(x)))); };
const pinBox = (product) => {
  const lab = document.createElement('label'); lab.className = 'jm-pin'; lab.title = 'Pin to the top';
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = isPinned(product); cb.setAttribute('aria-label', 'Pin ' + product + ' to the top');
  cb.addEventListener('click', (ev) => ev.stopPropagation());
  cb.addEventListener('change', () => { const P = pinSet(); if (cb.checked) P.add(product); else P.delete(product); try { localStorage.setItem(PIN_KEY, JSON.stringify([...P])); } catch (e) { /* kept for this visit only */ } PIN_DRAWS.forEach((n) => dash.draw(n)); });
  lab.appendChild(cb); return lab;
};
const togglePin = (product) => { const P = pinSet(); if (P.has(product)) P.delete(product); else P.add(product); try { localStorage.setItem(PIN_KEY, JSON.stringify([...P])); } catch (e) { /* kept for this visit only */ } PIN_DRAWS.forEach((n) => dash.draw(n)); };
const pinDivider = (cls) => { const d = document.createElement('div'); d.className = 'jm-pindiv ' + (cls || ''); d.textContent = 'Not pinned'; return d; };

// ---------- Overview: on tour now ----------
dash.draw('tour-cap', (el) => {
  const u = dash.data('upcoming'); if (u.status !== 'ok') { el.textContent = '—'; return; }
  const conf = u.data.filter((x) => x.status === 'Confirmed'); const last = conf[conf.length - 1];
  el.textContent = last ? 'Projected from ' + conf.length + ' confirmed ' + (conf.length === 1 ? 'show' : 'shows') + ', booked through ' + jm.date(last.date) + '.' : 'No confirmed shows booked, so nothing is projected to sell.';
});
const TONE = { Red: 'bad', Yellow: 'warn', Green: 'ok', None: 'none' };
dash.draw('k-red', (el) => { const d = dash.data('tour_status'); el.textContent = d.status === 'ok' ? String(d.data.filter((r) => r.status === 'Red').length) : '—'; });
dash.draw('k-yellow', (el) => { const d = dash.data('tour_status'); el.textContent = d.status === 'ok' ? String(d.data.filter((r) => r.status === 'Yellow').length) : '—'; });
dash.draw('k-units', (el) => { const d = dash.data('tour_status'); el.textContent = d.status === 'ok' ? jm.int(d3.sum(d.data, (r) => r.road)) : '—'; });
dash.draw('k-units-sub', (el) => { const d = dash.data('tour_status'); el.textContent = d.status === 'ok' ? 'across ' + d.data.filter((r) => r.road > 0).length + ' products' : '—'; });
const pqNow = () => { const d = dash.data('profit_q'); if (d.status !== 'ok' || !d.data.length) return null; const q = d.data[d.data.length - 1]; return { d: d.data, q, prev: d.data[d.data.length - 2] || null }; };
dash.draw('k-profit-lbl', (el) => { const p = pqNow(); el.textContent = p ? 'Profit ' + p.q.label : 'Profit this quarter'; });
dash.draw('k-profit', (el) => { const p = pqNow(); el.textContent = p ? jm.money(p.q.profit) : '—'; });
dash.draw('k-profit-sub', (el) => { const p = pqNow(); if (!p) { el.textContent = '—'; return; } el.textContent = (p.q.margin != null ? p.q.margin + '% margin' : '') + (p.q.is_current ? ' · so far' : ''); });
dash.draw('tour-gauges', (el) => {
  const d = dash.data('tour_status'); if (d.status !== 'ok') { jm.placeholder(el, ['tour_status']); return; }
  if (!d.data.length) { const p = document.createElement('div'); p.className = 'jm-msg'; p.textContent = 'Nothing on tour and nothing selling at shows.'; el.replaceChildren(p); return; }
  el.replaceChildren(); el.style.position = 'relative'; const tip = jm.tip(el);
  const list = pinFirst(d.data, (r) => r.product); const nPin = list.filter((r) => isPinned(r.product)).length;
  list.forEach((r, i) => {
    if (nPin && i === nPin) el.appendChild(pinDivider());
    const tone = r.has_sales ? TONE[r.status] : 'none';
    const card = document.createElement('div'); card.className = 'jm-gauge ' + tone + (isPinned(r.product) ? ' pinned' : ''); card.appendChild(pinBox(r.product));
    const h = document.createElement('div'); h.className = 'g-name'; h.textContent = r.product;
    const box = document.createElement('div'); box.className = 'g-dial';
    const v = document.createElement('div'); v.className = 'g-val'; const vb = document.createElement('b'); vb.textContent = jm.int(r.road);
    vb.setAttribute('data-source', 'tour_status'); vb.setAttribute('data-field', 'road'); vb.setAttribute('data-where', 'product=' + encodeURIComponent(r.product));
    const vs = document.createElement('small'); vs.textContent = 'on hand'; v.append(vb, vs);
    const st = document.createElement('div'); st.className = 'g-st';
    const qd = dash.data('quotes'); const hasQ = qd.status === 'ok' && qd.data.some((q) => q.product === r.product && q.type === 'Quote' && q.status === 'Open');
    if (!r.has_sales) st.textContent = 'No show sales yet';
    else if (!r.first_out) st.textContent = 'Lasts past the booked shows';
    else if (r.days <= 0) st.textContent = r.sizes ? 'Out of ' + r.sizes + ' now' : 'None on tour';
    else st.textContent = (r.sizes ? r.sizes + ' runs out ' : 'Runs out ') + jm.shortDate(r.first_out) + ' · ' + r.days + (r.days === 1 ? ' day' : ' days');
    card.append(h, box, v, st);
    if (hasQ) { const qb = document.createElement('a'); qb.className = 'g-quote'; qb.href = '#stock'; qb.textContent = 'Reprint quote on file'; qb.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (window.jmShowPage) window.jmShowPage('stock', true); }); card.appendChild(qb); }
    el.appendChild(card);
    // dial
    const W = Math.max(160, box.clientWidth || 220), R = Math.min(W / 2 - 14, 96), H = R + 28;
    const max = Math.max(1, r.run_total);
    const sc = d3.scaleLinear().domain([0, max]).range([-Math.PI / 2, Math.PI / 2]).clamp(true);
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H).attr('role', 'img').attr('aria-label', r.product + ': ' + r.road + ' on hand');
    const g = svg.append('g').attr('transform', `translate(${W / 2},${R + 6})`);
    const arc = (r0, r1, a0, a1) => d3.arc()({ innerRadius: r0, outerRadius: r1, startAngle: a0, endAngle: a1 });
    if (r.has_sales) {
      const bands = [[0, r.need_24, 'var(--color-bad)'], [r.need_24, r.need_90, 'var(--color-warn)'], [r.need_90, max, 'var(--color-ok)']];
      bands.forEach(([a, b, c]) => { if (b > a) g.append('path').attr('d', arc(R - 7, R, sc(a), sc(b))).style('fill', c); });
    } else g.append('path').attr('d', arc(R - 7, R, -Math.PI / 2, Math.PI / 2)).style('fill', 'var(--color-border-line)');
    g.append('path').attr('d', arc(R * 0.5, R - 11, -Math.PI / 2, Math.PI / 2)).style('fill', 'color-mix(in srgb, var(--color-fg-muted) 14%, transparent)');
    const col = { bad: 'var(--color-bad)', warn: 'var(--color-warn)', ok: 'var(--color-ok)', none: 'var(--color-fg-muted)' }[tone];
    if (r.road > 0) g.append('path').attr('d', arc(R * 0.5, R - 11, -Math.PI / 2, sc(r.road))).style('fill', col);
    const a = sc(Math.max(0, r.road)); const nx = Math.sin(a) * (R - 4), ny = -Math.cos(a) * (R - 4);
    g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', nx).attr('y2', ny).style('stroke', 'var(--color-fg)').style('stroke-width', 4).style('stroke-linecap', 'round');
    g.append('circle').attr('r', 7).style('fill', 'var(--color-fg)');
    g.append('text').attr('x', -R + 3).attr('y', 14).attr('text-anchor', 'middle').attr('class', 'g-tick').text('0');
    g.append('text').attr('x', R - 3).attr('y', 14).attr('text-anchor', 'middle').attr('class', 'g-tick').text(jm.int(Math.round(max))).attr('data-source', 'tour_status').attr('data-field', 'run_total').attr('data-where', 'product=' + encodeURIComponent(r.product));
    const lines = [r.product + ': ' + jm.int(r.road) + ' on hand with John'];
    if (r.run_start) lines.push('This run (since ' + jm.shortDate(r.run_start) + '): ' + jm.int(r.run_total) + ' in total, ' + jm.int(r.sold_run) + ' sold so far');
    if (r.has_sales) { lines.push('3½ weeks of shows need about ' + jm.int(r.need_24)); lines.push('3 months of shows need about ' + jm.int(r.need_90)); }
    if (r.first_out && r.days > 0) lines.push((r.sizes ? 'Size ' + r.sizes : 'Stock') + ' runs out at ' + r.where + ' (' + jm.shortDate(r.first_out) + ')');
    card.addEventListener('mousemove', (ev) => tip.show(ev, lines)); card.addEventListener('mouseleave', () => tip.hide());
  });
});
dash.draw('pq-cap', (el) => { const p = pqNow(); if (!p) { el.textContent = '—'; return; } const nc = d3.sum(p.d, (q) => q.sales_no_cost); el.textContent = 'Sales minus HST/GST, cost of goods, venue cuts and card fees, in CAD.' + (nc > 0 ? ' ' + jm.money(nc) + ' of sales have no cost on file and are left out.' : ''); });
dash.draw('pq-chart', (el) => {
  const p = pqNow(); if (!p) { jm.placeholder(el, ['profit_q']); return; }
  const rows = p.d.slice(-8); el.replaceChildren(); el.style.position = 'relative';
  const W = Math.max(280, el.clientWidth), H = 260, m = { l: 8, r: 8, t: 28, b: 30 };
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Merch profit by quarter');
  const x = d3.scaleBand().domain(rows.map((q) => q.quarter)).range([m.l, W - m.r]).padding(0.28);
  const y = d3.scaleLinear().domain([Math.min(0, d3.min(rows, (q) => q.profit)), Math.max(1, d3.max(rows, (q) => q.profit))]).nice().range([H - m.b, m.t]);
  const defs = svg.append('defs');
  const gr = defs.append('linearGradient').attr('id', 'jm-pq-grad').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  gr.append('stop').attr('offset', '0%').style('stop-color', dash.colors[0]); gr.append('stop').attr('offset', '100%').style('stop-color', dash.colors[0]);
  const gc = defs.append('linearGradient').attr('id', 'jm-pq-cur').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  gc.append('stop').attr('offset', '0%').style('stop-color', dash.colors[0]); gc.append('stop').attr('offset', '100%').style('stop-color', dash.colors[0]);
  svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-axis)');
  const bars = svg.append('g').selectAll('g').data(rows).join('g');
  bars.append('rect').attr('x', (q) => x(q.quarter)).attr('width', x.bandwidth()).attr('y', (q) => y(Math.max(0, q.profit))).attr('height', (q) => Math.abs(y(q.profit) - y(0))).attr('rx', 6)
    .style('fill', (q) => (q.is_current ? 'url(#jm-pq-cur)' : 'url(#jm-pq-grad)')).style('opacity', (q) => (q.is_current ? 1 : 0.55))
    .attr('data-source', 'profit_q').attr('data-field', 'profit').attr('data-where', (q) => 'quarter=' + encodeURIComponent(q.quarter));
  bars.append('text').attr('x', (q) => x(q.quarter) + x.bandwidth() / 2).attr('y', (q) => y(Math.max(0, q.profit)) - 8).attr('text-anchor', 'middle').attr('class', 'pq-val').text((q) => '$' + (Math.abs(q.profit) >= 1000 ? d3.format('.1f')(q.profit / 1000) + 'k' : Math.round(q.profit)));
  bars.append('text').attr('x', (q) => x(q.quarter) + x.bandwidth() / 2).attr('y', H - 10).attr('text-anchor', 'middle').attr('class', 'pq-lab').text((q) => q.label + (q.is_current ? ' (so far)' : ''));
  const tip = jm.tip(el);
  bars.on('mousemove', (ev, q) => tip.show(ev, [q.label + (q.is_current ? ' (so far)' : ''), 'Profit ' + jm.money(q.profit) + (q.margin != null ? ' (' + q.margin + '% margin)' : ''), 'Sales ' + jm.money(q.sales), 'Cost of goods ' + jm.money(q.cogs) + (q.venue_cut ? ' · venue cuts ' + jm.money(q.venue_cut) : '') + (q.card_fee ? ' · card fees ' + jm.money(q.card_fee) : '')].concat(q.sales_no_cost > 0 ? [jm.money(q.sales_no_cost) + ' of sales with no cost on file'] : []))).on('mouseleave', () => tip.hide());
});

// ---------- Road: shared helpers ----------
const DAY = 864e5;
const RANGE_BACK = -60, RANGE_AHEAD = 60;
const todayUTC = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
const isoOff = (n) => new Date(todayUTC().getTime() + n * DAY).toISOString().slice(0, 10);
const pd = (s) => new Date(s + 'T00:00:00Z');
const roadWindow = () => ({ from: isoOff(S.roadFrom), to: isoOff(S.roadTo), today: isoOff(0) });
const leftOf = (x) => (S.holds ? x.left_with_holds : x.left_confirmed);
const futureRows = (strip, product, w) => strip.filter((x) => x.product === product && x.date >= w.today && x.date >= w.from && x.date <= w.to && (S.holds || x.status === 'Confirmed'));
const orderedProducts = () => {
  const plan = dash.data('road_plan'), strip = dash.data('road_strip');
  if (plan.status !== 'ok' || strip.status !== 'ok') return null;
  const w = roadWindow();
  const rows = plan.data.filter((r) => r.road > 0 || r.rate > 0).map((r) => { const f = futureRows(strip.data, r.product, w); const lefts = f.map(leftOf); const so = firstSizeOut(r.product, f); const tOut = f.find((x) => leftOf(x) < 0);
    const firstOut = so.now.length ? '0000' : [so.later[0] && so.later[0].st.out.date, tOut && tOut.date].filter(Boolean).sort()[0] || '9999';
    return { r, f, firstOut, minLeft: lefts.length ? Math.min(...lefts) : r.road }; });
  if (S.roadSort === 'name') rows.sort((a, b) => (a.r.product < b.r.product ? -1 : 1));
  else if (S.roadSort === 'carrying') rows.sort((a, b) => b.r.road - a.r.road);
  else rows.sort((a, b) => a.firstOut.localeCompare(b.firstOut) || a.minLeft - b.minLeft || b.r.road - a.r.road);
  return pinFirst(rows, (o) => o.r.product);
};
const ROAD_DRAWS = ['road-multiples', 'road-grid', 'road-range-cap', 'road-modal'];
// Sizes: units left of one size after an upcoming show = on hand − its share of the product's projected sales so far.
const sizeRows = (product) => { const d = dash.data('road_sizes'); return d.status === 'ok' ? d.data.filter((z) => z.product === product) : []; };
const sizeLeft = (z, x) => z.qty - z.share * (x.road - leftOf(x));
const sizeStatus = (z, f) => {
  if (z.qty <= 0) return z.selling ? { kind: 'bad', out: 'now' } : { kind: 'grey' };
  const o = f.find((x) => sizeLeft(z, x) < -0.5);
  if (o) return { kind: 'bad', out: o };
  const end = f.length ? sizeLeft(z, f[f.length - 1]) : z.qty;
  return { kind: Math.round(end) <= 1 && f.length ? 'warn' : 'ok', end, last: f[f.length - 1] };
};
const placeOf = (x) => x.city + (x.region ? ', ' + x.region : '');
const BASIS_TXT = { own: 'from this shirt’s own show sales', 'all apparel': 'from all apparel sold at shows (not enough sized sales of this one yet)', typical: 'a typical tee split (no sized sales yet)' };
const sizeTip = (z, st) => {
  const L = [z.size + ' · ' + jm.int(z.qty) + ' on the road', 'About ' + Math.round(z.share * 100) + '% of sales, ' + BASIS_TXT[z.basis]];
  if (st.kind === 'grey') L.push('None on tour, and not expected to sell');
  else if (st.out === 'now') L.push('Out now');
  else if (st.out) L.push('Expected to run out at ' + placeOf(st.out) + ' (' + jm.shortDate(st.out.date) + ')');
  else if (st.last) L.push('About ' + Math.max(0, Math.round(st.end)) + ' left after ' + placeOf(st.last) + ' (' + jm.shortDate(st.last.date) + ')');
  if (z.basis !== 'own' || z.size_shows < 10) L.push('Early estimate: size data starts Oct 2026');
  return L;
};
const sizeChips = (wrap, product, f) => {
  const zs = sizeRows(product); if (!zs.length) return false;
  const strip = document.createElement('div'); strip.className = 'jm-szchips';
  zs.forEach((z) => { const st = sizeStatus(z, f); const c = document.createElement('span'); c.className = 'jm-szchip ' + st.kind; c.tabIndex = 0;
    const b = document.createElement('b'); b.textContent = jm.int(z.qty); b.setAttribute('data-source', 'road_sizes'); b.setAttribute('data-field', 'qty'); b.setAttribute('data-where', 'key=' + encodeURIComponent(z.key));
    const sm = document.createElement('small'); sm.textContent = z.size; c.append(b, sm);
    const lines = sizeTip(z, st); c.setAttribute('aria-label', lines.join('. '));
    c.addEventListener('mousemove', (ev) => { if (!wrap._tip) wrap._tip = jm.tip(wrap); wrap._tip.show(ev, lines); }); c.addEventListener('mouseleave', () => wrap._tip && wrap._tip.hide());
    strip.appendChild(c); });
  wrap.appendChild(strip); return true;
};
const firstSizeOut = (product, f) => {
  const zs = sizeRows(product).map((z) => ({ z, st: sizeStatus(z, f) })).filter((o) => o.st.out);
  const now = zs.filter((o) => o.st.out === 'now').map((o) => o.z.size);
  const later = zs.filter((o) => o.st.out !== 'now').sort((a, b) => (a.st.out.date < b.st.out.date ? -1 : 1));
  return { now, later };
};

// ---------- Road: date range slider (today in the middle) ----------
const dayKind = () => { const d = dash.data('show_days'); const m = new Map(); if (d.status === 'ok') for (const x of d.data) m.set(x.date, x); return m; };
const DAY_FILL = { show: 'color-mix(in srgb, var(--color-ok) 18%, transparent)', offer: 'color-mix(in srgb, var(--color-fg-muted) 16%, transparent)', off: 'color-mix(in srgb, var(--color-warn) 12%, transparent)' };
const buildRange = (el, getR, setR, after) => {
  el.replaceChildren();
  const days = dayKind();
  const W = Math.max(280, el.clientWidth), H = 62, m = { l: 10, r: 10, t: 20, b: 18 };
  const x = d3.scaleUtc().domain([pd(isoOff(RANGE_BACK)), pd(isoOff(RANGE_AHEAD))]).range([m.l, W - m.r]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Date range, from 60 days ago to 60 days ahead');
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 90))).tickFormat(d3.utcFormat('%b %-d')).tickSize(-(H - m.b - m.t)));
  const dots = [...days.values()].filter((d) => d.date >= isoOff(RANGE_BACK) && d.date <= isoOff(RANGE_AHEAD));
  svg.append('g').selectAll('circle').data(dots).join('circle').attr('cx', (d) => x(pd(d.date))).attr('cy', (H - m.b + m.t) / 2).attr('r', 3.2)
    .style('fill', (d) => (d.kind === 'show' ? 'var(--color-ok)' : 'var(--color-fg-muted)')).style('opacity', (d) => (d.kind === 'show' ? 0.9 : 0.6));
  svg.append('line').attr('x1', x(pd(isoOff(0)))).attr('x2', x(pd(isoOff(0)))).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--color-fg)').style('stroke-width', 1.5);
  svg.append('text').attr('x', x(pd(isoOff(0)))).attr('y', H - m.b - 4).attr('text-anchor', 'middle').style('font-weight', 600).style('fill', 'var(--color-fg)').text('Today');
  const labA = svg.append('text').attr('y', 12).style('fill', 'var(--color-fg)').style('font-weight', 600);
  const labB = svg.append('text').attr('y', 12).style('fill', 'var(--color-fg)').style('font-weight', 600);
  const showLabels = (sel) => {
    const [a, b] = sel; const da = d3.utcFormat('%b %-d')(x.invert(a)), db = d3.utcFormat('%b %-d')(x.invert(b));
    if (b - a < 90) { labA.attr('x', Math.max(40, Math.min(W - 40, (a + b) / 2))).attr('text-anchor', 'middle').text(da + ' – ' + db); labB.text(''); return; }
    labA.attr('x', a).attr('text-anchor', a < 40 ? 'start' : 'middle').text(da);
    labB.attr('x', b).attr('text-anchor', b > W - 40 ? 'end' : 'middle').text(db);
  };
  const brush = d3.brushX().extent([[m.l, m.t - 2], [W - m.r, H - m.b]])
    .on('brush', (ev) => { if (ev.selection) showLabels(ev.selection); })
    .on('end', (ev) => {
      if (!ev.sourceEvent) { if (ev.selection) showLabels(ev.selection); return; }
      let A = -14, B = 28;
      if (ev.selection) { const [a, b] = ev.selection.map((v) => Math.round((x.invert(v) - todayUTC()) / DAY)); A = Math.max(RANGE_BACK, Math.min(a, RANGE_AHEAD - 1)); B = Math.min(RANGE_AHEAD, Math.max(b, A + 1)); }
      setR(A, B);
      gB.call(brush.move, [x(pd(isoOff(A))), x(pd(isoOff(B)))]);
      after();
    });
  const gB = svg.append('g').call(brush);
  const [A0, B0] = getR();
  gB.call(brush.move, [x(pd(isoOff(A0))), x(pd(isoOff(B0)))]);
};
dash.draw('road-range', (el) => buildRange(el, () => [S.roadFrom, S.roadTo], (a, b) => { S.roadFrom = a; S.roadTo = b; }, () => ROAD_DRAWS.forEach((n) => dash.draw(n))));
dash.draw('road-range-cap', (el) => {
  const w = roadWindow(); const strip = dash.data('road_strip');
  let n = '', h = '';
  if (strip.status === 'ok') {
    const ids = new Map(); for (const r of strip.data) if (r.date >= w.today && r.date >= w.from && r.date <= w.to) ids.set(r.show_id, r.status);
    const conf = [...ids.values()].filter((v) => v === 'Confirmed').length, holds = [...ids.values()].filter((v) => v === 'Hold').length;
    n = ' · ' + conf + ' confirmed ' + (conf === 1 ? 'show' : 'shows') + ' ahead'; h = holds ? (S.holds ? ' + ' + holds + (holds === 1 ? ' offer / hold' : ' offers / holds') : ' (' + holds + (holds === 1 ? ' offer / hold' : ' offers / holds') + ' not counted)') : '';
  }
  el.textContent = 'Showing ' + jm.date(w.from) + ' to ' + jm.date(w.to) + n + h + '.';
});

// ---------- Road: chart for one product (used in cards and in the expanded view) ----------
const drawRoadChart = (box, r, f, hp, w, idx, big, zoom) => {
  const H = big ? 340 : 130, m = big ? { l: 40, r: 16, t: 22, b: 26 } : { l: 30, r: 10, t: 16, b: 18 };
  const Wc = Math.max(240, box.clientWidth || (big ? 800 : 280));
  const x = d3.scaleUtc().domain([pd(w.from), pd(w.to)]).range([m.l, Wc - m.r]);
  const line = [{ date: w.today, v: r.road }];
  for (const x2 of f) { line.push({ date: x2.date, v: line[line.length - 1].v }); line.push({ date: x2.date, v: leftOf(x2) }); }
  if (line.length && line[line.length - 1].date < w.to) line.push({ date: w.to, v: line[line.length - 1].v });
  const ymin = Math.min(0, d3.min(line, (d) => d.v)); const ymax = Math.max(1, r.road, d3.max(hp, (d) => d.units) || 0, d3.max(f, (d) => d.projected_units) || 0);
  const z = Math.max(1, zoom || 1);
  const y = d3.scaleLinear().domain(z > 1 ? [Math.max(ymin, -ymax / z), ymax / z] : [ymin, ymax]).nice(big ? 6 : 4).range([H - m.b, m.t]);
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${Wc} ${H}`).attr('role', 'img')
    .attr('aria-label', r.product + ': units sold per show, projected sales and projected stock left');
  const pid = 'jm-hatch-' + idx + (big ? 'b' : '');
  const defs = svg.append('defs');
  defs.append('pattern').attr('id', pid).attr('patternUnits', 'userSpaceOnUse').attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)').append('rect').attr('width', 2).attr('height', 5).style('fill', 'var(--color-fg-muted)');
  const above = 'jm-ab-' + idx + (big ? 'b' : ''), below = 'jm-bl-' + idx + (big ? 'b' : '');
  defs.append('clipPath').attr('id', above).append('rect').attr('x', m.l).attr('y', 0).attr('width', Wc - m.l - m.r).attr('height', y(0));
  defs.append('clipPath').attr('id', below).append('rect').attr('x', m.l).attr('y', y(0)).attr('width', Wc - m.l - m.r).attr('height', Math.max(0, H - y(0)));
  const tx = Math.max(m.l, Math.min(Wc - m.r, x(pd(w.today))));
  const plot = 'jm-plot-' + idx + (big ? 'b' : '');
  defs.append('clipPath').attr('id', plot).append('rect').attr('x', m.l).attr('y', m.t - 6).attr('width', Wc - m.l - m.r).attr('height', H - m.b - m.t + 6);
  const kinds = dayKind(); const dayList = []; for (let t = pd(w.from); t <= pd(w.to); t = new Date(t.getTime() + DAY)) dayList.push(t.toISOString().slice(0, 10));
  const dw = (Wc - m.l - m.r) / Math.max(1, (pd(w.to) - pd(w.from)) / DAY);
  svg.append('g').attr('clip-path', `url(#${plot})`).selectAll('rect').data(dayList).join('rect').attr('x', (d) => x(pd(d)) - dw / 2).attr('width', dw + 0.5).attr('y', m.t - 6).attr('height', H - m.b - m.t + 6)
    .style('fill', (d) => DAY_FILL[(kinds.get(d) || {}).kind || 'off']);
  if (big && dw >= 4) svg.append('g').attr('clip-path', `url(#${plot})`).selectAll('line').data(dayList).join('line').attr('x1', (d) => x(pd(d)) + dw / 2).attr('x2', (d) => x(pd(d)) + dw / 2).attr('y1', m.t - 6).attr('y2', H - m.b).style('stroke', 'var(--color-bg)').style('stroke-width', 1);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(big ? 6 : 3).tickSize(-(Wc - m.l - m.r))).call((g) => g.select('.domain').remove());
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(Wc / (big ? 80 : 90)))).tickFormat(d3.utcFormat('%b %-d')).tickSize(0).tickPadding(5)).call((g) => g.select('.domain').remove());
  if (w.today >= w.from && w.today <= w.to) {
    if (tx - m.l > 46) svg.append('text').attr('x', tx - 6).attr('y', m.t - 8 + (big ? 0 : 2)).attr('text-anchor', 'end').text('Actual');
    if (Wc - m.r - tx > 60) svg.append('text').attr('x', tx + 6).attr('y', m.t - 8 + (big ? 0 : 2)).text('Projected');
  }
  const area = d3.area().x((d) => x(pd(d.date))).y0(y(0)).y1((d) => y(d.v));
  const out = f.find((x2) => leftOf(x2) < 0);
  if (w.today >= w.from && w.today <= w.to) {
    const gA = svg.append('g').attr('clip-path', `url(#${plot})`);
    gA.append('path').datum(line).attr('d', area).attr('clip-path', `url(#${above})`).style('fill', 'var(--color-ok)').style('opacity', 0.18);
    gA.append('path').datum(line).attr('d', area).attr('clip-path', `url(#${below})`).style('fill', 'var(--color-bad)').style('opacity', 0.25);
    gA.append('path').datum(line).attr('d', d3.line().x((d) => x(pd(d.date))).y((d) => y(d.v))).style('fill', 'none').style('stroke', out ? 'var(--color-bad)' : 'var(--color-ok)').style('stroke-width', big ? 2.5 : 2);
  }
  svg.append('line').attr('x1', m.l).attr('x2', Wc - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-axis)');
  const span = Math.max(10, (pd(w.to) - pd(w.from)) / DAY);
  const bw = Math.max(3, Math.min(big ? 16 : 9, ((Wc - m.l - m.r) / span) * 0.8));
  const gBars = svg.append('g').attr('clip-path', `url(#${plot})`);
  gBars.append('g').selectAll('rect').data(hp).join('rect').attr('x', (d) => x(pd(d.date)) - bw / 2).attr('width', bw).attr('y', (d) => y(Math.max(0, d.units))).attr('height', (d) => y(0) - y(Math.max(0, d.units)))
    .style('fill', 'var(--color-fg-muted)').attr('data-source', 'road_history').attr('data-field', 'units').attr('data-where', (d) => 'product_show=' + encodeURIComponent(d.product_show));
  gBars.append('g').selectAll('rect').data(f).join('rect').attr('x', (d) => x(pd(d.date)) - bw / 2).attr('width', bw).attr('y', (d) => y(d.projected_units)).attr('height', (d) => y(0) - y(d.projected_units))
    .style('fill', `url(#${pid})`).style('stroke', 'var(--color-fg-muted)').style('stroke-width', 0.5);
  if (w.today >= w.from && w.today <= w.to) {
    svg.append('line').attr('x1', tx).attr('x2', tx).attr('y1', m.t - 6).attr('y2', H - m.b).style('stroke', 'var(--color-fg)').style('stroke-width', 1);
    const last = line[line.length - 1];
    const ly = y(last.v) + (last.v < 0 || y(last.v) - 5 < m.t + 14 ? 14 : -5);
    svg.append('text').attr('class', 'jm-val').attr('x', Wc - m.r - 2).attr('y', Math.max(m.t + 10, Math.min(H - m.b - 3, ly))).attr('text-anchor', 'end').text(jm.int(last.v) + ' left').style('fill', last.v < 0 ? 'var(--color-bad)' : 'var(--color-ok)').style('font-weight', 600);
  }
  if (big) {
    hp.forEach((d) => gBars.append('text').attr('x', x(pd(d.date))).attr('y', y(Math.max(0, d.units)) - 4).attr('text-anchor', 'middle').text(d.units));
    f.forEach((d) => gBars.append('text').attr('x', x(pd(d.date))).attr('y', y(d.projected_units) - 4).attr('text-anchor', 'middle').text(Math.round(d.projected_units)));
  }
  const events = hp.map((h) => ({ date: h.date, lines: [jm.date(h.date) + ' · show (played)', h.city + (h.venue ? ' – ' + h.venue : ''), (h.tickets ? jm.int(h.tickets) + ' tickets · ' : '') + 'sold ' + h.units] }))
    .concat(f.map((x2) => ({ date: x2.date, lines: [jm.date(x2.date) + (x2.status === 'Hold' ? ' · offer / hold' : ' · show'), x2.city + (x2.venue ? ' – ' + x2.venue : ''), jm.int(x2.expected) + ' tickets expected', 'Projected to sell ' + Math.round(x2.projected_units) + ', leaving ' + leftOf(x2)] })));
  const evDates = new Set(events.map((e) => e.date));
  if (big) dayList.filter((d) => !evDates.has(d)).forEach((d) => { const k = kinds.get(d); events.push({ date: d, lines: [jm.date(d), k ? (k.kind === 'show' ? 'Show: ' : 'Offer / hold: ') + k.city + (k.venue ? ' – ' + k.venue : '') : 'Travel or day off'] }); });
  const ctip = jm.tip(box);
  svg.append('g').selectAll('rect').data(events).join('rect').attr('x', (e) => x(pd(e.date)) - Math.max(dw / 2, 7)).attr('width', Math.max(dw, 14)).attr('y', m.t).attr('height', H - m.b - m.t).style('fill', 'transparent')
    .on('mousemove', (ev, e) => ctip.show(ev, e.lines)).on('mouseleave', () => ctip.hide());
};
const drawSizeChart = (box, r, f, w, zs, zoom) => {
  const H = 340, m = { l: 40, r: 44, t: 22, b: 26 };
  const Wc = Math.max(240, box.clientWidth || 800);
  const x = d3.scaleUtc().domain([pd(w.from), pd(w.to)]).range([m.l, Wc - m.r]);
  const series = zs.map((z, i) => { const pts = [{ date: w.today, v: z.qty }]; for (const x2 of f) { pts.push({ date: x2.date, v: pts[pts.length - 1].v }); pts.push({ date: x2.date, v: sizeLeft(z, x2) }); } if (pts[pts.length - 1].date < w.to) pts.push({ date: w.to, v: pts[pts.length - 1].v }); return { z, pts, color: dash.colors[i % dash.colors.length] }; });
  const all = series.flatMap((s) => s.pts.map((p) => p.v));
  const ymax = Math.max(1, ...all), ymin = Math.min(0, ...all); const zz = Math.max(1, zoom || 1);
  const y = d3.scaleLinear().domain(zz > 1 ? [Math.max(ymin, -ymax / zz), ymax / zz] : [ymin, ymax]).nice(6).range([H - m.b, m.t]);
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${Wc} ${H}`).attr('role', 'img').attr('aria-label', r.product + ': projected units left by size');
  const plot = 'jm-szplot'; svg.append('defs').append('clipPath').attr('id', plot).append('rect').attr('x', m.l).attr('y', m.t - 6).attr('width', Wc - m.l - m.r).attr('height', H - m.b - m.t + 6);
  const kinds = dayKind(); const dayList = []; for (let t = pd(w.from); t <= pd(w.to); t = new Date(t.getTime() + DAY)) dayList.push(t.toISOString().slice(0, 10));
  const dw = (Wc - m.l - m.r) / Math.max(1, (pd(w.to) - pd(w.from)) / DAY);
  svg.append('g').attr('clip-path', `url(#${plot})`).selectAll('rect').data(dayList).join('rect').attr('x', (d) => x(pd(d)) - dw / 2).attr('width', dw + 0.5).attr('y', m.t - 6).attr('height', H - m.b - m.t + 6).style('fill', (d) => DAY_FILL[(kinds.get(d) || {}).kind || 'off']);
  if (dw >= 4) svg.append('g').attr('clip-path', `url(#${plot})`).selectAll('line').data(dayList).join('line').attr('x1', (d) => x(pd(d)) + dw / 2).attr('x2', (d) => x(pd(d)) + dw / 2).attr('y1', m.t - 6).attr('y2', H - m.b).style('stroke', 'var(--color-bg)').style('stroke-width', 1);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(Wc - m.l - m.r))).call((g) => g.select('.domain').remove());
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(Wc / 80))).tickFormat(d3.utcFormat('%b %-d')).tickSize(0).tickPadding(5)).call((g) => g.select('.domain').remove());
  svg.append('line').attr('x1', m.l).attr('x2', Wc - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--color-fg-muted)').style('stroke-dasharray', '4 3');
  const ln = d3.line().x((d) => x(pd(d.date))).y((d) => y(d.v));
  const gL = svg.append('g').attr('clip-path', `url(#${plot})`);
  const paths = series.map((s) => gL.append('path').datum(s.pts).attr('d', ln).style('fill', 'none').style('stroke', s.color).style('stroke-width', 2.2));
  let lastY = -99; series.map((s) => ({ s, yy: y(Math.max(y.domain()[0], Math.min(y.domain()[1], s.pts[s.pts.length - 1].v))) })).sort((a, b) => a.yy - b.yy).forEach(({ s, yy }) => { const v = Math.max(yy + 4, lastY + 12); lastY = v; svg.append('text').attr('x', Wc - m.r + 6).attr('y', v).text(s.z.size).style('fill', s.color).style('font-weight', 600); });
  const tx = x(pd(w.today));
  if (w.today >= w.from && w.today <= w.to) { svg.append('line').attr('x1', tx).attr('x2', tx).attr('y1', m.t - 6).attr('y2', H - m.b).style('stroke', 'var(--color-fg)').style('stroke-width', 1); svg.append('text').attr('x', tx + 6).attr('y', m.t - 8).text('Projected'); }
  const ctip = jm.tip(box);
  svg.append('g').selectAll('rect').data(f).join('rect').attr('x', (e) => x(pd(e.date)) - Math.max(dw / 2, 7)).attr('width', Math.max(dw, 14)).attr('y', m.t).attr('height', H - m.b - m.t).style('fill', 'transparent')
    .on('mousemove', (ev, x2) => ctip.show(ev, [jm.date(x2.date) + (x2.status === 'Hold' ? ' · offer / hold' : ' · show'), placeOf(x2)].concat(series.map((s) => s.z.size + ': ' + Math.round(sizeLeft(s.z, x2)) + ' left')))).on('mouseleave', () => ctip.hide());
  paths.forEach((p, i) => p.on('mouseenter', () => paths.forEach((q, j) => q.style('opacity', j === i ? 1 : 0.25))).on('mouseleave', () => paths.forEach((q) => q.style('opacity', 1))));
};
const EXPAND_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const roadStatus = (st, r, f) => {
  const so = firstSizeOut(r.product, f);
  if (so.now.length || so.later.length) {
    st.className = 'st bad'; const parts = [];
    if (so.now.length) parts.push('Out of ' + so.now.join(', ') + ' now');
    if (so.later.length) { const d0 = so.later[0].st.out; const same = so.later.filter((o) => o.st.out.date === d0.date).map((o) => o.z.size); const more = so.later.length - same.length;
      parts.push(same.join(' and ') + ' expected to run out at ' + placeOf(d0) + ' (' + jm.shortDate(d0.date) + ')' + (more ? ' · ' + more + ' more ' + (more === 1 ? 'size' : 'sizes') + ' later' : '')); }
    st.textContent = parts.join(' · '); return;
  }
  const out = f.find((x) => leftOf(x) < 0);
  const mark = (elm, x) => { elm.setAttribute('data-source', 'road_strip'); elm.setAttribute('data-field', S.holds ? 'left_with_holds' : 'left_confirmed'); elm.setAttribute('data-where', 'product_show=' + encodeURIComponent(x.product_show)); };
  if (out) { st.className = 'st bad'; st.textContent = 'Expected to run out at ' + out.city + (out.region ? ', ' + out.region : '') + ' (' + jm.shortDate(out.date) + ') · '; const v = document.createElement('span'); v.textContent = 'short ' + jm.int(-leftOf(f[f.length - 1])) + ' by ' + jm.shortDate(f[f.length - 1].date); mark(v, f[f.length - 1]); st.appendChild(v); }
  else if (f.length) { const last = f[f.length - 1]; st.className = 'st ok'; st.textContent = 'Enough · '; const v = document.createElement('span'); v.textContent = jm.int(leftOf(last)) + ' left after ' + last.city + ', ' + jm.shortDate(last.date); mark(v, last); st.appendChild(v); }
  else { st.className = 'st muted'; st.textContent = 'No shows booked in these dates'; }
};

