/*
 * Static stand-in for the claude.ai Dashboard runtime.
 *
 * The dashboard page (page.html) was written for claude.ai, where a `dash`
 * object loads live Notion data. On GitHub Pages there is no claude.ai
 * runtime, so this file provides the same `dash` API, reading snapshots in
 * data/<id>.json that the "JM merch data" GitHub Action refreshes from Notion.
 *
 * page.html and the page-*.css / page-*.js parts are the dashboard's
 * index.html from the claude.ai artifact, split by scripts/split-page.py so
 * each update only changes the parts that changed. This file joins them back.
 */
(function () {
  'use strict';

  const DATASETS = ['products', 'shows', 'sales', 'issues', 'size_sales', 'web_geo', 'supplier_docs'];
  const DATA_DIR = 'data/';

  const sources = {};   // id -> state object returned by dash.data
  const loaders = {};   // id -> loader fn
  const calcs = {};     // id -> {inputs, fn}
  const calcCache = {}; // id -> {version, state}
  const draws = {};     // name -> {fn} or {mount, update, unmount}
  const mounted = new WeakMap(); // el -> {name, made}
  const listeners = [];
  let params = {};
  let version = 0;
  let scheduled = false;

  const blank = (status) => ({ status, data: [], columns: [], message: '', refreshing: false, truncated: false, meta: null });

  /* ---------- data ---------- */

  function columnsOf(rows) {
    const seen = new Set();
    (rows || []).slice(0, 50).forEach((r) => { if (r && typeof r === 'object') Object.keys(r).forEach((k) => seen.add(k)); });
    return [...seen];
  }

  function normalise(out) {
    if (Array.isArray(out)) return { data: out, columns: columnsOf(out), truncated: false, meta: null };
    if (out && Array.isArray(out.rows)) return { data: out.rows, columns: out.columns || columnsOf(out.rows), truncated: !!out.truncated, meta: out.meta || null };
    if (out && 'data' in out) return { data: out.data, columns: out.columns || (Array.isArray(out.data) ? columnsOf(out.data) : []), truncated: !!out.truncated, meta: out.meta || null };
    return { data: out, columns: [], truncated: false, meta: null };
  }

  async function load(id) {
    const prev = sources[id];
    if (prev && prev.status === 'ok') { prev.refreshing = true; changed(); }
    else { sources[id] = blank('loading'); changed(); }
    try {
      const res = await fetch(DATA_DIR + id + '.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 404 ? 'No data file yet. Run the "JM merch data" action on GitHub.' : 'Could not load ' + id + ' (' + res.status + ')');
      const answer = await res.json();
      if (answer && answer.error) throw new Error(typeof answer.error === 'string' ? answer.error : (answer.error.message || 'Sync error'));
      let out = answer;
      if (loaders[id]) {
        out = await loaders[id]({
          answer, items: [answer], args: { data: {} },
          call: async () => { throw new Error('Paging is done by the sync; the snapshot should hold every row.'); },
          read: {},
        });
      } else if (answer && Array.isArray(answer.results)) {
        out = answer.results;
      }
      sources[id] = Object.assign(blank('ok'), normalise(out));
    } catch (e) {
      console.error('[dash] ' + id, e);
      sources[id] = Object.assign(blank('error'), { message: String(e && e.message || e) });
    }
    changed();
  }

  function calcState(id) {
    const c = calcs[id];
    const cached = calcCache[id];
    if (cached && cached.version === version) return cached.state;
    const ins = c.inputs.map((i) => dashData(i));
    let state;
    if (ins.some((s) => s.status === 'error' || s.status === 'missing')) {
      state = Object.assign(blank('error'), { data: null, message: 'An input failed to load' });
    } else if (ins.some((s) => s.status !== 'ok')) {
      state = Object.assign(blank('loading'), { data: null });
    } else {
      try {
        const v = c.fn(...ins.map((s) => s.data));
        state = Object.assign(blank('ok'), { data: v, columns: Array.isArray(v) ? columnsOf(v) : [] });
        state.refreshing = ins.some((s) => s.refreshing);
      } catch (e) {
        console.error('[dash] calc ' + id, e);
        state = Object.assign(blank('error'), { data: null, message: String(e && e.message || e) });
      }
    }
    calcCache[id] = { version, state };
    return state;
  }

  function dashData(id) {
    if (calcs[id]) return calcState(id);
    if (sources[id]) return sources[id];
    if (DATASETS.includes(id)) { load(id); return sources[id]; }
    return blank('missing');
  }

  /* ---------- drawing ---------- */

  function visible(el) { return !el.closest('[hidden]'); }
  function nested(el) { const p = el.parentElement; return !!(p && p.closest('[data-draw]')); }

  function runDraw(name, el) {
    const d = draws[name];
    if (!d) return;
    try {
      if (d.fn) { d.fn(el); return; }
      let m = mounted.get(el);
      if (!m) { el.replaceChildren(); m = { made: d.mount ? d.mount(el) : undefined }; mounted.set(el, m); }
      if (d.update) d.update(el, m.made);
    } catch (e) {
      console.error('[dash] draw ' + name, e);
      const m = mounted.get(el);
      if (m && d.unmount) { try { d.unmount(el, m.made); } catch (_) { /* ignore */ } }
      mounted.delete(el);
    }
  }

  const widths = new WeakMap();
  const ro = 'ResizeObserver' in window ? new ResizeObserver((entries) => {
    entries.forEach((en) => {
      const el = en.target; const w = Math.round(en.contentRect.width);
      if (widths.get(el) === w) return; widths.set(el, w);
      const name = el.getAttribute('data-draw');
      if (name && visible(el)) runDraw(name, el);
    });
  }) : null;

  function drawAll(only) {
    const names = only ? [only] : Object.keys(draws);
    names.forEach((name) => {
      document.querySelectorAll('[data-draw="' + CSS.escape(name) + '"]').forEach((el) => {
        if (nested(el) || !visible(el)) return;
        if (ro && !widths.has(el)) { widths.set(el, Math.round(el.clientWidth)); ro.observe(el); }
        runDraw(name, el);
      });
    });
  }

  function render() {
    scheduled = false;
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error('[dash] onData', e); } });
    drawAll();
  }

  function changed() {
    version++;
    if (!started || scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }

  let started = false;

  /* ---------- public API ---------- */

  window.dash = {
    data: dashData,
    onData(fn) { listeners.push(fn); if (started) { try { fn(); } catch (e) { console.error(e); } } },
    calc(id, spec) { calcs[id] = { inputs: spec.inputs || [], fn: spec.fn }; },
    loader(id, spec) { loaders[id] = spec.fn; },
    draw(name, spec) {
      if (spec === undefined) { if (started) drawAll(name); return; }
      draws[name] = typeof spec === 'function' ? { fn: spec } : spec;
    },
    // Chart colors follow the page theme (set as --chart-1 … --chart-6 in index.html).
    colors: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'],
    refresh(id) { if (DATASETS.includes(id)) load(id); },
    setLink(name) { try { history.pushState(null, '', '#' + name); } catch (e) { location.hash = name; } },
    params() { return Object.assign({}, params); },
    setParams(p) { Object.keys(p).forEach((k) => { if (p[k] == null) delete params[k]; else params[k] = p[k]; }); changed(); },
    resetParams() { params = {}; changed(); },
  };

  /* ---------- boot: mount page.html, run its scripts in order ---------- */

  async function boot() {
    const root = document.getElementById('dash-root');
    const bust = '?t=' + Date.now();
    const get = async (f) => { const r = await fetch(f + bust, { cache: 'no-store' }); if (!r.ok) throw new Error(f + ' ' + r.status); return r.text(); };
    // page.html may point at its styles and scripts in parts (data-src="a.js b.js"); join them in order.
    const joined = (el) => Promise.all(el.getAttribute('data-src').split(/\s+/).filter(Boolean).map(get)).then((xs) => xs.join(''));
    const tpl = document.createElement('template');
    tpl.innerHTML = await get('page.html');
    for (const st of tpl.content.querySelectorAll('style[data-src]')) { st.textContent = await joined(st); st.removeAttribute('data-src'); }
    const scripts = [...tpl.content.querySelectorAll('script')];
    const code = await Promise.all(scripts.map((s) => (s.hasAttribute('data-src') ? joined(s) : s.textContent)));
    scripts.forEach((s) => s.remove());
    tpl.content.querySelectorAll('meta').forEach((m) => m.remove());
    root.replaceChildren(tpl.content);
    for (const c of code) {
      const el = document.createElement('script');
      el.textContent = '(function(){\n' + c + '\n})();';
      document.body.appendChild(el);
    }
    started = true;
    DATASETS.forEach((id) => { if (!sources[id]) load(id); });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
