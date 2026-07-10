import { crc16xmodem } from 'crc';
import * as fs from 'fs';

const buf = fs.readFileSync('./data/MS43_WBABW510X0PK46741_430069_512KB.bin');

// ----- Helper: CRC-CCITT (poly 0x1021, init 0xFFFF) -----
function crc16ccitt(data: Buffer): number {
  let crc = 0xFFFF;
  for (const byte of data) {
    crc ^= (byte << 8);
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xFFFF;
    }
  }
  return crc;
}

// ----- Addition sum: byte-wise -----
function sumBytes(data: Buffer): number {
  let sum = 0;
  for (const b of data) sum = (sum + b) >>> 0;
  return sum >>> 0;
}

// ----- Addition sum: 32-bit word-wise (LE) -----
function sumWords32LE(data: Buffer): number {
  let sum = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    sum = (sum + data.readUInt32LE(i)) >>> 0;
  }
  return sum >>> 0;
}

// -------------------------------------------------------------------
// 1. Program addition sum  (stored at 0x6FDB0, 4 bytes LE)
//    Region candidate: 0x10000..0x6FDAF (inclusive)
// -------------------------------------------------------------------
const progAddRegion = buf.subarray(0x10000, 0x6FDB0);
console.log('--- Program 32-bit Addition ---');
console.log('Stored at 0x6FDB0: 0x' + buf.readUInt32LE(0x6FDB0).toString(16).padStart(8,'0'));
console.log('Byte-wise sum:    0x' + sumBytes(progAddRegion).toString(16).padStart(8,'0'));
console.log('Word-wise sum:    0x' + sumWords32LE(progAddRegion).toString(16).padStart(8,'0'));

// -------------------------------------------------------------------
// 2. Calibration addition sum (stored at 0x72FFC, 4 bytes LE)
//    Region candidate: 0x70000..0x72FFB (inclusive)
// -------------------------------------------------------------------
const calAddRegion = buf.subarray(0x70000, 0x72FFC);
console.log('--- Calibration 32-bit Addition ---');
console.log('Stored at 0x72FFC: 0x' + buf.readUInt32LE(0x72FFC).toString(16).padStart(8,'0'));
console.log('Byte-wise sum:    0x' + sumBytes(calAddRegion).toString(16).padStart(8,'0'));
console.log('Word-wise sum:    0x' + sumWords32LE(calAddRegion).toString(16).padStart(8,'0'));

// -------------------------------------------------------------------
// 3. Boot CRC16  (stored at 0x3C24)
// -------------------------------------------------------------------
console.log('--- Boot CRC16 ---');
const bootStored = buf.readUInt16LE(0x3C24);
console.log('Stored at 0x3C24: 0x' + bootStored.toString(16).padStart(4,'0'));

// Try region 0x00000..0x0FFDB, skipping 0x3C24-0x3C25
const bootBlock1 = Buffer.concat([
  buf.subarray(0x00000, 0x3C24),
  buf.subarray(0x3C26, 0x0FFDC)
]);
console.log('CRC-CCITT (skipping 0x3C24): 0x' + crc16ccitt(bootBlock1).toString(16).padStart(4,'0') + '  Match:', crc16ccitt(bootBlock1) === bootStored);
// Full region without skipping
const bootBlock2 = buf.subarray(0x00000, 0x0FFDC);
console.log('CRC-CCITT (full 0x00000-0x0FFDB): 0x' + crc16ccitt(bootBlock2).toString(16).padStart(4,'0') + '  Match:', crc16ccitt(bootBlock2) === bootStored);
// Try XMODEM
console.log('CRC-XMODEM (full 0x00000-0x0FFDB): 0x' + crc16xmodem(bootBlock2).toString(16).padStart(4,'0') + '  Match:', crc16xmodem(bootBlock2) === bootStored);

// -------------------------------------------------------------------
// 4. Program CRC16  (stored at 0x6FDE0)
// -------------------------------------------------------------------
console.log('--- Program CRC16 ---');
const progCrcStored = buf.readUInt16LE(0x6FDE0);
console.log('Stored at 0x6FDE0: 0x' + progCrcStored.toString(16).padStart(4,'0'));
// Full region 0x10000..0x6FFDB (excluding 0x6FFDC-0x6FFDD)
const progBlockFull = buf.subarray(0x10000, 0x6FFDC);
console.log('XMODEM (full 0x10000-0x6FFDB): 0x' + crc16xmodem(progBlockFull).toString(16).padStart(4,'0') + '  Match:', crc16xmodem(progBlockFull) === progCrcStored);
// Skip CRC bytes at 0x6FDE0-0x6FDE1
const progBlockSkip = Buffer.concat([
  buf.subarray(0x10000, 0x6FDE0),
  buf.subarray(0x6FDE2, 0x6FFDC)
]);
console.log('XMODEM (skip 0x6FDE0): 0x' + crc16xmodem(progBlockSkip).toString(16).padStart(4,'0') + '  Match:', crc16xmodem(progBlockSkip) === progCrcStored);

// -------------------------------------------------------------------
// 5. Calibration CRC16  (stored at 0x73FE0)
// -------------------------------------------------------------------
console.log('--- Calibration CRC16 ---');
const calCrcStored = buf.readUInt16LE(0x73FE0);
console.log('Stored at 0x73FE0: 0x' + calCrcStored.toString(16).padStart(4,'0'));
// Full region 0x70000..0x73FDF (excluding 0x73FE0-0x73FE1)
const calBlockFull = buf.subarray(0x70000, 0x73FE0);
console.log('XMODEM (full 0x70000-0x73FDF): 0x' + crc16xmodem(calBlockFull).toString(16).padStart(4,'0') + '  Match:', crc16xmodem(calBlockFull) === calCrcStored);
// Skip addition sum storage 0x72FFC-0x72FFF as well?
const calBlockSkipAdd = Buffer.concat([
  buf.subarray(0x70000, 0x72FFC),
  buf.subarray(0x73000, 0x73FE0)
]);
console.log('XMODEM (skip 0x72FFC-0x72FFF): 0x' + crc16xmodem(calBlockSkipAdd).toString(16).padStart(4,'0') + '  Match:', crc16xmodem(calBlockSkipAdd) === calCrcStored);