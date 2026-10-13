// Decode a Figma .fig file (zip containing canvas.fig "fig-kiwi" + images/)
// into build/figma/doc.json and build/figma/images/.
// usage: node tools/figma/decode.js "path/to/VLC Redesign (Community).fig"
const fs = require('fs');
const path = require('path');
const kiwi = require('kiwi-schema');
const pako = require('pako');
const fzstd = require('fzstd');
const { unzipSync } = require('fflate');

const input = process.argv[2];
if (!input) {
  console.error('usage: node tools/figma/decode.js <file.fig>');
  process.exit(1);
}
const OUT = path.join(__dirname, '..', '..', 'build', 'figma');
fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });

let canvas = fs.readFileSync(input);
if (canvas[0] === 0x50 && canvas[1] === 0x4b) {
  const files = unzipSync(new Uint8Array(canvas));
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith('images/') && data.length) fs.writeFileSync(path.join(OUT, 'images', path.basename(name)), data);
  }
  canvas = Buffer.from(files['canvas.fig']);
}

if (canvas.toString('latin1', 0, 8) !== 'fig-kiwi') throw new Error('not a fig-kiwi file');
let off = 8;
const version = canvas.readUInt32LE(off); off += 4;
const chunks = [];
while (off < canvas.length) {
  const len = canvas.readUInt32LE(off); off += 4;
  chunks.push(canvas.subarray(off, off + len)); off += len;
}
const inflate = c => (c[0] === 0x28 && c[1] === 0xb5 && c[2] === 0x2f && c[3] === 0xfd ? fzstd.decompress(c) : pako.inflateRaw(c));
const schema = kiwi.compileSchema(kiwi.decodeBinarySchema(inflate(chunks[0])));
const msg = schema.decodeMessage(inflate(chunks[1]));
fs.writeFileSync(path.join(OUT, 'doc.json'), JSON.stringify(msg, (k, v) => (v instanceof Uint8Array ? Buffer.from(v).toString('base64') : v)));
console.log(`fig version ${version}: ${msg.nodeChanges.length} nodes -> ${OUT}`);
