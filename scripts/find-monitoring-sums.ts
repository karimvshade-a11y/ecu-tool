import * as fs from 'fs';

const binPath = './data/MS43_WBABW510X0PK46741_430069_512KB.bin';
const buf = fs.readFileSync(binPath);

function sum32(start: number, end: number): number {
  let sum = 0;
  for (let i = start; i <= end; i++) {
    sum = (sum + buf[i]) >>> 0; // force unsigned 32-bit
  }
  return sum >>> 0;
}

function read32le(offset: number): number {
  return buf.readUInt32LE(offset);
}

console.log('Program stored sum at 0x6FDAE:', read32le(0x6FDAE).toString(16));
console.log('Candidate A (0x10000-0x6FDA9):', sum32(0x10000, 0x6FDA9).toString(16));
console.log('Candidate B (0x10000-0x6FFDB):', sum32(0x10000, 0x6FFDB).toString(16));

console.log('Calibration stored sum at 0x72FFC:', read32le(0x72FFC).toString(16));
console.log('Candidate A (0x70000-0x72FF7):', sum32(0x70000, 0x72FF7).toString(16));
console.log('Candidate B (0x70000-0x73FDF):', sum32(0x70000, 0x73FDF).toString(16));