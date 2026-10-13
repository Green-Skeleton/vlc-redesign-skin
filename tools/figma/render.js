// Minimal Figma (.fig kiwi JSON) -> SVG -> PNG renderer.
// usage: node render.js <nodeId> <out.png|out.svg> [scale]
// Reads build/figma/doc.json (produced by decode.js); override with FIG_DOC / FIG_IMAGES.
const fs = require('fs');
const path = require('path');

const BUILD = path.join(__dirname, '..', '..', 'build', 'figma');
const docPath = process.env.FIG_DOC || path.join(BUILD, 'doc.json');
const msg = JSON.parse(fs.readFileSync(docPath));
const IMG_DIR = process.env.FIG_IMAGES || path.join(path.dirname(docPath), 'images');

const gid = g => (g ? `${g.sessionID}:${g.localID}` : null);
const nodes = new Map();
const kids = new Map();
for (const n of msg.nodeChanges) {
  nodes.set(gid(n.guid), n);
  const p = n.parentIndex && gid(n.parentIndex.guid);
  if (p) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(n); }
}
for (const arr of kids.values()) arr.sort((a, b) => (a.parentIndex.position < b.parentIndex.position ? -1 : a.parentIndex.position > b.parentIndex.position ? 1 : 0));
const byOverrideKey = new Map();
for (const n of msg.nodeChanges) if (n.overrideKey) byOverrideKey.set(gid(n.overrideKey), n);

const blobCache = new Map();
function blobPath(i) {
  if (blobCache.has(i)) return blobCache.get(i);
  const b = Buffer.from(msg.blobs[i].bytes, 'base64');
  let o = 0, d = '';
  const f = () => { const v = b.readFloatLE(o); o += 4; return +v.toFixed(3); };
  while (o < b.length) {
    const c = b[o++];
    if (c === 0) { if (d) d += 'Z'; }
    else if (c === 1) d += `M${f()} ${f()}`;
    else if (c === 2) d += `L${f()} ${f()}`;
    else if (c === 3) d += `Q${f()} ${f()} ${f()} ${f()}`;
    else if (c === 4) d += `C${f()} ${f()} ${f()} ${f()} ${f()} ${f()}`;
    else break;
  }
  blobCache.set(i, d);
  return d;
}

let defs = [];
let uid = 0;
const nid = p => `${p}${uid++}`;
const rgba = (c, op = 1) => {
  const a = (c.a ?? 1) * op;
  return { col: `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`, a };
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function invert(t) {
  const { m00: a, m01: b, m02: c, m10: d, m11: e, m12: f } = t;
  const det = a * e - b * d;
  return { m00: e / det, m01: -b / det, m02: (b * f - c * e) / det, m10: -d / det, m11: a / det, m12: (c * d - a * f) / det };
}

function imageFile(hash) {
  const hex = Buffer.from(hash, 'base64').toString('hex');
  const p = path.join(IMG_DIR, hex);
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  const mime = buf[0] === 0x89 ? 'image/png' : 'image/jpeg';
  return { href: `data:${mime};base64,${buf.toString('base64')}`, buf };
}
function imageSize(buf) {
  if (buf[0] === 0x89) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let o = 2;
  while (o < buf.length) {
    const m = buf[o + 1], len = buf.readUInt16BE(o + 2);
    if (m >= 0xc0 && m <= 0xc2) return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
    o += 2 + len;
  }
  return { w: 1, h: 1 };
}

// returns {fill, opacity} attribute strings for a paint
function paintAttr(p, size) {
  if (p.visible === false) return null;
  const op = p.opacity ?? 1;
  if (p.type === 'SOLID') {
    const { col, a } = rgba(p.color, op);
    return `fill="${col}" fill-opacity="${a.toFixed(4)}"`;
  }
  if (p.type && p.type.startsWith('GRADIENT')) {
    const id = nid('g');
    const T = invert(p.transform);
    const gt = `matrix(${size.x * T.m00} ${size.y * T.m10} ${size.x * T.m01} ${size.y * T.m11} ${size.x * T.m02} ${size.y * T.m12})`;
    const stops = (p.stops || []).map(s => { const { col, a } = rgba(s.color); return `<stop offset="${s.position}" stop-color="${col}" stop-opacity="${a}"/>`; }).join('');
    if (p.type === 'GRADIENT_LINEAR') defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0.5" x2="1" y2="0.5" gradientTransform="${gt}">${stops}</linearGradient>`);
    else defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0.5" cy="0.5" r="0.5" gradientTransform="${gt}">${stops}</radialGradient>`);
    return `fill="url(#${id})" fill-opacity="${op}"`;
  }
  if (p.type === 'IMAGE' && p.image && p.image.hash) {
    const img = imageFile(p.image.hash);
    if (!img) return null;
    const id = nid('p');
    const { w, h } = imageSize(img.buf);
    let inner;
    const mode = p.imageScaleMode || 'FILL';
    if (mode === 'STRETCH' && p.transform) {
      const T = invert(p.transform);
      inner = `<image href="${img.href}" width="1" height="1" preserveAspectRatio="none" transform="matrix(${size.x * T.m00} ${size.y * T.m10} ${size.x * T.m01} ${size.y * T.m11} ${size.x * T.m02} ${size.y * T.m12})"/>`;
    } else {
      const par = mode === 'FIT' ? 'xMidYMid meet' : 'xMidYMid slice';
      inner = `<image href="${img.href}" width="${size.x}" height="${size.y}" preserveAspectRatio="${par}"/>`;
    }
    defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${size.x}" height="${size.y}">${inner}</pattern>`);
    void w; void h;
    return `fill="url(#${id})" fill-opacity="${op}"`;
  }
  return null;
}

function geomPaths(geom, paints, size) {
  if (!geom || !paints) return '';
  let out = '';
  for (const p of paints) {
    const attr = paintAttr(p, size);
    if (!attr) continue;
    const bm = p.blendMode && p.blendMode !== 'NORMAL' && p.blendMode !== 'PASS_THROUGH' ? ` style="mix-blend-mode:${p.blendMode.toLowerCase().replace('_', '-')}"` : '';
    for (const g of geom) {
      out += `<path d="${blobPath(g.commandsBlob)}" fill-rule="${g.windingRule === 'ODD' ? 'evenodd' : 'nonzero'}" ${attr}${bm}/>`;
    }
  }
  return out;
}

function rectPath(n) {
  const w = n.size.x, h = n.size.y;
  const tl = n.rectangleTopLeftCornerRadius ?? n.cornerRadius ?? 0;
  const tr = n.rectangleTopRightCornerRadius ?? n.cornerRadius ?? 0;
  const br = n.rectangleBottomRightCornerRadius ?? n.cornerRadius ?? 0;
  const bl = n.rectangleBottomLeftCornerRadius ?? n.cornerRadius ?? 0;
  const r = v => Math.min(v, w / 2, h / 2);
  return `M${r(tl)} 0H${w - r(tr)}A${r(tr)} ${r(tr)} 0 0 1 ${w} ${r(tr)}V${h - r(br)}A${r(br)} ${r(br)} 0 0 1 ${w - r(br)} ${h}H${r(bl)}A${r(bl)} ${r(bl)} 0 0 1 0 ${h - r(bl)}V${r(tl)}A${r(tl)} ${r(tl)} 0 0 1 ${r(tl)} 0Z`;
}

function textSvg(n) {
  const d = n.derivedTextData;
  if (!d || !d.glyphs) return '';
  let paths = '';
  for (const g of d.glyphs) {
    if (g.commandsBlob === undefined) continue;
    const s = g.fontSize;
    paths += `<path transform="matrix(${s} 0 0 ${-s} ${g.position.x} ${g.position.y})" d="${blobPath(g.commandsBlob)}"/>`;
  }
  let out = '';
  for (const p of n.fillPaints || []) {
    const attr = paintAttr(p, n.size);
    if (attr) out += `<g ${attr}>${paths}</g>`;
  }
  // decorations
  if (d.decorations) for (const dec of d.decorations) for (const r of dec.rects || []) {
    const attr = (n.fillPaints || []).map(p => paintAttr(p, n.size)).find(Boolean);
    if (attr) out += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${attr}/>`;
  }
  return out;
}

function effectsFilter(effects) {
  if (!effects || !effects.length) return '';
  const vis = effects.filter(e => e.visible !== false);
  if (!vis.length) return '';
  const id = nid('f');
  let prims = '', merge = [];
  vis.forEach((e, i) => {
    if (e.type === 'DROP_SHADOW') {
      const { col, a } = rgba(e.color);
      prims += `<feGaussianBlur in="SourceAlpha" stdDeviation="${(e.radius || 0) / 2}" result="b${i}"/><feOffset in="b${i}" dx="${e.offset?.x || 0}" dy="${e.offset?.y || 0}" result="o${i}"/><feFlood flood-color="${col}" flood-opacity="${a}"/><feComposite in2="o${i}" operator="in" result="s${i}"/>`;
      merge.push(`s${i}`);
    }
  });
  const blur = vis.find(e => e.type === 'LAYER_BLUR');
  let src = 'SourceGraphic';
  if (blur) { prims += `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur.radius / 2}" result="lb"/>`; src = 'lb'; }
  if (!merge.length && !blur) return '';
  merge.push(src);
  defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">${prims}<feMerge>${merge.map(m => `<feMergeNode in="${m}"/>`).join('')}</feMerge></filter>`);
  return ` filter="url(#${id})"`;
}

// ---- instance override resolution ----
const keyOf = n => gid(n.overrideKey) || gid(n.guid);
function scopeFor(inst, base, propAssign) {
  const ov = new Map(), dv = new Map();
  for (const o of inst.symbolData?.symbolOverrides || []) ov.set(o.guidPath.guids.map(gid).join('/'), o);
  for (const o of inst.derivedSymbolData || []) dv.set(o.guidPath.guids.map(gid).join('/'), o);
  return { base, ov, dv, props: propAssign };
}
function resolve(n, fullPath, scopes) {
  let r = n;
  // innermost first, outermost overrides last (outer wins)
  let derived = null;
  for (let i = scopes.length - 1; i >= 0; i--) {
    const s = scopes[i];
    if (fullPath.length <= s.base.length) continue;
    const rel = fullPath.slice(s.base.length).join('/');
    const o = s.ov.get(rel);
    if (o) { const { guidPath, ...rest } = o; r = { ...r, ...rest }; }
    const d = s.dv.get(rel);
    if (d) derived = d;
  }
  if (derived) { const { guidPath, ...rest } = derived; r = { ...r, ...rest }; }
  // component props
  if (n.componentPropRefs) {
    for (const ref of n.componentPropRefs) {
      for (let i = scopes.length - 1; i >= 0; i--) {
        const a = scopes[i].props.get(gid(ref.defID));
        if (!a) continue;
        if (ref.componentPropNodeField === 'VISIBLE' && a.boolValue !== undefined) r = { ...r, visible: a.boolValue };
        if (ref.componentPropNodeField === 'OVERRIDDEN_SYMBOL_ID' && a.guidValue) r = { ...r, overriddenSymbolID: a.guidValue };
        if (ref.componentPropNodeField === 'TEXT_DATA' && a.textValue) r = { ...r, textData: a.textValue };
      }
    }
  }
  return r;
}

function renderNode(n0, path, scopes) {
  const n = resolve(n0, path, scopes);
  if (n.visible === false) return '';
  if (['BRUSH', 'VARIABLE', 'VARIABLE_SET'].includes(n.type)) return '';
  const t = n.transform;
  const tf = t ? ` transform="matrix(${t.m00} ${t.m10} ${t.m01} ${t.m11} ${t.m02} ${t.m12})"` : '';
  const op = n.opacity !== undefined && n.opacity < 1 ? ` opacity="${n.opacity}"` : '';
  const flt = effectsFilter(n.effects);
  const size = n.size || { x: 0, y: 0 };
  let body = '';

  if (n.type === 'TEXT') {
    body = textSvg(n);
  } else {
    let geom = n.fillGeometry;
    if ((!geom || !geom.length) && ['FRAME', 'ROUNDED_RECTANGLE', 'RECTANGLE', 'SYMBOL', 'INSTANCE'].includes(n.type) && n.fillPaints?.length) {
      body += (n.fillPaints || []).map(p => { const a = paintAttr(p, size); return a ? `<path d="${rectPath(n)}" ${a}/>` : ''; }).join('');
    } else body += geomPaths(geom, n.fillPaints, size);
    if (n.type !== 'BOOLEAN_OPERATION' || true) body += geomPaths(n.strokeGeometry, n.strokePaints, size);
  }

  // children
  let children = [];
  let childScopes = scopes;
  let childBasePath = path;
  if (n.type === 'INSTANCE') {
    const symId = gid(n.overriddenSymbolID) || gid(n.symbolData?.symbolID);
    const sym = nodes.get(symId);
    const props = new Map();
    for (const a of n.componentPropAssignments || []) props.set(gid(a.defID), a.value);
    childScopes = [...scopes, scopeFor(n, path, props)];
    children = sym ? kids.get(gid(sym.guid)) || [] : [];
  } else if (n.type !== 'BOOLEAN_OPERATION') {
    children = kids.get(gid(n0.guid)) || [];
  }
  let inner = '';
  let maskOpen = 0;
  for (const c of children) {
    const cp = [...childBasePath, keyOf(c)];
    if (c.mask) {
      const mid = nid('m');
      const rc = renderNode({ ...c, mask: false, effects: [] }, cp, childScopes);
      defs.push(`<mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">${rc}</mask>`);
      inner += `<g mask="url(#${mid})">`;
      maskOpen++;
      continue;
    }
    inner += renderNode(c, cp, childScopes);
  }
  inner += '</g>'.repeat(maskOpen);
  if (inner && ['FRAME', 'INSTANCE', 'SYMBOL'].includes(n.type) && !n.frameMaskDisabled) {
    const cid = nid('c');
    defs.push(`<clipPath id="${cid}"><path d="${rectPath(n)}"/></clipPath>`);
    inner = `<g clip-path="url(#${cid})">${inner}</g>`;
  }
  return `<g${tf}${op}${flt}>${body}${inner}</g>`;
}

function renderToSvg(id) {
  const n = nodes.get(id);
  defs = [];
  const inner = renderNode({ ...n, transform: undefined }, [], []);
  const w = n.size.x, h = n.size.y;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs>${inner}</svg>`;
}

// ---- flat outlines (for icon fonts): every visible filled/stroked shape as an
// absolute path in the root node's coordinate space ----
const mul = (a, b) => ({
  m00: a.m00 * b.m00 + a.m01 * b.m10, m01: a.m00 * b.m01 + a.m01 * b.m11, m02: a.m00 * b.m02 + a.m01 * b.m12 + a.m02,
  m10: a.m10 * b.m00 + a.m11 * b.m10, m11: a.m10 * b.m01 + a.m11 * b.m11, m12: a.m10 * b.m02 + a.m11 * b.m12 + a.m12,
});
const IDENT = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
function transformPath(d, m) {
  return d.replace(/([MLQCZ])([^MLQCZ]*)/g, (_, cmd, args) => {
    const n = args.trim() ? args.trim().split(/\s+/).map(Number) : [];
    const out = [];
    for (let i = 0; i < n.length; i += 2) {
      out.push(+(m.m00 * n[i] + m.m01 * n[i + 1] + m.m02).toFixed(3), +(m.m10 * n[i] + m.m11 * n[i + 1] + m.m12).toFixed(3));
    }
    return cmd + out.join(' ');
  });
}
const visiblePaint = paints => (paints || []).some(p => p.visible !== false && (p.opacity ?? 1) > 0 && (!p.color || p.color.a > 0));
function collectOutlines(id) {
  const out = [];
  function walk(n0, path, scopes, parentM) {
    const n = resolve(n0, path, scopes);
    if (n.visible === false || n.mask || ['BRUSH', 'VARIABLE', 'VARIABLE_SET', 'TEXT'].includes(n.type)) return;
    if (n.opacity === 0) return;
    const m = n.transform ? mul(parentM, n.transform) : parentM;
    const add = (geom, paints) => {
      if (!geom || !visiblePaint(paints)) return;
      for (const g of geom) out.push({ d: transformPath(blobPath(g.commandsBlob), m), evenodd: g.windingRule === 'ODD' });
    };
    if (n.type !== 'FRAME' && n.type !== 'SYMBOL' && n.type !== 'INSTANCE') add(n.fillGeometry, n.fillPaints);
    add(n.strokeGeometry, n.strokePaints);
    let children = [], childScopes = scopes;
    if (n.type === 'INSTANCE') {
      const sym = nodes.get(gid(n.overriddenSymbolID) || gid(n.symbolData?.symbolID));
      const props = new Map();
      for (const a of n.componentPropAssignments || []) props.set(gid(a.defID), a.value);
      childScopes = [...scopes, scopeFor(n, path, props)];
      children = sym ? kids.get(gid(sym.guid)) || [] : [];
    } else if (n.type !== 'BOOLEAN_OPERATION') children = kids.get(gid(n0.guid)) || [];
    for (const c of children) walk(c, [...path, keyOf(c)], childScopes, m);
  }
  walk({ ...nodes.get(id), transform: undefined }, [], [], IDENT);
  return out;
}

module.exports = { renderToSvg, collectOutlines, nodes, kids, gid };

if (require.main === module) {
  const { Resvg } = require('@resvg/resvg-js');
  const id = process.argv[2], out = process.argv[3], scale = +(process.argv[4] || 1);
  const svg = renderToSvg(id);
  if (out.endsWith('.svg')) fs.writeFileSync(out, svg);
  else {
    const r = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale } });
    fs.writeFileSync(out, r.render().asPng());
  }
  console.log('wrote', out);
}
