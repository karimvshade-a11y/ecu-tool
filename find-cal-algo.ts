import { readFileSync } from 'fs';
import {
  crc16xmodem,
  crc16ccitt,
  crc16kermit,
  crc16modbus,
  crc16,
} from 'crc';

const bin = readFileSync('data/MS43_WBABW510X0PK46741_430069_512KB.bin.modified.fixed');
const block = bin.subarray(0x60000, 0x7FFFE); // calibration data only
const stored = bin.readUInt16LE(0x7FFFE);

// Define candidate CRC functions with names
const candidates: { name: string; fn: (buf: Buffer) => number }[] = [
  { name: 'CRC16/XMODEM (init 0x0000)', fn: crc16xmodem },
  { name: 'CRC16/CCITT (init 0xFFFF)', fn: crc16ccitt },
  { name: 'CRC16/KERMIT (init 0x0000, poly 0x1021)', fn: crc16kermit },
  { name: 'CRC16/MODBUS (init 0xFFFF, poly 0x8005)', fn: crc16modbus },
  { name: 'CRC16/BUYPASS (init 0x0000, poly 0x8005)', fn: crc16 },
];

// Also test custom initial values for XMODEM and CCITT (init values 0x0000, 0xFFFF, 0x1D0F, etc.)
function crc16xmodemInit(buf: Buffer, init: number) {
  // implement manually? crc library might not allow custom init directly.
  // We can compute using crc16xmodem but then XOR with init?
  // Actually, crc16xmodem has fixed init 0x0000. To test different inits,
  // we'd need to use a lower-level function. For now, skip custom inits.
  return crc16xmodem(buf);
}

console.log('Searching for correct calibration checksum algorithm...\n');
console.log(`Calibration block: 0x60000–0x7FFFD (${block.length} bytes)`);
console.log(`Stored checksum at 0x7FFFE: 0x${stored.toString(16).toUpperCase().padStart(4, '0')}\n`);

let found = false;
for (const c of candidates) {
  const computed = c.fn(block);
  if (computed === stored) {
    console.log(`✅ MATCH: ${c.name}`);
    console.log(`   Computed = 0x${computed.toString(16).toUpperCase().padStart(4, '0')}`);
    found = true;
  }
}

if (!found) {
  console.log('❌ No match among standard algorithms. Trying self-consistency (CRC of block + stored checksum = 0x0000)...');
  // Test if the checksum makes the whole block+checksum CRC zero
  const fullBlock = bin.subarray(0x60000, 0x80000);
  for (const c of candidates) {
    const crc = c.fn(fullBlock);
    if (crc === 0x0000) {
      console.log(`✅ SELF-CONSISTENT: ${c.name} (CRC over 0x60000–0x7FFFF) = 0x0000`);
      found = true;
    }
  }
}

if (!found) {
  console.log('\nStill no match. The algorithm may involve a non-standard initial value.');
  console.log('We can try brute-forcing init values for XMODEM and CCITT.');
}