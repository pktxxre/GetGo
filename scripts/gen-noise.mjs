// Generates assets/noise.png — a 128×128 grayscale random-noise tile for the image grade's 4%
// monochrome grain (DESIGN.md → Image grade). Dependency-free (built-in zlib + a hand-rolled
// CRC32), reproducible: re-run `node scripts/gen-noise.mjs` to regenerate. Random per-pixel noise
// tiles seamlessly enough at 4% opacity that edge seams are invisible.
import zlib from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 128;

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 0; // colour type 0 = grayscale
// compression/filter/interlace all 0 (already zeroed)

const raw = Buffer.alloc((SIZE + 1) * SIZE);
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0; // per-scanline filter: none
  for (let x = 0; x < SIZE; x++) raw[p++] = Math.floor(Math.random() * 256);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(new URL('../assets/noise.png', import.meta.url), png);
console.log('wrote assets/noise.png', png.length, 'bytes');
