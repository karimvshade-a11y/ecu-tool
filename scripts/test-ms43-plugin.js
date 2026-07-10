const { ms43Plugin } = require('./src/checksums/ms43');
const fs = require('fs');

const bin = fs.readFileSync('data/MS43_WBABW510X0PK46741_430069_512KB.bin.modified');
const patches = ms43Plugin.correct(bin);
console.log('Patches:', patches);