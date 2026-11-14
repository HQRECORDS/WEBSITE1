// ---------- Road: one card per product ----------
dash.draw('road-multiples', (el) => {
  const ordered = orderedProducts(); const hist = dash.data('road_history');
  if (!ordered || hist.status !== 'ok') { jm.placeholder(el, ['road_plan', 'road_strip', 'road_history']); return; }
  if (!ordered.length) { const p = document.createElement('div'); p.className = 'jm-msg'; p.textContent = 'Nothing on the road and no sales projected.'; el.replaceChildren(p); return; }
  const w = roadWindow();
  el.replaceChildren();
  const nPin = ordered.filter((o) => isPinned(o.r.product)).length;
  ordered.forEach(({ r, f }, idx) => {
    if (nPin && idx === nPin) el.appendChild(pinDivider());
    const card = document.createElement('div'); card.className = 'jm-card' + (isPinned(r.product) ? ' pinned' : '');
    const top = document.createElement('div'); top.className = 'jm-card-top';
    const p = document.createElement('span'); p.className = 'p'; p.textContent = r.product;
    const right = document.createElement('span'); right.className = 'jm-card-right';
    const n = document.createElement('span'); n.className = 'n'; const nv = document.createElement('span'); nv.textContent = jm.int(r.road);
    nv.setAttribute('data-source', 'road_plan'); nv.setAttribute('data-field', 'road'); nv.setAttribute('data-where', 'product=' + encodeURIComponent(r.product));
    const nl = document.createElement('small'); nl.textContent = 'carrying'; n.append(nv, nl);
    const ex = document.createElement('button'); ex.type = 'button'; ex.className = 'jm-expand'; ex.setAttribute('aria-label', 'Expand ' + r.product); ex.title = 'Expand';
    ex.insertAdjacentHTML('afterbegin', EXPAND_SVG);
    ex.addEventListener('click', () => { S.expanded = r.product; S.mFrom = S.roadFrom; S.mTo = S.roadTo; S.mZoom = 1; dash.draw('road-modal'); const dlg = document.getElementById('road-modal'); if (dlg && dlg.showModal && !dlg.open) dlg.showModal(); });
    right.append(n, ex); const pl = document.createElement('span'); pl.className = 'jm-card-left'; pl.append(pinBox(r.product), p); top.append(pl, right);
    const st = document.createElement('div'); roadStatus(st, r, f);
    const box = document.createElement('div'); box.className = 'jm-chart';
    card.append(top, st, box); el.appendChild(card);
    drawRoadChart(box, r, f, hist.data.filter((h) => h.product === r.product && h.date >= w.from && h.date <= w.to), w, idx, false, 1);
    card.style.position = 'relative'; sizeChips(card, r.product, f);
  });
});

// ---------- Road: expanded view ----------
// ---------- Overview (one urgency rule: rest of booked tour) ----------
const ovSum = () => { const d = dash.data('tour_need_sum'); return d.status === 'ok' ? (d.data || []).find((r) => r.range === 'tour') : null; };
dash.draw('ov-short', (el) => { const s = ovSum(); el.textContent = s ? jm.int(s.short_products) : '—'; if (s) el.setAttribute('data-where', 'range=tour'); });
dash.draw('ov-end', (el) => { const s = ovSum(); el.textContent = s && s.end ? d3.utcFormat('%b %-d')(new Date(s.end + 'T00:00:00Z')) : '—'; if (s) el.setAttribute('data-where', 'range=tour'); });
const ovNext = () => { const d = dash.data('upcoming'); return d.status === 'ok' ? d.data.find((u) => u.status === 'Confirmed') : null; };
dash.draw('ov-next', (el) => { const n = ovNext(); el.textContent = n ? d3.utcFormat('%b %-d')(new Date(n.date + 'T00:00:00Z')) : (dash.data('upcoming').status === 'ok' ? 'None booked' : '—'); if (n) el.setAttribute('data-where', 'show_id=' + encodeURIComponent(n.show_id)); });
dash.draw('ov-next-sub', (el) => { const n = ovNext(); el.textContent = n ? n.city + (n.region ? ', ' + n.region : '') + (n.venue ? ' · ' + n.venue : '') : '—'; if (n) el.setAttribute('data-where', 'show_id=' + encodeURIComponent(n.show_id)); });
dash.draw('ov-cards', (el) => {
  const d = dash.data('tour_need'); if (d.status !== 'ok') { jm.placeholder(el, ['tour_need']); return; }
  const fmt = d3.utcFormat('%a %b %-d');
  const label = { short: 'Running short', tight: 'Tight', ok: 'Enough' }, cls = { short: 'bad', tight: 'warn', ok: 'ok' };
  const mk = (tag, c, text) => { const e = document.createElement(tag); if (c) e.className = c; if (text != null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  // Half-circle dial: share of what the booked shows need that is covered (size by size), full sweep = enough.
  const dial = (r, tone) => {
    const R = 78, cx = 100, cy = 92, need = Math.max(0, r.need || 0), have = Math.max(0, r.on_hand || 0);
    const frac = need > 0 ? Math.max(0, Math.min(1, (need - Math.max(0, r.short || 0)) / need)) : 1;
    const pt = (f, rad) => { const a = Math.PI * (1 - f); return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)]; };
    const arc = (f0, f1) => { const [x0, y0] = pt(f0, R), [x1, y1] = pt(f1, R); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
    const svg = svgEl('svg', { viewBox: '0 0 200 104', class: 'ov-dial', role: 'img', 'aria-label': `${jm.int(have)} on hand of ${jm.int(need)} needed` });
    for (let i = 0; i <= 10; i++) { const [x0, y0] = pt(i / 10, R - 14), [x1, y1] = pt(i / 10, R - (i % 5 ? 18 : 22)); svg.appendChild(svgEl('line', { x1: x0.toFixed(2), y1: y0.toFixed(2), x2: x1.toFixed(2), y2: y1.toFixed(2), class: 'ov-tick' })); }
    svg.appendChild(svgEl('path', { d: arc(0, 1), class: 'ov-track' }));
    if (frac > 0.004) svg.appendChild(svgEl('path', { d: arc(0, frac), class: 'ov-fill ' + tone }));
    const [nx, ny] = pt(frac, R - 26);
    svg.appendChild(svgEl('line', { x1: cx, y1: cy, x2: nx.toFixed(2), y2: ny.toFixed(2), class: 'ov-needle' }));
    svg.appendChild(svgEl('circle', { cx, cy, r: 5.5, class: 'ov-hub' }));
    return svg;
  };
  const rows = pinFirst(d.data.filter((r) => r.range === 'tour'), (r) => r.product);
  el.replaceChildren(...rows.map((r) => {
    const tone = cls[r.status], pinned = isPinned(r.product);
    const card = mk('div', 'jm-ov-card ' + tone + (pinned ? ' pinned' : ''));
    const go = () => { if (window.jmShowPage) window.jmShowPage('road', true); };
    card.addEventListener('click', go);
    const top = mk('div', 'ov-top');
    const name = mk('a', 'ov-name', r.product); name.href = '#road';
    name.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); go(); });
    const pin = mk('button', 'ov-pin'); pin.type = 'button';
    pin.setAttribute('aria-pressed', pinned ? 'true' : 'false');
    pin.setAttribute('aria-label', (pinned ? 'Unpin ' : 'Pin ') + r.product + (pinned ? '' : ' as on the current tour'));
    pin.title = pinned ? 'Pinned: on the current tour' : 'Pin: on the current tour';
    pin.appendChild(mk('span', 'jm-ico ico-pin'));
    pin.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); togglePin(r.product); });
    top.append(name, pin);
    const pill = mk('span', 'ts-pill ' + tone, label[r.status]);
    const big = mk('div', 'ov-big'); const b = mk('b', null, jm.int(r.short > 0 ? r.short : r.spare));
    b.setAttribute('data-source', 'tour_need'); b.setAttribute('data-field', r.short > 0 ? 'short' : 'spare'); b.setAttribute('data-where', 'key=' + encodeURIComponent(r.key));
    big.append(b, mk('small', null, r.short > 0 ? 'short' : 'spare'));
    const cap = mk('p', 'ov-cap', jm.int(r.on_hand) + ' on hand · ' + jm.int(r.need) + ' needed');
    let line;
    if (r.first_out_city === 'now') line = r.first_out_sizes ? r.first_out_sizes + ' already out' : 'None on tour now';
    else if (r.first_out_date) line = (r.first_out_sizes ? r.first_out_sizes + ' runs out' : 'Runs out') + ' at ' + r.first_out_city + ' · ' + fmt(new Date(r.first_out_date + 'T00:00:00Z'));
    else line = r.need > 0 ? 'Lasts the booked shows' : 'No sales expected';
    const mid = mk('div', 'ov-mid'); mid.append(dial(r, tone), big);
    card.append(top, pill, mid, cap, mk('p', 'ov-when', line));
    return card;
  }));
});

// ---------- Tour stock: packing list ----------
const packRows = () => {
  const d = dash.data('tour_need'), z = dash.data('tour_need_sizes'); if (d.status !== 'ok' || z.status !== 'ok') return null;
  const out = [];
  for (const r of d.data.filter((x) => x.range === S.tsRange && x.need > 0)) {
    const sz = z.data.filter((x) => x.product === r.product && x.range === S.tsRange && x.need > 0).sort((a, b) => a.sort - b.sort);
    if (sz.length) sz.forEach((x) => out.push({ product: r.product, size: x.size, need: x.need, have: x.have, send: x.short, src: 'tour_need_sizes', key: x.key }));
    else out.push({ product: r.product, size: '', need: r.need, have: r.on_hand, send: r.short, src: 'tour_need', key: r.key });
  }
  return out;
};
dash.draw('ts-pack', (tb) => {
  const rows = packRows(); if (!rows) { tb.replaceChildren(); return; }
  tb.replaceChildren(...rows.map((r, i) => {
    const tr = document.createElement('tr'); if (i > 0 && rows[i - 1].product === r.product) tr.className = 'cont';
    jm.cell(tr, i > 0 && rows[i - 1].product === r.product ? '' : r.product); jm.cell(tr, r.size || '—');
    [['need', r.need], ['have', r.have], [r.src === 'tour_need' ? 'short' : 'short', r.send]].forEach(([f, v], k) => {
      const td = jm.cell(tr, jm.int(v), 'n' + (k === 2 && v > 0 ? ' bad' : ''));
      td.setAttribute('data-source', r.src); td.setAttribute('data-field', r.src === 'tour_need' && f === 'need' ? 'need' : r.src === 'tour_need' && f === 'have' ? 'on_hand' : f); td.setAttribute('data-where', 'key=' + encodeURIComponent(r.key));
    });
    return tr;
  }));
});
document.querySelectorAll('#ts-pack-copy').forEach((btn) => btn.addEventListener('click', () => {
  const rows = packRows() || []; const s = (window.jmState || {}).tsRange === 'd14' ? 'next 2 weeks' : 'rest of booked tour';
  const lines = ['John Muirhead merch, packing list (' + s + ')', 'Product\tSize\tNeeded\tOn hand\tTo send'].concat(rows.map((r) => [r.product, r.size || '-', r.need, r.have, r.send].join('\t')));
  const ok = document.getElementById('ts-pack-copied'), bad = document.getElementById('ts-pack-fail');
  const done = (good) => { if (ok) ok.hidden = !good; if (bad) bad.hidden = good; if (good) setTimeout(() => { if (ok) ok.hidden = true; }, 2500); };
  try { navigator.clipboard.writeText(lines.join('\n')).then(() => done(true), () => done(false)); } catch (e) { done(false); }
}));

// ---------- Tour stock: have / need / short ----------
const tsSum = () => { const d = dash.data('tour_need_sum'); return d.status === 'ok' ? (d.data || []).find((r) => r.range === S.tsRange) : null; };
const tsMark = (el, src, field, where) => { el.setAttribute('data-source', src); el.setAttribute('data-field', field); if (where) el.setAttribute('data-where', where); };
const tsEnc = (v) => encodeURIComponent(v);
dash.draw('ts-end', (el) => { const s = tsSum(); el.textContent = s && s.end ? d3.utcFormat('%a %b %-d')(new Date(s.end + 'T00:00:00Z')) : '—'; });
[['ts-k-short', 'short_products'], ['ts-k-units', 'short_units'], ['ts-k-tight', 'tight_products'], ['ts-k-ok', 'ok_products']].forEach(([name, f]) => {
  dash.draw(name, (el) => { const s = tsSum(); el.textContent = s ? jm.int(s[f]) : '—'; if (s) el.setAttribute('data-where', 'range=' + S.tsRange); });
});
dash.draw('ts-list', (el) => {
  const d = dash.data('tour_need'), z = dash.data('tour_need_sizes');
  if (d.status !== 'ok' || z.status !== 'ok') { jm.placeholder(el, ['tour_need', 'tour_need_sizes']); return; }
  const rows = d.data.filter((r) => r.range === S.tsRange);
  const fmt = d3.utcFormat('%a %b %-d');
  const label = { short: 'Running short', tight: 'Tight', ok: 'Enough' };
  const cls = { short: 'bad', tight: 'warn', ok: 'ok' };
  const mk = (tag, c, text) => { const e = document.createElement(tag); if (c) e.className = c; if (text != null) e.textContent = text; return e; };
  el.replaceChildren(...rows.map((r) => {
    const where = 'key=' + tsEnc(r.key);
    const card = mk('article', 'jm-ts-row ' + cls[r.status]); card.id = 'ts-' + r.product.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const head = mk('div', 'ts-head');
    head.append(mk('h3', 'ts-name', r.product), mk('span', 'ts-pill ' + cls[r.status], label[r.status]));
    const btn = mk('button', 'jm-btn ts-chart', 'Chart'); btn.type = 'button'; btn.setAttribute('aria-label', 'Show-by-show chart for ' + r.product);
    btn.addEventListener('click', () => { S.expanded = r.product; S.mFrom = S.roadFrom; S.mTo = S.roadTo; S.mZoom = 1; dash.draw('road-modal'); const dlg = document.getElementById('road-modal'); if (dlg && dlg.showModal && !dlg.open) dlg.showModal(); });
    head.append(btn);
    const nums = mk('div', 'ts-nums');
    const num = (val, lbl, field, extra) => { const box = mk('div', 'ts-num' + (extra ? ' ' + extra : '')); const b = mk('b', null, jm.int(val)); tsMark(b, 'tour_need', field, where); box.append(b, mk('small', null, lbl)); return box; };
    nums.append(num(r.on_hand, 'on hand', 'on_hand'), num(r.need, 'needed', 'need'),
      r.short > 0 ? num(r.short, r.has_sizes ? 'short, by size' : 'short', 'short', 'is-short') : num(r.spare, 'spare', 'spare', r.status === 'tight' ? 'is-tight' : 'is-spare'));
    card.append(head, nums);
    let line;
    if (r.first_out_city === 'now') line = (r.first_out_sizes ? r.first_out_sizes + ' already out' : 'None on tour now');
    else if (r.first_out_date) line = (r.first_out_sizes ? r.first_out_sizes + ' runs out' : 'Runs out') + ' at ' + r.first_out_city + ' · ' + fmt(new Date(r.first_out_date + 'T00:00:00Z'));
    else line = r.need > 0 ? 'Lasts through ' + fmt(new Date(r.end + 'T00:00:00Z')) : 'No sales expected at these shows';
    card.append(mk('p', 'ts-when', line));
    if (r.has_sizes) {
      const sz = z.data.filter((x) => x.product === r.product && x.range === S.tsRange).sort((a, b) => a.sort - b.sort);
      const chips = mk('div', 'ts-sizes');
      sz.forEach((x) => {
        const c = mk('span', 'ts-size' + (x.short > 0 ? ' bad' : x.need > 0 && x.have - x.need < Math.max(1, x.need * 0.2) ? ' warn' : ''));
        const w = 'key=' + tsEnc(x.key);
        const s = mk('b', null, x.size); const h = mk('span', 'h', jm.int(x.have)); tsMark(h, 'tour_need_sizes', 'have', w);
        const n = mk('span', 'n', jm.int(x.need)); tsMark(n, 'tour_need_sizes', 'need', w);
        c.append(s, ' ', h, ' / ', n);
        if (x.short > 0) { const sh = mk('em', null, jm.int(x.short)); tsMark(sh, 'tour_need_sizes', 'short', w); c.append(' · short ', sh); }
        chips.append(c);
      });
      const legend = mk('p', 'ts-legend', 'Each size: on hand / needed');
      card.append(chips, legend);
    }
    return card;
  }));
});

dash.draw('road-modal', (dlg) => {
  const plan = dash.data('road_plan'), strip = dash.data('road_strip'), hist = dash.data('road_history');
  const r = plan.status === 'ok' && S.expanded ? plan.data.find((x) => x.product === S.expanded) : null;
  if (!r || strip.status !== 'ok' || hist.status !== 'ok') { dlg.replaceChildren(); return; }
  if (typeof S.mFrom !== 'number') { S.mFrom = S.roadFrom; S.mTo = S.roadTo; }
  const w = { from: isoOff(S.mFrom), to: isoOff(S.mTo), today: isoOff(0) };
  const f = futureRows(strip.data, r.product, w);
  const hp = hist.data.filter((h) => h.product === r.product && h.date >= w.from && h.date <= w.to);
  const head = document.createElement('div'); head.className = 'jm-modal-head';
  const t = document.createElement('h3'); t.textContent = r.product;
  const close = document.createElement('button'); close.type = 'button'; close.className = 'jm-expand'; close.setAttribute('aria-label', 'Close'); close.textContent = '✕';
  close.addEventListener('click', () => dlg.close());
  head.append(t, close);
  const st = document.createElement('div'); st.className = 'st'; roadStatus(st, r, f); st.style.fontSize = 'var(--cds-font-size-body)';
  const range = document.createElement('div'); range.className = 'jm-range';
  const row = document.createElement('div'); row.className = 'jm-zoomrow';
  const zc = document.createElement('div'); zc.className = 'jm-zoom';
  const plus = document.createElement('button'); plus.type = 'button'; plus.className = 'jm-expand'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Zoom in vertically');
  const minus = document.createElement('button'); minus.type = 'button'; minus.className = 'jm-expand'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Zoom out vertically');
  const slider = document.createElement('input'); slider.type = 'range'; slider.min = '1'; slider.max = '10'; slider.step = '0.5'; slider.value = String(S.mZoom || 1); slider.setAttribute('aria-label', 'Vertical zoom'); slider.className = 'jm-vslider';
  const fit = document.createElement('button'); fit.type = 'button'; fit.className = 'jm-fit'; fit.textContent = 'Fit';
  zc.append(plus, slider, minus, fit);
  const box = document.createElement('div'); box.className = 'jm-chart';
  row.append(zc, box);
  const zs = sizeRows(r.product); if (!S.mMode) S.mMode = 'size';
  const modeSeg = document.createElement('div'); modeSeg.className = 'jm-seg'; modeSeg.setAttribute('role', 'group'); modeSeg.setAttribute('aria-label', 'Chart');
  [['total', 'Total'], ['size', 'By size']].forEach(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.className = S.mMode === v ? 'is-on' : ''; b.setAttribute('aria-pressed', String(S.mMode === v)); b.addEventListener('click', () => { S.mMode = v; dash.draw('road-modal'); }); modeSeg.appendChild(b); });
  if (!zs.length) modeSeg.hidden = true;
  const chipsWrap = document.createElement('div'); chipsWrap.style.position = 'relative'; sizeChips(chipsWrap, r.product, f);
  const redraw = () => { box.replaceChildren(); if (zs.length && S.mMode === 'size') drawSizeChart(box, r, f, w, zs, S.mZoom || 1); else drawRoadChart(box, r, f, hp, w, 'm', true, S.mZoom || 1); };
  const setZ = (v) => { S.mZoom = Math.max(1, Math.min(10, v)); slider.value = String(S.mZoom); redraw(); };
  slider.addEventListener('input', () => setZ(Number(slider.value)));
  plus.addEventListener('click', () => setZ((S.mZoom || 1) + 1)); minus.addEventListener('click', () => setZ((S.mZoom || 1) - 1)); fit.addEventListener('click', () => setZ(1));
  const facts = document.createElement('div'); facts.className = 'jm-kpis';
  const kpi = (label, value) => { const k = document.createElement('div'); k.className = 'jm-kpi'; const a = document.createElement('span'); a.textContent = label; const b = document.createElement('b'); b.textContent = value; k.append(a, b); return k; };
  facts.append(kpi('Carrying now', jm.int(r.road)), kpi('Sold, shown dates', jm.int(d3.sum(hp, (h) => h.units))), kpi('Projected to sell', jm.int(d3.sum(f, (x) => x.projected_units))), kpi('Per 100 tickets', r.shows_used ? jm.dec1(r.rate_per_100) : '—'));
  const tw = document.createElement('div'); tw.className = 'jm-tablewrap';
  const table = document.createElement('table'); table.className = 'jm-table';
  const thead = document.createElement('thead'); const hr = document.createElement('tr');
  ['Date', 'City', 'Venue', 'Tickets', 'Sold', 'Projected', 'Left after'].forEach((h, i) => { const th = document.createElement('th'); th.textContent = h; if (i >= 3) th.className = 'n'; hr.appendChild(th); });
  thead.appendChild(hr); table.appendChild(thead);
  const tb = document.createElement('tbody');
  hp.forEach((h) => { const tr = document.createElement('tr'); jm.cell(tr, jm.date(h.date)); jm.cell(tr, h.city); jm.cell(tr, h.venue || '—', 'muted'); jm.cell(tr, h.tickets ? jm.int(h.tickets) : '—', 'n'); jm.cell(tr, String(h.units), 'n'); jm.cell(tr, '', 'n');
    const la = jm.cell(tr, h.left_after_est == null ? 'Not tracked' : h.left_after_est + ' (est.)', 'n' + (h.left_after_est == null ? ' muted' : ''));
    if (h.left_after_est == null) la.title = 'Road stock wasn’t tracked in Shopify before Nov 12, 2026.'; else { la.setAttribute('data-source', 'road_history'); la.setAttribute('data-field', 'left_after_est'); la.setAttribute('data-where', 'product_show=' + encodeURIComponent(h.product_show)); la.title = 'Estimated: today’s count plus what sold at later shows. A restock in between would change it.'; }
    tb.appendChild(tr); });
  f.forEach((x) => { const tr = document.createElement('tr'); jm.cell(tr, jm.date(x.date) + (x.status === 'Hold' ? ' (offer / hold)' : '')); jm.cell(tr, x.city); jm.cell(tr, x.venue || '—', 'muted'); jm.cell(tr, jm.int(x.expected) + ' exp.', 'n'); jm.cell(tr, '', 'n'); jm.cell(tr, String(Math.round(x.projected_units)), 'n'); const c = jm.cell(tr, String(leftOf(x)) + ' (proj.)', 'n'); if (leftOf(x) < 0) c.style.color = 'var(--color-bad)'; tb.appendChild(tr); });
  table.appendChild(tb); tw.appendChild(table);
  dlg.replaceChildren(head, st, range, modeSeg, row, chipsWrap, facts, tw);
  buildRange(range, () => [S.mFrom, S.mTo], (a, b) => { S.mFrom = a; S.mTo = b; }, () => dash.draw('road-modal'));
  redraw();
  dlg.onclick = (ev) => { if (ev.target === dlg) dlg.close(); };
});

// ---------- Road: table of projected units left after each show (resizable columns) ----------
dash.draw('road-grid', (el) => {
  const ordered = orderedProducts();
  if (!ordered) { jm.placeholder(el, ['road_plan', 'road_strip']); return; }
  S.colW = S.colW || {};
  const shows = []; const seen = new Set();
  for (const { f } of ordered) for (const x of f) if (!seen.has(x.show_id)) { seen.add(x.show_id); shows.push(x); }
  shows.sort((a, b) => (a.date < b.date ? -1 : 1));
  const keys = ['__lead', '__num'].concat(shows.map((x) => x.show_id));
  const widthOf = (k) => S.colW[k] || (k === '__lead' ? 190 : k === '__num' ? 84 : 84);
  const table = document.createElement('table'); table.className = 'jm-grid';
  const cg = document.createElement('colgroup'); const cols = {};
  keys.forEach((k) => { const col = document.createElement('col'); col.style.width = widthOf(k) + 'px'; cols[k] = col; cg.appendChild(col); });
  table.appendChild(cg);
  const setTableWidth = () => { table.style.width = d3.sum(keys, widthOf) + 'px'; };
  setTableWidth();
  const gtip = { t: null };
  const resizer = (th, k) => {
    const h = document.createElement('span'); h.className = 'jm-resize'; h.setAttribute('aria-hidden', 'true');
    h.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); ev.stopPropagation(); const x0 = ev.clientX, w0 = widthOf(k); h.setPointerCapture(ev.pointerId); h.classList.add('is-on');
      const move = (e) => { S.colW[k] = Math.max(44, Math.min(400, w0 + e.clientX - x0)); cols[k].style.width = S.colW[k] + 'px'; setTableWidth(); };
      const up = () => { h.classList.remove('is-on'); h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up);
    });
    h.addEventListener('dblclick', () => { delete S.colW[k]; cols[k].style.width = widthOf(k) + 'px'; setTableWidth(); });
    th.appendChild(h);
  };
  const thead = document.createElement('thead'); const hr = document.createElement('tr');
  const h0 = document.createElement('th'); h0.className = 'lead'; h0.textContent = 'Product'; resizer(h0, '__lead');
  const h1 = document.createElement('th'); h1.className = 'numh'; h1.textContent = 'Carrying'; resizer(h1, '__num');
  hr.append(h0, h1);
  shows.forEach((x, i) => {
    const th = document.createElement('th'); if (x.status === 'Hold') th.className = 'hold'; if (i === 0) th.classList.add('divider');
    const d = document.createElement('span'); d.className = 'd'; d.textContent = jm.shortDate(x.date); const cty = document.createElement('span'); cty.className = 'city'; cty.textContent = x.city; th.append(d, cty);
    th.addEventListener('mousemove', (ev) => gtip.t && gtip.t.show(ev, [jm.date(x.date) + (x.status === 'Hold' ? ' · offer / hold' : ' · show'), x.city + (x.venue ? ' – ' + x.venue : ''), jm.int(x.expected) + ' tickets expected']));
    th.addEventListener('mouseleave', () => gtip.t && gtip.t.hide());
    resizer(th, x.show_id); hr.appendChild(th);
  });
  thead.appendChild(hr); table.appendChild(thead);
  const tb = document.createElement('tbody');
  for (const { r, f } of ordered) {
    const tr = document.createElement('tr');
    const lead = document.createElement('td'); lead.className = 'lead'; const p = document.createElement('span'); p.className = 'p'; p.textContent = r.product; lead.appendChild(p);
    const c = document.createElement('td'); c.className = 'num'; c.textContent = String(r.road); c.setAttribute('data-source', 'road_plan'); c.setAttribute('data-field', 'road'); c.setAttribute('data-where', 'product=' + encodeURIComponent(r.product));
    tr.append(lead, c);
    const byShow = new Map(f.map((x) => [x.show_id, x]));
    shows.forEach((sh, i) => {
      const x = byShow.get(sh.show_id); const td = document.createElement('td'); const v = x ? leftOf(x) : null;
      const low = Math.max(3, Math.round(r.road * 0.1));
      td.className = 'cell ' + (v == null ? '' : v < 0 ? 'out' : v <= low ? 'low' : 'ok'); if (i === 0) td.classList.add('divider');
      const sp = document.createElement('span'); sp.textContent = v == null ? '' : String(v);
      if (x) { sp.setAttribute('data-source', 'road_strip'); sp.setAttribute('data-field', S.holds ? 'left_with_holds' : 'left_confirmed'); sp.setAttribute('data-where', 'product_show=' + encodeURIComponent(x.product_show)); }
      td.appendChild(sp); tr.appendChild(td);
    });
    tb.appendChild(tr);
  }
  table.appendChild(tb);
  el.replaceChildren(table);
  el.style.position = 'relative'; gtip.t = jm.tip(el);
});

// ---------- Quotes & invoices ----------
dash.draw('quotes-open', (el) => {
  const d = dash.data('quotes'); if (d.status !== 'ok') { jm.placeholder(el, ['quotes']); return; }
  const open = d.data.filter((r) => r.type === 'Quote' && r.status === 'Open');
  if (!open.length) { const p = document.createElement('div'); p.className = 'jm-msg'; p.textContent = 'No open quotes. Add them to Supplier Quotes & Invoices in Notion with Status = Open.'; el.replaceChildren(p); return; }
  el.replaceChildren();
  for (const [product, qs] of d3.groups(open, (r) => r.product)) {
    const card = document.createElement('div'); card.className = 'jm-qcard';
    const h = document.createElement('div'); h.className = 'jm-qhead'; const b = document.createElement('b'); b.textContent = product; const sm = document.createElement('small'); sm.textContent = qs[0].supplier + (qs[0].price ? ' · sells for ' + jm.money(qs[0].price) : '') + (qs[0].per_month ? ' · selling about ' + jm.dec1(qs[0].per_month) + ' a month' : ''); h.append(b, sm);
    const opts = document.createElement('div'); opts.className = 'jm-qopts';
    const sorted = qs.slice().sort((a, b2) => a.qty - b2.qty); const best = d3.min(sorted, (q) => q.unit_cost);
    sorted.forEach((q) => {
      const o = document.createElement('div'); o.className = 'jm-qopt' + (q.unit_cost === best && sorted.length > 1 ? ' best' : '');
      const mk = (cls, txt, field) => { const e = document.createElement('div'); e.className = cls; e.textContent = txt; if (field) { e.setAttribute('data-source', 'quotes'); e.setAttribute('data-field', field); e.setAttribute('data-where', 'doc_id=' + encodeURIComponent(q.doc_id)); } return e; };
      o.append(mk('q-qty', jm.int(q.qty) + ' units'), mk('q-unit', jm.money2(q.unit_cost) + ' each', 'unit_cost'), mk('q-line', jm.money(q.subtotal) + ' + HST · quote ' + q.number, 'subtotal'));
      if (q.profit_unit != null) o.append(mk('q-line', 'Profit ' + jm.money2(q.profit_unit) + ' each (' + q.margin + '%)', 'margin'));
      if (q.months_cover != null) o.append(mk('q-line', 'Lasts about ' + (q.months_cover >= 24 ? Math.round(q.months_cover / 12) + ' years' : jm.dec1(q.months_cover) + ' months'), 'months_cover'));
      if (q.extra_unit != null) o.append(mk('q-note', (q.qty - q.extra_vs) + ' more than the ' + q.extra_vs + ' quote for ' + jm.money2(q.extra_unit) + ' each', 'extra_unit'));
      if (q.unit_cost === best && sorted.length > 1) o.prepend(mk('q-badge', 'Lowest cost per unit'));
      opts.appendChild(o);
    });
    card.append(h, opts); el.appendChild(card);
  }
});
dash.draw('docs-sum', (el) => { const d = dash.data('quotes'); if (d.status !== 'ok') { el.textContent = '—'; return; } const due = d.data.filter((r) => r.type === 'Invoice' && r.status === 'Invoiced'); el.textContent = 'All ' + d.data.length + ' quotes and invoices' + (due.length ? ' · ' + due.length + ' invoice' + (due.length === 1 ? '' : 's') + ' not marked paid' : ''); });
dash.draw('docs-table', (tb) => {
  const d = dash.data('quotes'); if (d.status !== 'ok') { tb.replaceChildren(); return; }
  tb.replaceChildren(...d.data.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((r) => {
    const tr = document.createElement('tr'); tr.setAttribute('data-key', encodeURIComponent(r.doc_id));
    jm.cell(tr, r.date ? jm.date(r.date) : '—'); jm.cell(tr, r.document);
    const kind = { Open: 'warn', Accepted: 'ok', Invoiced: 'warn', Paid: 'muted', Superseded: 'muted', Declined: 'muted' }[r.status] || 'muted'; jm.pill(tr, r.status === 'Invoiced' ? 'Not marked paid' : r.status, kind);
    jm.cell(tr, r.qty != null ? jm.int(r.qty) : '—', 'n'); jm.cell(tr, r.unit_cost != null ? jm.money2(r.unit_cost) : '—', 'n'); jm.cell(tr, r.subtotal != null ? jm.money(r.subtotal) : '—', 'n');
    const due = jm.cell(tr, r.due && r.status === 'Invoiced' ? jm.date(r.due) : '—', r.due && r.status === 'Invoiced' ? '' : 'muted'); if (r.due && r.status === 'Invoiced' && r.due <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)) due.style.color = 'var(--color-bad)';
    return tr;
  }));
});

// ---------- Inventory (stock + reorder status) ----------
const STATUS_SHORT = { 'Order now': ['Order now', 'bad', 0], 'Order within 30 days': ['Order soon', 'warn', 1], 'Set lead time': ['', 'muted', 2], 'OK': ['OK', 'ok', 3] };
dash.draw('stock-list', (el) => {
  const d = dash.data('stock'), ro = dash.data('reorder'), rp = dash.data('road_plan'), wp = dash.data('web_plan');
  if (d.status !== 'ok' || ro.status !== 'ok') { jm.placeholder(el, ['stock', 'reorder']); return; }
  const reo = new Map(ro.data.map((r) => [r.product, r]));
  const road = new Map(rp.status === 'ok' ? rp.data.map((r) => [r.product, r]) : []);
  const webp = new Map(wp.status === 'ok' ? wp.data.map((r) => [r.product, r]) : []);
  const rzd = dash.data('road_sizes'); const rz = rzd.status === 'ok' ? rzd.data : [];
  const rows = d.data.filter((r) => r.location === S.stockLoc && (S.stockGroup === 'all' || r.group === S.stockGroup));
  const groups = d3.groups(rows, (r) => r.product).map(([product, rs]) => { const o = reo.get(product); const st = o ? STATUS_SHORT[o.status] || ['OK', 'ok', 3] : ['No forecast', 'muted', 4];
    return { product, group: rs[0].group, rs: rs.sort((a, b) => a.sort - b.sort), total: rs[0].total, weeks: rs[0].weeks_left, o, st }; });
  const sorters = { name: (a, b) => (a.product < b.product ? -1 : 1), high: (a, b) => b.total - a.total, low: (a, b) => a.total - b.total,
    urgent: (a, b) => a.st[2] - b.st[2] || ((a.o && a.o.first_out) || '9999').localeCompare((b.o && b.o.first_out) || '9999') || a.total - b.total };
  groups.sort(sorters[S.stockSort] || sorters.urgent);
  const pinned = pinFirst(groups, (g) => g.product); groups.length = 0; groups.push(...pinned);
  if (!groups.length) { const p = document.createElement('div'); p.className = 'jm-msg'; p.textContent = 'Nothing in this view.'; el.replaceChildren(p); return; }
  const web = S.stockLoc === 'web';
  let tip = null; el.style.position = 'relative';
  const head = document.createElement('div'); head.className = 'jm-stockrow jm-stockhead';
  [['Pin · Status', ''], ['Product', ''], ['Total', 't'], ['By size', 'sz'], [web ? 'Weeks left' : '', 'w']].forEach(([t, c]) => { const s2 = document.createElement('span'); s2.textContent = t; if (c === 't' || c === 'w') s2.style.textAlign = 'right'; if (c === 'sz') s2.className = 'sz'; head.appendChild(s2); });
  const tipLines = (g) => {
    const L = [g.product + ': ' + g.st[0]]; const r = road.get(g.product), w = webp.get(g.product), o = g.o;
    const zs = rz.filter((z) => z.product === g.product && z.runs_out_date).sort((a, b) => (a.runs_out_date < b.runs_out_date ? -1 : 1));
    if (zs.length) zs.slice(0, 3).forEach((z) => L.push('On the road: ' + z.size + (z.runs_out_date === 'now' ? ' is out now' : ' expected to run out at ' + z.runs_out_city + ' (' + jm.shortDate(z.runs_out_date) + ')')));
    else if (r) L.push(r.runs_out_date ? 'On the road: expected to run out at ' + r.runs_out_city + ' (' + jm.shortDate(r.runs_out_date) + ')' : 'On the road: enough for the booked shows');
    if (w) L.push(w.per_week > 0 ? 'Web store: about ' + jm.dec1(w.weeks_cover) + ' weeks left at ' + jm.dec1(w.per_week) + ' a week' : 'Web store: no sales in the last 8 weeks');
    if (o && o.order_by) L.push('Order by ' + jm.date(o.order_by) + ' (' + o.lead_days + '-day lead time)');
    const qd = dash.data('quotes'); if (qd.status === 'ok') qd.data.filter((q) => q.product === g.product && q.type === 'Quote' && q.status === 'Open').sort((a, b) => a.qty - b.qty).forEach((q) => L.push('Quote on file: ' + jm.int(q.qty) + ' for ' + jm.money(q.subtotal) + ' (' + jm.money2(q.unit_cost) + ' each)'));
    else if (o && o.status === 'Set lead time') L.push('Add the supplier lead time in Notion to get an order-by date');
    else if (!o) L.push('No sales yet to forecast from');
    return L;
  };
  const rowFor = (g) => {
    const row = document.createElement('div'); row.className = 'jm-stockrow' + (isPinned(g.product) ? ' pinned' : '');
    const sc = document.createElement('span'); sc.className = 's'; sc.appendChild(pinBox(g.product));
    const pill = document.createElement('span'); pill.className = 'jm-pill ' + g.st[1]; pill.textContent = g.st[0]; pill.tabIndex = 0; sc.style.display = 'flex'; sc.style.alignItems = 'center'; sc.style.gap = '8px';
    const lines = tipLines(g); pill.setAttribute('aria-label', lines.join('. '));
    if (g.o) { pill.setAttribute('data-source', 'reorder'); pill.setAttribute('data-field', 'status'); pill.setAttribute('data-where', 'product=' + encodeURIComponent(g.product)); }
    pill.addEventListener('mousemove', (ev) => tip.show(ev, lines)); pill.addEventListener('mouseleave', () => tip.hide());
    pill.addEventListener('focus', () => { const b = pill.getBoundingClientRect(); tip.show({ clientX: b.right, clientY: b.bottom, pageX: b.right + window.scrollX, pageY: b.bottom + window.scrollY }, lines); }); pill.addEventListener('blur', () => tip.hide());
    if (g.st[0]) sc.appendChild(pill);
    const p = document.createElement('span'); p.className = 'p'; p.textContent = g.product;
    const t = document.createElement('span'); t.className = 't' + (g.total <= 0 ? ' bad' : ''); t.textContent = jm.int(g.total);
    t.setAttribute('data-source', 'stock'); t.setAttribute('data-field', 'total'); t.setAttribute('data-where', 'key=' + encodeURIComponent(g.rs[0].key));
    const sz = document.createElement('div'); sz.className = 'jm-sizes-inline sz';
    if (g.rs.length === 1 && !g.rs[0].size) { const none = document.createElement('span'); none.className = 'jm-range-cap'; none.textContent = 'No sizes'; sz.appendChild(none); }
    else g.rs.forEach((r) => { const c = document.createElement('span'); c.className = 'jm-sz' + (r.qty <= 3 ? ' bad' : r.qty <= 8 ? ' low' : ''); const b = document.createElement('b'); b.textContent = r.qty; b.setAttribute('data-source', 'stock'); b.setAttribute('data-field', 'qty'); b.setAttribute('data-where', 'key=' + encodeURIComponent(r.key)); c.append(b, document.createTextNode(r.size)); sz.appendChild(c); });
    const wk = document.createElement('span'); wk.className = 'w';
    if (web) { wk.textContent = g.weeks == null ? 'No recent sales' : g.weeks <= 0 ? 'Out' : jm.dec1(g.weeks); wk.style.color = g.weeks == null ? 'var(--color-fg-muted)' : g.weeks < 4 ? 'var(--color-bad)' : g.weeks < 12 ? 'var(--color-warn)' : 'var(--color-ok)'; }
    row.append(sc, p, t, sz, wk);
    return row;
  };
  const out = [head];
  if (S.stockGroup === 'all') for (const name of ['Soft goods', 'Hard goods']) { const gs = groups.filter((g) => g.group === name); if (!gs.length) continue; const h = document.createElement('div'); h.className = 'jm-stockgroup'; h.textContent = name; out.push(h, ...gs.map(rowFor)); }
  else out.push(...groups.map(rowFor));
  el.replaceChildren(...out); tip = jm.tip(el);
});

