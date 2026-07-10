const { readFileSync } = require('fs');

// The custom function exactly as in your plugin
function crc16Custom(buf, poly, init) {
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

const bin = readFileSync('data/MS43_WBABW510X0PK46741_430069_512KB.bin.modified');
const calBlock = bin.subarray(0x60000, 0x7FFFE);

const result = crc16Custom(calBlock, 0x1021, 0xa580);
console.log('Custom CRC16 result = 0x' + result.toString(16).toUpperCase().padStart(4, '0'));