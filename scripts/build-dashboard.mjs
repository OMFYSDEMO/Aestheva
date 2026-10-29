// Builds dashboard/index.html: a single self-contained file with the booking data embedded.
//
//   node scripts/build-dashboard.mjs [data.json]       (default: dashboard/sample-data.json)
//   node scripts/build-dashboard.mjs --fragment out.html   also writes the page without the
//                                                         document wrapper (for hosts that add their own)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fi = args.indexOf('--fragment');
const fragmentOut = fi >= 0 ? args.splice(fi, 2)[1] : null;
const dataPath = path.resolve(args[0] || path.join(root, 'dashboard/sample-data.json'));

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
for (const k of ['meta', 'providers', 'services', 'categories', 'areas', 'bookings', 'queue', 'cities'])
  if (!(k in data)) throw new Error(`${dataPath}: missing "${k}"`);

const template = fs.readFileSync(path.join(root, 'dashboard/template.html'), 'utf8');
if (!template.includes('/*__DATA__*/null')) throw new Error('template.html: data placeholder not found');
// Escape "</" so embedded strings can never close the script element.
const json = JSON.stringify(data).replace(/<\//g, '<\\/');
const page = template.replace('/*__DATA__*/null', () => json);

const doc = '<!doctype html>\n<html lang="en-IN">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + page + '</html>\n';
fs.writeFileSync(path.join(root, 'dashboard/index.html'), doc);
if (fragmentOut) fs.writeFileSync(path.resolve(fragmentOut), page);
console.log(`dashboard/index.html written (${(doc.length / 1024).toFixed(0)} KB, ${data.bookings.rows.length} bookings)`);
