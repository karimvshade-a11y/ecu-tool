// Brute-force discovery: given a stock binary and a corrected one, work out
// which checksum algorithm over which address range reproduces each changed field.
//
//   npx ts-node discover-checksum.ts [stock.bin] [stock_fixed.bin]
//
// NOTE: this is a manual research tool. Over a 512KB file the nested range
// search is slow (minutes), which is expected - narrow STEP once you have a
// rough hit, or reduce the range once you know roughly where the field lives.
import { crc16xmodem, crc16ccitt, crc32 } from 'crc';
import * as fs from 'fs';

const stockPath = process.argv[2] || 'stock.bin';
const fixedPath = process.argv[3] || 'stock_fixed.bin';

const stock = fs.readFileSync(stockPath);
const fixed = fs.readFileSync(fixedPath);

if (stock.length !== fixed.length) {
    console.warn(`Warning: files differ in length (${stock.length} vs ${fixed.length}).`);
}

// Find all changed offsets
const changed: number[] = [];
const len = Math.min(stock.length, fixed.length);
for (let i = 0; i < len; i++) {
    if (stock[i] !== fixed[i]) changed.push(i);
}

console.log(`Comparing ${stockPath} vs ${fixedPath}`);
console.log('Changed offsets:', changed.map(o => '0x' + o.toString(16)).join(', ') || '(none)');

const STEP = 0x1000;

// additive 16-bit sum over a slice (mod 65536), tolerant of odd length
function sum16(slice: Buffer): number {
    let s = 0;
    for (let j = 0; j + 2 <= slice.length; j += 2) {
        s = (s + slice.readUInt16LE(j)) & 0xffff;
    }
    return s;
}

// For each changed offset, try to reproduce the corrected value
for (const offset of changed) {
    // Candidate corrected values in both widths and byte orders
    const target16LE = offset + 2 <= fixed.length ? fixed.readUInt16LE(offset) : -1;
    const target16BE = offset + 2 <= fixed.length ? fixed.readUInt16BE(offset) : -1;
    const target32LE = offset + 4 <= fixed.length ? fixed.readUInt32LE(offset) : -1;
    const target32BE = offset + 4 <= fixed.length ? fixed.readUInt32BE(offset) : -1;

    console.log(`\nOffset 0x${offset.toString(16)}: `
        + `16LE=0x${(target16LE >>> 0).toString(16)} 16BE=0x${(target16BE >>> 0).toString(16)} `
        + `32LE=0x${(target32LE >>> 0).toString(16)}`);

    let found = false;
    for (let start = 0; start < stock.length && !found; start += STEP) {
        for (let end = stock.length; end > start; end -= STEP) {
            const slice = stock.subarray(start, end);
            const range = `0x${start.toString(16)}..0x${end.toString(16)}`;

            const x = crc16xmodem(slice);
            const cc = crc16ccitt(slice);
            const c32 = crc32(slice) >>> 0;
            const s16 = sum16(slice);

            if (x === target16LE || x === target16BE) {
                console.log(`  FOUND: CRC16/XMODEM over ${range}`); found = true; break;
            }
            if (cc === target16LE || cc === target16BE) {
                console.log(`  FOUND: CRC16/CCITT over ${range}`); found = true; break;
            }
            if (s16 === target16LE || s16 === target16BE) {
                console.log(`  FOUND: additive 16-bit sum over ${range}`); found = true; break;
            }
            if (c32 === target32LE || c32 === target32BE) {
                console.log(`  FOUND: CRC32 over ${range}`); found = true; break;
            }
        }
    }
    if (!found) {
        console.log('  No match (try other algorithms, word sizes, or seed/xor variants)');
    }
}
