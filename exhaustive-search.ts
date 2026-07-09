import { readFileSync } from 'fs';
import { crc16xmodem, crc16ccitt, crc16kermit, crc16modbus, crc16 } from 'crc';

const bin = readFileSync('data/MS43_WBABW510X0PK46741_430069_512KB.bin');
const SIZE = bin.length; // 0x80000

// Ranges to test [start, end) – end is exclusive
const ranges: [string, number, number][] = [
  ['Cal 0x60000-0x73FE0', 0x60000, 0x73FE0],
  ['Cal 0x60000-0x7FFE0', 0x60000, 0x7FFE0],
  ['Cal 0x60000-0x7DFFF', 0x60000, 0x7E000],
  ['Cal 0x60000-0x80000', 0x60000, 0x80000],
  ['Full 0x00000-0x7FFE0', 0x00000, 0x7FFE0],
  ['Full 0x00000-0x80000', 0x00000, 0x80000],
  ['0x10000-0x73FE0', 0x10000, 0x73FE0],
  ['0x10000-0x7FFE0', 0x10000, 0x7FFE0],
];

// Storage offsets to check (even addresses, 2 bytes)
const offsets = [
  0x73FE0, 0x73FE2, 0x73FE4,
  0x7FFE0, 0x7FFE2, 0x7FFE4,
  0x7FFFC, 0x7FFFE,
  0x7DFE0, 0x7DFE2,
  0x7E000, 0x7E002,
];

// ----------------- Algorithms -----------------
interface Algo {
  name: string;
  fn: (buf: Buffer) => number;
}

const algorithms: Algo[] = [
  { name: 'CRC16/XMODEM', fn: crc16xmodem },
  { name: 'CRC16/CCITT',  fn: crc16ccitt },
  { name: 'CRC16/KERMIT', fn: crc16kermit },
  { name: 'CRC16/MODBUS', fn: crc16modbus },
  // crc16 (generic) with default polynomial 0x8005? Actually crc16 is CRC-16/BUYPASS (0x8005)
  { name: 'CRC16/BUYPASS', fn: crc16 },
];

// Additive checksum (16-bit sum of all bytes, modulo 2^16)
function sum8(buf: Buffer): number {
  let s = 0;
  for (const b of buf) s += b;
  return s & 0xFFFF;
}

// Additive checksum of 16-bit words (little-endian)
function sum16le(buf: Buffer): number {
  let s = 0;
  for (let i = 0; i < buf.length - 1; i += 2) {
    s += buf.readUInt16LE(i);
  }
  return s & 0xFFFF;
}

// Additive checksum of 16-bit words (big-endian)
function sum16be(buf: Buffer): number {
  let s = 0;
  for (let i = 0; i < buf.length - 1; i += 2) {
    s += buf.readUInt16BE(i);
  }
  return s & 0xFFFF;
}

// XOR checksum (byte-wise XOR)
function xor8(buf: Buffer): number {
  let x = 0;
  for (const b of buf) x ^= b;
  return x; // 8-bit
}

// Append these to algorithms
algorithms.push(
  { name: 'SUM8', fn: sum8 },
  { name: 'SUM16LE', fn: sum16le },
  { name: 'SUM16BE', fn: sum16be },
);

// For XOR8 we need to compare only low byte? The stored checksum is 16-bit, so XOR8 would be a single byte, perhaps stored in low byte and high byte is 0. We'll treat it as 16-bit with high byte zero.
// We'll compute 8-bit XOR and then treat stored value as little-endian 16-bit where high byte should be zero.

// Also try bitwise NOT of computed value (some checksums store the complement)
function complement(c: number): number { return (~c) & 0xFFFF; }

// Try two's complement negative
function twosComp(c: number): number { return (-c) & 0xFFFF; }

console.log('Running exhaustive checksum search...\n');

let found = false;

for (const [rangeName, start, end] of ranges) {
  const block = bin.subarray(start, end);
  for (const algo of algorithms) {
    const computed = algo.fn(block);
    for (const offset of offsets) {
      if (offset + 1 >= SIZE) continue;
      const stored = bin.readUInt16LE(offset);

      // Direct match
      if (computed === stored) {
        console.log(`✅ DIRECT MATCH: ${algo.name} over ${rangeName}`);
        console.log(`   Computed = 0x${computed.toString(16).toUpperCase().padStart(4,'0')}`);
        console.log(`   Stored at 0x${offset.toString(16).toUpperCase()} = 0x${stored.toString(16).toUpperCase().padStart(4,'0')}\n`);
        found = true;
      }

      // Complement (~val)
      if (complement(computed) === stored) {
        console.log(`✅ COMPLEMENT MATCH: ~(${algo.name}) over ${rangeName}`);
        console.log(`   Computed = 0x${computed.toString(16).toUpperCase().padStart(4,'0')}, ~ = 0x${complement(computed).toString(16).toUpperCase().padStart(4,'0')}`);
        console.log(`   Stored at 0x${offset.toString(16).toUpperCase()} = 0x${stored.toString(16).toUpperCase().padStart(4,'0')}\n`);
        found = true;
      }

      // Two's complement negated
      if (twosComp(computed) === stored) {
        console.log(`✅ NEGATED MATCH: -(${algo.name}) over ${rangeName}`);
        console.log(`   Computed = 0x${computed.toString(16).toUpperCase().padStart(4,'0')}, - = 0x${twosComp(computed).toString(16).toUpperCase().padStart(4,'0')}`);
        console.log(`   Stored at 0x${offset.toString(16).toUpperCase()} = 0x${stored.toString(16).toUpperCase().padStart(4,'0')}\n`);
        found = true;
      }
    }
  }
  // Also treat XOR8 result as 16-bit: stored must have high byte 0 and low byte = xor8
  const xor = xor8(block);
  for (const offset of offsets) {
    if (offset + 1 >= SIZE) continue;
    const stored = bin.readUInt16LE(offset);
    if (stored === xor) { // low byte = xor, high byte 0
      console.log(`✅ XOR8 MATCH (as 16-bit low byte): over ${rangeName}`);
      console.log(`   XOR8 = 0x${xor.toString(16).toUpperCase().padStart(2,'0')}`);
      console.log(`   Stored at 0x${offset.toString(16).toUpperCase()} = 0x${stored.toString(16).toUpperCase().padStart(4,'0')}\n`);
      found = true;
    }
  }
}

if (!found) {
  console.log('No matches found. The checksum may involve a custom polynomial or range.');
}