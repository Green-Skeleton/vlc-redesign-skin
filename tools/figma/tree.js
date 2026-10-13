const fs = require('fs');
const msg = JSON.parse(fs.readFileSync(process.env.FIG_DOC || require("path").join(__dirname, "..", "..", "build", "figma", "doc.json")));
const maxDepth = +(process.argv[2] || 3);
const rootFilter = process.argv[3];
const id = g => g ? `${g.sessionID}:${g.localID}` : null;
const nodes = new Map();
const kids = new Map();
for (const n of msg.nodeChanges) {
  nodes.set(id(n.guid), n);
  const p = n.parentIndex && id(n.parentIndex.guid);
  if (p) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(n); }
}
for (const arr of kids.values()) arr.sort((a, b) => (a.parentIndex.position < b.parentIndex.position ? -1 : 1));
function walk(n, d) {
  const s = n.size ? ` ${Math.round(n.size.x)}x${Math.round(n.size.y)}` : '';
  const t = n.transform ? ` @${Math.round(n.transform.m02)},${Math.round(n.transform.m12)}` : '';
  const txt = n.textData ? ` "${n.textData.characters.slice(0, 40).replace(/\n/g, ' ')}"` : '';
  console.log('  '.repeat(d) + `${n.type} [${id(n.guid)}] ${n.name}${s}${t}${txt}`);
  if (d < maxDepth) for (const c of kids.get(id(n.guid)) || []) walk(c, d + 1);
}
const root = rootFilter ? nodes.get(rootFilter) : msg.nodeChanges.find(n => n.type === 'DOCUMENT');
walk(root, 0);
