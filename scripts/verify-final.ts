import { readFileSync } from 'fs';
import { crc16xmodem } from 'crc';

const b = readFileSync('data/MS43_WBABW510X0PK46741_430069_512KB.bin.modified.fixed');

function crc16Custom(buf: Buffer, poly: number, init: number): number {
  let crc = init & 0xffff;
  for (const byte of buf) {
    crc ^= (byte << 8);
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) crc = (crc << 1) ^ poly;
      else crc = crc << 1;
    }
    crc &= 0xffff;
  }
  return crc;
}

console.log('Prog:', '0x' + crc16xmodem(b.subarray(0, 0x60000)).toString(16).toUpperCase(),
            'Stored:', '0x' + b.readUInt16LE(0x7FFE0).toString(16).toUpperCase());
console.log('Cal :', '0x' + crc16Custom(b.subarray(0x60000, 0x7FFFE), 0x1021, 0xA580).toString(16).toUpperCase(),
            'Stored:', '0x' + b.readUInt16LE(0x7FFFE).toString(16).toUpperCase());