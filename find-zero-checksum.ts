import { readFileSync } from 'fs';
import { crc16xmodem, crc16ccitt, crc16kermit, crc16modbus, crc16 } from 'crc';

const bin = readFileSync('data/MS43_WBABW510X0PK46741_430069_512KB.bin');
const SIZE = bin.length;

// Ranges to test (start inclusive, end exclusive) that INCLUDE the checksum field.
// For each storage offset O (2 bytes), we consider end = O + 2.
// Candidate starts: typical block starts.
const candidates: { name: string; start: number; end: number; storageOffset: number }[] = [];

// Build candidates for each common start and each potential storage offset
const starts = [
  0x60000, // calibration area
  0x00000, // full file
  0x10000, // skip boot sector
];

const storageOffsets = [
  0x73FE0, 0x73FE2, 0x73FE4,
  0x7FFE0, 0x7FFE2, 0x7FFE4,
  0x7FFFC, 0x7FFFE,
  0x7DFE0, 0x7DFE2,
];

for (const start of starts) {
  for (const off of storageOffsets) {
    if (off + 2 <= SIZE && start < off + 2) {
      candidates.push({
        name: `0x${start.toString(16)}-0x${(off+2).toString(16)} (stored at 0x${off.toString(16)})`,
        start,
        end: off + 2,
        storageOffset: off,
      });
    }
  }
}

// Algorithms
const algos = [
  { name: 'CRC16/XMODEM', fn: crc16xmodem },
  { name: 'CRC16/CCITT',  fn: crc16ccitt },
  { name: 'CRC16/KERMIT', fn: crc16kermit },
  { name: 'CRC16/MODBUS', fn: crc16modbus },
  { name: 'CRC16/BUYPASS', fn: crc16 },
];

console.log('Searching for self-consistent checksum (CRC over block incl. checksum = 0x0000)...\n');

let found = false;

for (const c of candidates) {
  const block = bin.subarray(c.start, c.end);
  for (const algo of algos) {
    const crc = algo.fn(block);
    if (crc === 0x0000) {
      console.log(`✅ ZERO MATCH: ${algo.name} over ${c.name}`);
      console.log(`   CRC of block (incl stored checksum) = 0x0000`);
      console.log(`   => When patching, compute ${algo.name} over 0x${c.start.toString(16)}-0x${(c.storageOffset).toString(16)} (excl), store at 0x${c.storageOffset.toString(16)}\n`);
      found = true;
    }
  }
  // Also try 32-bit CRC? skip for now.
}

if (!found) {
  console.log('No zero-match found. Trying negated CRC (CRC of block = 0xFFFF)...');
  for (const c of candidates) {
    const block = bin.subarray(c.start, c.end);
    for (const algo of algos) {
      const crc = algo.fn(block);
      if (crc === 0xFFFF) {
        console.log(`✅ FFFF MATCH: ${algo.name} over ${c.name} -> CRC = 0xFFFF`);
        found = true;
      }
    }
  }
}

if (!found) {
  console.log('Still no match. The checksum might be additive (sum=0), XOR, or custom.');
}