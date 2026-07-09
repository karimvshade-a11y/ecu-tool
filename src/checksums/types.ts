// src/checksums/types.ts

export interface ChecksumDefinition {
    name: string;
    address: number;
    range: [number, number];
    algorithm: 'CRC16_XMODEM' | 'CRC16_CCITT' | string;
}

export interface ChecksumPlugin {
    /** Human-readable name for this ECU */
    name: string;
    /** True once the algorithm has been verified against a known-good tool. */
    validated: boolean;
    /** Given the full binary buffer, return an array of patches to apply. */
    correct(buffer: Buffer): Patch[];
}

export interface Patch {
    offset: number;
    value: number;         // the computed checksum (raw value)
    size: number;          // 2 for 16-bit, 4 for 32-bit
    endian?: 'LE' | 'BE';  // byte order to write in (default LE)
    label?: string;        // optional description
}