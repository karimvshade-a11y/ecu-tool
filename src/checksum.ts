// Checksum runner: applies a plugin's patches to a binary and writes a .fixed copy.
import * as fs from 'fs';
import { ChecksumPlugin, Patch } from './checksums';

export function fixChecksum(file: string, plugin: ChecksumPlugin): string {
    const buffer = fs.readFileSync(file);

    if (!plugin.validated) {
        console.warn('*** WARNING: checksum plugin "' + plugin.name + '" is UNVALIDATED.');
        console.warn('*** The output has NOT been verified against a trusted tool. DO NOT FLASH. ***');
    }

    const patches = plugin.correct(buffer);
    warnOnOverlaps(patches);

    for (const p of patches) {
        applyPatch(buffer, p);
        const hex = p.value.toString(16).toUpperCase().padStart(p.size * 2, '0');
        console.log(`Patched ${p.label || 'checksum'} @ 0x${p.offset.toString(16).toUpperCase()} = 0x${hex} (${p.endian || 'LE'})`);
    }

    const outPath = file + '.fixed';
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved: ${outPath}`);
    return outPath;
}

/**
 * Validate checksums without modifying the file.
 * Returns true if all checksums are already correct.
 */
export function validateChecksum(file: string, plugin: ChecksumPlugin): boolean {
    const buffer = fs.readFileSync(file);

    if (!plugin.validated) {
        console.warn('*** WARNING: checksum plugin "' + plugin.name + '" is UNVALIDATED. Results may not be trustworthy.');
    }

    const patches = plugin.correct(buffer);
    let allValid = true;

    for (const p of patches) {
        const stored = p.size === 2
            ? buffer.readUInt16LE(p.offset)
            : buffer.readUInt32LE(p.offset);
        const ok = stored === (p.value & ((1 << (p.size * 8)) - 1));
        const label = p.label || ('0x' + p.offset.toString(16));
        const storedHex = stored.toString(16).toUpperCase().padStart(p.size * 2, '0');
        const computedHex = p.value.toString(16).toUpperCase().padStart(p.size * 2, '0');
        console.log(`${label}: stored=0x${storedHex} computed=0x${computedHex} ${ok ? 'OK' : 'MISMATCH'}`);
        if (!ok) allValid = false;
    }

    if (allValid) {
        console.log('All checksums are correct.');
    } else {
        console.log('Checksums need correction. Run "checksum" to fix.');
    }
    return allValid;
}

function applyPatch(buffer: Buffer, p: Patch): void {
    if (p.offset < 0 || p.offset + p.size > buffer.length) {
        throw new Error(`Patch "${p.label || '?'}" at 0x${p.offset.toString(16)} (${p.size} bytes) is out of bounds.`);
    }
    if (p.size === 2) {
        if (p.endian === 'BE') buffer.writeUInt16BE(p.value & 0xffff, p.offset);
        else buffer.writeUInt16LE(p.value & 0xffff, p.offset);
    } else if (p.size === 4) {
        if (p.endian === 'BE') buffer.writeUInt32BE(p.value >>> 0, p.offset);
        else buffer.writeUInt32LE(p.value >>> 0, p.offset);
    } else {
        throw new Error(`Unsupported patch size: ${p.size} bytes.`);
    }
}

// Two checksum fields can never share bytes; overlapping patches mean the
// plugin's discovered offsets are wrong and later writes clobber earlier ones.
function warnOnOverlaps(patches: Patch[]): void {
    for (let i = 0; i < patches.length; i++) {
        for (let j = i + 1; j < patches.length; j++) {
            const a = patches[i];
            const b = patches[j];
            if (a.offset < b.offset + b.size && b.offset < a.offset + a.size) {
                console.warn(`*** WARNING: patches "${a.label || i}" and "${b.label || j}" overlap `
                    + `(0x${a.offset.toString(16)}+${a.size} vs 0x${b.offset.toString(16)}+${b.size}) — `
                    + `the later write clobbers the earlier one. The plugin definition is suspect.`);
            }
        }
    }
}
