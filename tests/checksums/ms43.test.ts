import { describe, it, expect } from 'vitest';
import { plugin as ms43Plugin } from '../../src/plugins/ms43_2sum';

function makeTestBin(progFill: number, calFill: number): Buffer {
  const buf = Buffer.alloc(0x80000, 0xFF);
  for (let i = 0x00000; i < 0x60000; i++) buf[i] = progFill;
  for (let i = 0x60000; i < 0x7FFE0; i++) buf[i] = calFill;
  buf.writeUInt16LE(0x0000, 0x7FFE0);
  buf.writeUInt16LE(0x0000, 0x7FFFE);
  return buf;
}

describe('MS43 checksum plugin', () => {
  it('computes correct program and calibration CRCs on a known binary', () => {
    const bin = makeTestBin(0x12, 0x34);
    const patches = ms43Plugin.correct(bin);

    expect(patches).toHaveLength(2);
    const [progPatch, calPatch] = patches;

    expect(progPatch.offset).toBe(0x7FFE0);
    expect(calPatch.offset).toBe(0x7FFFE);

    // Known expected values (from earlier verification)
    expect(progPatch.value).toBe(0xA388);
    expect(calPatch.value).toBe(0x949A);
  });

  it('calibration CRC differs from program CRC (order dependency check)', () => {
    const bin = makeTestBin(0x12, 0x34);
    const patches = ms43Plugin.correct(bin);

    const progCrc = patches.find(p => p.offset === 0x7FFE0)?.value;
    const calCrc = patches.find(p => p.offset === 0x7FFFE)?.value;

    expect(progCrc).toBeDefined();
    expect(calCrc).toBeDefined();
    expect(progCrc).not.toBe(calCrc);
  });
});