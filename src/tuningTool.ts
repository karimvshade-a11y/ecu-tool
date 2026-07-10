import * as fs from 'fs';
import * as path from 'path';
import { XdfLoader } from './XdfLoader';
import { BinaryReader } from './BinaryReader'; 
import { getPlugin } from './checksums'; 
import { fixChecksum } from './checksum';
import chalk from 'chalk';

// ---------------------------------------------------------------------------
// Edit log types and helper
// ---------------------------------------------------------------------------

interface EditLogEntry {
  mapName: string;
  address: number;
  row: number;
  col: number;
  oldRawValue: number;
  newRawValue: number;
  timestamp: string;
  checksumStatus: 'corrected' | 'failed' | 'skipped';
}

function recordEditLog(binPath: string, entry: EditLogEntry): void {
  const logPath = binPath + '.edit-log.json';
  let log: EditLogEntry[] = [];
  if (fs.existsSync(logPath)) {
    try {
      const raw = fs.readFileSync(logPath, 'utf8');
      log = JSON.parse(raw);
      if (!Array.isArray(log)) log = [];
    } catch {
      log = [];
    }
  }
  log.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Pure, testable map I/O helpers (no global state)
// ---------------------------------------------------------------------------

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
    undefined
  );
}

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
let loadedBinPath: string;

export async function loadAllMaps(xdfPath: string, binPath: string): Promise<void> {
    loadedBinPath = binPath;
    buffer = fs.readFileSync(binPath);
    reader = new BinaryReader(buffer);
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

export function readMap(mapName: string, engineering: boolean, json?: boolean) {
    const map = findMap(mapName);
    const rawData = readMapData(map, false);
    const engData = readMapData(map, true);

    if (json) {
        const output = {
            mapName: map.name,
            address: map.address,
            rows: map.rows,
            cols: map.cols,
            elementSizeBits: map.elementSizeBits,
            equation: map.mathEquation,
            raw: rawData,
            engineering: engData,
        };
        console.log(JSON.stringify(output, null, 2));
        return;
    }

    console.log(`\nMap: ${map.name}  (${map.rows}x${map.cols}, ${map.elementSizeBits}-bit)  Equation: ${map.mathEquation}`);
    if (engineering) {
        console.log('Engineering values:');
        printTable(engData);
    } else {
        console.log('Raw values:');
        printTable(rawData);
        console.log('\nEngineering values:');
        printTable(engData);
    }
}

export function editMap(mapName: string, row: number, col: number, rawValue: number, ecu?: string) {
    const map = findMap(mapName);
    if (!buffer) throw new Error('Binary not loaded');
    if (row < 0 || row >= map.rows || col < 0 || col >= map.cols) {
        throw new Error(`Cell [${row}][${col}] is out of range for a ${map.rows}x${map.cols} map.`);
    }

    const cellSizeBytes = map.elementSizeBits / 8;
    const offset = map.address + (row * map.cols + col) * cellSizeBytes;
    let oldRawValue: number;
    if (map.elementSizeBits === 8) {
        oldRawValue = buffer.readUInt8(offset);
    } else if (map.elementSizeBits === 16) {
        oldRawValue = buffer.readUInt16LE(offset);
    } else if (map.elementSizeBits === 32) {
        oldRawValue = buffer.readUInt32LE(offset);
    } else {
        throw new Error(`Unsupported element size: ${map.elementSizeBits}`);
    }

    writeMapCell(buffer, map, row, col, rawValue);

    const outPath = loadedBinPath + '.modified';
    fs.writeFileSync(outPath, buffer);
    console.log(`Wrote ${rawValue} to ${map.name}[${row}][${col}]. Saved: ${outPath}`);

    let checksumStatus: EditLogEntry['checksumStatus'] = 'skipped';
    if (ecu) {
        try {
            console.log('Applying automatic checksum correction...');
            const plugin = getPlugin(ecu);
            fixChecksum(outPath, plugin);
            checksumStatus = 'corrected';
        } catch (err) {
            console.error('Checksum correction failed. Do not flash!', err);
            checksumStatus = 'failed';
        }
    }

    recordEditLog(loadedBinPath, {
        mapName: map.name,
        address: map.address,
        row,
        col,
        oldRawValue,
        newRawValue: rawValue,
        timestamp: new Date().toISOString(),
        checksumStatus,
    });
}

export function revertEdit(mapName: string, entryIndex?: number, ecu?: string) {
    if (!buffer) throw new Error('Binary not loaded');

    const map = findMap(mapName);
    const logPath = loadedBinPath + '.edit-log.json';
    if (!fs.existsSync(logPath)) {
        throw new Error(`No edit log found at ${logPath}. Nothing to revert.`);
    }

    const log: EditLogEntry[] = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    const mapLogs = log
        .map((entry, idx) => ({ entry, idx }))
        .filter(({ entry }) => entry.mapName === map.name);

    if (mapLogs.length === 0) {
        throw new Error(`No edits found for map "${map.name}".`);
    }

    let targetIdx: number;
    if (entryIndex !== undefined) {
        if (entryIndex < 0 || entryIndex >= log.length) {
            throw new Error(`Entry index ${entryIndex} is out of range (0-${log.length - 1}).`);
        }
        targetIdx = entryIndex;
    } else {
        targetIdx = mapLogs[mapLogs.length - 1].idx;
    }

    const targetEntry = log[targetIdx];
    if (targetEntry.mapName !== map.name) {
        throw new Error(`Entry at index ${targetIdx} belongs to map "${targetEntry.mapName}", not "${map.name}".`);
    }

    const row = targetEntry.row;
    const col = targetEntry.col;
    const oldValue = targetEntry.oldRawValue;

    writeMapCell(buffer, map, row, col, oldValue);

    const outPath = loadedBinPath + '.modified';
    fs.writeFileSync(outPath, buffer);
    console.log(`Reverted ${map.name}[${row}][${col}] to ${oldValue} (was ${targetEntry.newRawValue}). Saved: ${outPath}`);

    let checksumStatus: EditLogEntry['checksumStatus'] = 'skipped';
    if (ecu) {
        try {
            console.log('Applying automatic checksum correction...');
            const plugin = getPlugin(ecu);
            fixChecksum(outPath, plugin);
            checksumStatus = 'corrected';
        } catch (err) {
            console.error('Checksum correction failed. Do not flash!', err);
            checksumStatus = 'failed';
        }
    }

    recordEditLog(loadedBinPath, {
        mapName: targetEntry.mapName,
        address: targetEntry.address,
        row,
        col,
        oldRawValue: targetEntry.newRawValue,
        newRawValue: targetEntry.oldRawValue,
        timestamp: new Date().toISOString(),
        checksumStatus,
    });
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

function printTable(data: number[][]) {
    if (data.length === 0) return;
    const flat: number[] = [];
    for (const row of data) for (const val of row) flat.push(val);
    const min = Math.min(...flat);
    const max = Math.max(...flat);
    const range = max - min || 1;

    const colCount = data[0].length;
    console.log('     ' + Array.from({ length: colCount }, (_, i) => i.toString().padStart(6)).join(''));
    console.log('     ' + '-'.repeat(colCount * 6));

    for (let r = 0; r < data.length; r++) {
        const rowLabel = r.toString().padStart(3) + ' |';
        let rowStr = rowLabel;
        for (let c = 0; c < data[r].length; c++) {
            const val = data[r][c];
            const ratio = (val - min) / range;
            let colorFn: chalk.Chalk;
            if (ratio < 0.25) colorFn = chalk.blue;
            else if (ratio < 0.5) colorFn = chalk.cyan;
            else if (ratio < 0.75) colorFn = chalk.yellow;
            else colorFn = chalk.red;
            rowStr += colorFn(val.toString().padStart(6));
        }
        console.log(rowStr);
    }
    console.log('');
}