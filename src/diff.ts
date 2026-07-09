// Core diff logic: compare two ECU binaries map-by-map using the XDF definitions.
import * as path from 'path';
import { XdfLoader } from './XdfLoader';
import { BinaryReader } from './BinaryReader';

const DEFAULT_XDF = path.join(__dirname, '..', 'data', 'Siemens_MS43_430069_512K.xdf');

// Type for a single cell change
export interface CellDiff {
    row: number;
    col: number;
    rawBefore: number;
    rawAfter: number;
    engBefore: number;
    engAfter: number;
}

// Type for a map diff
export interface MapDiff {
    title: string;
    address: string; // hex, e.g. "0x791E9"
    rows: number;
    cols: number;
    equation: string;
    changes: CellDiff[];
}

// Load the XDF once and return the parsed map objects
// (name, address, rows, cols, elementSizeBits, outputType, mathEquation)
async function loadMaps(xdfPath: string = DEFAULT_XDF): Promise<any[]> {
    return new XdfLoader().loadXdf(xdfPath);
}

export async function diffBins(
    file1: string,
    file2: string,
    filter?: string,
    json?: boolean,
    xdfPath?: string
): Promise<MapDiff[]> {
    const maps = await loadMaps(xdfPath);

    // BinaryReader loads the file into memory when given a path
    const reader1 = new BinaryReader(file1);
    const reader2 = new BinaryReader(file2);

    const diffs: MapDiff[] = [];
    let compared = 0;
    let skipped = 0;

    for (const map of maps) {
        if (filter && !map.name.toLowerCase().includes(filter.toLowerCase())) continue;

        const changes = diffMap(map, reader1, reader2);
        if (changes === null) {
            skipped++; // map lies outside the bounds of one of the files
            continue;
        }
        compared++;
        if (changes.length > 0) {
            diffs.push({
                title: map.name,
                address: `0x${map.address.toString(16).toUpperCase()}`,
                rows: map.rows,
                cols: map.cols,
                equation: map.mathEquation,
                changes,
            });
        }
    }

    if (json) {
        console.log(JSON.stringify(diffs, null, 2));
    } else {
        printDiffs(diffs, compared, skipped);
    }
    return diffs;
}

// Compare one map cell-by-cell. Returns null if the map is out of bounds.
// readBlock returns the full 2D grid; with the equation passed it applies
// signed conversion + math per cell, without it we get the raw values.
function diffMap(map: any, reader1: BinaryReader, reader2: BinaryReader): CellDiff[] | null {
    let raw1: number[][], raw2: number[][], eng1: number[][], eng2: number[][];
    try {
        raw1 = reader1.readBlock(map.address, map.rows, map.cols, map.elementSizeBits, map.outputType, undefined);
        raw2 = reader2.readBlock(map.address, map.rows, map.cols, map.elementSizeBits, map.outputType, undefined);
        eng1 = reader1.readBlock(map.address, map.rows, map.cols, map.elementSizeBits, map.outputType, map.mathEquation);
        eng2 = reader2.readBlock(map.address, map.rows, map.cols, map.elementSizeBits, map.outputType, map.mathEquation);
    } catch {
        return null;
    }

    const changes: CellDiff[] = [];
    for (let r = 0; r < map.rows; r++) {
        for (let c = 0; c < map.cols; c++) {
            if (raw1[r][c] !== raw2[r][c]) {
                changes.push({
                    row: r,
                    col: c,
                    rawBefore: raw1[r][c],
                    rawAfter: raw2[r][c],
                    engBefore: eng1[r][c],
                    engAfter: eng2[r][c],
                });
            }
        }
    }
    return changes;
}

function printDiffs(diffs: MapDiff[], compared: number, skipped: number): void {
    if (diffs.length === 0) {
        console.log('No differences found.'
            + ` (${compared} maps compared${skipped ? `, ${skipped} skipped as out of bounds` : ''})`);
        return;
    }

    let totalCells = 0;
    for (const mapDiff of diffs) {
        totalCells += mapDiff.changes.length;
    }

    console.log(`${diffs.length} of ${compared} map(s) changed, ${totalCells} cell(s) modified.`
        + (skipped ? ` ${skipped} map(s) skipped (out of bounds).` : '') + '\n');

    for (const mapDiff of diffs) {
        console.log(`Map: ${mapDiff.title}  @ ${mapDiff.address}  (${mapDiff.rows}x${mapDiff.cols})  [${mapDiff.equation}]`);
        for (const cell of mapDiff.changes) {
            console.log(`  [${cell.row},${cell.col}]: ${cell.engBefore.toFixed(4)} → ${cell.engAfter.toFixed(4)}`
                + `  (raw ${cell.rawBefore} → ${cell.rawAfter})`);
        }
        console.log('');
    }
}
