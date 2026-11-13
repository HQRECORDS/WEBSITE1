// Pulls the John Muirhead merch databases from Notion and writes one JSON
// snapshot per dataset into jmmerch-dashboard/data/. Run by the
// "JM merch data" GitHub Action. Needs NOTION_TOKEN (a Notion internal
// integration secret with read access to the Merch Inventory System page).
//
// The rows are written in the same flat shape Notion's Claude connector
// returns, so the dashboard's own loaders in page.html read them unchanged.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) { console.error('NOTION_TOKEN is not set'); process.exit(1); }

const NOTION_VERSION = '2025-09-03';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'jmmerch-dashboard', 'data');

// Dataset id -> Notion data source id (from the project's notion-database-ids doc).
const SOURCES = {
  products: '8ec23f71-bc38-4d2f-bf86-9c6d8c59d82f',
  shows: 'dc2e8f85-1601-4bd2-b565-3f25342f8a71',
  sales: '0bd0f322-6216-4085-ba3f-3ae4709bb4d1',
  size_sales: 'b11d6c7d-538f-434d-9ebf-0e47bed22097',
  web_geo: '0784bc31-8a45-4252-9ce5-042b720caf2c',
  supplier_docs: '41722585-e88c-81f7-9d0e-000b167686b2',
  issues: '0900854b-360d-4f6e-bce7-2359bd9fb5a4',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function notion(path, body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch('https://api.notion.com/v1/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * (attempt + 1) * 2); continue; }
    const json = await res.json();
    if (!res.ok) throw new Error(`${path}: ${res.status} ${json.message || ''}`);
    return json;
  }
  throw new Error(path + ': gave up after retries');
}

const pageUrl = (id) => 'https://app.notion.com/p/' + String(id).replace(/-/g, '');
const text = (arr) => (arr || []).map((t) => t.plain_text).join('');

// Relations over 25 items come back truncated; fetch the full list.
async function fullRelation(pageId, prop) {
  const ids = []; let cursor;
  do {
    const q = cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : '';
    const r = await notion(`pages/${pageId}/properties/${prop.id}${q}`);
    (r.results || []).forEach((x) => x.relation && ids.push(x.relation.id));
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return ids;
}

async function flatten(page, dsId) {
  const row = {};
  for (const [name, p] of Object.entries(page.properties)) {
    const key = /^(id|url)$/i.test(name) ? 'userDefined:' + name : name;
    switch (p.type) {
      case 'title': row[key] = text(p.title); break;
      case 'rich_text': row[key] = text(p.rich_text); break;
      case 'number': if (p.number !== null) row[key] = p.number; break;
      case 'select': if (p.select) row[key] = p.select.name; break;
      case 'status': if (p.status) row[key] = p.status.name; break;
      case 'multi_select': row[key] = JSON.stringify(p.multi_select.map((o) => o.name)); break;
      case 'checkbox': row[key] = p.checkbox ? '__YES__' : '__NO__'; break;
      case 'date':
        if (p.date) {
          row[`date:${name}:start`] = p.date.start;
          if (p.date.end) row[`date:${name}:end`] = p.date.end;
          row[`date:${name}:is_datetime`] = /T/.test(p.date.start) ? 1 : 0;
        }
        break;
      case 'relation': {
        const ids = p.has_more ? await fullRelation(page.id, p) : p.relation.map((r) => r.id);
        if (ids.length) row[key] = JSON.stringify(ids.map(pageUrl));
        break;
      }
      case 'unique_id': if (p.unique_id && p.unique_id.number != null) row[key] = (p.unique_id.prefix ? p.unique_id.prefix + '-' : '') + p.unique_id.number; break;
      // The dashboard was built against Notion's Claude connector, which does not
      // compute formulas or rollups in view mode; its loaders treat these as empty.
      // Keep the same placeholders so the numbers match the claude.ai version.
      case 'formula': row[key] = `formulaResult://${dsId}/${page.id}/${p.id}`; break;
      case 'rollup': row[key] = `rollupResult://${dsId}/${page.id}/${p.id}`; break;
      case 'url': case 'email': case 'phone_number': if (p[p.type]) row[key] = p[p.type]; break;
      case 'created_time': case 'last_edited_time': row[key] = p[p.type]; break;
      default: break; // people, files, buttons etc. are not used by the dashboard
    }
  }
  row.url = pageUrl(page.id);
  return row;
}

async function pull(id, dsId) {
  const results = []; let cursor;
  do {
    const r = await notion(`data_sources/${dsId}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    for (const page of r.results) if (page.object === 'page' && !page.in_trash && !page.archived) results.push(await flatten(page, dsId));
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return { results, has_more: false };
}

await mkdir(OUT, { recursive: true });
let failed = 0;
for (const [id, dsId] of Object.entries(SOURCES)) {
  try {
    const answer = await pull(id, dsId);
    await writeFile(join(OUT, id + '.json'), JSON.stringify(answer) + '\n');
    console.log(`${id}: ${answer.results.length} rows`);
  } catch (e) {
    failed++;
    console.error(`${id}: ${e.message}`); // keep the previous snapshot for this dataset
  }
}
if (failed) process.exit(1);
