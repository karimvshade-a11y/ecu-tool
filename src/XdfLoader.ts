// src/XdfLoader.ts
import * as fs from 'fs';
import * as xml2js from 'xml2js';

export class XdfLoader {
    async loadXdf(filePath: string, verbose = false): Promise<any[]> {
        const xml = fs.readFileSync(filePath, 'utf8');
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xml);

        const tables = result.XDFFORMAT.XDFTABLE;

        if (verbose) {
            // DEBUG: Print the first table to the console to inspect its structure
            console.log("--- INSPECTING FIRST TABLE STRUCTURE ---");
            console.log(JSON.stringify(tables[0], null, 2));
            console.log("----------------------------------------");
        }

        const baseOffset = parseInt(result.XDFFORMAT.XDFHEADER[0].BASEOFFSET[0].$.offset, 16);

        return tables
            .filter((t: any) => t.XDFAXIS)
            .map((t: any) => {
                // The table data lives on the z-axis; only fall back to another
                // axis's address if the z-axis has none (rare, malformed tables)
                const zAxis = t.XDFAXIS.find((a: any) => a.$.id === 'z');
                const hasAddress = (axis: any) => axis?.EMBEDDEDDATA?.[0]?.$?.mmedaddress;
                const dataAxis = hasAddress(zAxis) ? zAxis : t.XDFAXIS.find(hasAddress);
                const address = dataAxis ? parseInt(dataAxis.EMBEDDEDDATA[0].$.mmedaddress, 16) : NaN;
                const embed = zAxis?.EMBEDDEDDATA?.[0]?.$;
                const elemBits = embed?.mmedelementsizebits
                    ? parseInt(embed.mmedelementsizebits, 10)
                    : 16; // default to 16-bit
                if (verbose) {
                    // Debug: show map title/address and element size in bits
                    console.log(`[DEBUG] Map: ${t.title ? t.title[0] : 'Unknown'}  Address: 0x${(isNaN(address) ? 0 : address + baseOffset).toString(16)}  elemBits: ${elemBits}`);
                }
                const outputType = zAxis?.outputtype?.[0];

                // The conversion equation lives on the z-axis MATH element,
                // not at the table root (fall back to table-level MATH just in case)
                const equation = zAxis?.MATH?.[0]?.$?.equation
                    || t.MATH?.[0]?.$?.equation
                    || 'X';

                return {
                    name: t.title ? t.title[0] : "Unnamed",
                    address: isNaN(address) ? NaN : address + baseOffset,
                    rows: parseInt(t.XDFAXIS.find((a: any) => a.$.id === 'y')?.indexcount?.[0] || "1"),
                    cols: parseInt(t.XDFAXIS.find((a: any) => a.$.id === 'x')?.indexcount?.[0] || "1"),
                    equation,
                    mathEquation: equation,
                    elementSizeBits: elemBits,
                    outputType,
                    raw: t
                };
            })
            .filter((map: any) => !isNaN(map.address));
    }
}