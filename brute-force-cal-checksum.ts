import { readFileSync } from 'fs';

const bin = readFileSync('data/MS43_WBABW510X0PK46741_430069_512KB.bin.modified.fixed');
const block = bin.subarray(0x60000, 0x7FFFE); // calibration block (131070 bytes)
const target = bin.readUInt16LE(0x7FFFE);      // 0x8FDC

// Generic CRC16 function (reflect in=false, out=false, no final XOR)
function crc16(buf: Buffer, poly: number, init: number): number {
  let crc = init & 0xFFFF;
  for (const byte of buf) {
    crc ^= (byte << 8);
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ poly;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xFFFF;
  }
  return crc;
}

console.log(`Brute-forcing initial value for calibration checksum...`);
console.log(`Target: 0x${target.toString(16).toUpperCase().padStart(4, '0')}\n`);

// Test XMODEM poly 0x1021
let found = false;
for (let init = 0; init <= 0xFFFF; init++) {
  const computed = crc16(block, 0x1021, init);
  if (computed === target) {
    console.log(`✅ CRC16/XMODEM (poly=0x1021) with init=0x${init.toString(16).toUpperCase().padStart(4, '0')}`);
    found = true;
  }
}

// Test CCITT poly 0x1021 but with init? Actually CCITT uses same poly 0x1021, just different init.
// So XMODEM and CCITT differ only by init value. Our test above already covers all inits for poly 0x1021.
// So if not found above, it's not a standard 0x1021 poly. Test 0x8005 (BUYPASS) as well.
if (!found) {
  console.log('Not found with poly=0x1021. Trying poly=0x8005...');
  for (let init = 0; init <= 0xFFFF; init++) {
    const computed = crc16(block, 0x8005, init);
    if (computed === target) {
      console.log(`✅ CRC16/BUYPASS (poly=0x8005) with init=0x${init.toString(16).toUpperCase().padStart(4, '0')}`);
      found = true;
    }
  }
}

if (!found) {
  console.log('No match found with brute-force of init values for common polys.');
}