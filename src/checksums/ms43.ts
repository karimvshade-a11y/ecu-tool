/**
 * MS43 checksum plugin — 2‑checksum variant.
 * Validated against binary: MS43_WBABW510X0PK46741_430069_512KB.bin
 *
 * Some MS43 firmware variants use a 5‑checksum layout (boot CRC, program CRC,
 * calibration CRC, and two 32‑bit addition monitoring sums). This plugin
 * implements the 2‑checksum layout used by the above binary.
 */
import { crc16xmodem } from 'crc';
import { ChecksumPlugin } from './types';

function crc16Custom(buf: Buffer, poly: number, init: number): number {
  let crc = init & 0xffff;
  for (const byte of buf) {
    crc ^= (byte << 8);
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ poly;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xffff;
  }
  return crc;
}

export const ms43Plugin: ChecksumPlugin = {
  name: 'ms43',
  validated: true,
  correct(buffer: Buffer) {
    // 1. Program checksum: CRC16/XMODEM over 0x00000–0x5FFFF, stored at 0x7FFE0
    const progBlock = buffer.subarray(0x00000, 0x60000);
    const progCrc = crc16xmodem(progBlock);

    // 2. Write program checksum first, because the calibration block includes 0x7FFE0
    const cloned = Buffer.from(buffer);
    cloned.writeUInt16LE(progCrc, 0x7FFE0);

    // 3. Calibration checksum: CRC16 poly 0x1021, init 0xA580 over 0x60000–0x7FFFD
    const calBlock = cloned.subarray(0x60000, 0x7FFFE);
    const calCrc = crc16Custom(calBlock, 0x1021, 0xa580);

    return [
      { offset: 0x7FFE0, value: progCrc, size: 2, endian: 'LE', label: 'CRC16_PROG' },
      { offset: 0x7FFFE, value: calCrc, size: 2, endian: 'LE', label: 'CRC16_CAL' },
    ];
  },
};