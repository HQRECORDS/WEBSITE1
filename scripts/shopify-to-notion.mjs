// Copies John Muirhead's Shopify store into the Notion Merch Inventory System.
// Run by the "Shopify to Notion" GitHub Action. Replaces the weekly Claude
// scheduled task, so syncing uses no Claude usage.
//
// What it writes (all upserts by Sync Key, so reruns never double count):
//   Sales                 one row per day, product, channel, location, currency
//   Sales by Size         one row per day, product, size, channel, location
//   Web Customer Regions  one row per month, country, province/state, city (counts only)
//   Products              Road / Web / Current On Hand, Size Breakdown, Last Synced
//   Inventory Snapshots   one row per day and product
// It never deletes anything, never changes Shopify, and never logs customer details.
//
// Env:
//   NOTION_TOKEN            Notion integration secret with read + update + insert access
//   SHOPIFY_STORE           e.g. johnmuirhead.myshopify.com
//   SHOPIFY_CLIENT_ID       Shopify app client id      } client-credentials grant
//   SHOPIFY_CLIENT_SECRET   Shopify app client secret  }
//   SHOPIFY_ADMIN_TOKEN     (optional) an Admin API token instead of the two above
//   SYNC_FROM               (optional) YYYY-MM-DD to backfill from; default: 14 days ago
//   DRY_RUN                 (optional) "1" = read everything, write nothing, print counts

// Trim spaces and any quotes or backticks picked up when copying a value into GitHub.
const env = (k) => (process.env[k] || '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
const NOTION_TOKEN = env('NOTION_TOKEN');
const STORE = env('SHOPIFY_STORE').replace(/^https?:\/\//, '').replace(/\/$/, '');
const DRY = env('DRY_RUN') === '1' || env('DRY_RUN') === 'true';
if (!NOTION_TOKEN || !STORE) { console.error('NOTION_TOKEN and SHOPIFY_STORE must be set'); process.exit(1); }

const API = '2025-10';
const NOTION_VERSION = '2025-09-03';
const TZ = 'America/Toronto';
const ROAD_LOCATION = 'On Tour';          // stock John carries; every other location is web stock
const POS_LATE_HOURS = 4;                 // POS orders before 4 AM count toward the previous night's show

const DS = {
  products: '8ec23f71-bc38-4d2f-bf86-9c6d8c59d82f',
  shows: 'dc2e8f85-1601-4bd2-b565-3f25342f8a71',
  sales: '0bd0f322-6216-4085-ba3f-3ae4709bb4d1',
  sizes: 'b11d6c7d-538f-434d-9ebf-0e47bed22097',
  geo: '0784bc31-8a45-4252-9ce5-042b720caf2c',
  snapshots: '6cf4c913-d718-47bc-a331-5289c9f0adf3',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (v) => Math.round(v * 100) / 100;
const num = (v) => (v == null || v === '' ? 0 : Number(v));
const idNum = (gid) => String(gid || '').split('/').pop();
const summary = [];
const log = (s) => { console.log(s); summary.push(s); };

// ---------------- Dates ----------------
const ymdIn = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const hourIn = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d)) % 24;
const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TODAY = ymdIn(new Date());
const FROM = /^\d{4}-\d{2}-\d{2}$/.test(env('SYNC_FROM')) ? env('SYNC_FROM') : addDays(TODAY, -14);
const FETCH_FROM = addDays(FROM.slice(0, 8) + '01', -1); // whole months, so monthly region totals are complete

// ---------------- Notion ----------------
async function notion(path, body, method) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch('https://api.notion.com/v1/' + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { Authorization: 'Bearer ' + NOTION_TOKEN, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) { await sleep(Number(res.headers.get('retry-after') || 0) * 1000 || 1500 * (attempt + 1)); continue; }
    const json = await res.json();
    if (!res.ok) throw new Error(`Notion ${path}: ${res.status} ${json.message || ''}`);
    return json;
  }
  throw new Error('Notion ' + path + ': gave up after retries');
}
async function queryAll(ds, filter) {
  const out = []; let cursor;
  do {
    const r = await notion(`data_sources/${ds}/query`, { page_size: 100, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) });
    out.push(...r.results.filter((p) => p.object === 'page' && !p.in_trash && !p.archived));
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out;
}
const plain = (p) => !p ? '' : p.type === 'title' ? p.title.map((t) => t.plain_text).join('') : p.type === 'rich_text' ? p.rich_text.map((t) => t.plain_text).join('') : p.type === 'select' ? (p.select ? p.select.name : '') : p.type === 'status' ? (p.status ? p.status.name : '') : p.type === 'number' ? p.number : p.type === 'date' ? (p.date ? p.date.start : '') : '';

// Property builders
const P = {
  title: (s) => ({ title: [{ text: { content: String(s).slice(0, 1900) } }] }),
  text: (s) => ({ rich_text: s ? [{ text: { content: String(s).slice(0, 1900) } }] : [] }),
  num: (v) => ({ number: v == null ? null : r2(v) }),
  select: (s) => ({ select: s ? { name: s } : null }),
  date: (s, e) => ({ date: s ? { start: s, ...(e ? { end: e } : {}) } : null }),
  rel: (ids) => ({ relation: (ids || []).filter(Boolean).map((id) => ({ id })) }),
  check: (b) => ({ checkbox: !!b }),
};

let writes = 0;
async function upsert(ds, existing, key, props, compareKeys) {
  const cur = existing.get(key);
  if (cur) {
    // Skip the write when nothing we manage has changed.
    const same = compareKeys.every((k) => { const a = cur.properties[k]; const b = props[k]; if (!a || !b) return false;
      if ('number' in b) return r2(num(a.number)) === r2(num(b.number));
      if ('relation' in b) return JSON.stringify((a.relation || []).map((x) => x.id.replace(/-/g, '')).sort()) === JSON.stringify(b.relation.map((x) => x.id.replace(/-/g, '')).sort());
      return true; });
    if (same) return 'same';
    if (!DRY) { await notion('pages/' + cur.id, { properties: props }, 'PATCH'); await sleep(340); }
    writes++; return 'updated';
  }
  if (!DRY) { await notion('pages', { parent: { type: 'data_source_id', data_source_id: ds }, properties: props }); await sleep(340); }
  writes++; return 'created';
}

// ---------------- Shopify ----------------
let TOKEN = env('SHOPIFY_ADMIN_TOKEN');
async function shopifyToken() {
  if (TOKEN) return TOKEN;
  const creds = { grant_type: 'client_credentials', client_id: env('SHOPIFY_CLIENT_ID'), client_secret: env('SHOPIFY_CLIENT_SECRET') };
  const url = `https://${STORE}/admin/oauth/access_token`;
  // Shopify accepts the request as a form or as JSON; try the form first, then JSON.
  let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(creds) });
  let j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(creds) });
    j = await res.json().catch(() => ({}));
  }
  if (!res.ok || !j.access_token) {
    const why = [j.error, j.error_description, j.errors && JSON.stringify(j.errors)].filter(Boolean).join(': ') || 'no reason given';
    throw new Error(`Shopify login failed (${res.status}): ${why}. Check SHOPIFY_STORE, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (id length ${creds.client_id.length}, secret length ${creds.client_secret.length}).`);
  }
  TOKEN = j.access_token; return TOKEN;
}
async function gql(query, variables) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://${STORE}/admin/api/${API}/graphql.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await shopifyToken() },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    const j = await res.json();
    if (j.errors && j.errors.some((e) => e.extensions && e.extensions.code === 'THROTTLED')) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok || j.errors) throw new Error('Shopify: ' + res.status + ' ' + JSON.stringify(j.errors || '').slice(0, 300));
    return j.data;
  }
  throw new Error('Shopify: gave up after retries');
}

const ORDERS = `query($q: String!, $after: String) {
  orders(first: 8, after: $after, query: $q, sortKey: PROCESSED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id processedAt cancelledAt test sourceName presentmentCurrencyCode taxesIncluded
      retailLocation { name }
      shippingAddress { countryCodeV2 provinceCode city }
      refunds { refundLineItems(first: 30) { nodes { quantity lineItem { id } } } }
      lineItems(first: 40) { nodes {
        id title quantity
        product { id title }
        variant { id selectedOptions { name value } }
        originalUnitPriceSet { shopMoney { amount } presentmentMoney { amount } }
        totalDiscountSet { presentmentMoney { amount } }
        taxLines { title rate priceSet { presentmentMoney { amount } } }
      } }
    }
  }
}`;

const STOCK = `query($after: String) {
  products(first: 10, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { id title variants(first: 30) { nodes { id selectedOptions { name value }
      inventoryItem { inventoryLevels(first: 5) { nodes { location { name } quantities(names: ["available", "committed"]) { name quantity } } } } } } }
  }
}`;

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
function sizeOf(variant) {
  const o = ((variant && variant.selectedOptions) || []).find((x) => /size/i.test(x.name));
  if (!o) return '';
  const v = String(o.value).trim().toUpperCase().replace(/\s+/g, '');
  return ({ SMALL: 'S', MEDIUM: 'M', LARGE: 'L', XLARGE: 'XL', 'X-LARGE': 'XL', XXL: '2XL', '2X': '2XL', 'XX-LARGE': '2XL', XXXL: '3XL', '3X': '3XL', 'XXX-LARGE': '3XL', XSMALL: 'XS', 'X-SMALL': 'XS' })[v] || v;
}

// ---------------- Run ----------------
log(`Shopify → Notion ${DRY ? '(dry run) ' : ''}from ${FROM} to ${TODAY}`);

// Notion lookups
const products = await queryAll(DS.products);
const prodByShopify = new Map(); const prodByVariant = new Map(); const prodName = new Map();
for (const p of products) {
  const pid = idNum(plain(p.properties['Shopify Product ID'])); if (pid) prodByShopify.set(pid, p);
  String(plain(p.properties['Shopify Variant ID']) || '').split(/[,\s]+/).filter(Boolean).forEach((v) => prodByVariant.set(idNum(v), p));
  prodName.set(p.id, plain(p.properties['Name']));
}
const shows = await queryAll(DS.shows);
const showByDate = new Map();
for (const s of shows) { const d = plain(s.properties['Date']); const st = plain(s.properties['Status']); if (d && /^(Played|Confirmed)$/i.test(st)) showByDate.set(d.slice(0, 10), s.id); }
const byKey = (pages) => { const m = new Map(); pages.forEach((p) => { const k = plain(p.properties['Sync Key']); if (k) m.set(k, p); }); return m; };
const since = { property: 'Date', date: { on_or_after: FETCH_FROM } };
const sales0 = byKey(await queryAll(DS.sales, since));
const sizes0 = byKey(await queryAll(DS.sizes, since));
const geo0 = byKey(await queryAll(DS.geo, { property: 'Month', date: { on_or_after: FROM.slice(0, 8) + '01' } }));
const snaps0 = byKey(await queryAll(DS.snapshots, { property: 'Date', date: { on_or_after: TODAY } }));

// Orders
const sales = new Map(), sizes = new Map(), geo = new Map();
let orders = 0, skippedLines = 0, after = null;
do {
  const d = await gql(ORDERS, { q: `processed_at:>=${FETCH_FROM} status:any`, after });
  for (const o of d.orders.nodes) {
    if (o.test || o.cancelledAt) continue;
    orders++;
    const when = new Date(o.processedAt);
    const pos = !!o.retailLocation || /pos/i.test(o.sourceName || '');
    const channel = pos ? 'Show POS' : /^web$/i.test(o.sourceName || '') ? 'Web' : 'Other';
    let day = ymdIn(when); if (pos && hourIn(when) < POS_LATE_HOURS) day = addDays(day, -1);
    const location = pos ? (o.retailLocation ? o.retailLocation.name : 'POS') : 'Online Store';
    const cur = o.presentmentCurrencyCode || 'CAD';
    const refunded = new Map();
    for (const rf of o.refunds || []) for (const n of rf.refundLineItems.nodes) refunded.set(n.lineItem.id, (refunded.get(n.lineItem.id) || 0) + n.quantity);
    let orderUnits = 0, orderCad = 0;
    for (const li of o.lineItems.nodes) {
      if (!li.product) { skippedLines++; continue; }
      const pid = idNum(li.product.id); const vid = li.variant ? idNum(li.variant.id) : '';
      const np = prodByShopify.get(pid) || prodByVariant.get(vid) || null;
      const ref = refunded.get(li.id) || 0; const kept = li.quantity - ref;
      const unitP = num(li.originalUnitPriceSet.presentmentMoney.amount), unitS = num(li.originalUnitPriceSet.shopMoney.amount);
      const tax = (li.taxLines || []).reduce((t, x) => t + num(x.priceSet.presentmentMoney.amount), 0);
      const taxNames = (li.taxLines || []).map((x) => `${x.title} ${r2(x.rate * 100)}%`);
      orderUnits += kept; orderCad += unitS * kept;
      if (day >= FROM) {
        const k = `shopify|${day}|${pid}|${channel}|${location}|${cur}`;
        const a = sales.get(k) || { day, pid, channel, location, cur, title: li.product.title, np, show: pos ? showByDate.get(day) : null, units: 0, refunded: 0, grossP: 0, grossS: 0, disc: 0, tax: 0, taxNames: new Set(), taxesIncluded: !!o.taxesIncluded };
        a.units += li.quantity; a.refunded += ref; a.grossP += unitP * kept; a.grossS += unitS * kept; a.disc += num(li.totalDiscountSet.presentmentMoney.amount); a.tax += tax; taxNames.forEach((t) => a.taxNames.add(t));
        sales.set(k, a);
        const size = sizeOf(li.variant);
        if (size) {
          const sk = `size|${day}|${pid}|${size}|${channel}|${location}`;
          const b = sizes.get(sk) || { day, pid, size, channel, location, np, title: li.product.title, show: pos ? showByDate.get(day) : null, units: 0, refunded: 0 };
          b.units += li.quantity; b.refunded += ref; sizes.set(sk, b);
        }
      }
    }
    if (channel === 'Web' && o.shippingAddress && orderUnits > 0) {
      const month = ymdIn(when).slice(0, 7);
      if (month >= FROM.slice(0, 7)) {
        const sa = o.shippingAddress; const gk = `geo|${month}|${sa.countryCodeV2 || ''}|${sa.provinceCode || ''}|${(sa.city || '').trim()}`;
        const g = geo.get(gk) || { month, country: sa.countryCodeV2 || '', region: sa.provinceCode || '', city: (sa.city || '').trim(), orders: 0, units: 0, cad: 0 };
        g.orders += 1; g.units += orderUnits; g.cad += orderCad; geo.set(gk, g);
      }
    }
  }
  after = d.orders.pageInfo.hasNextPage ? d.orders.pageInfo.endCursor : null;
} while (after);
log(`Orders read: ${orders} (${skippedLines} line items without a product skipped)`);

// Write sales
const tally = () => { const t = { created: 0, updated: 0, same: 0 }; return { t, add: (r) => { t[r]++; } }; };
let T = tally();
for (const [k, a] of sales) {
  const sold = a.units, kept = a.units - a.refunded;
  const props = {
    'Entry': P.title(`${a.day} | ${a.np ? prodName.get(a.np.id) : a.title} | ${a.channel}${a.cur !== 'CAD' ? ' | ' + a.cur : ''}`),
    'Date': P.date(a.day), 'Date Precision': P.select('Exact'), 'Channel': P.select(a.channel), 'Shopify Location': P.text(a.location),
    'Currency': P.select(['CAD', 'USD', 'EUR', 'GBP', 'DKK'].includes(a.cur) ? a.cur : 'Other'),
    'Units Sold': P.num(sold), 'Units Refunded': P.num(a.refunded),
    'Unit Price': P.num(kept > 0 ? a.grossP / kept : 0), 'Gross Revenue': P.num(a.grossP), 'Gross (Shop Currency)': P.num(a.grossS),
    'Discounts': P.num(a.disc), 'Tax': P.num(a.tax), 'Tax Detail': P.text(a.taxNames.size ? [...a.taxNames].join(' + ') : 'No tax charged'), 'Taxes Included': P.check(a.taxesIncluded),
    'Source': P.text('Shopify'), 'Sync Key': P.text(k),
    ...(a.np ? { 'Product': P.rel([a.np.id]) } : {}), ...(a.show ? { 'Show': P.rel([a.show]) } : {}),
  };
  T.add(await upsert(DS.sales, sales0, k, props, ['Units Sold', 'Units Refunded', 'Gross Revenue', 'Gross (Shop Currency)', 'Discounts', 'Tax', ...(a.np ? ['Product'] : []), ...(a.show ? ['Show'] : [])]));
}
log(`Sales: ${T.t.created} new, ${T.t.updated} updated, ${T.t.same} unchanged`);

T = tally();
for (const [k, b] of sizes) {
  const props = {
    'Entry': P.title(`${b.day} | ${b.np ? prodName.get(b.np.id) : b.title} | ${b.size} | ${b.channel}`),
    'Date': P.date(b.day), 'Size': P.text(b.size), 'Channel': P.select(b.channel), 'Shopify Location': P.text(b.location),
    'Units Sold': P.num(b.units), 'Units Refunded': P.num(b.refunded), 'Sync Key': P.text(k),
    ...(b.np ? { 'Product': P.rel([b.np.id]) } : {}), ...(b.show ? { 'Show': P.rel([b.show]) } : {}),
  };
  T.add(await upsert(DS.sizes, sizes0, k, props, ['Units Sold', 'Units Refunded', ...(b.np ? ['Product'] : []), ...(b.show ? ['Show'] : [])]));
}
log(`Sales by Size: ${T.t.created} new, ${T.t.updated} updated, ${T.t.same} unchanged`);

T = tally();
for (const [k, g] of geo) {
  const props = {
    'Entry': P.title(`${g.month} | ${g.country}${g.region ? ' ' + g.region : ''}${g.city ? ' | ' + g.city : ''}`),
    'Month': P.date(g.month + '-01'), 'Country': P.text(g.country), 'Region': P.text(g.region), 'City': P.text(g.city),
    'Orders': P.num(g.orders), 'Units': P.num(g.units), 'Gross (CAD)': P.num(g.cad), 'Sync Key': P.text(k),
  };
  T.add(await upsert(DS.geo, geo0, k, props, ['Orders', 'Units', 'Gross (CAD)']));
}
log(`Web Customer Regions: ${T.t.created} new, ${T.t.updated} updated, ${T.t.same} unchanged`);

// Stock
const stock = new Map(); after = null;
do {
  const d = await gql(STOCK, { after });
  for (const pr of d.products.nodes) {
    const s = { road: 0, web: 0, committed: 0, sizes: new Map() };
    for (const v of pr.variants.nodes) {
      const size = sizeOf(v);
      for (const lv of ((v.inventoryItem && v.inventoryItem.inventoryLevels.nodes) || [])) {
        const q = Object.fromEntries((lv.quantities || []).map((x) => [x.name, x.quantity]));
        const where = lv.location.name === ROAD_LOCATION ? 'road' : 'web';
        s[where] += q.available || 0; s.committed += q.committed || 0;
        if (size) { const z = s.sizes.get(size) || { road: 0, web: 0 }; z[where] += q.available || 0; s.sizes.set(size, z); }
      }
    }
    stock.set(idNum(pr.id), s);
  }
  after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
} while (after);

let pu = 0, snapT = tally();
for (const p of products) {
  const pid = idNum(plain(p.properties['Shopify Product ID'])); const s = pid && stock.get(pid); if (!s) continue;
  const order = [...s.sizes.keys()].sort((a, b) => (SIZE_ORDER.indexOf(a) + 99) % 99 - (SIZE_ORDER.indexOf(b) + 99) % 99);
  const breakdown = order.length
    ? 'Road ' + order.map((z) => `${z}:${s.sizes.get(z).road}`).join(' ') + ' | Web ' + order.map((z) => `${z}:${s.sizes.get(z).web}`).join(' ')
    : `Road ${s.road} | Web ${s.web}`;
  const props = { 'Road On Hand': P.num(s.road), 'Web On Hand': P.num(s.web), 'Current On Hand': P.num(s.road + s.web), 'Size Breakdown': P.text(breakdown), 'Last Synced': P.date(TODAY) };
  if (!DRY) { await notion('pages/' + p.id, { properties: props }, 'PATCH'); await sleep(340); }
  pu++; writes++;
  const name = prodName.get(p.id); const sk = `${TODAY}|${name}`;
  snapT.add(await upsert(DS.snapshots, snaps0, sk, {
    'Entry': P.title(`${TODAY} | ${name}`), 'Date': P.date(TODAY), 'Product': P.rel([p.id]), 'On Hand': P.num(s.road + s.web),
    'Road On Hand': P.num(s.road), 'Web On Hand': P.num(s.web), 'Committed': P.num(s.committed), 'Source': P.select('Shopify sync'), 'Sync Key': P.text(sk),
  }, ['On Hand', 'Road On Hand', 'Web On Hand', 'Committed']));
}
log(`Products: stock updated on ${pu}. Inventory Snapshots: ${snapT.t.created} new, ${snapT.t.updated} updated, ${snapT.t.same} unchanged`);
const unmatched = [...stock.keys()].filter((pid) => !prodByShopify.has(pid)).length;
if (unmatched) log(`${unmatched} Shopify products aren't linked to a Notion product (no Shopify Product ID), so their stock isn't copied.`);
log(`Notion writes: ${writes}${DRY ? ' (dry run, nothing written)' : ''}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, '### Shopify → Notion\n\n' + summary.map((s) => '- ' + s).join('\n') + '\n');
}
