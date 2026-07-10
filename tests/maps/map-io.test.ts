import { describe, it, expect } from 'vitest';
import { readMapValues, writeMapCell } from '../../src/tuningTool';

const map16 = { address: 8, rows: 2, cols: 2, elementSizeBits: 16 };

describe('Map I/O (pure functions)', () => {
  it('reads a 16-bit map correctly', () => {
    const buf = Buffer.alloc(16, 0);
    buf.writeUInt16LE(10, 8);
    buf.writeUInt16LE(20, 10);
    buf.writeUInt16LE(30, 12);
    buf.writeUInt16LE(40, 14);

    const data = readMapValues(buf, map16);
    expect(data).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  it('writes a single 16-bit cell and leaves others unchanged', () => {
    const buf = Buffer.alloc(16, 0);
    buf.writeUInt16LE(10, 8);
    buf.writeUInt16LE(20, 10);
    buf.writeUInt16LE(30, 12);
    buf.writeUInt16LE(40, 14);

    writeMapCell(buf, map16, 0, 1, 99); // row 0, col 1

    expect(buf.readUInt16LE(10)).toBe(99);
    expect(buf.readUInt16LE(8)).toBe(10);
    expect(buf.readUInt16LE(12)).toBe(30);
    expect(buf.readUInt16LE(14)).toBe(40);
  });

  it('handles 8-bit cells', () => {
    const map8 = { address: 0, rows: 1, cols: 2, elementSizeBits: 8 };
    const buf = Buffer.from([0xAB, 0xCD]);
    expect(readMapValues(buf, map8)).toEqual([[0xAB, 0xCD]]);

    writeMapCell(buf, map8, 0, 1, 0xEF);
    expect(buf.readUInt8(1)).toBe(0xEF);
  });

  it('handles 32-bit cells', () => {
    const map32 = { address: 0, rows: 1, cols: 2, elementSizeBits: 32 };
    const buf = Buffer.alloc(8);
    buf.writeUInt32LE(0x12345678, 0);
    buf.writeUInt32LE(0x9ABCDEF0, 4);
    expect(readMapValues(buf, map32)).toEqual([[0x12345678, 0x9ABCDEF0]]);

    writeMapCell(buf, map32, 0, 0, 0xDEADBEEF);
    expect(buf.readUInt32LE(0)).toBe(0xDEADBEEF);
  });
});