// ---------- Merch per head ----------
dash.draw('ph-region', (el) => {
  const d = dash.data('markets');
  if (d.status !== 'ok') { jm.placeholder(el, ['markets']); return; }
  const rows = d.data.filter((r) => r.range === S.phRange).slice();
  if (!rows.length) { const p = document.createElement('div'); p.className = 'jm-msg'; p.textContent = 'No played shows with tickets and merch sales in these dates.'; el.replaceChildren(p); return; }
  const k = S.phSort; rows.sort((a, b) => (k === 'region' ? (a.region < b.region ? -1 : 1) : b[k] - a[k]));
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth), rowH = 30, mt = 2, mb = 20;
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', 'Merch per head by province or region').attr('width', '100%');
  const ml = Math.ceil(jm.measure(svg, rows.map((r) => r.region))) + 12;
  const lbl = (r) => jm.money2(r.per_ticket) + '  ·  ' + r.shows + (r.shows === 1 ? ' show' : ' shows') + ', ' + jm.int(r.tickets) + ' tickets, ' + jm.money(r.gross);
  const mr = Math.min(W * 0.5, Math.ceil(jm.measure(svg, rows.map(lbl))) + 14);
  const H = mt + mb + rows.length * rowH; svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.per_ticket) || 1]).nice().range([ml, Math.max(ml + 80, W - mr)]);
  const y = d3.scaleBand().domain(rows.map((r) => r.region)).range([mt, H - mb]).padding(0.25);
  svg.append('g').attr('transform', `translate(0,${H - mb})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((x.range()[1] - ml) / 70))).tickFormat((v) => '$' + v).tickSize(-(H - mb - mt))).call((g) => g.select('.domain').remove());
  const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r) => `translate(0,${y(r.region)})`);
  g.append('text').attr('class', 'jm-lab').attr('x', ml - 8).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((r) => r.region);
  g.append('rect').attr('x', x(0)).attr('height', y.bandwidth()).attr('width', (r) => x(r.per_ticket) - x(0)).style('fill', dash.colors[0]).attr('rx', 2)
    .attr('data-source', 'markets').attr('data-field', 'per_ticket').attr('data-where', (r) => 'range_region=' + encodeURIComponent(r.range_region));
  g.append('text').attr('class', 'jm-val').attr('x', (r) => x(r.per_ticket) + 8).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').text(lbl);
});

dash.draw('ph-items', (el) => {
  const d = dash.data('ph_items');
  if (d.status !== 'ok') { jm.placeholder(el, ['ph_items']); return; }
  const rows = d.data.filter((r) => r.range === S.phRange).sort((a, b) => b.per_head - a.per_head);
  if (!rows.length) { const p = document.createElement('div'); p.className = 'jm-msg'; p.textContent = 'No played shows with tickets and point-of-sale sales in these dates.'; el.replaceChildren(p); return; }
  el.replaceChildren();
  const cap = document.createElement('p'); cap.className = 'jm-range-cap'; cap.textContent = 'Across ' + rows[0].shows + (rows[0].shows === 1 ? ' show' : ' shows') + ' and ' + jm.int(rows[0].tickets) + ' tickets.'; el.appendChild(cap);
  const W = Math.max(280, el.clientWidth), rowH = 30, mt = 2, mb = 20;
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', 'Merch per head by item').attr('width', '100%');
  const ml = Math.min(W * 0.4, Math.ceil(jm.measure(svg, rows.map((r) => r.product))) + 12);
  const lbl = (r) => jm.money2(r.per_head) + '  ·  ' + jm.dec1(r.per_100) + ' per 100 tickets, ' + jm.money(r.gross);
  const mr = Math.min(W * 0.45, Math.ceil(jm.measure(svg, rows.map(lbl))) + 14);
  const H = mt + mb + rows.length * rowH; svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.per_head) || 1]).nice().range([ml, Math.max(ml + 80, W - mr)]);
  const y = d3.scaleBand().domain(rows.map((r) => r.product)).range([mt, H - mb]).padding(0.25);
  svg.append('g').attr('transform', `translate(0,${H - mb})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((x.range()[1] - ml) / 70))).tickFormat((v) => '$' + v).tickSize(-(H - mb - mt))).call((g) => g.select('.domain').remove());
  const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r) => `translate(0,${y(r.product)})`);
  g.append('text').attr('class', 'jm-lab').attr('x', ml - 8).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((r) => r.product);
  g.append('rect').attr('x', x(0)).attr('height', y.bandwidth()).attr('width', (r) => Math.max(0, x(r.per_head) - x(0))).style('fill', dash.colors[0]).attr('rx', 2)
    .attr('data-source', 'ph_items').attr('data-field', 'per_head').attr('data-where', (r) => 'range_product=' + encodeURIComponent(r.range_product));
  g.append('text').attr('class', 'jm-val').attr('x', (r) => x(r.per_head) + 8).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').text(lbl);
});

dash.draw('ph-shows', (tb) => {
  const d = dash.data('show_perf');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  const y = new Date().getUTCFullYear(); const since12 = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const since = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); const ok = { all: () => true, d30: (dt) => dt >= since(30), d60: (dt) => dt >= since(60), d90: (dt) => dt >= since(90), d120: (dt) => dt >= since(120), last12: (dt) => dt >= since12, this_year: (dt) => dt.slice(0, 4) === String(y), last_year: (dt) => dt.slice(0, 4) === String(y - 1) }[S.phRange] || (() => true);
  const k = S.showSort, dir = S.showDir;
  const rows = d.data.filter((r) => r.date && ok(r.date)).slice().sort((a, b) => { const va = a[k], vb = b[k]; return (va < vb ? -1 : va > vb ? 1 : 0) * dir; });
  tb.replaceChildren(...rows.map((r) => {
    const tr = document.createElement('tr'); tr.setAttribute('data-key', encodeURIComponent(r.show_id));
    jm.cell(tr, jm.date(r.date)); jm.cell(tr, r.city); jm.cell(tr, r.region, 'muted'); jm.cell(tr, jm.int(r.tickets), 'n'); jm.cell(tr, jm.money(r.gross), 'n'); jm.cell(tr, jm.money2(r.per_ticket), 'n');
    return tr;
  }));
});

// ---------- Sales over time ----------
const CH = ['Shows', 'Web', 'Other'];
const chColor = (c) => (c === 'Shows' ? dash.colors[0] : c === 'Web' ? dash.colors[2] : 'var(--cds-chart-muted)');
dash.draw('sw-shows', (el) => { el.style.setProperty('--sw', dash.colors[0]); });
dash.draw('sw-web', (el) => { el.style.setProperty('--sw', dash.colors[2]); });
const trendExtent = () => {
  const d = dash.data('sales_series'); if (d.status !== 'ok') return null;
  const days = d.data.filter((r) => r.grain === 'day').map((r) => r.period).sort();
  return days.length ? { min: days[0], max: isoOff(0) > days[days.length - 1] ? isoOff(0) : days[days.length - 1] } : null;
};
const trendWindow = () => {
  const ext = trendExtent(); if (!ext) return null;
  if (S.trendFrom && S.trendTo) return { from: S.trendFrom, to: S.trendTo, ext };
  const to = ext.max; const t = pd(to);
  const back = { '1m': 30, '3m': 91, '6m': 182, '1y': 365 }[S.trendRange];
  let from = back ? new Date(t.getTime() - back * DAY).toISOString().slice(0, 10) : S.trendRange === 'ytd' ? to.slice(0, 4) + '-01-01' : ext.min;
  if (from < ext.min) from = ext.min;
  return { from, to, ext };
};
const grainNow = (w) => { if (S.grain !== 'auto') return S.grain; const span = (pd(w.to) - pd(w.from)) / DAY; return span <= 62 ? 'day' : span <= 400 ? 'week' : 'month'; };
const periodsBetween = (from, to, grain) => {
  const out = []; let t = pd(from);
  if (grain === 'week') t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  if (grain === 'month') t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  const end = pd(to);
  while (t <= end) { out.push(t.toISOString().slice(0, 10)); if (grain === 'day') t = new Date(t.getTime() + DAY); else if (grain === 'week') t = new Date(t.getTime() + 7 * DAY); else t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1)); }
  return out;
};
dash.draw('trend-total', (el) => {
  const w = trendWindow(); if (!w) { el.textContent = '—'; return; }
  const g = grainNow(w);
  el.textContent = 'Showing ' + jm.date(w.from) + ' to ' + jm.date(w.to) + ', grouped by ' + g + '.';
});
dash.draw('trend-chart', (el) => {
  const d = dash.data('sales_series'); const w = trendWindow();
  if (d.status !== 'ok' || !w) { jm.placeholder(el, ['sales_series']); return; }
  const grain = grainNow(w); const metric = S.metric; const chans = CH.filter((c) => S.ch[c] !== false);
  const periods = periodsBetween(w.from, w.to, grain);
  const idx = new Map(d.data.filter((r) => r.grain === grain).map((r) => [r.period + '|' + r.channel, r]));
  const wide = periods.map((p) => { const o = { period: p }; CH.forEach((c) => { const r = idx.get(p + '|' + c); o[c] = r ? Math.max(0, r[metric]) : 0; o[c + '_key'] = r ? r.key : null; }); return o; });
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth), H = 240, mt = 8, mb = 24;
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', 'Sales over time, stacked by shows, web store and other').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const yMax = d3.max(wide, (o) => chans.reduce((t, c) => t + o[c], 0)) || 1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([H - mb, mt]);
  const fmt = metric === 'gross' ? (v) => '$' + (v >= 1000 ? d3.format(',')(v / 1000) + 'k' : v) : (v) => d3.format(',')(v);
  const ml = Math.ceil(jm.measure(svg, y.ticks(4).map(fmt))) + 8;
  const x = d3.scaleBand().domain(periods).range([ml, W]).padding(periods.length > 120 ? 0.05 : 0.2);
  svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(fmt).tickSize(-(W - ml))).call((g) => g.select('.domain').remove());
  const lab = grain === 'month' ? d3.utcFormat('%b %y') : d3.utcFormat('%b %-d');
  const every = Math.max(1, Math.ceil(periods.length / Math.max(1, Math.floor((W - ml) / 60))));
  svg.append('g').attr('transform', `translate(0,${H - mb})`).call(d3.axisBottom(x).tickSize(0).tickPadding(8).tickValues(periods.filter((p, i) => i % every === 0)).tickFormat((p) => lab(pd(p)))).call((g) => g.select('.domain').style('stroke', 'var(--cds-chart-axis)'));
  const step = x.step(); const gap = (step - x.bandwidth()) / 2;
  if (step >= 3) svg.append('g').selectAll('line').data(periods.concat(['__end'])).join('line')
    .attr('x1', (p, i) => (p === '__end' ? x(periods[periods.length - 1]) + x.bandwidth() + gap : x(p) - gap)).attr('x2', function () { return this.getAttribute('x1'); })
    .attr('y1', mt).attr('y2', H - mb).style('stroke', 'var(--color-border-line)').style('stroke-width', 0.75);
  const stack = d3.stack().keys(chans)(wide);
  svg.append('g').selectAll('g').data(stack).join('g').style('fill', (s) => chColor(s.key))
    .selectAll('rect').data((s) => s.map((p) => ({ p, key: s.key }))).join('rect')
    .attr('x', (o) => x(o.p.data.period)).attr('width', x.bandwidth()).attr('y', (o) => y(o.p[1])).attr('height', (o) => Math.max(0, y(o.p[0]) - y(o.p[1])))
    .each(function (o) { const k = o.p.data[o.key + '_key']; if (k) { this.setAttribute('data-source', 'sales_series'); this.setAttribute('data-field', metric); this.setAttribute('data-where', 'key=' + encodeURIComponent(k)); } });
  const tip = jm.tip(el);
  const vfmt = metric === 'gross' ? jm.money : jm.int;
  const head = (p) => (grain === 'month' ? d3.utcFormat('%B %Y')(pd(p)) : grain === 'week' ? 'Week of ' + jm.date(p) : jm.date(p));
  svg.append('g').selectAll('rect').data(wide).join('rect').attr('x', (o) => x(o.period)).attr('width', x.bandwidth()).attr('y', mt).attr('height', H - mb - mt).style('fill', 'transparent')
    .on('mousemove', (ev, o) => tip.show(ev, [head(o.period)].concat(chans.map((c) => (c === 'Shows' ? 'At shows' : c === 'Web' ? 'Web store' : 'Other') + ': ' + vfmt(o[c])))))
    .on('mouseleave', () => tip.hide());
});
dash.draw('trend-range', (el) => {
  const d = dash.data('sales_series'); const w = trendWindow();
  if (d.status !== 'ok' || !w) { el.replaceChildren(); return; }
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth), H = 50, m = { l: 8, r: 8, t: 4, b: 16 };
  const months = d.data.filter((r) => r.grain === 'month');
  const tot = d3.rollups(months, (v) => d3.sum(v, (r) => Math.max(0, r.gross)), (r) => r.period).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const x = d3.scaleUtc().domain([pd(w.ext.min), pd(w.ext.max)]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, d3.max(tot, (t) => t[1]) || 1]).range([H - m.b, m.t]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Overview of all sales; drag to choose the dates shown above');
  svg.append('path').datum(tot).attr('d', d3.area().x((t) => x(pd(t[0]))).y0(H - m.b).y1((t) => y(t[1]))).style('fill', 'var(--cds-chart-muted)').style('opacity', 0.6);
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 100))).tickFormat(d3.utcFormat('%b %y')).tickSize(0).tickPadding(4)).call((g) => g.select('.domain').style('stroke', 'var(--cds-chart-axis)'));
  const brush = d3.brushX().extent([[m.l, m.t], [W - m.r, H - m.b]]).on('end', (ev) => {
    if (!ev.sourceEvent) return;
    if (!ev.selection) { S.trendFrom = null; S.trendTo = null; } else { const [a, b] = ev.selection.map((v) => x.invert(v).toISOString().slice(0, 10)); S.trendFrom = a; S.trendTo = b > a ? b : a; }
    document.querySelectorAll('.jm-seg[data-group="trendRange"] button').forEach((btn) => { btn.classList.toggle('is-on', !S.trendFrom && btn.getAttribute('data-val') === S.trendRange); });
    dash.draw('trend-chart'); dash.draw('trend-total');
    const w2 = trendWindow(); gB.call(brush.move, [x(pd(w2.from)), x(pd(w2.to))]);
  });
  const gB = svg.append('g').call(brush);
  gB.call(brush.move, [x(pd(w.from)), x(pd(w.to))]);
});

// ---------- Sizes sold by city ----------
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const emptyBox = (el, text) => { const p = document.createElement('div'); p.className = 'jm-empty'; p.textContent = text; el.replaceChildren(p); };
dash.draw('sizes-product', (sel) => {
  const d = dash.data('size_mix');
  const names = d.status === 'ok' ? [...new Set(d.data.filter((r) => r.type === 'all').map((r) => r.product))].filter((n) => n !== 'All shirts').sort() : [];
  sel.replaceChildren(new Option('All shirts', 'All shirts'), ...names.map((n) => new Option(n, n)));
  if (!names.includes(S.sizeProduct)) S.sizeProduct = 'All shirts';
  sel.value = S.sizeProduct;
  sel.onchange = () => { S.sizeProduct = sel.value; dash.draw('sizes-table'); dash.draw('sizes-takeaway'); };
});
dash.draw('sizes-takeaway', (el) => {
  const d = dash.data('size_mix'); if (d.status !== 'ok') { el.textContent = '—'; return; }
  const all = d.data.filter((r) => r.product === S.sizeProduct && r.type === 'all').sort((a, b) => b.units - a.units);
  if (!all.length) { el.textContent = 'No sizes recorded yet.'; return; }
  const top = all[0]; const road = d.data.find((r) => r.product === S.sizeProduct && r.type === 'road' && r.size === top.size);
  el.textContent = 'Across all shows, ' + top.size + ' sells most (' + top.pct + '% of ' + jm.int(top.total) + ' sold)' + (road ? ', and makes up ' + road.pct + '% of what John is carrying now.' : '.');
});
dash.draw('sizes-table', (el) => {
  const d = dash.data('size_mix');
  if (d.status !== 'ok') { jm.placeholder(el, ['size_mix']); return; }
  const rows = d.data.filter((r) => r.product === S.sizeProduct);
  if (!rows.some((r) => r.type === 'all')) { emptyBox(el, 'No sizes recorded yet. Sizes sold per show start filling in at the next Shopify sync (Saturdays at about 7:30 AM Eastern, or run it now from Scheduled tasks in the Claude app).'); return; }
  const sizes = SIZE_ORDER.filter((z) => rows.some((r) => r.size === z));
  const groupsOf = (type) => { const m = new Map(); for (const r of rows.filter((x) => x.type === type)) { const g = m.get(r.group) || { group: r.group, total: r.total, date: r.date, cells: new Map() }; g.cells.set(r.size, r); m.set(r.group, g); } return [...m.values()]; };
  const main = groupsOf(S.sizeGroup); if (S.sizeGroup === 'show') main.sort((a, b) => (a.date < b.date ? 1 : -1)); else main.sort((a, b) => b.total - a.total);
  const lines = [...groupsOf('all').map((g) => ({ ...g, cls: 'all' })), ...groupsOf('road').map((g) => ({ ...g, cls: 'road' })), ...main];
  el.replaceChildren(); const tip = jm.tip(el);
  const table = document.createElement('table'); table.className = 'jm-mix';
  const hr = document.createElement('tr'); const h0 = document.createElement('th'); h0.className = 'g'; h0.textContent = { show: 'Show', city: 'City', region: 'Province' }[S.sizeGroup]; hr.appendChild(h0);
  sizes.forEach((z) => { const th = document.createElement('th'); th.textContent = z; hr.appendChild(th); });
  const ht = document.createElement('th'); ht.textContent = 'Units'; hr.appendChild(ht);
  const thead = document.createElement('thead'); thead.appendChild(hr); table.appendChild(thead);
  const tb = document.createElement('tbody');
  for (const g of lines) {
    const tr = document.createElement('tr'); if (g.cls) tr.className = g.cls;
    const td0 = document.createElement('td'); td0.className = 'g'; td0.textContent = g.group; tr.appendChild(td0);
    sizes.forEach((z) => {
      const r = g.cells.get(z); const td = document.createElement('td'); const c = document.createElement('span'); c.className = 'c';
      if (r) {
        c.textContent = S.sizeShow === 'pct' ? Math.round(r.pct) + '%' : String(r.units);
        c.style.background = 'color-mix(in srgb, ' + dash.colors[0] + ' ' + Math.min(70, Math.round(r.pct * 1.6)) + '%, transparent)';
        c.setAttribute('data-source', 'size_mix'); c.setAttribute('data-field', S.sizeShow === 'pct' ? 'pct' : 'units'); c.setAttribute('data-where', 'key=' + encodeURIComponent(r.key));
        c.addEventListener('mousemove', (ev) => tip.show(ev, [g.group + ' · ' + z, (g.cls === 'road' ? 'Carrying ' : 'Sold ') + r.units + ' of ' + r.total + ' (' + r.pct + '%)']));
        c.addEventListener('mouseleave', () => tip.hide());
      } else { c.textContent = '–'; c.style.color = 'var(--color-fg-muted)'; }
      td.appendChild(c); tr.appendChild(td);
    });
    const tt = document.createElement('td'); tt.className = 't'; tt.textContent = jm.int(g.total); tr.appendChild(tt);
    tb.appendChild(tr);
  }
  table.appendChild(tb);
  el.insertBefore(table, el.firstChild);
});

// ---------- Profit ----------
const profitRows = () => { const d = dash.data('profit'); return d.status === 'ok' ? d.data.filter((r) => r.range === S.profitRange && r.channel === S.profitCh) : null; };
dash.draw('profit-takeaway', (el) => {
  const rows = profitRows(); if (!rows) { el.textContent = '—'; return; }
  const t = rows.find((r) => r.is_total); if (!t) { el.textContent = 'No sales in these dates.'; return; }
  el.textContent = jm.money(t.profit) + ' profit on ' + jm.money(t.sales) + ' of sales' + (t.margin != null ? ' (' + t.margin + '% margin)' : '') + '.';
});
dash.draw('profit-kpis', (el) => {
  const rows = profitRows(); if (!rows) { jm.placeholder(el, ['profit']); return; }
  const t = rows.find((r) => r.is_total);
  if (!t) { emptyBox(el, 'No sales in these dates.'); return; }
  const kpi = (label, value, field, cls) => { const k = document.createElement('div'); k.className = 'jm-kpi' + (cls ? ' ' + cls : ''); const s1 = document.createElement('span'); s1.textContent = label; const b = document.createElement('b'); b.textContent = value; b.setAttribute('data-source', 'profit'); b.setAttribute('data-field', field); b.setAttribute('data-where', 'key=' + encodeURIComponent(t.key)); k.append(s1, b); return k; };
  const parts = [kpi('Sales', jm.money(t.sales), 'sales'), kpi('HST / GST', jm.money(t.hst), 'hst'), kpi('Cost of goods', jm.money(t.cogs), 'cogs'), kpi('Venue cuts', jm.money(t.venue_cut), 'venue_cut'), kpi('Card fees', jm.money(t.card_fee), 'card_fee'), kpi('Profit', jm.money(t.profit), 'profit', t.profit >= 0 ? 'good' : 'bad'), kpi('Margin', t.margin == null ? '—' : t.margin + '%', 'margin')];
  el.replaceChildren(...parts);
  if (t.sales_no_cost > 0) { const n = document.createElement('p'); n.className = 'jm-note'; n.style.gridColumn = '1 / -1'; n.textContent = jm.money(t.sales_no_cost) + ' of sales are from products with no unit cost in Notion and are left out of profit.'; el.appendChild(n); }
});
dash.draw('profit-chart', (el) => {
  const rows = profitRows(); if (!rows) { jm.placeholder(el, ['profit']); return; }
  const list = rows.filter((r) => !r.is_total && r.sales > 0).sort((a, b) => (b.profit ?? -1e9) - (a.profit ?? -1e9) || b.sales - a.sales);
  if (!list.length) { el.replaceChildren(); return; }
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth), rowH = 30, mt = 2, mb = 20;
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', 'Sales split into sales tax, cost of goods, venue cuts, card fees and profit, by product').attr('width', '100%');
  const ml = Math.ceil(jm.measure(svg, list.map((r) => r.product))) + 12;
  const lbl = (r) => (r.profit == null ? 'Cost missing · ' + jm.money(r.sales) + ' sales' : jm.money(r.profit) + ' profit · ' + (r.margin ?? 0) + '%');
  const mr = Math.min(W * 0.45, Math.ceil(jm.measure(svg, list.map(lbl))) + 14);
  const H = mt + mb + list.length * rowH; svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const x = d3.scaleLinear().domain([0, d3.max(list, (r) => r.sales) || 1]).nice().range([ml, Math.max(ml + 80, W - mr)]);
  const y = d3.scaleBand().domain(list.map((r) => r.product)).range([mt, H - mb]).padding(0.25);
  svg.append('g').attr('transform', `translate(0,${H - mb})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((x.range()[1] - ml) / 80))).tickFormat((v) => '$' + d3.format(',')(v)).tickSize(-(H - mb - mt))).call((g) => g.select('.domain').remove());
  const tip = jm.tip(el);
  const g = svg.append('g').selectAll('g').data(list).join('g').attr('transform', (r) => `translate(0,${y(r.product)})`);
  g.append('text').attr('class', 'jm-lab').attr('x', ml - 8).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((r) => r.product);
  g.each(function (r) {
    const gg = d3.select(this); let x0 = x(0);
    const segs = r.profit == null ? [{ v: r.sales, fill: 'var(--cds-chart-muted)', f: 'sales' }] : [{ v: r.hst, fill: 'color-mix(in srgb, var(--color-fg-muted) 30%, transparent)', f: 'hst' }, { v: r.cogs, fill: 'var(--cds-chart-muted)', f: 'cogs' }, { v: r.venue_cut, fill: 'color-mix(in srgb, var(--color-fg-muted) 70%, transparent)', f: 'venue_cut' }, { v: r.card_fee, fill: 'color-mix(in srgb, var(--color-fg-muted) 50%, transparent)', f: 'card_fee' }, { v: Math.max(0, r.profit), fill: dash.colors[0], f: 'profit' }];
    for (const sg of segs) { const w = Math.max(0, x(sg.v) - x(0)); gg.append('rect').attr('x', x0).attr('width', w).attr('height', y.bandwidth()).style('fill', sg.fill).attr('data-source', 'profit').attr('data-field', sg.f).attr('data-where', 'key=' + encodeURIComponent(r.key)); x0 += w; }
  });
  g.append('text').attr('class', 'jm-val').attr('x', (r) => x(r.sales) + 8).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').text(lbl).style('fill', (r) => (r.profit == null ? 'var(--color-warn)' : 'var(--color-fg)'));
  g.append('rect').attr('width', W).attr('height', y.bandwidth()).style('fill', 'transparent')
    .on('mousemove', (ev, r) => tip.show(ev, [r.product, jm.int(r.units) + ' units · ' + jm.money(r.sales) + ' sales', r.profit == null ? 'No unit cost in Notion' : 'HST / GST: ' + jm.money(r.hst), r.profit == null ? '' : 'Cost of goods: ' + jm.money(r.cogs), r.profit == null ? '' : 'Venue cuts: ' + jm.money(r.venue_cut), r.profit == null ? '' : 'Card fees: ' + jm.money(r.card_fee), r.profit == null ? '' : 'Profit: ' + jm.money(r.profit) + ' (' + r.margin + '%)'].filter(Boolean)))
    .on('mouseleave', () => tip.hide());
  const leg = document.createElement('div'); leg.className = 'jm-legend';
  [['HST / GST', 'color-mix(in srgb, var(--color-fg-muted) 30%, transparent)'], ['Cost of goods', 'var(--cds-chart-muted)'], ['Venue cut', 'color-mix(in srgb, var(--color-fg-muted) 70%, transparent)'], ['Card fees', 'color-mix(in srgb, var(--color-fg-muted) 50%, transparent)'], ['Profit', dash.colors[0]]].forEach(([t, c]) => { const sp = document.createElement('span'); sp.style.setProperty('--sw', c); sp.textContent = t; leg.appendChild(sp); });
  el.insertBefore(leg, el.firstChild);
});

// ---------- Web customers ----------
const geoRows = () => { const d = dash.data('geo'); return d.status === 'ok' ? d.data.filter((r) => r.range === S.geoRange && r.level === S.geoLevel) : null; };
dash.draw('geo-takeaway', (el) => {
  const rows = geoRows(); if (!rows) { el.textContent = '—'; return; }
  if (!rows.length) { el.textContent = ''; return; }
  const m = S.geoMeasure; const top = rows.slice().sort((a, b) => b[m] - a[m])[0];
  el.textContent = 'Most web ' + (m === 'orders' ? 'orders' : m === 'gross' ? 'sales' : 'units') + ' come from ' + top.place + ' (' + top['share_' + m] + '%), across ' + rows.length + (rows.length === 1 ? ' place.' : ' places.');
});
dash.draw('geo-chart', (el) => {
  const rows = geoRows(); if (!rows) { jm.placeholder(el, ['geo']); return; }
  if (!rows.length) { emptyBox(el, 'No web customer locations recorded yet. They start filling in at the next Shopify sync (Saturdays at about 7:30 AM Eastern, or run it now from Scheduled tasks in the Claude app).'); return; }
  const m = S.geoMeasure; const fmt = m === 'gross' ? jm.money : jm.int;
  const list = rows.slice().sort((a, b) => b[m] - a[m]); const shown = list.slice(0, 15);
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth), rowH = 28, mt = 2, mb = 20;
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', 'Web customers by place').attr('width', '100%');
  const ml = Math.min(W * 0.4, Math.ceil(jm.measure(svg, shown.map((r) => r.place))) + 12);
  const lbl = (r) => fmt(r[m]) + ' · ' + r['share_' + m] + '%';
  const mr = Math.ceil(jm.measure(svg, shown.map(lbl))) + 14;
  const H = mt + mb + shown.length * rowH; svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const x = d3.scaleLinear().domain([0, d3.max(shown, (r) => r[m]) || 1]).nice().range([ml, Math.max(ml + 60, W - mr)]);
  const y = d3.scaleBand().domain(shown.map((r) => r.place)).range([mt, H - mb]).padding(0.25);
  svg.append('g').attr('transform', `translate(0,${H - mb})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((x.range()[1] - ml) / 70))).tickFormat((v) => (m === 'gross' ? '$' : '') + d3.format(',')(v)).tickSize(-(H - mb - mt))).call((g) => g.select('.domain').remove());
  const tip = jm.tip(el);
  const g = svg.append('g').selectAll('g').data(shown).join('g').attr('transform', (r) => `translate(0,${y(r.place)})`);
  g.append('text').attr('class', 'jm-lab').attr('x', ml - 8).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((r) => r.place);
  g.append('rect').attr('x', x(0)).attr('height', y.bandwidth()).attr('width', (r) => x(r[m]) - x(0)).style('fill', dash.colors[0]).attr('rx', 2)
    .attr('data-source', 'geo').attr('data-field', m).attr('data-where', (r) => 'key=' + encodeURIComponent(r.key));
  g.append('text').attr('class', 'jm-val').attr('x', (r) => x(r[m]) + 8).attr('y', y.bandwidth() / 2).attr('dy', '0.35em').text(lbl);
  g.append('rect').attr('width', W).attr('height', y.bandwidth()).style('fill', 'transparent')
    .on('mousemove', (ev, r) => tip.show(ev, [r.place, jm.int(r.orders) + ' orders · ' + jm.int(r.units) + ' units', jm.money(r.gross) + ' in sales']))
    .on('mouseleave', () => tip.hide());
  if (list.length > shown.length) { const p = document.createElement('p'); p.className = 'jm-range-cap'; p.textContent = 'Showing the top 15 of ' + list.length + ' places.'; el.appendChild(p); }
});

// ---------- Issues ----------
const openIssues = () => { const d = dash.data('issues'); if (d.status !== 'ok') return null; const rank = { High: 0, Medium: 1, Low: 2 }; return d.data.filter((r) => r.status === 'Open' || r.status === 'Investigating').sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3)); };
const issueRow = (r) => { const tr = document.createElement('tr'); jm.pill(tr, r.severity || '—', r.severity === 'High' ? 'bad' : r.severity === 'Medium' ? 'warn' : 'muted'); jm.cell(tr, r.issue); return tr; };
dash.draw('issues-table', (tb) => { const rows = openIssues(); if (!rows) { tb.replaceChildren(); return; } tb.replaceChildren(...rows.filter((r) => r.severity === 'High').map(issueRow)); });
dash.draw('issues-low', (tb) => { const rows = openIssues(); if (!rows) { tb.replaceChildren(); return; } tb.replaceChildren(...rows.filter((r) => r.severity !== 'High').map(issueRow)); });
dash.draw('issues-more', (el) => { const rows = openIssues(); const n = rows ? rows.filter((r) => r.severity !== 'High').length : null; el.textContent = n == null ? 'Lower-priority issues' : n + ' lower-priority ' + (n === 1 ? 'issue' : 'issues'); });
