import { readFileSync } from 'fs';
import { crc16xmodem } from 'crc';

const stockPath = 'data/MS43_WBABW510X0PK46741_430069_512KB.bin';
const buffer = readFileSync(stockPath);

// Range to test: 0x60000 to 0x73FDF (inclusive)
const start = 0x60000;
const end   = 0x73FDF;
const block = buffer.subarray(start, end + 1);

// Compute CRC16/XMODEM over this block
const computedCrc = crc16xmodem(block);

// Read the stored 16-bit value at 0x73FE0 (little-endian)
const storedCrc = buffer.readUInt16LE(0x73FE0);

console.log(`Computed CRC16/XMODEM = 0x${computedCrc.toString(16).toUpperCase().padStart(4, '0')}`);
console.log(`Stored at 0x73FE0      = 0x${storedCrc.toString(16).toUpperCase().padStart(4, '0')}`);

if (computedCrc === storedCrc) {
  console.log('\n✅ MATCH! This is the correct algorithm and range.');
} else {
  console.log('\n❌ No match. Trying alternative ranges...');
  // Try alternative ranges if needed (we can add)
}