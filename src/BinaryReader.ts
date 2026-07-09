import * as fs from 'fs';
import { evaluateMath } from './mathEvaluator';

export class BinaryReader {
    private buffer: Buffer;

    constructor(source: string | Buffer) {
        // Accept a file path or an already-loaded Buffer (shared with an editor)
        this.buffer = typeof source === 'string' ? fs.readFileSync(source) : source;
        console.error(`Loaded ${this.buffer.length} bytes into memory.`);
    }

    // Read a 16-bit value (Little Endian) - Standard for most ECUs
    readU16(address: number): number {
        if (address < 0 || address + 2 > this.buffer.length) {
            throw new Error(`Address 0x${address.toString(16)} is out of bounds.`);
        }
        return this.buffer.readUInt16LE(address);
    }

    private readCell(offset: number, elementSizeBits: number): number {
        if (offset < 0 || offset + elementSizeBits / 8 > this.buffer.length) {
            throw new Error(`Offset 0x${offset.toString(16)} is out of bounds for ${elementSizeBits}-bit read.`);
        }

        if (elementSizeBits === 8) {
            return this.buffer.readUInt8(offset);
        } else if (elementSizeBits === 16) {
            return this.buffer.readUInt16LE(offset);
        } else if (elementSizeBits === 32) {
            return this.buffer.readUInt32LE(offset);
        }

        throw new Error(`Unsupported element size: ${elementSizeBits}`);
    }

    private convertSigned(raw: number, elementSizeBits: number, outputType?: string): number {
        if (!outputType) return raw;

        const signedTypes: Record<string, number> = {
            '3': 8,
            '4': 16,
            '5': 32
        };
        const bits = signedTypes[outputType];
        if (!bits || bits !== elementSizeBits) {
            return raw;
        }

        const maxUnsigned = elementSizeBits === 32 ? 0xffffffff : (1 << elementSizeBits) - 1;
        const half = elementSizeBits === 32 ? 0x80000000 : 1 << (elementSizeBits - 1);
        if (raw > half - 1) {
            return raw - (maxUnsigned + 1);
        }
        return raw;
    }

    // Read raw bytes from the buffer (helper for debugging)
    readBytes(offset: number, length: number): number[] {
        const out: number[] = [];
        for (let i = 0; i < length; i++) {
            const idx = offset + i;
            if (idx < 0 || idx >= this.buffer.length) break;
            out.push(this.buffer.readUInt8(idx));
        }
        return out;
    }

    readBlock(address: number, rows: number, cols: number, elementSizeBits: number, outputType?: string, equation?: string): number[][] {
        // Defensive default: if elementSizeBits is missing or invalid, default to 16
        elementSizeBits = (typeof elementSizeBits === 'number' && !isNaN(elementSizeBits)) ? elementSizeBits : 16;
        const cellSizeBytes = Math.floor(elementSizeBits / 8);
        const rowStride = cols * cellSizeBytes;
        const blockSize = rows * rowStride;

        if (address < 0 || address + blockSize > this.buffer.length) {
            throw new Error(`Block at 0x${address.toString(16)} is out of bounds.`);
        }

        const grid: number[][] = [];

        for (let r = 0; r < rows; r++) {
            const rowData: number[] = [];
            for (let c = 0; c < cols; c++) {
                const offset = address + r * rowStride + c * cellSizeBytes;
                const raw = this.readCell(offset, elementSizeBits);
                const signed = this.convertSigned(raw, elementSizeBits, outputType);
                const eng = evaluateMath(signed, equation);
                rowData.push(eng);
            }
            grid.push(rowData);
        }
        return grid;
    }
}