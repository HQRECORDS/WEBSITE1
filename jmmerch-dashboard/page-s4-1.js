
// ---------- Words, tiles, nav, refresh ----------
const sumVal = (metric) => { const d = dash.data('summary'); if (d.status !== 'ok' || !d.data) return null; const r = d.data.find((x) => x.metric === metric); return r ? r.value : null; };
const legVal = (field) => { const d = dash.data('leg'); const r = d.status === 'ok' && d.data ? d.data.find((x) => x.key === 'next30') : null; return r ? r[field] : null; };
const word = (name, metric, fmt) => dash.draw(name, (el) => { const v = sumVal(metric); el.textContent = v == null ? '—' : fmt(v); });
word('synced', 'last_synced', (v) => { if (!/T\d/.test(v)) return jm.date(v); const d = new Date(v); if (isNaN(d)) return jm.date(v.slice(0, 10)); return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(d); });
const badge = (name, metric, fn) => dash.draw(name, (el) => { const v = sumVal(metric); el.classList.remove('bad', 'warn', 'ok'); if (v == null || v === 0) { el.textContent = ''; return; } el.textContent = String(v); el.classList.add(fn(v)); });
badge('nav-road', 'short', () => 'bad');
badge('nav-reorder', 'reorder_soon', () => 'warn');
badge('nav-issues', 'high_issues', () => 'warn');

window.jmState = Object.assign({ roadView: 'chart', holds: false, roadFrom: -14, roadTo: 28, roadSort: 'risk', stockLoc: 'road', stockGroup: 'all', stockSort: 'urgent', phView: 'region', phRange: 'last12', phSort: 'per_ticket', showSort: 'date', showDir: -1, trendRange: '1y', sizeGroup: 'city', sizeShow: 'pct', sizeProduct: 'All shirts', profitRange: 'm12', profitCh: 'all', geoLevel: 'country', geoMeasure: 'orders', geoRange: 'm12', trendFrom: null, trendTo: null, grain: 'auto', metric: 'gross', ch: { Shows: true, Web: true, Other: true } }, window.jmState || {});
if (!window.jmState.ch) window.jmState.ch = { Shows: true, Web: true, Other: true };
if (typeof window.jmState.roadFrom !== 'number') { window.jmState.roadFrom = -14; window.jmState.roadTo = 28; }
const S = window.jmState;
if (S.tsRange !== 'd14' && S.tsRange !== 'tour') S.tsRange = 'tour';
S.stockLoc = 'web'; S.stockGroup = 'all'; S.stockSort = 'urgent'; S.grain = 'month'; if (S.trendRange !== 'all') S.trendRange = '1y'; S.trendFrom = null; S.trendTo = null;

// Segmented controls, checkbox, selects: update state and redraw.
const ROAD = ['road-multiples', 'road-grid', 'road-range-cap', 'road-modal'];
const TREND = ['trend-chart', 'trend-range', 'trend-total'];
const redrawFor = { tsRange: ['ts-end', 'ts-k-short', 'ts-k-units', 'ts-k-tight', 'ts-k-ok', 'ts-list', 'ts-pack'], sizeGroup: ['sizes-table', 'sizes-takeaway'], sizeShow: ['sizes-table'], profitRange: ['profit-kpis', 'profit-chart', 'profit-takeaway'], profitCh: ['profit-kpis', 'profit-chart', 'profit-takeaway'], geoLevel: ['geo-chart', 'geo-takeaway'], geoMeasure: ['geo-chart', 'geo-takeaway'], geoRange: ['geo-chart', 'geo-takeaway'], roadView: ROAD, stockLoc: ['stock-list'], stockGroup: ['stock-list'], phView: ['ph-region', 'ph-shows', 'ph-items'], grain: TREND, metric: TREND,
  trendRange: () => { S.trendFrom = null; S.trendTo = null; TREND.forEach((n) => dash.draw(n)); } };
const applyPanels = () => {
  document.querySelectorAll('#road-chart-panel').forEach((p) => { p.hidden = S.roadView !== 'chart'; });
  document.querySelectorAll('#road-table-panel').forEach((p) => { p.hidden = S.roadView !== 'table'; });
  document.querySelectorAll('#ph-region-panel').forEach((p) => { p.hidden = S.phView !== 'region'; });
  document.querySelectorAll('#ph-show-panel').forEach((p) => { p.hidden = S.phView !== 'show'; });
  document.querySelectorAll('#ph-item-panel').forEach((p) => { p.hidden = S.phView !== 'item'; });
  document.querySelectorAll('#ph-sort-field').forEach((p) => { p.hidden = S.phView !== 'region'; });
};
document.querySelectorAll('.jm-seg[data-group]').forEach((seg) => {
  const group = seg.getAttribute('data-group');
  seg.querySelectorAll('button[data-val]').forEach((b) => {
    b.classList.toggle('is-on', b.getAttribute('data-val') === S[group]);
    b.setAttribute('aria-pressed', String(b.getAttribute('data-val') === S[group]));
    b.addEventListener('click', () => {
      S[group] = b.getAttribute('data-val');
      seg.querySelectorAll('button[data-val]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
      applyPanels();
      const r = redrawFor[group]; if (typeof r === 'function') r(); else (r || []).forEach((n) => dash.draw(n));
    });
  });
});
document.querySelectorAll('#holds-toggle').forEach((c) => { c.checked = S.holds; c.addEventListener('change', () => { S.holds = c.checked; ROAD.concat(['road-range']).forEach((n) => dash.draw(n)); }); });
document.querySelectorAll('#road-sort').forEach((c) => { c.value = S.roadSort; c.addEventListener('change', () => { S.roadSort = c.value; ROAD.forEach((n) => dash.draw(n)); }); });
document.querySelectorAll('#stock-sort').forEach((c) => { c.value = S.stockSort; c.addEventListener('change', () => { S.stockSort = c.value; dash.draw('stock-list'); }); });
document.querySelectorAll('.trend-ch').forEach((c) => { c.checked = S.ch[c.value] !== false; c.addEventListener('change', () => { S.ch[c.value] = c.checked; TREND.forEach((n) => dash.draw(n)); }); });
document.querySelectorAll('#ph-range').forEach((c) => { c.value = S.phRange; c.addEventListener('change', () => { S.phRange = c.value; ['ph-region', 'ph-shows', 'ph-items'].forEach((n) => dash.draw(n)); }); });
document.querySelectorAll('#ph-sort').forEach((c) => { c.value = S.phSort; c.addEventListener('change', () => { S.phSort = c.value; dash.draw('ph-region'); }); });
document.querySelectorAll('.jm-sort[data-sort]').forEach((b) => b.addEventListener('click', () => {
  const k = b.getAttribute('data-sort');
  if (S.showSort === k) S.showDir = -S.showDir; else { S.showSort = k; S.showDir = (k === 'city' || k === 'region') ? 1 : -1; }
  document.querySelectorAll('.jm-sort[data-sort]').forEach((x) => { const on = x.getAttribute('data-sort') === S.showSort; x.classList.toggle('is-on', on); x.classList.toggle('asc', on && S.showDir > 0); x.classList.toggle('desc', on && S.showDir < 0); });
  dash.draw('ph-shows');
}));
applyPanels();

// Copy road table as tab-separated text (pastes into Excel or Sheets as columns).
document.querySelectorAll('#road-copy').forEach((btn) => btn.addEventListener('click', () => {
  const t = document.querySelector('#road-table-panel table'); if (!t) return;
  const tsv = [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => c.textContent.trim().replace(/−/g, '-')).join('\t')).join('\n');
  const ok = document.getElementById('road-copied'), bad = document.getElementById('road-copy-fail');
  const done = (good) => { if (ok) ok.hidden = !good; if (bad) bad.hidden = good; setTimeout(() => { if (ok) ok.hidden = true; }, 3000); };
  try {
    navigator.clipboard.writeText(tsv).then(() => done(true), () => { const r = document.createRange(); r.selectNodeContents(t); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); done(false); });
  } catch (e) { done(false); }
}));

window.jmLoadedAt = window.jmLoadedAt || null;
const DATASETS = ['products', 'shows', 'sales', 'issues', 'size_sales', 'web_geo', 'supplier_docs'];
dash.draw('loaded-at', (el) => {
  const st = DATASETS.map((id) => dash.data(id));
  if (st.some((d) => d.status === 'loading' || d.refreshing)) { el.textContent = 'just now (loading)'; return; }
  if (st.some((d) => d.status !== 'ok')) { el.textContent = '—'; return; }
  window.jmLoadedAt = window.jmLoadedAt || new Date();
  el.textContent = d3.timeFormat('%b %-d at %-I:%M %p')(window.jmLoadedAt);
});
dash.onData(() => {
  const busy = DATASETS.some((id) => { const d = dash.data(id); return d.status === 'loading' || d.refreshing; });
  document.querySelectorAll('#refresh-btn').forEach((b) => { b.disabled = busy; b.classList.toggle('is-busy', busy); });
});
document.querySelectorAll('#refresh-btn').forEach((b) => b.addEventListener('click', () => { window.jmLoadedAt = null; DATASETS.forEach((id) => dash.refresh(id)); }));

const PAGES = ['overview', 'road', 'profit', 'markets', 'issues'];
const PAGE_ALIAS = { stock: 'road', trend: 'profit', sizes: 'markets', webgeo: 'markets' };
const showPage = (id, push) => {
  if (PAGE_ALIAS[id]) id = PAGE_ALIAS[id];
  if (id === 'top' || !PAGES.includes(id)) id = 'overview';
  document.querySelectorAll('.jm-page').forEach((p) => { p.hidden = p.id !== id; });
  document.querySelectorAll('.jm-nav a[data-target]').forEach((l) => { const on = l.getAttribute('data-target') === id; l.classList.toggle('is-active', on); if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
  const page = document.getElementById(id);
  if (page) new Set([...page.querySelectorAll('[data-draw]')].map((e) => e.getAttribute('data-draw'))).forEach((n) => dash.draw(n));
  window.scrollTo(0, 0);
  if (push) dash.setLink(id);
};
document.querySelectorAll('[data-target]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); showPage(a.getAttribute('data-target'), true); }));
window.addEventListener('hashchange', () => showPage((location.hash || '').slice(1), false));
showPage((location.hash || '').slice(1), false);
window.jmShowPage = showPage;

// Light/Dark switch: flips the page theme and remembers the choice in this browser.
(function () {
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const current = () => root.getAttribute('data-theme') || (mq.matches ? 'dark' : 'light');
  const paint = () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    btn.querySelector('span').textContent = next === 'dark' ? 'Dark' : 'Light';
    btn.querySelector('.i-moon').hidden = next !== 'dark';
    btn.querySelector('.i-sun').hidden = next === 'dark';
    btn.setAttribute('aria-label', 'Switch to ' + next + ' mode');
  };
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('jm-theme', next); } catch (e) { /* private window: switch still works for this visit */ }
    paint();
  });
  if (mq.addEventListener) mq.addEventListener('change', paint);
  paint();
})();
