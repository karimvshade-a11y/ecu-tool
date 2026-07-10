import * as fs from 'fs';
import * as path from 'path';
import { XdfLoader } from './XdfLoader';
import { BinaryReader } from './BinaryReader'; 
import { getPlugin } from './checksums'; 
import { fixChecksum } from './checksum';

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_XDF = path.join(DATA_DIR, 'Siemens_MS43_430069_512K.xdf');
const DEFAULT_BIN = path.join(DATA_DIR, 'MS43_WBABW510X0PK46741_430069_512KB.bin');

// ---------------------------------------------------------------------------
// Pure, testable map I/O helpers (no global state)
// ---------------------------------------------------------------------------

/**
 * Read raw map values from a buffer (no global state, no equation applied).
 * Returns a 2D array of numbers.
 */
export function readMapValues(
  buffer: Buffer,
  mapDef: { address: number; rows: number; cols: number; elementSizeBits: number; outputType?: any }
): number[][] {
  const reader = new BinaryReader(buffer);
  return reader.readBlock(
    mapDef.address,
    mapDef.rows,
    mapDef.cols,
    mapDef.elementSizeBits,
    mapDef.outputType,
    undefined   // raw values only, no equation
  );
}

/**
 * Write a single cell value into a buffer (in-place, pure).
 * Throws on unsupported bit size.
 */
export function writeMapCell(
  buffer: Buffer,
  mapDef: { address: number; rows: number; cols: number; elementSizeBits: number },
  row: number,
  col: number,
  value: number
): void {
  const cellSizeBytes = mapDef.elementSizeBits / 8;
  const offset = mapDef.address + (row * mapDef.cols + col) * cellSizeBytes;
  if (mapDef.elementSizeBits === 8) {
    buffer.writeUInt8(value & 0xff, offset);
  } else if (mapDef.elementSizeBits === 16) {
    buffer.writeUInt16LE(value & 0xffff, offset);
  } else if (mapDef.elementSizeBits === 32) {
    buffer.writeUInt32LE(value >>> 0, offset);
  } else {
    throw new Error(`Unsupported element size: ${mapDef.elementSizeBits}`);
  }
}

// ---------------------------------------------------------------------------
// Singleton cache for the loaded definitions and binary data
// ---------------------------------------------------------------------------

let maps: any[] = [];
let buffer: Buffer | null = null;
let reader: BinaryReader | null = null;
let loadedBinPath = DEFAULT_BIN;

export async function loadAllMaps(xdfPath: string = DEFAULT_XDF, binPath: string = DEFAULT_BIN): Promise<void> {
    loadedBinPath = binPath;
    buffer = fs.readFileSync(binPath);
    reader = new BinaryReader(buffer); // shares the buffer so edits are visible to reads
    maps = await new XdfLoader().loadXdf(xdfPath);
    console.error(`Loaded ${maps.length} maps and ${buffer.length} bytes binary.`);
}

export function listMaps(filter?: string) {
    let filtered = maps;
    if (filter) {
        const term = filter.toLowerCase();
        filtered = maps.filter((m: any) => m.name.toLowerCase().includes(term));
    }
    filtered.forEach((m: any) =>
        console.log(`${m.name}  (${m.rows}x${m.cols}) @ 0x${m.address.toString(16).toUpperCase()}  [${m.mathEquation}]`)
    );
    console.log(`\nTotal: ${filtered.length} maps`);
}

export function readMap(mapName: string, engineering: boolean) {
    const map = findMap(mapName);

    console.log(`\nMap: ${map.name}  (${map.rows}x${map.cols}, ${map.elementSizeBits}-bit)  Equation: ${map.mathEquation}`);
    if (engineering) {
        console.log('Engineering values:');
        printTable(readMapData(map, true));
    } else {
        console.log('Raw values:');
        printTable(readMapData(map, false));
        console.log('\nEngineering values:');
        printTable(readMapData(map, true));
    }
}

export function editMap(mapName: string, row: number, col: number, rawValue: number) {
    const map = findMap(mapName);
    if (!buffer) throw new Error('Binary not loaded');
    if (row < 0 || row >= map.rows || col < 0 || col >= map.cols) {
        throw new Error(`Cell [${row}][${col}] is out of range for a ${map.rows}x${map.cols} map.`);
    }

    writeMapCell(buffer, map, row, col, rawValue);

    // Save the modified binary next to the original
    const outPath = loadedBinPath + '.modified';
    fs.writeFileSync(outPath, buffer);
    console.log(`Wrote ${rawValue} to ${map.name}[${row}][${col}]. Saved: ${outPath}`);

    try {
        console.log('Applying automatic checksum correction...');
        const plugin = getPlugin('ms43');
        fixChecksum(outPath, plugin);
    } catch (err) {
        console.error('Checksum correction failed. Do not flash!', err);
    }
}

export function exportMap(mapName: string, outputPath?: string) {
    const map = findMap(mapName);
    const engData = readMapData(map, true);
    const csvRows = engData.map((row: number[]) => row.join(',')).join('\n');
    const safeName = map.name.replace(/[\\/:*?"<>|]/g, '_');
    const filePath = outputPath || `${safeName}.csv`;
    fs.writeFileSync(filePath, csvRows);
    console.log(`Exported ${map.name} to ${filePath}`);
}

// Helper: find a map by name (exact match first, then substring)
function findMap(name: string): any {
    const needle = name.toLowerCase();
    const exact = maps.filter((m: any) => m.name.toLowerCase() === needle);
    if (exact.length === 1) return exact[0];

    const matches = maps.filter((m: any) => m.name.toLowerCase().includes(needle));
    if (matches.length === 0) throw new Error(`No map found matching "${name}"`);
    if (matches.length > 1) {
        console.warn(`Multiple maps match. Using first: ${matches[0].name}`);
        matches.forEach((m: any) => console.log(`  - ${m.name}`));
    }
    return matches[0];
}

// Helper: read a map's data as a 2D array (raw or engineering units)
function readMapData(map: any, engineering: boolean): number[][] {
    if (!reader) throw new Error('Binary not loaded');
    return reader.readBlock(
        map.address,
        map.rows,
        map.cols,
        map.elementSizeBits,
        map.outputType,
        engineering ? map.mathEquation : undefined
    );
}

// Helper: print a 2D array as a table
function printTable(data: number[][]) {
    console.table(data);
}