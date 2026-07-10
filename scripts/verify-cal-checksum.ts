import { readFileSync } from 'fs';
import { crc16xmodem } from 'crc';

const bin = readFileSync('data/MS43_WBABW510X0PK46741_430069_512KB.bin');

// Calibration area: 0x60000 to 0x7FFFD inclusive (length = 0x20000 - 2)
const START = 0x60000;
const END = 0x7FFFE; // exclusive: so range is 0x60000..0x7FFFD
const block = bin.subarray(START, END);

// Compute correct checksum
const correctCrc = crc16xmodem(block);

// What is currently at 0x7FFFE?
const stored = bin.readUInt16LE(0x7FFFE);

console.log(`Calibration range: 0x${START.toString(16)} - 0x${(END-1).toString(16)}`);
console.log(`Computed CRC16/XMODEM = 0x${correctCrc.toString(16).toUpperCase().padStart(4,'0')}`);
console.log(`Current value at 0x7FFFE = 0x${stored.toString(16).toUpperCase().padStart(4,'0')} (${stored === 0xFFFF ? 'likely uninitialized' : 'some data'})`);

if (stored === correctCrc) {
  console.log('\n✅ The current checksum is already correct.');
} else {
  console.log('\n⚠️ Current stored checksum is invalid, but the computed value above is the correct one.');
}