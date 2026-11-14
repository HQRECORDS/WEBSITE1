
// Shared helpers for the drawings below.
window.jm = {
  int: (v) => v == null || isNaN(v) ? '—' : d3.format(',')(Math.round(v)),
  money: (v) => v == null || isNaN(v) ? '—' : '$' + d3.format(',.0f')(v),
  money2: (v) => v == null || isNaN(v) ? '—' : '$' + d3.format(',.2f')(v),
  dec1: (v) => v == null || isNaN(v) ? '—' : d3.format(',.1f')(v),
  date: (s) => { if (!s) return '—'; const d = new Date(s + 'T00:00:00Z'); return isNaN(d) ? s : d3.utcFormat('%b %-d, %Y')(d); },
  shortDate: (s) => { if (!s) return '—'; const d = new Date(s + 'T00:00:00Z'); return isNaN(d) ? s : d3.utcFormat('%b %-d')(d); },
  status: (ids) => { const st = ids.map((id) => dash.data(id).status); if (st.every((s) => s === 'ok')) return 'ok'; if (st.some((s) => s === 'error' || s === 'missing')) return 'error'; return 'loading'; },
  placeholder: (el, ids) => { const s = jm.status(ids); const p = document.createElement('div'); p.className = 'jm-msg'; p.textContent = s === 'error' ? 'Failed to load' : 'Loading…'; el.replaceChildren(p); },
  tip: (el) => { const t = document.createElement('div'); t.className = 'jm-tip'; t.hidden = true; el.appendChild(t); return {
    show: (ev, lines) => { t.replaceChildren(...lines.map((l, i) => { const d = document.createElement('div'); if (i === 0) { const b = document.createElement('b'); b.textContent = l; d.appendChild(b); } else d.textContent = l; return d; })); t.hidden = false; const r = el.getBoundingClientRect(); let x = ev.clientX - r.left + 12, y = ev.clientY - r.top + 12; const w = t.offsetWidth; if (x + w > el.clientWidth) x = Math.max(0, ev.clientX - r.left - w - 12); t.style.left = x + 'px'; t.style.top = y + 'px'; },
    hide: () => { t.hidden = true; } }; },
  measure: (svg, texts) => { const g = svg.append('g').attr('opacity', 0); let m = 0; texts.forEach((s) => { const n = g.append('text').text(s).node(); m = Math.max(m, n.getComputedTextLength()); }); g.remove(); return m; },
  cell: (tr, text, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = text; tr.appendChild(td); return td; },
  pill: (tr, text, kind) => { const td = document.createElement('td'); const s = document.createElement('span'); s.className = 'jm-pill ' + kind; s.textContent = text; td.appendChild(s); tr.appendChild(td); return td; },
};
