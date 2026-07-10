import { readFileSync } from 'fs';
import { crc16xmodem, crc16ccitt } from 'crc';

const bin = readFileSync('data/MS43_WBABW510X0PK46741_430069_512KB.bin');
const FILE_SIZE = bin.length; // 524288 (0x80000)

// Candidate ranges to test (start inclusive, end exclusive for subarray)
const ranges: { name: string; start: number; end: number }[] = [
  { name: 'Cal 0x60000-0x73FDF', start: 0x60000, end: 0x73FE0 }, // up to but not including 0x73FE0
  { name: 'Cal 0x60000-0x7FFDF', start: 0x60000, end: 0x7FFE0 }, // up to checksum area at 0x7FFE0
  { name: 'Cal 0x60000-0x7DFFF', start: 0x60000, end: 0x7E000 },
  { name: 'Cal 0x60000-0x7FFFF', start: 0x60000, end: 0x80000 }, // entire 128KB cal block
  { name: 'Full 0x00000-0x7FFDF', start: 0x00000, end: 0x7FFE0 },
  { name: 'Full 0x00000-0x7FFFF', start: 0x00000, end: 0x80000 },
];

// Offsets where the checksum might be stored (even addresses, 2 bytes)
const storageOffsets = [
  0x73FE0, 0x73FE2, 0x73FE4,
  0x7FFE0, 0x7FFE2, 0x7FFE4,
  0x7FFFC, 0x7FFFE,
  // less common but possible
  0x7DFE0, 0x7DFE2,
];

// Algorithms to test
const algorithms: { name: string; fn: (buf: Buffer) => number }[] = [
  { name: 'CRC16/XMODEM', fn: crc16xmodem },
  { name: 'CRC16/CCITT', fn: crc16ccitt },
];

console.log('Searching for checksum match in stock file...\n');

for (const range of ranges) {
  const block = bin.subarray(range.start, range.end);
  for (const algo of algorithms) {
    const computed = algo.fn(block);
    for (const offset of storageOffsets) {
      if (offset + 1 >= FILE_SIZE) continue; // safety
      const stored = bin.readUInt16LE(offset);
      if (computed === stored) {
        console.log(`✅ MATCH: ${algo.name} over ${range.name}`);
        console.log(`   Computed = 0x${computed.toString(16).toUpperCase().padStart(4, '0')}`);
        console.log(`   Stored at 0x${offset.toString(16).toUpperCase()} = 0x${stored.toString(16).toUpperCase().padStart(4, '0')}\n`);
      }
    }
  }
}

console.log('Search complete. If any match found, that’s the real checksum.');