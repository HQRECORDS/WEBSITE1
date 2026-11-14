
// ---------- Loaders: page through each Notion view and keep only the columns used here ----------
dash.loader('sales', { description: 'Reads every page of the Sales view (100 rows per call) and keeps date, channel, product, show, units, gross in Canadian dollars and any tax recorded on the line.', fn: async ({ answer, call, args }) => {
  const all = []; let page = answer; let n = 0;
  while (true) {
    if (page && page.error) throw new Error(typeof page.error === 'string' ? page.error : (page.error.message || 'Notion returned an error'));
    all.push(...((page && page.results) || []));
    if (!page || !page.has_more || !page.next_cursor || ++n > 40) break;
    page = await call('notion-query-data-sources', { data: { ...args.data, start_cursor: page.next_cursor } });
  }
  const ref = (s) => { try { const a = JSON.parse(s || '[]'); const m = String(a[0] || '').match(/[0-9a-f]{32}/g); return m ? m[m.length - 1] : null; } catch (e) { return null; } };
  const num = (v) => (v === null || v === undefined || v === '' || (typeof v === 'string' && /^(formula|rollup)/.test(v))) ? null : Number(v);
  return all.map((r) => ({
    sale_id: (String(r.url || '').match(/[0-9a-f]{32}/g) || []).pop() || null,
    date: r['date:Date:start'] || null,
    precision: r['Date Precision'] || null,
    channel: r['Channel'] || null,
    product_id: ref(r['Product']),
    show_id: ref(r['Show']),
    units: num(r['Units Sold']) || 0,
    refunded: num(r['Units Refunded']) || 0,
    gross_cad: num(r['Gross (Shop Currency)']) ?? num(r['Gross Revenue']) ?? 0,
    cogs: num(r['Total COGS']),
    venue_cut: num(r['Venue Cut']) || 0,
    tax: num(r['Tax']) || 0,
    currency: r['Currency'] || 'CAD',
    // Rows from a one-off Shopify backfill (Source "shopify-backfill-<date>") count as Shopify, so they get card fees and venue cuts too.
    source: /^shopify/i.test(r['Source'] || '') ? 'Shopify' : (r['Source'] || null),
  }));
} });

dash.loader('shows', { description: 'Reads every page of the Shows view and keeps date, place, status, capacity, tickets, the calendar merch gross and the merch terms.', fn: async ({ answer, call, args }) => {
  const all = []; let page = answer; let n = 0;
  while (true) {
    if (page && page.error) throw new Error(typeof page.error === 'string' ? page.error : (page.error.message || 'Notion returned an error'));
    all.push(...((page && page.results) || []));
    if (!page || !page.has_more || !page.next_cursor || ++n > 20) break;
    page = await call('notion-query-data-sources', { data: { ...args.data, start_cursor: page.next_cursor } });
  }
  const un = (s) => s == null ? '' : String(s).replace(/\\([\\`*_{}\[\]()#+\-.!|$<>~])/g, '$1');
  const num = (v) => (v === null || v === undefined || v === '' || (typeof v === 'string' && /^(formula|rollup)/.test(v))) ? null : Number(v);
  return all.map((r) => ({
    id: (String(r.url || '').match(/[0-9a-f]{32}/g) || []).pop() || null,
    show: un(r['Show']),
    date: r['date:Date:start'] || null,
    precision: r['Date Precision'] || null,
    city: un(r['City']),
    region: un(r['Province/State']),
    country: r['Country'] || '',
    venue: un(r['Venue']),
    status: r['Status'] || '',
    show_type: r['Show Type'] || '',
    capacity: num(r['Capacity']),
    tickets: num(r['Tickets Sold']),
    merch_gross_cal: num(r['Merch Gross (Calendar)']),
    merch_terms: un(r['Merch Terms']),
  }));
} });

dash.loader('products', { description: 'Reads the Products view and keeps name, status, road and web stock, size breakdown, cost, supplier and lead time.', fn: async ({ answer, call, args }) => {
  const all = []; let page = answer; let n = 0;
  while (true) {
    if (page && page.error) throw new Error(typeof page.error === 'string' ? page.error : (page.error.message || 'Notion returned an error'));
    all.push(...((page && page.results) || []));
    if (!page || !page.has_more || !page.next_cursor || ++n > 10) break;
    page = await call('notion-query-data-sources', { data: { ...args.data, start_cursor: page.next_cursor } });
  }
  const un = (s) => s == null ? '' : String(s).replace(/\\([\\`*_{}\[\]()#+\-.!|$<>~])/g, '$1');
  const num = (v) => (v === null || v === undefined || v === '' || (typeof v === 'string' && /^(formula|rollup)/.test(v))) ? null : Number(v);
  return all.map((r) => ({
    id: (String(r.url || '').match(/[0-9a-f]{32}/g) || []).pop() || null,
    product: un(r['Name']),
    category: r['Category'] || '',
    status: r['Status'] || '',
    road: num(r['Road On Hand']),
    web: num(r['Web On Hand']),
    sizes: un(r['Size Breakdown']),
    unit_cost: num(r['Unit Cost']),
    price: num(r['Retail Price']),
    supplier: un(r['Supplier']),
    lead_days: num(r['Lead Time (days)']),
    last_synced: r['date:Last Synced:start'] || null,
  }));
} });

dash.loader('size_sales', { description: 'Reads every page of the Sales by Size view and keeps date, product, show, size, channel and units; duplicate sync keys count once.', fn: async ({ answer, call, args }) => {
  const all = []; let page = answer; let n = 0;
  while (true) {
    if (page && page.error) throw new Error(typeof page.error === 'string' ? page.error : (page.error.message || 'Notion returned an error'));
    all.push(...((page && page.results) || []));
    if (!page || !page.has_more || !page.next_cursor || ++n > 40) break;
    page = await call('notion-query-data-sources', { data: { ...args.data, start_cursor: page.next_cursor } });
  }
  const un = (s) => s == null ? '' : String(s).replace(/\\([\\`*_{}\[\]()#+\-.!|$<>~])/g, '$1');
  const num = (v) => (v === null || v === undefined || v === '' || (typeof v === 'string' && /^(formula|rollup)/.test(v))) ? null : Number(v);
  const ref = (s) => { try { const a = JSON.parse(s || '[]'); const m = String(a[0] || '').match(/[0-9a-f]{32}/g); return m ? m[m.length - 1] : null; } catch (e) { return null; } };
  const seen = new Map();
  for (const r of all) {
    const key = un(r['Sync Key']) || r.url;
    seen.set(key, { sync_key: key, date: r['date:Date:start'] || null, product_id: ref(r['Product']), show_id: ref(r['Show']), size: un(r['Size']).trim().toUpperCase().replace(/^XXXL$/, '3XL').replace(/^XXL$/, '2XL'), channel: r['Channel'] || null, units: (num(r['Units Sold']) || 0) - (num(r['Units Refunded']) || 0) });
  }
  return [...seen.values()];
} });

dash.loader('web_geo', { description: 'Reads every page of the Web Customer Regions view and keeps month, country, province or state, city, orders, units and sales in Canadian dollars; duplicate sync keys count once.', fn: async ({ answer, call, args }) => {
  const all = []; let page = answer; let n = 0;
  while (true) {
    if (page && page.error) throw new Error(typeof page.error === 'string' ? page.error : (page.error.message || 'Notion returned an error'));
    all.push(...((page && page.results) || []));
    if (!page || !page.has_more || !page.next_cursor || ++n > 40) break;
    page = await call('notion-query-data-sources', { data: { ...args.data, start_cursor: page.next_cursor } });
  }
  const un = (s) => s == null ? '' : String(s).replace(/\\([\\`*_{}\[\]()#+\-.!|$<>~])/g, '$1');
  const num = (v) => (v === null || v === undefined || v === '' || (typeof v === 'string' && /^(formula|rollup)/.test(v))) ? null : Number(v);
  const ref = (s) => { try { const a = JSON.parse(s || '[]'); const m = String(a[0] || '').match(/[0-9a-f]{32}/g); return m ? m[m.length - 1] : null; } catch (e) { return null; } };
  const seen = new Map();
  for (const r of all) {
    const key = un(r['Sync Key']) || r.url;
    seen.set(key, { sync_key: key, month: (r['date:Month:start'] || '').slice(0, 7), country: un(r['Country']).trim().toUpperCase(), region: un(r['Region']).trim().toUpperCase(), city: un(r['City']).trim(), orders: num(r['Orders']) || 0, units: num(r['Units']) || 0, gross: num(r['Gross (CAD)']) || 0 });
  }
  return [...seen.values()];
} });

dash.loader('supplier_docs', { description: 'Reads the Supplier Quotes & Invoices view and keeps the document, type, status, supplier, number, date, product, run, quantity, ex-HST subtotal, HST, total, unit cost and one-time costs.', fn: async ({ answer, call, args }) => {
  const all = []; let page = answer; let n = 0;
  while (true) {
    if (page && page.error) throw new Error(typeof page.error === 'string' ? page.error : (page.error.message || 'Notion returned an error'));
    all.push(...((page && page.results) || []));
    if (!page || !page.has_more || !page.next_cursor || ++n > 10) break;
    page = await call('notion-query-data-sources', { data: { ...args.data, start_cursor: page.next_cursor } });
  }
  const un = (s) => s == null ? '' : String(s).replace(/\\([\\`*_{}\[\]()#+\-.!|$<>~])/g, '$1');
  const num = (v) => (v === null || v === undefined || v === '') ? null : Number(v);
  const ref = (s) => { try { const a = JSON.parse(s || '[]'); const m = String(a[0] || '').match(/[0-9a-f]{32}/g); return m ? m[m.length - 1] : null; } catch (e) { return null; } };
  return all.map((r) => ({
    doc_id: (String(r.url || '').match(/[0-9a-f]{32}/g) || []).pop() || null,
    document: un(r['Document']), type: r['Type'] || '', status: r['Status'] || '', supplier: r['Supplier'] || '', number: un(r['Doc Number']),
    date: r['date:Date:start'] || null, due: r['date:Due Date:start'] || null, product_id: ref(r['Product']), run: r['Run'] || '',
    qty: num(r['Qty']), subtotal: num(r['Subtotal ex-HST']), hst: num(r['HST']), total: num(r['Total']), unit_cost: num(r['Unit Cost ex-HST']), one_time: num(r['One-time Costs']),
  }));
} });

dash.loader('issues', { description: 'Reads the Data Issues view and keeps the issue, status, severity, type and whether it affects the forecast.', fn: async ({ answer, call, args }) => {
  const all = []; let page = answer; let n = 0;
  while (true) {
    if (page && page.error) throw new Error(typeof page.error === 'string' ? page.error : (page.error.message || 'Notion returned an error'));
    all.push(...((page && page.results) || []));
    if (!page || !page.has_more || !page.next_cursor || ++n > 10) break;
    page = await call('notion-query-data-sources', { data: { ...args.data, start_cursor: page.next_cursor } });
  }
  const un = (s) => s == null ? '' : String(s).replace(/\\([\\`*_{}\[\]()#+\-.!|$<>~])/g, '$1');
  return all.map((r) => ({
    id: String(r['userDefined:ID'] ?? r['ID'] ?? (String(r.url || '').match(/[0-9a-f]{32}/g) || []).pop() ?? ''),
    issue: un(r['Issue']),
    status: r['Status'] || '',
    severity: r['Severity'] || '',
    type: r['Type'] || '',
    affects_forecast: r['Affects Forecast'] === '__YES__' ? 'Yes' : 'No',
    first_seen: r['date:First Seen:start'] || null,
  }));
} });
