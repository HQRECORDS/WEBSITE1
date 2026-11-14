dash.calc('markets', { title: 'Merch per head by region', description: 'Played shows grouped by province, state or region for eight date ranges (all time, last 30, 60, 90 and 120 days, last 12 months, this year, last year): total merch gross divided by total tickets sold, in Canadian dollars.', inputs: ['show_perf'], fn: (show_perf) => {
  const now = new Date(); const y = now.getUTCFullYear(); const since = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); 
  const ranges = { all: () => true, d30: (d) => d >= since(30), d60: (d) => d >= since(60), d90: (d) => d >= since(90), d120: (d) => d >= since(120), last12: (d) => d >= new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10), this_year: (d) => d.slice(0, 4) === String(y), last_year: (d) => d.slice(0, 4) === String(y - 1) };
  const out = [];
  for (const [range, ok] of Object.entries(ranges)) {
    const g = new Map();
    for (const s of show_perf) { if (!s.date || !ok(s.date)) continue; const a = g.get(s.region) || { range, region: s.region, range_region: range + '|' + s.region, shows: 0, tickets: 0, gross: 0 }; a.shows += 1; a.tickets += s.tickets; a.gross += s.gross; g.set(s.region, a); }
    for (const a of g.values()) out.push({ ...a, gross: Math.round(a.gross), per_ticket: Math.round((a.gross / a.tickets) * 100) / 100 });
  }
  return out;
} });



dash.calc('ph_items', { title: 'Merch per head by item', description: 'For played shows with point-of-sale sales and tickets sold, in eight date ranges (all time, last 30, 60, 90 and 120 days, last 12 months, this year, last year): each product’s show sales in Canadian dollars and units (net of refunds), divided by all tickets sold at those shows. Gives dollars per head and units per 100 tickets for each item.', inputs: ['show_perf', 'sales', 'products'], fn: (show_perf, sales, products) => {
  const y = new Date().getUTCFullYear(); const since12 = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10); const since = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); 
  const ranges = { all: () => true, d30: (d) => d >= since(30), d60: (d) => d >= since(60), d90: (d) => d >= since(90), d120: (d) => d >= since(120), last12: (d) => d >= since12, this_year: (d) => d.slice(0, 4) === String(y), last_year: (d) => d.slice(0, 4) === String(y - 1) };
  const name = new Map(products.map((p) => [p.id, p.product]));
  const out = [];
  for (const [range, ok] of Object.entries(ranges)) {
    const shows = new Map(show_perf.filter((s) => s.gross_from === 'Sales' && s.date && ok(s.date)).map((s) => [s.show_id, s.tickets]));
    const T = [...shows.values()].reduce((t, v) => t + v, 0); if (!T) continue;
    const g = new Map();
    for (const s of sales) {
      if (s.channel !== 'Show POS' || !shows.has(s.show_id)) continue;
      const p = name.get(s.product_id) || 'Unlinked items';
      const a = g.get(p) || { range, product: p, range_product: range + '|' + p, gross: 0, units: 0 }; a.gross += s.gross_cad; a.units += s.units - s.refunded; g.set(p, a);
    }
    for (const a of g.values()) if (a.gross > 0 || a.units > 0) out.push({ ...a, gross: Math.round(a.gross), tickets: T, shows: shows.size, per_head: Math.round((a.gross / T) * 100) / 100, per_100: Math.round((a.units / T) * 1000) / 10 });
  }
  return out;
} });

dash.calc('size_mix', { title: 'Size mix by show, city and province', description: 'Units sold at shows per size (net of refunds) for each product and for all shirts together, grouped by show, city, province and all shows, with each size as a share of its group. Also the size mix John is carrying now.', inputs: ['size_sales', 'shows', 'products', 'stock'], fn: (size_sales, shows, products, stock) => {
  const order = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  const showById = new Map(shows.map((x) => [x.id, x])); const nameById = new Map(products.map((p) => [p.id, p.product]));
  const g = new Map();
  const add = (product, type, group, size, units, date) => { const k = product + '|' + type + '|' + group + '|' + size; const a = g.get(k) || { key: k, product, type, group, size, units: 0, date: date || null, sort: order.indexOf(size) }; a.units += units; g.set(k, a); };
  for (const r of size_sales) {
    if (r.channel !== 'Show POS' || !r.show_id || !r.size) continue;
    const sh = showById.get(r.show_id); const name = nameById.get(r.product_id); if (!sh || !name) continue;
    const showLabel = sh.city + ', ' + (sh.date || '');
    for (const prod of [name, 'All shirts']) {
      add(prod, 'show', showLabel, r.size, r.units, sh.date);
      add(prod, 'city', sh.city, r.size, r.units);
      add(prod, 'region', sh.region || (sh.country === 'Other' ? 'Outside North America' : sh.country), r.size, r.units);
      add(prod, 'all', 'All shows', r.size, r.units);
    }
  }
  for (const r of stock) {
    if (r.location !== 'road' || !r.size) continue;
    add(r.product, 'road', 'On the road now', r.size, Math.max(0, r.qty));
    if (r.group === 'Soft goods') add('All shirts', 'road', 'On the road now', r.size, Math.max(0, r.qty));
  }
  const totals = new Map();
  for (const a of g.values()) { const t = a.product + '|' + a.type + '|' + a.group; totals.set(t, (totals.get(t) || 0) + a.units); }
  return [...g.values()].map((a) => { const total = totals.get(a.product + '|' + a.type + '|' + a.group) || 0; return { ...a, total, pct: total > 0 ? Math.round((a.units / total) * 1000) / 10 : 0 }; });
} });

dash.calc('venue_terms', { title: 'Venue merch cut by show', description: 'Each show’s Merch Terms from Notion read as the venue’s share of merch sales: “100%”, “to artist”, “SELLER” or “no merch fee” = no cut; “10% on merch” = 10%; a split like “85/15” = the smaller number (15%). Where terms give separate splits for soft goods and recorded music, each applies to its own products. Where terms list both “artist sells” and “venue sells”, the artist-sells split is used. Blank terms = no cut.', inputs: ['shows'], fn: (shows) => shows.map((s) => {
  const raw = String(s.merch_terms || '').trim(); const low = raw.toLowerCase();
  let soft = 0, rec = 0, basis = raw ? 'Read from terms' : 'No terms on file';
  if (raw && !/\d+\s*\/\s*\d+/.test(low) && !/\d+(\.\d+)?\s*%\s*on/.test(low)) { soft = 0; rec = 0; }
  else if (raw) {
    const pct = low.match(/(\d+(?:\.\d+)?)\s*%\s*on/); let any = pct ? Number(pct[1]) / 100 : null, s1 = null, r1 = null;
    const parts = low.split(/[;,]/); const both = /artist sells/.test(low) && /venue sells/.test(low);
    for (const part of parts) { const m = part.match(/(\d+)\s*\/\s*(\d+)/); if (!m) continue; if (both && /venue sells/.test(part)) continue;
      const v = Math.min(Number(m[1]), Number(m[2])) / 100; if (/soft/.test(part)) s1 = v; else if (/record/.test(part)) r1 = v; else any = v; }
    soft = s1 ?? any ?? 0; rec = r1 ?? any ?? 0;
  }
  return { show_id: s.id, show: s.show, date: s.date, terms: raw, soft_pct: Math.round(soft * 1000) / 10, recorded_pct: Math.round(rec * 1000) / 10, basis };
}) });

dash.calc('profit', { title: 'Profit by product', description: 'Sales, sales tax backed out of tax-inclusive show sales (GST/HST by the show’s province), cost of goods, venue cuts (recorded, or from the show’s Merch Terms), Shopify card fees and profit per product and for all products, for four date ranges and three channel views. Profit = sales − tax − cost of goods − venue cuts − card fees. Cost of goods uses the recorded cost on a sale when there is one, otherwise units × the product’s unit cost. Sales of products with no unit cost are counted separately and left out of profit.', inputs: ['sales', 'products', 'shows', 'venue_terms'], fn: (sales, products, shows, venue_terms) => {
  const prod = new Map(products.map((p) => [p.id, p]));
  // Venue cut: recorded on the sale (spreadsheet years), otherwise worked out from the show's Merch Terms on sales before tax.
  // Card fees: Shopify Payments standard rates on Shopify sales: 2.6% in person (Basic plan, Canada), 2.9% online (per-order 30¢ not included).
  const CARD_POS = 0.026, CARD_WEB = 0.029; const RECORDED = new Set(['CD', 'Vinyl']);
  const terms = new Map(venue_terms.map((v) => [v.show_id, v]));
  const cutOf = (s, p, tx) => { if (s.venue_cut) return s.venue_cut; if (s.source !== 'Shopify' || s.channel !== 'Show POS' || !s.show_id) return 0; const v = terms.get(s.show_id); if (!v) return 0; const pc = RECORDED.has(p.category) || /\b(CD|Vinyl|LP)\b/i.test(p.product || '') ? v.recorded_pct : v.soft_pct; return (s.gross_cad - tx) * pc / 100; };
  const feeOf = (s) => s.source !== 'Shopify' ? 0 : s.channel === 'Show POS' ? s.gross_cad * CARD_POS : s.channel === 'Web' ? s.gross_cad * CARD_WEB : 0;
  // Show sales rung up with no tax recorded are tax-inclusive (as in the artist's tour reports): back out GST/HST by the show's province.
  // ON 13%, NS 14% (15% before Apr 2025), NB/NL/PE 15%, other provinces 5% GST. PST is not backed out. Shows outside Canada: none. No show linked: 13%.
  const showPlace = new Map(shows.map((x) => [x.id, x]));
  const taxIn = (s) => { if (s.channel !== 'Show POS' || s.tax > 0 || !(s.gross_cad > 0)) return 0; const sh = s.show_id ? showPlace.get(s.show_id) : null;
    let r = 0.13; if (sh) { const c = String(sh.country || '').toLowerCase(), pr = String(sh.region || '').toUpperCase(); r = c !== 'canada' && c !== 'ca' ? 0 : pr === 'ON' ? 0.13 : pr === 'NS' ? (s.date < '2025-04-01' ? 0.15 : 0.14) : ['NB', 'NL', 'PE'].includes(pr) ? 0.15 : 0.05; }
    return s.gross_cad * r / (1 + r); };
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const year = new Date().toISOString().slice(0, 4);
  const ranges = { d30: (d) => d >= day(30), m12: (d) => d >= day(365), ytd: (d) => d.slice(0, 4) === year, all: () => true };
  const chans = { all: () => true, shows: (c) => c === 'Show POS', web: (c) => c === 'Web' };
  const r2 = (v) => Math.round(v * 100) / 100;
  const g = new Map();
  for (const s of sales) {
    if (!s.date || !s.product_id) continue; const p = prod.get(s.product_id); if (!p) continue;
    const units = s.units - s.refunded;
    const cogs = s.cogs != null && s.cogs > 0 ? s.cogs : (p.unit_cost != null ? p.unit_cost * units : null);
    const tx = taxIn(s); const vc = cutOf(s, p, tx); const fee = feeOf(s);
    for (const [rk, rf] of Object.entries(ranges)) {
      if (!rf(s.date)) continue;
      for (const [ck, cf] of Object.entries(chans)) {
        if (!cf(s.channel)) continue;
        for (const name of [p.product, 'All products']) {
          const key = rk + '|' + ck + '|' + name;
          const a = g.get(key) || { key, range: rk, channel: ck, product: name, is_total: name === 'All products', units: 0, sales: 0, hst: 0, cogs: 0, venue_cut: 0, card_fee: 0, sales_no_cost: 0 };
          a.units += units; a.sales += s.gross_cad;
          if (cogs == null) a.sales_no_cost += s.gross_cad; else { a.cogs += cogs; a.venue_cut += vc; a.hst += tx; a.card_fee += fee; }
          g.set(key, a);
        }
      }
    }
  }
  return [...g.values()].map((a) => { const known = a.sales - a.sales_no_cost; const profit = known - a.hst - a.cogs - a.venue_cut - a.card_fee; const costed = a.is_total || a.sales_no_cost === 0;
    return { ...a, sales: r2(a.sales), hst: r2(a.hst), card_fee: r2(a.card_fee), cogs: r2(a.cogs), venue_cut: r2(a.venue_cut), sales_no_cost: r2(a.sales_no_cost), cost_known: costed ? 'Yes' : 'No', profit: costed ? r2(profit) : null, margin: costed && known > 0 ? Math.round((profit / known) * 1000) / 10 : null }; });
} });

dash.calc('profit_q', { title: 'Merch profit by quarter', description: 'For each calendar quarter: merch sales in Canadian dollars, sales tax backed out of tax-inclusive show sales (GST/HST by the show’s province), cost of goods (recorded cost on the sale, otherwise units × unit cost), venue cuts (recorded, or from the show’s Merch Terms), Shopify card fees, and profit = sales with a known cost − tax − cost of goods − venue cuts − card fees. Sales of products with no unit cost are counted separately and left out of profit.', inputs: ['sales', 'products', 'shows', 'venue_terms'], fn: (sales, products, shows, venue_terms) => {
  const prod = new Map(products.map((p) => [p.id, p]));
  // Venue cut: recorded on the sale (spreadsheet years), otherwise worked out from the show's Merch Terms on sales before tax.
  // Card fees: Shopify Payments standard rates on Shopify sales: 2.6% in person (Basic plan, Canada), 2.9% online (per-order 30¢ not included).
  const CARD_POS = 0.026, CARD_WEB = 0.029; const RECORDED = new Set(['CD', 'Vinyl']);
  const terms = new Map(venue_terms.map((v) => [v.show_id, v]));
  const cutOf = (s, p, tx) => { if (s.venue_cut) return s.venue_cut; if (s.source !== 'Shopify' || s.channel !== 'Show POS' || !s.show_id) return 0; const v = terms.get(s.show_id); if (!v) return 0; const pc = RECORDED.has(p.category) || /\b(CD|Vinyl|LP)\b/i.test(p.product || '') ? v.recorded_pct : v.soft_pct; return (s.gross_cad - tx) * pc / 100; };
  const feeOf = (s) => s.source !== 'Shopify' ? 0 : s.channel === 'Show POS' ? s.gross_cad * CARD_POS : s.channel === 'Web' ? s.gross_cad * CARD_WEB : 0;
  // Show sales rung up with no tax recorded are tax-inclusive (as in the artist's tour reports): back out GST/HST by the show's province.
  // ON 13%, NS 14% (15% before Apr 2025), NB/NL/PE 15%, other provinces 5% GST. PST is not backed out. Shows outside Canada: none. No show linked: 13%.
  const showPlace = new Map(shows.map((x) => [x.id, x]));
  const taxIn = (s) => { if (s.channel !== 'Show POS' || s.tax > 0 || !(s.gross_cad > 0)) return 0; const sh = s.show_id ? showPlace.get(s.show_id) : null;
    let r = 0.13; if (sh) { const c = String(sh.country || '').toLowerCase(), pr = String(sh.region || '').toUpperCase(); r = c !== 'canada' && c !== 'ca' ? 0 : pr === 'ON' ? 0.13 : pr === 'NS' ? (s.date < '2025-04-01' ? 0.15 : 0.14) : ['NB', 'NL', 'PE'].includes(pr) ? 0.15 : 0.05; }
    return s.gross_cad * r / (1 + r); };
  const now = new Date().toISOString().slice(0, 10); const qOf = (d) => d.slice(0, 4) + '-Q' + (Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1);
  const g = new Map();
  for (const s of sales) {
    if (!s.date || !s.product_id) continue; const p = prod.get(s.product_id); if (!p) continue;
    const units = s.units - s.refunded; const cogs = s.cogs != null && s.cogs > 0 ? s.cogs : (p.unit_cost != null ? p.unit_cost * units : null);
    const q = qOf(s.date); const a = g.get(q) || { quarter: q, sales: 0, hst: 0, cogs: 0, venue_cut: 0, card_fee: 0, sales_no_cost: 0 };
    a.sales += s.gross_cad; if (cogs == null) a.sales_no_cost += s.gross_cad; else { const tx = taxIn(s); a.cogs += cogs; a.venue_cut += cutOf(s, p, tx); a.hst += tx; a.card_fee += feeOf(s); }
    g.set(q, a);
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  return [...g.values()].sort((a, b) => (a.quarter < b.quarter ? -1 : 1)).map((a) => { const known = a.sales - a.sales_no_cost; const profit = known - a.hst - a.cogs - a.venue_cut - a.card_fee;
    return { quarter: a.quarter, label: 'Q' + a.quarter.slice(-1) + ' ' + a.quarter.slice(0, 4), is_current: a.quarter === qOf(now), sales: r2(a.sales), hst: r2(a.hst), card_fee: r2(a.card_fee), cogs: r2(a.cogs), venue_cut: r2(a.venue_cut), sales_no_cost: r2(a.sales_no_cost), profit: r2(profit), margin: known > 0 ? Math.round((profit / known) * 1000) / 10 : null }; });
} });

dash.calc('geo', { title: 'Web customers by place', description: 'Web-store orders, units and sales in Canadian dollars by country, by province or state and by city, for the last 3 months, last 12 months and all time, with each place’s share of the total.', inputs: ['web_geo'], fn: (web_geo) => {
  const names = { CA: 'Canada', US: 'United States', GB: 'United Kingdom', AU: 'Australia', NZ: 'New Zealand', DE: 'Germany', FR: 'France', NL: 'Netherlands', IE: 'Ireland', DK: 'Denmark', SE: 'Sweden', NO: 'Norway', CH: 'Switzerland', AT: 'Austria', BE: 'Belgium', IT: 'Italy', ES: 'Spain', JP: 'Japan' };
  const cname = (c) => names[c] || c || 'Unknown';
  const mon = (n) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 7); };
  const ranges = { m3: (m) => m >= mon(2), m12: (m) => m >= mon(11), all: () => true };
  const g = new Map(); const tot = new Map();
  for (const r of web_geo) {
    for (const [rk, rf] of Object.entries(ranges)) {
      if (!r.month || !rf(r.month)) continue;
      const places = { country: cname(r.country), region: r.region ? r.region + ', ' + cname(r.country) : cname(r.country) + ' (no province/state)', city: r.city ? r.city + (r.region ? ', ' + r.region : '') + ', ' + r.country : 'No city, ' + cname(r.country) };
      for (const [lv, place] of Object.entries(places)) {
        const k = rk + '|' + lv + '|' + place; const a = g.get(k) || { key: k, range: rk, level: lv, place, orders: 0, units: 0, gross: 0 };
        a.orders += r.orders; a.units += r.units; a.gross += r.gross; g.set(k, a);
      }
      const t = tot.get(rk) || { orders: 0, units: 0, gross: 0 }; t.orders += r.orders; t.units += r.units; t.gross += r.gross; tot.set(rk, t);
    }
  }
  return [...g.values()].map((a) => { const t = tot.get(a.range); return { ...a, gross: Math.round(a.gross * 100) / 100, share_orders: t.orders ? Math.round((a.orders / t.orders) * 1000) / 10 : 0, share_gross: t.gross ? Math.round((a.gross / t.gross) * 1000) / 10 : 0, share_units: t.units ? Math.round((a.units / t.units) * 1000) / 10 : 0 }; });
} });

dash.calc('summary', { title: 'Headline numbers', description: 'Totals behind the tiles: units on the road, products short, reorders due within 30 days, open issues and high-severity open issues.', inputs: ['products', 'road_plan', 'reorder', 'issues'], fn: (products, road_plan, reorder, issues) => {
  const open = issues.filter((i) => i.status === 'Open' || i.status === 'Investigating');
  const synced = products.map((p) => p.last_synced).filter(Boolean).sort().pop() || null;
  return [
    { metric: 'road_units', value: products.filter((p) => p.status !== 'Discontinued').reduce((t, p) => t + Math.max(0, p.road || 0), 0) },
    { metric: 'short', value: road_plan.filter((r) => r.need > 0 && r.gap < 0).length },
    { metric: 'reorder_soon', value: reorder.filter((r) => r.status === 'Order now' || r.status === 'Order within 30 days').length },
    { metric: 'open_issues', value: open.length },
    { metric: 'high_issues', value: open.filter((i) => i.severity === 'High').length },
    { metric: 'last_synced', value: synced },
  ];
} });
