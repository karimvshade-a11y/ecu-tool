/**
 * MS43 5‑checksum variant (community template).
 * NOT YET VALIDATED — needs a matching binary to verify.
 *
 * Implements boot CRC, program CRC, calibration CRC, and two 32‑bit addition
 * monitoring sums as described in the MS4X wiki.
 */
import { ChecksumPlugin } from '../checksums/types';
import { crc16xmodem } from 'crc';

function crc16ccitt(buf: Buffer): number {
  let crc = 0xFFFF;
  for (const byte of buf) {
    crc ^= (byte << 8);
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xFFFF;
    }
  }
  return crc;
}

function uint32sum(buf: Buffer): number {
  let sum = 0;
  for (const byte of buf) sum = (sum + byte) >>> 0;
  return sum >>> 0;
}

export const plugin: ChecksumPlugin = {
  name: 'ms43_5sum',
  validated: false,
  correct(buffer: Buffer) {
    // --- 1. Program addition sum (0x10000..0x6FDAF → stored 0x6FDB0) ---
    const progAdd = uint32sum(buffer.subarray(0x10000, 0x6FDB0));
    // --- 2. Calibration addition sum (0x70000..0x72FFB → stored 0x72FFC) ---
    const calAdd = uint32sum(buffer.subarray(0x70000, 0x72FFC));

    const cloned = Buffer.from(buffer);
    cloned.writeUInt32LE(progAdd, 0x6FDB0);
    cloned.writeUInt32LE(calAdd, 0x72FFC);

    // --- 3. Boot CRC16 (CCITT, init 0xFFFF) over 0x00000-0x0FFDB → stored 0x3C24 ---
    const bootCrc = crc16ccitt(cloned.subarray(0x00000, 0x0FFDC));
    // --- 4. Program CRC16 (XMODEM) over 0x10000-0x6FFDB → stored 0x6FDE0 ---
    const progCrc = crc16xmodem(cloned.subarray(0x10000, 0x6FFDC));
    // --- 5. Calibration CRC16 (XMODEM) over 0x70000-0x73FDF → stored 0x73FE0 ---
    const calCrc = crc16xmodem(cloned.subarray(0x70000, 0x73FE0));

    return [
      { offset: 0x6FDB0, value: progAdd, size: 4, endian: 'LE', label: 'Program 32-bit Addition' },
      { offset: 0x72FFC, value: calAdd,  size: 4, endian: 'LE', label: 'Calibration 32-bit Addition' },
      { offset: 0x3C24,  value: bootCrc, size: 2, endian: 'LE', label: 'Boot CRC16' },
      { offset: 0x6FDE0, value: progCrc, size: 2, endian: 'LE', label: 'Program CRC16' },
      { offset: 0x73FE0, value: calCrc,  size: 2, endian: 'LE', label: 'Calibration CRC16' },
    ];
  },
};