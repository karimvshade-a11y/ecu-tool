import { readFileSync } from 'fs';

const bin = readFileSync('data/MS43_WBABW510X0PK46741_430069_512KB.bin');
const SIZE = bin.length;

// Candidate starts and storage offsets (same as before)
const starts = [0x60000, 0x00000, 0x10000];
const offsets = [
  0x73FE0, 0x73FE2, 0x73FE4,
  0x7FFE0, 0x7FFE2, 0x7FFE4,
  0x7FFFC, 0x7FFFE,
  0x7DFE0, 0x7DFE2,
];

interface Candidate {
  name: string;
  start: number;
  end: number;   // exclusive, covers bytes from start to end-1
  storage: number; // offset where 2-byte checksum is stored
}

const candidates: Candidate[] = [];
for (const start of starts) {
  for (const off of offsets) {
    if (off + 2 <= SIZE && start < off + 2) {
      candidates.push({
        name: `0x${start.toString(16)}–0x${(off+2).toString(16)} (sum stored @ 0x${off.toString(16)})`,
        start,
        end: off + 2,
        storage: off,
      });
    }
  }
}

console.log('Testing additive checksum (16-bit sum over block including stored checksum = 0x0000)\n');

let found = false;

for (const c of candidates) {
  const block = bin.subarray(c.start, c.end);
  // Compute sum of 16-bit words (little-endian)
  let sum = 0;
  for (let i = 0; i < block.length - 1; i += 2) {
    sum += block.readUInt16LE(i);
  }
  // Handle odd byte? This range should be even length.
  sum &= 0xFFFF;

  if (sum === 0x0000) {
    console.log(`✅ ZERO SUM MATCH: range ${c.name}`);
    console.log(`   The stored checksum at 0x${c.storage.toString(16)} makes the total sum zero.\n`);
    found = true;
  }
}

if (!found) {
  console.log('No zero-sum match. Testing total sum = 0xFFFF...');
  for (const c of candidates) {
    const block = bin.subarray(c.start, c.end);
    let sum = 0;
    for (let i = 0; i < block.length - 1; i += 2) {
      sum += block.readUInt16LE(i);
    }
    sum &= 0xFFFF;
    if (sum === 0xFFFF) {
      console.log(`✅ FFFF SUM MATCH: range ${c.name}`);
      found = true;
    }
  }
}

if (!found) {
  console.log('No additive match found.');
}