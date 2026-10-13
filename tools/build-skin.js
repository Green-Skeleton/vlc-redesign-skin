// Builds the VLC 3 (Skins2) theme in ./skin from the decoded Figma file.
//   1. node tools/figma/decode.js "VLC Redesign (Community).fig"
//   2. node tools/build-skin.js
//   3. node tools/package.js          -> dist/VLC-Redesign.vlt
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { renderToSvg } = require('./figma/render.js');

const ROOT = path.join(__dirname, '..');
const SKIN = path.join(ROOT, 'skin');
const IMG = path.join(SKIN, 'images');
const FONTS = path.join(SKIN, 'fonts');
const INTER = path.dirname(require.resolve('@expo-google-fonts/inter/package.json'));

fs.rmSync(SKIN, { recursive: true, force: true });
fs.mkdirSync(IMG, { recursive: true });
fs.mkdirSync(FONTS, { recursive: true });
fs.copyFileSync(path.join(INTER, 'Inter_400Regular.ttf'), path.join(FONTS, 'Inter-Regular.ttf'));
fs.copyFileSync(path.join(INTER, 'Inter_500Medium.ttf'), path.join(FONTS, 'Inter-Medium.ttf'));
fs.copyFileSync(path.join(__dirname, 'assets', 'Inter-OFL.txt'), path.join(FONTS, 'OFL.txt'));

// ---------------------------------------------------------------------------
// Design tokens (Figma colour styles, "Dark" theme)
// ---------------------------------------------------------------------------
const C = {
  topbar: '#191919', // Dark/BG/A4
  frame: '#1b1b1b', // Dark/BG/A3
  stage: '#222120',
  rail: '#191919',
  panel: '#0e0e0e', // Dark/BG/B1
  popup: '#141414',
  divider: '#222222', // Dark/Divider/Dim
  dividerBright: '#373737',
  hover: '#262626',
  track: '#000000',
  fill: '#371f06', // Dark/BG/Accent Bright
  accent: '#d37918', // Dark/Accent/Main
  accentBright: '#fc9729', // Dark/Accent/Bright
  accentDim: '#ab6314', // Dark/Accent/DIm
  fg1: '#eaeaea',
  fg2: '#c6c6c6',
  fgA1: '#969696',
  fgA2: '#8f8f8f',
  fgA3: '#6b6b6b',
  fgB1: '#161616',
};

// Figma component ids (page "Icon" etc.)
const I = {
  vlc: '48:57', more: '247:418', sidebar: '69:814', sidebarActive: '87:1041', folder: '51:808',
  minimize: '48:46', maximize: '48:51', fullscreen: '48:54', fullscreenActive: '6031:13553', close: '45:40',
  pip: '2139:8439', previous: '45:18', next: '45:12', play: '44:419', pause: '44:427', stop: '187:322',
  volHigh: '182:179', volMute: '182:198', audio: '44:407', audioActive: '496:2439', subtitles: '42:398',
  settings: '2493:9293', playbackSettings: '2230:9222', lists: '217:191', listsActive: '467:492',
  home: '87:1026', video: '71:857', music: '71:851', streaming: '70:833', disc: '5884:24330', playlist: '42:357',
  add: '463:550', remove: '463:560', sort: '463:564', save: '2459:9542', open: '330:267', file: '2107:6307',
  chevronDown: '71:868', chevronRight: '71:875', shuffle: '187:474', repeat: '187:470', record: '2115:7482',
  snapshot: '2115:7492', expand: '6586:17393',
  volume0: '244:185', volume200: '244:183',
};

// ---------------------------------------------------------------------------
// Bitmap helpers
// ---------------------------------------------------------------------------
const bitmaps = [];
const fontOpts = {
  fontFiles: [path.join(INTER, 'Inter_400Regular.ttf'), path.join(INTER, 'Inter_500Medium.ttf')],
  loadSystemFonts: false,
  defaultFontFamily: 'Inter',
};

function png(id, w, h, body) {
  if (bitmaps.some(b => b.id === id)) return id;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  const file = `images/${id}.png`;
  fs.writeFileSync(path.join(SKIN, file), new Resvg(svg, { font: fontOpts }).render().asPng());
  bitmaps.push({ id, file });
  return id;
}

// A Figma icon component as a nested <svg>, recoloured to a single colour.
function icon(symId, color, x = 0, y = 0, size = 24, opacity = 1) {
  let svg = renderToSvg(symId);
  if (color) svg = svg.replace(/fill="rgb\([^)]*\)"/g, `fill="${color}"`);
  const m = svg.match(/^<svg [^>]*viewBox="([^"]+)"[^>]*>/);
  return svg.replace(m[0], `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${m[1]}" opacity="${opacity}">`);
}
// A Figma component rendered as-is.
function component(symId, x = 0, y = 0) {
  const svg = renderToSvg(symId);
  return svg.replace(/^<svg xmlns="[^"]+"/, `<svg x="${x}" y="${y}"`);
}

const rect = (x, y, w, h, fill, r = 0, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const text = (x, y, str, { size = 13, fill = C.fgA1, weight = 400, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-family="Inter" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${str}</text>`;

const solid = (id, color) => png(id, 4, 4, rect(0, 0, 4, 4, color));
const transparent = (id, w, h) => png(id, w, h, '');

// Three-state icon button: up / over / down.
// Skins2 on Windows draws semi-transparent pixels darkened, so every bitmap is
// rendered opaque on top of the surface colour it sits on (`on`).
function iconButton(id, sym, { w = 30, h = 28, size = 24, color = C.fgA1, hover = C.fg1, down = C.accent, on = C.topbar, r = 6, label = null } = {}) {
  const ix = label ? 6 : (w - size) / 2, iy = (h - size) / 2;
  const lbl = c => (label ? text(ix + size + 6, h / 2 + 4.5, label, { fill: c, size: 13 }) : '');
  const base = rect(0, 0, w, h, on);
  png(`${id}.up`, w, h, base + icon(sym, color, ix, iy, size) + lbl(color));
  png(`${id}.over`, w, h, base + rect(0, 0, w, h, C.hover, r) + icon(sym, hover, ix, iy, size) + lbl(hover));
  png(`${id}.down`, w, h, base + rect(0, 0, w, h, C.hover, r) + icon(sym, down, ix, iy, size) + lbl(down));
  return { up: `${id}.up`, over: `${id}.over`, down: `${id}.down`, w, h };
}

// Rounded-corner masks: opaque `outer` colour outside the arc, `inner` inside.
function corners(id, r, inner, outer) {
  const out = {};
  for (const [k, cx, cy] of [['tl', r, r], ['tr', 0, r], ['bl', r, 0], ['br', 0, 0]]) {
    out[k] = png(`${id}.${k}`, r, r, rect(0, 0, r, r, outer) + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${inner}"/>`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function el(tag, attrs = {}, children = null) {
  const a = Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  if (!children || !children.length) return `<${tag}${a}/>`;
  return `<${tag}${a}>\n${[].concat(children).flat(Infinity).filter(Boolean).map(c => '  ' + c.replace(/\n/g, '\n  ')).join('\n')}\n</${tag}>`;
}
// h: l(eft) r(ight) s(tretch); v: t(op) b(ottom) s(tretch)
function anchor(h, v) {
  return {
    lefttop: (h === 'r' ? 'right' : 'left') + (v === 'b' ? 'bottom' : 'top'),
    rightbottom: (h === 'l' ? 'left' : 'right') + (v === 't' ? 'top' : 'bottom'),
  };
}
let uid = 0;
const nextId = p => `${p}${++uid}`;
const Img = (image, x, y, opts = {}) => {
  const { a = 'lt', w, h, ...rest } = opts;
  return el('Image', { id: nextId('img'), x, y, width: w, height: h, image, ...anchor(a[0], a[1]), ...rest });
};
const Fill = (image, x, y, w, h, a, extra = {}) => Img(image, x, y, { w, h, a, resize: 'scale', ...extra });
const Btn = (b, x, y, action, tip, a = 'lt', extra = {}) =>
  el('Button', { id: nextId('btn'), x, y, up: b.up, over: b.over, down: b.down, action, tooltiptext: tip, ...anchor(a[0], a[1]), ...extra });
const Check = (b1, b2, x, y, state, action1, action2, tip1, tip2, a = 'lt', extra = {}) =>
  el('Checkbox', {
    id: nextId('chk'), x, y, state, up1: b1.up, over1: b1.over, down1: b1.down, up2: b2.up, over2: b2.over, down2: b2.down,
    action1, action2, tooltiptext1: tip1, tooltiptext2: tip2, ...anchor(a[0], a[1]), ...extra,
  });
const Txt = (txt, x, y, w, font, color, a = 'lt', extra = {}) =>
  el('Text', { id: nextId('txt'), x, y, width: w, text: txt, font, color, scrolling: 'none', ...anchor(a[0], a[1]), ...extra });

// ---------------------------------------------------------------------------
// Bitmaps
// ---------------------------------------------------------------------------
solid('c.topbar', C.topbar);
solid('c.frame', C.frame);
solid('c.stage', C.stage);
solid('c.rail', C.rail);
solid('c.panel', C.panel);
solid('c.popup', C.popup);
solid('c.divider', C.divider);
solid('c.dividerBright', C.dividerBright);
solid('c.track', C.track);
solid('c.black', '#000000');
transparent('none', 2, 28);

const stageCorners = corners('stage', 9, C.stage, C.frame);
png('stage.logo', 96, 96, rect(0, 0, 96, 96, C.stage) + icon(I.vlc, null, 0, 0, 96, 0.18));
png('stage.art', 320, 320, rect(0, 0, 320, 320, C.stage) + icon(I.vlc, null, 112, 112, 96, 0.18));

// top bar
const B = {};
B.logo = iconButton('top.logo', I.vlc, { w: 38, h: 28, color: null, hover: null, down: null });
B.more = iconButton('top.more', I.more);
B.sidebar = iconButton('top.sidebar', I.sidebar);
B.sidebarOn = iconButton('top.sidebarOn', I.sidebar, { color: C.accent, hover: C.accentBright });
B.open = iconButton('top.open', I.folder, { w: 82, label: 'Open' });
B.pip = iconButton('top.pip', I.pip, { w: 36, h: 24, size: 20 });
B.min = iconButton('top.min', I.minimize, { w: 36, h: 24, size: 20 });
B.max = iconButton('top.max', I.maximize, { w: 36, h: 24, size: 20 });
B.fs = iconButton('top.fs', I.fullscreen, { w: 36, h: 24, size: 20 });
B.close = iconButton('top.close', I.close, { w: 36, h: 24, size: 20, down: C.fg1 });
png('top.divider', 1, 16, rect(0, 0, 1, 16, C.dividerBright));

// transport
B.prev = iconButton('ctl.prev', I.previous);
B.next = iconButton('ctl.next', I.next);
for (const [k, sym] of [['play', I.play], ['pause', I.pause]]) {
  png(`ctl.${k}.up`, 54, 28, rect(0, 0, 54, 28, C.topbar) + rect(0, 0, 54, 28, C.accent, 6) + icon(sym, C.fgB1, 15, 2));
  png(`ctl.${k}.over`, 54, 28, rect(0, 0, 54, 28, C.topbar) + rect(0, 0, 54, 28, C.accentBright, 6) + icon(sym, C.fgB1, 15, 2));
  png(`ctl.${k}.down`, 54, 28, rect(0, 0, 54, 28, C.topbar) + rect(0, 0, 54, 28, C.accentDim, 6) + icon(sym, C.fgB1, 15, 2));
  B[k] = { up: `ctl.${k}.up`, over: `ctl.${k}.over`, down: `ctl.${k}.down` };
}
B.mute0 = iconButton('ctl.vol', I.volHigh, { w: 28, h: 28 });
B.mute1 = iconButton('ctl.mute', I.volMute, { w: 28, h: 28, color: C.accent, hover: C.accentBright });
B.eq = iconButton('ctl.eq', I.audio, { h: 32 });
B.eqOn = iconButton('ctl.eqOn', I.audio, { h: 32, color: C.accent, hover: C.accentBright });
B.subs = iconButton('ctl.subs', I.subtitles, { h: 32 });
B.psettings = iconButton('ctl.psettings', I.playbackSettings, { h: 32 });
B.settings = iconButton('ctl.settings', I.settings, { h: 32 });
B.queue = iconButton('ctl.queue', I.lists, { h: 32 });
B.queueOn = iconButton('ctl.queueOn', I.lists, { h: 32, color: C.accent, hover: C.accentBright });
B.fsExit = iconButton('ctl.fsExit', I.fullscreenActive, { h: 32 });
B.stop = iconButton('ctl.stop', I.stop);

// seek bar: rounded black track + 101-frame progress fill (Figma "Frame 21")
const SEEK_FRAMES = 101;
function seekBitmaps(id, w, h, r, fillInset) {
  png(`${id}.l`, r, h, rect(0, 0, r, h, C.topbar) + rect(0, 0, r * 2, h, C.track, r));
  png(`${id}.r`, r, h, rect(0, 0, r, h, C.topbar) + rect(-r, 0, r * 2, h, C.track, r));
  const fw = w; // width of the curve area
  let frames = '';
  for (let i = 0; i < SEEK_FRAMES; i++) {
    const x = Math.round((i / (SEEK_FRAMES - 1)) * (fw - 1));
    if (x > 0) frames += rect(0, i * h + fillInset, x + 1, h - fillInset * 2, C.fill, 4);
  }
  png(`${id}.fill`, fw, h * SEEK_FRAMES, frames);
}
png('seek.cursor', 8, 24, rect(0, 0, 8, 24, C.fill) + rect(0, 0, 8, 24, C.accent, 4));
png('seek.cursor.over', 8, 24, rect(0, 0, 8, 24, C.fill) + rect(0, 0, 8, 24, C.accentBright, 4));
png('miniseek.cursor', 6, 10, rect(0, 0, 6, 10, C.fill) + rect(0, 0, 6, 10, C.accent, 3));
png('miniseek.cursor.over', 6, 10, rect(0, 0, 6, 10, C.fill) + rect(0, 0, 6, 10, C.accentBright, 3));

// volume wedge (Figma "volume" component, 0%..200%)
const VOL_FRAMES = 51;
{
  let frames = '';
  for (let i = 0; i < VOL_FRAMES; i++) {
    const w = (i / (VOL_FRAMES - 1)) * 88;
    frames += `<g transform="translate(0 ${i * 28})">${rect(0, 0, 88, 28, C.topbar)}${component(I.volume0)}<defs><clipPath id="vc${i}"><rect width="${w}" height="28"/></clipPath></defs><g clip-path="url(#vc${i})">${component(I.volume200)}</g></g>`;
  }
  png('volume.frames', 88, 28 * VOL_FRAMES, frames);
}

// sidebar
B.rail = {};
for (const [k, sym, active] of [['home', I.home, true], ['video', I.video], ['music', I.music], ['network', I.streaming], ['disc', I.disc], ['playlists', I.playlist], ['settings', I.settings]]) {
 B.rail[k] = iconButton(`rail.${k}`, sym, { w: 36, h: 36, on: C.rail, color: active ? C.accent : C.fgA1, hover: active ? C.accentBright : C.fg1 });
}
B.pl = {};
B.q = {};
for (const [k, sym] of [['add', I.add], ['remove', I.remove], ['sort', I.sort], ['save', I.save], ['load', I.open], ['shuffle', I.shuffle], ['repeat', I.repeat]]) {
  B.pl[k] = iconButton(`pl.${k}`, sym, { on: C.panel });
  B.q[k] = iconButton(`q.${k}`, sym, { on: C.popup });
}
B.pl.shuffleOn = iconButton('pl.shuffleOn', I.shuffle, { on: C.panel, color: C.accent, hover: C.accentBright });
B.pl.repeatOn = iconButton('pl.repeatOn', I.repeat, { on: C.panel, color: C.accent, hover: C.accentBright });
B.q.shuffleOn = iconButton('q.shuffleOn', I.shuffle, { on: C.popup, color: C.accent, hover: C.accentBright });
B.q.repeatOn = iconButton('q.repeatOn', I.repeat, { on: C.popup, color: C.accent, hover: C.accentBright });
B.popClose = iconButton('pop.close', I.close, { on: '#000000' });
B.miniClose = iconButton('mini.close', I.close);
for (const [t, bg] of [['tree', C.panel], ['qtree', C.popup]]) {
  // rows mimic the design's grey thumbnail placeholders
  png(`${t}.item`, 16, 16, rect(0, 0, 16, 16, bg) + rect(1, 2, 14, 12, '#2b2b2b', 2));
  png(`${t}.open`, 16, 16, rect(0, 0, 16, 16, bg) + icon(I.chevronDown, C.fgA2, 0, 0, 16));
  png(`${t}.closed`, 16, 16, rect(0, 0, 16, 16, bg) + icon(I.chevronRight, C.fgA2, 0, 0, 16));
}
png('scroll.thumb', 4, 48, rect(0, 0, 4, 48, C.panel) + rect(0, 0, 4, 48, C.dividerBright, 2));
png('scroll.thumb.over', 4, 48, rect(0, 0, 4, 48, C.panel) + rect(0, 0, 4, 48, C.fgA3, 2));

// mini player
B.expand = iconButton('mini.expand', I.maximize);
B.miniPrev = B.prev;
B.miniNext = B.next;

// equalizer
png('eq.track', 6, 180, rect(0, 0, 6, 180, C.popup) + rect(0, 0, 6, 180, C.fill, 3));
png('eq.handle', 24, 8, rect(0, 0, 24, 8, C.fill) + rect(0, 0, 24, 8, C.accentDim, 4));
png('eq.handle.over', 24, 8, rect(0, 0, 24, 8, C.fill) + rect(0, 0, 24, 8, C.accent, 4));
// Toggle (Figma "Toggle", Value=on/off), redrawn with explicit state colours.
png('eq.on', 68, 32, rect(0, 0, 68, 32, '#000000') + rect(0, 0, 68, 32, C.fill, 8) + rect(39, 3, 26, 26, C.accent, 6) + text(19, 21, 'ON', { size: 12, fill: C.accentBright, weight: 500, anchor: 'middle' }));
png('eq.off', 68, 32, rect(0, 0, 68, 32, '#000000') + rect(0, 0, 68, 32, '#1f1f1f', 8) + rect(3, 3, 26, 26, C.fgA3, 6) + text(48, 21, 'OFF', { size: 12, fill: C.fgA2, weight: 500, anchor: 'middle' }));
const EQ_LABELS = ['Preamp', '60 Hz', '170 Hz', '310 Hz', '600 Hz', '1 KHz', '3 KHz', '6 KHz', '12 KHz', '14 KHz', '16 KHz'];
const EQ_W = 480, EQ_H = 340, EQ_COL0 = 38, EQ_DX = 40.4;
png('eq.bg', EQ_W, EQ_H,
  rect(0, 0, EQ_W, EQ_H, C.popup) + rect(0, 0, EQ_W, 48, '#000000') +
  text(EQ_W / 2, 29, 'Equalizer', { size: 14, fill: C.fg2, anchor: 'middle' }) +
  EQ_LABELS.map((l, i) => text(Math.round(EQ_COL0 + i * EQ_DX), 300, l, { size: 11, fill: i === 0 ? C.fg1 : C.fgA2, anchor: 'middle' })).join('') );

// queue popup header
png('queue.header', 400, 48, rect(0, 0, 400, 48, '#000000') + text(200, 29, 'Queue', { size: 14, fill: C.fg2, anchor: 'middle' }));
png('panel.title', 160, 24, rect(0, 0, 160, 24, C.panel) + text(0, 18, 'Playlist', { size: 16, fill: C.fg2, weight: 500 }));
png('resize.grip', 12, 12, rect(0, 0, 12, 12, C.topbar) + [0, 1, 2].map(i => rect(10 - i * 4, 10, 2, 2, C.fgA3) + (i ? rect(10, 10 - i * 4, 2, 2, C.fgA3) : '')).join(''));
png('resize.grip.popup', 12, 12, rect(0, 0, 12, 12, C.popup) + [0, 1, 2].map(i => rect(10 - i * 4, 10, 2, 2, C.fgA3) + (i ? rect(10, 10 - i * 4, 2, 2, C.fgA3) : '')).join(''));

// ---------------------------------------------------------------------------
// Layout builders
// ---------------------------------------------------------------------------
const W = 1280, H = 720, TOP = 40, CTRL = 54;

function topBar(w, { sidebarOn = false, win = 'main' } = {}) {
  const sb = sidebarOn
    ? Btn(B.sidebarOn, 77, 6, `${win}.setLayout(normal)`, 'Hide sidebar')
    : Btn(B.sidebar, 77, 6, `${win}.setLayout(sidebar)`, 'Show sidebar');
  return [
    Fill('c.topbar', 0, 0, w, TOP, 'st', { action: 'move', action2: `${win}.maximize()`, visible: `not ${win}.isMaximized()` }),
    Fill('c.topbar', 0, 0, w, TOP, 'st', { action: 'move', action2: `${win}.unmaximize()`, visible: `${win}.isMaximized()` }),
    Btn(B.logo, 6, 6, 'dialogs.popup()', 'VLC menu'),
    Btn(B.more, 45, 6, 'dialogs.miscPopup()', 'More'),
    sb,
    Img('top.divider', 113, 12),
    Btn(B.open, 121, 6, 'dialogs.file()', 'Open media'),
    Txt('$N', 300, 12, w - 600, 'regular14', C.fgA2, 'st', { alignment: 'center', scrolling: 'none', visible: 'not vlc.isStopped' }),
    Txt('VLC Media Player', 300, 12, w - 600, 'regular14', C.fgA2, 'st', { alignment: 'center', visible: 'vlc.isStopped' }),
    Btn(B.pip, w - 186, 8, `${win}.setLayout(mini)`, 'Mini player', 'rt'),
    Btn(B.min, w - 150, 8, 'vlc.minimize()', 'Minimize', 'rt'),
    Btn(B.max, w - 114, 8, `${win}.maximize()`, 'Maximize', 'rt', { visible: `not ${win}.isMaximized()` }),
    Btn(B.max, w - 114, 8, `${win}.unmaximize()`, 'Restore', 'rt', { visible: `${win}.isMaximized()` }),
    Btn(B.fs, w - 78, 8, 'vlc.fullscreen()', 'Fullscreen', 'rt'),
    Btn(B.close, w - 42, 8, 'vlc.quit()', 'Quit', 'rt'),
  ];
}

// Video area: rounded "stage" inside a 10px frame (Figma "Frame 312").
function stage(x, y, w, h) {
  const r = 9;
  const art = Math.min(320, h - 40); // album art / audio-only placeholder
  return [
    Fill('c.stage', x, y, w, h, 'ss'),
    Img(stageCorners.tl, x, y, { a: 'lt' }),
    Img(stageCorners.tr, x + w - r, y, { a: 'rt' }),
    Img(stageCorners.bl, x, y + h - r, { a: 'lb' }),
    Img(stageCorners.br, x + w - r, y + h - r, { a: 'rb' }),
    Img('stage.art', Math.round(x + w / 2 - art / 2), Math.round(y + h / 2 - art / 2), { a: 'lt', w: art, h: art, art: 'true', resize: 'scale', xkeepratio: 'true', ykeepratio: 'true', rightbottom: 'lefttop', visible: 'not vlc.isStopped' }),
    Img('stage.logo', Math.round(x + w / 2 - 48), Math.round(y + h / 2 - 48), { a: 'lt', xkeepratio: 'true', ykeepratio: 'true', rightbottom: 'lefttop', visible: 'vlc.isStopped' }),
    el('Video', { id: nextId('video'), x, y, width: w, height: h, autoresize: 'false', ...anchor('s', 's'), visible: 'vlc.hasVout' }),
  ];
}

// Seek track with three-part background and progress fill slider.
// Sliders get no width/height: skins2 scales the cursor by (control size / curve
// size), so the control must be exactly the curve's bounding box.
function seekBar(id, x, y, w, h, a, { r = 6, inset = 2, cursor = 'seek.cursor', cursorW = 8 } = {}) {
  const curveW = w - cursorW;
  seekBitmaps(id, curveW, h, r, inset);
  return [
    Img(`${id}.l`, x, y, { a: a[0] === 'r' ? 'r' + a[1] : 'l' + a[1] }),
    Fill('c.track', x + r, y, w - 2 * r, h, a),
    Img(`${id}.r`, x + w - r, y, { a: (a[0] === 'l' ? 'l' : 'r') + a[1] }),
    el('Slider', {
      id: nextId('seek'), x: x + cursorW / 2, y, points: `(0,${h / 2}),(${curveW - 1},${h / 2})`,
      thickness: h / 2, value: 'time', up: cursor, over: `${cursor}.over`, down: `${cursor}.over`,
      tooltiptext: '$T / $D', ...anchor(a[0], a[1]),
    }, [el('SliderBackground', { id: nextId('seekbg'), image: `${id}.fill`, nbvert: SEEK_FRAMES })]),
  ];
}

function volume(x, y, a) {
  return [
    Check(B.mute0, B.mute1, x, y, 'vlc.isMute', 'vlc.mute()', 'vlc.mute()', 'Mute', 'Unmute', a),
    el('Slider', {
      id: nextId('vol'), x: x + 32, y, points: '(0,14),(87,14)', thickness: 14, value: 'volume',
      up: 'none', tooltiptext: 'Volume: $V%', ...anchor(a[0], a[1]),
    }, [el('SliderBackground', { id: nextId('volbg'), image: 'volume.frames', nbvert: VOL_FRAMES })]),
  ];
}

// Bottom control bar (Figma "Controls / Property 1=default").
function controls(w, y, { fsc = false } = {}) {
  const lb = 'lb', rb = 'rb', sb = 'sb';
  const v = fsc ? 'lt' : lb, vr = fsc ? 'rt' : rb, vs = fsc ? 'st' : sb;
  const right = fsc
    ? [
      Btn(B.subs, w - 142, y + 11, 'dialogs.videoPopup()', 'Video & subtitles', vr),
      Btn(B.psettings, w - 100, y + 11, 'dialogs.audioPopup()', 'Audio', vr),
      Btn(B.fsExit, w - 50, y + 11, 'vlc.fullscreen()', 'Exit fullscreen', vr),
    ]
    : [
      Check(B.eq, B.eqOn, w - 184, y + 11, 'eqwin.isVisible', 'eqwin.show()', 'eqwin.hide()', 'Equalizer', 'Hide equalizer', vr),
      Btn(B.subs, w - 142, y + 11, 'dialogs.videoPopup()', 'Video & subtitles', vr),
      Btn(B.settings, w - 100, y + 11, 'dialogs.prefs()', 'Preferences', vr),
      Check(B.queue, B.queueOn, w - 50, y + 11, 'plwin.isVisible', 'plwin.show()', 'plwin.hide()', 'Show queue', 'Hide queue', vr),
    ];
  return [
    Fill('c.topbar', 0, y, w, CTRL, vs, { action: 'move' }),
    Fill('c.divider', 0, y, w, 1, vs),
    Btn(B.prev, 20, y + 13, 'playlist.previous()', 'Previous', v),
    Check(B.play, B.pause, 58, y + 13, 'vlc.isPlaying', 'vlc.play()', 'vlc.pause()', 'Play', 'Pause', v),
    Btn(B.next, 120, y + 13, 'playlist.next()', 'Next', v),
    Txt('$T', 170, y + 20, 76, 'medium13', C.fgA1, v, { alignment: 'center', visible: 'not vlc.isStopped' }),
    Txt('--:--', 170, y + 20, 76, 'medium13', C.fgA3, v, { alignment: 'center', visible: 'vlc.isStopped' }),
    seekBar(fsc ? 'fseek' : 'seek', 254, y + 13, w - 254 - 428, 28, vs),
    Txt('$D', w - 420, y + 20, 76, 'medium13', C.fgA1, vr, { alignment: 'center', visible: 'not vlc.isStopped' }),
    Txt('--:--', w - 420, y + 20, 76, 'medium13', C.fgA3, vr, { alignment: 'center', visible: 'vlc.isStopped' }),
    volume(w - 324, y + 13, vr),
    right,
  ];
}

function resizeEdges(w, h, win = 'main') {
  return [
    Fill('c.topbar', 0, h - 3, w - 12, 3, 'sb', { action: 'resizeS' }),
    Fill('c.frame', w - 4, TOP, 4, h - TOP - CTRL, 'rs', { action: 'resizeE' }),
    Img('resize.grip', w - 12, h - 12, { a: 'rb', action: 'resizeSE' }),
  ];
}

function sidebar(h) {
  const SW = 427;
  const railBtns = [['home', 'dialogs.playlist()', 'Media library'], ['video', 'dialogs.file()', 'Open file'], ['music', 'dialogs.directory()', 'Open folder'],
    ['network', 'dialogs.net()', 'Open network stream'], ['disc', 'dialogs.disc()', 'Open disc'], ['playlists', 'playlist.load()', 'Load playlist']];
  return [
    Fill('c.rail', 0, TOP, 48, h - TOP - CTRL, 'ls', { action: 'move' }),
    railBtns.map(([k, act, tip], i) => Btn(B.rail[k], 6, TOP + 12 + i * 44, act, tip)),
    Btn(B.rail.settings, 6, h - CTRL - 48, 'dialogs.prefs()', 'Preferences', 'lb'),
    Fill('c.panel', 48, TOP, SW - 48, h - TOP - CTRL, 'ls'),
    Img('panel.title', 72, TOP + 14),
    Btn(B.pl.add, SW - 88, TOP + 12, 'playlist.add()', 'Add media'),
    Btn(B.pl.save, SW - 54, TOP + 12, 'playlist.save()', 'Save playlist'),
    Txt('$N', 72, TOP + 58, 190, 'regular12', C.fgA3, 'lt', { scrolling: 'auto' }),
    Check(B.pl.shuffle, B.pl.shuffleOn, SW - 156, TOP + 50, 'playtree.isRandom', 'playlist.setRandom(true)', 'playlist.setRandom(false)', 'Shuffle', 'Shuffle off'),
    Check(B.pl.repeat, B.pl.repeatOn, SW - 122, TOP + 50, 'playtree.isLoop', 'playlist.setLoop(true)', 'playlist.setLoop(false)', 'Repeat all', 'Repeat off'),
    Btn(B.pl.sort, SW - 88, TOP + 50, 'playtree.sort()', 'Sort'),
    Btn(B.pl.remove, SW - 54, TOP + 50, 'playtree.del()', 'Remove selected'),
    Fill('c.divider', 64, TOP + 88, SW - 64 - 16, 1, 'lt'),
    el('Playtree', {
      id: 'sidebar.tree', x: 60, y: TOP + 96, width: SW - 60 - 22, height: h - TOP - CTRL - 96 - 8, font: 'regular13',
      fgcolor: C.fgA1, playcolor: C.accent, selcolor: C.divider, bgcolor1: C.panel, bgcolor2: C.panel,
      itemimage: 'tree.item', openimage: 'tree.open', closedimage: 'tree.closed', flat: 'false', ...anchor('l', 's'),
    }, [el('Slider', {
      id: 'sidebar.tree.scroll', x: SW - 14, y: TOP + 96, points: `(2,${h - TOP - CTRL - 96 - 8 - 24}),(2,24)`, thickness: 4,
      up: 'scroll.thumb', over: 'scroll.thumb.over', down: 'scroll.thumb.over', ...anchor('l', 's'),
    })]),
  ];
}

function mainLayout(id, withSidebar) {
  const x0 = withSidebar ? 437 : 10;
  return el('Layout', { id, width: W, height: H, minwidth: withSidebar ? 980 : 720, maxwidth: 99999, minheight: 400, maxheight: 99999 }, [
    Fill('c.frame', 0, TOP, W, H - TOP - CTRL, 'ss', { action: 'move' }),
    stage(x0, TOP, W - x0 - 10, H - TOP - CTRL),
    withSidebar ? sidebar(H) : null,
    topBar(W, { sidebarOn: withSidebar }),
    controls(W, H - CTRL),
    resizeEdges(W, H),
  ]);
}

function miniLayout() {
  const MW = 392, MH = 330;
  return el('Layout', { id: 'mini', width: MW, height: MH, minwidth: MW, maxwidth: MW, minheight: MH, maxheight: MH }, [
    Fill('c.topbar', 0, 0, MW, MH, 'lt', { action: 'move', action2: 'main.setLayout(normal)' }),
    stage(10, 10, MW - 20, 210),
    seekBar('mseek', 10, 228, MW - 20, 10, 'lt', { r: 5, inset: 0, cursor: 'miniseek.cursor', cursorW: 6 }),
    Txt('$N', 14, 252, MW - 28, 'regular14', C.fgA2, 'lt', { scrolling: 'auto', visible: 'not vlc.isStopped' }),
    Txt('Nothing playing', 14, 252, MW - 28, 'regular14', C.fgA3, 'lt', { visible: 'vlc.isStopped' }),
    Btn(B.prev, 10, 286, 'playlist.previous()', 'Previous'),
    Check(B.play, B.pause, 44, 286, 'vlc.isPlaying', 'vlc.play()', 'vlc.pause()', 'Play', 'Pause'),
    Btn(B.next, 102, 286, 'playlist.next()', 'Next'),
    Txt('$T / $D', 140, 293, 120, 'medium12', C.fgA3, 'lt', { visible: 'not vlc.isStopped' }),
    Check(B.queue, B.queueOn, MW - 108, 284, 'plwin.isVisible', 'plwin.show()', 'plwin.hide()', 'Show queue', 'Hide queue'),
    Btn(B.expand, MW - 74, 286, 'main.setLayout(normal)', 'Back to full player'),
    Btn(B.miniClose, MW - 40, 286, 'vlc.quit()', 'Quit'),
  ]);
}

function queueWindow() {
  const QW = 400, QH = 520;
  return el('Window', { id: 'plwin', visible: 'false', position: 'East', xoffset: '-40', yoffset: '40' }, [
    el('Layout', { id: 'plwin.normal', width: QW, height: QH, minwidth: 300, maxwidth: 99999, minheight: 260, maxheight: 99999 }, [
      Fill('c.popup', 0, 0, QW, QH, 'ss', { action: 'move' }),
      Fill('c.black', 0, 0, QW, 48, 'st', { action: 'move' }),
      Img('queue.header', 0, 0, { a: 'lt', action: 'move', xkeepratio: 'true', rightbottom: 'lefttop' }),
      Btn(B.popClose, QW - 42, 10, 'plwin.hide()', 'Close', 'rt'),
      Btn(B.q.add, 12, 58, 'playlist.add()', 'Add media'),
      Btn(B.q.load, 46, 58, 'playlist.load()', 'Load playlist'),
      Btn(B.q.save, 80, 58, 'playlist.save()', 'Save playlist'),
      Check(B.q.shuffle, B.q.shuffleOn, QW - 148, 58, 'playlist.isRandom', 'playlist.setRandom(true)', 'playlist.setRandom(false)', 'Shuffle', 'Shuffle off', 'rt'),
      Check(B.q.repeat, B.q.repeatOn, QW - 114, 58, 'playlist.isLoop', 'playlist.setLoop(true)', 'playlist.setLoop(false)', 'Repeat all', 'Repeat off', 'rt'),
      Btn(B.q.sort, QW - 80, 58, 'playlist.sort()', 'Sort', 'rt'),
      Btn(B.q.remove, QW - 46, 58, 'playlist.del()', 'Remove selected', 'rt'),
      Fill('c.divider', 12, 94, QW - 24, 1, 'st'),
      el('Playtree', {
        id: 'queue.tree', x: 12, y: 102, width: QW - 36, height: QH - 102 - 16, font: 'regular13',
        fgcolor: C.fgA1, playcolor: C.accent, selcolor: C.divider, bgcolor1: C.popup, bgcolor2: C.popup,
        itemimage: 'qtree.item', openimage: 'qtree.open', closedimage: 'qtree.closed', flat: 'true', ...anchor('s', 's'),
      }, [el('Slider', {
        id: 'queue.tree.scroll', x: QW - 18, y: 102, points: `(2,${QH - 102 - 16 - 24}),(2,24)`, thickness: 4,
        up: 'scroll.thumb', over: 'scroll.thumb.over', down: 'scroll.thumb.over', ...anchor('r', 's'),
      })]),
      Img('resize.grip.popup', QW - 12, QH - 12, { a: 'rb', action: 'resizeSE' }),
    ]),
  ]);
}

function eqWindow() {
  const sliders = ['equalizer.preamp', ...Array.from({ length: 10 }, (_, i) => `equalizer.band(${i})`)];
  return el('Window', { id: 'eqwin', visible: 'false', position: 'Center' }, [
    el('Layout', { id: 'eqwin.normal', width: EQ_W, height: EQ_H, minwidth: EQ_W, maxwidth: EQ_W, minheight: EQ_H, maxheight: EQ_H }, [
      Img('eq.bg', 0, 0, { action: 'move' }),
      Check({ up: 'eq.off', over: 'eq.off', down: 'eq.on' }, { up: 'eq.on', over: 'eq.on', down: 'eq.off' }, 14, 8,
        'equalizer.isEnabled', 'equalizer.enable()', 'equalizer.disable()', 'Enable equalizer', 'Disable equalizer'),
      Btn(B.popClose, EQ_W - 42, 10, 'eqwin.hide()', 'Close'),
      sliders.map((v, i) => {
        const cx = Math.round(EQ_COL0 + i * EQ_DX);
        return [
          Img('eq.track', cx - 3, 92),
          el('Slider', {
            id: nextId('eq'), x: cx - 12, y: 88, points: '(12,184),(12,4)', thickness: 12, value: v,
            up: 'eq.handle', over: 'eq.handle.over', down: 'eq.handle.over', tooltiptext: EQ_LABELS[i],
          }),
        ];
      }),
    ]),
  ]);
}

function fscWindow() {
  const FW = 1000;
  return el('Window', { id: 'fullscreenController', position: 'South', ymargin: '24' }, [
    el('Layout', { id: 'fsc.normal', width: FW, height: CTRL, minwidth: FW, maxwidth: FW, minheight: CTRL, maxheight: CTRL }, [
      controls(FW, 0, { fsc: true }),
      Fill('c.dividerBright', 0, CTRL - 1, FW, 1, 'lt'),
      Fill('c.dividerBright', 0, 0, 1, CTRL, 'lt'),
      Fill('c.dividerBright', FW - 1, 0, 1, CTRL, 'lt'),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// theme.xml
// ---------------------------------------------------------------------------
const windows = [
  el('Window', { id: 'main', position: 'Center' }, [mainLayout('sidebar', true), miniLayout(), mainLayout('normal', false)] /* last layout = initial */),
  queueWindow(),
  eqWindow(),
  fscWindow(),
];

const xml = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<!DOCTYPE Theme PUBLIC "-//VideoLAN//DTD VLC Skins V2.0//EN" "skin.dtd">',
  '<!-- Generated by tools/build-skin.js from the "VLC Redesign" Figma Community file by Juxtopposed (CC BY 4.0). Do not edit by hand. -->',
  el('Theme', { version: '2.0', magnet: '12', alpha: '255', movealpha: '235' }, [
    el('ThemeInfo', { name: 'VLC Redesign', author: 'Design: Juxtopposed - Skin: VLC Redesign skin contributors', webpage: 'https://www.figma.com/community' }),
    el('Font', { id: 'regular12', file: 'fonts/Inter-Regular.ttf', size: 12 }),
    el('Font', { id: 'regular13', file: 'fonts/Inter-Regular.ttf', size: 13 }),
    el('Font', { id: 'regular14', file: 'fonts/Inter-Regular.ttf', size: 14 }),
    el('Font', { id: 'medium12', file: 'fonts/Inter-Medium.ttf', size: 12 }),
    el('Font', { id: 'medium13', file: 'fonts/Inter-Medium.ttf', size: 13 }),
    bitmaps.map(b => el('Bitmap', { id: b.id, file: b.file, alphacolor: '#FF00FF' })),
    windows,
  ]),
].join('\n');

fs.writeFileSync(path.join(SKIN, 'theme.xml'), xml + '\n');
console.log(`skin/theme.xml written (${bitmaps.length} bitmaps)`);
