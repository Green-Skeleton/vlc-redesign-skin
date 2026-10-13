// Replaces the SVGs behind VLC 4's icon font (modules/gui/qt/pixmaps/icons) with
// the matching icons from the Figma design. Each icon is rendered at 1024 px and
// traced back to a single clean outline, which is what fontforge (used by
// makeIconFont.py) needs.
//
//   node tools/vlc4-icons.js <path-to-vlc-checkout>
//   then, in the checkout: cd modules/gui/qt/pixmaps && python3 makeIconFont.py VLCIcons.json
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const potrace = require('potrace');
const { renderToSvg } = require('./figma/render.js');

// VLCIcons.json key -> Figma icon component id (page "Icon")
const MAP = {
  play: '44:419', play_filled: '44:419', pause_filled: '44:427',
  next: '45:12', previous: '45:18', stop: '187:322',
  skip_for: '45:22', skip_back: '45:28',
  volume_high: '182:179', volume_medium: '182:187', volume_low: '182:193', volume_zero: '182:193', volume_muted: '182:198',
  fullscreen: '48:54', defullscreen: '6031:13553',
  window_minimize: '48:46', window_maximize: '48:51', window_close: '45:40',
  home: '70:828', settings: '2493:9293', effect_filter: '2230:9222',
  topbar_video: '71:857', topbar_music: '71:851', topbar_network: '70:833', topbar_discover: '477:1096', tv: '477:1096',
  history: '2154:9699', playlist: '42:357', list: '2107:6531', grid: '2107:6523', search: '856:2147',
  topbar_sort: '463:564', shuffle: '187:474', repeat_all: '187:470',
  add: '463:550', remove: '463:560', more: '247:418', ellipsis: '247:418', info: '2139:8985', close: '45:40',
  back: '71:890', chevron_down: '71:868', chevron_up: '71:872',
  ic_fluent_chevron_down_24: '71:868', ic_fluent_chevron_up_24: '71:872',
  ic_fluent_chevron_right_24: '71:875', ic_fluent_chevron_left_24: '71:878',
  panel_left: '69:814', record: '2115:7482', snapshot: '2115:7492', bookmark: '2127:7779', check: '494:2400',
  audiosub: '42:398', visualization: '2139:8078', profile_new: '2437:14784', faster: '2115:7386',
  enqueue: '2127:7523',
};

const SIZE = 1024;

function trace(svg) {
  // render black-on-white for potrace
  const black = svg.replace(/fill="rgb\([^)]*\)"/g, 'fill="#000"').replace(/fill="url\([^)]*\)"/g, 'fill="#000"');
  const png = new Resvg(black, { fitTo: { mode: 'width', value: SIZE }, background: '#ffffff' }).render().asPng();
  return new Promise((resolve, reject) =>
    potrace.trace(png, { threshold: 128, turdSize: 8, optTolerance: 0.2 }, (err, out) => (err ? reject(err) : resolve(out))));
}

async function main() {
  const vlc = process.argv[2];
  if (!vlc) throw new Error('usage: node tools/vlc4-icons.js <vlc-checkout>');
  const pix = path.join(vlc, 'modules', 'gui', 'qt', 'pixmaps');
  const index = JSON.parse(fs.readFileSync(path.join(pix, 'VLCIcons.json'), 'utf8'));
  const preview = [];
  let n = 0;
  for (const g of index.glyphs) {
    const sym = MAP[g.key];
    if (!sym) continue;
    const traced = await trace(renderToSvg(sym));
    const m = traced.match(/ d="([^"]+)"/);
    if (!m) { console.warn(`skipped ${g.key} (${sym}): rendered empty`); continue; }
    const d = m[1];
    const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">\n<path d="${d}" fill="#000000" fill-rule="evenodd"/>\n</svg>\n`;
    fs.writeFileSync(path.join(pix, g.path), out);
    preview.push({ key: g.key, d });
    n++;
  }
  // contact sheet for review
  const cols = 10, cell = 64;
  const rows = Math.ceil(preview.length / cols);
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}"><rect width="100%" height="100%" fill="#191919"/>${preview
    .map((p, i) => `<g transform="translate(${(i % cols) * cell + 12} ${Math.floor(i / cols) * cell + 6}) scale(${40 / SIZE})"><path d="${p.d}" fill="#969696" fill-rule="evenodd"/></g>`)
    .join('')}</svg>`;
  fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'vlc4-icons.png'), new Resvg(sheet).render().asPng());
  console.log(`replaced ${n} icon SVGs; preview in build/vlc4-icons.png`);
}
main().catch(e => { console.error(e); process.exit(1); });
