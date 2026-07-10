#!/usr/bin/env ts-node
import { Command } from 'commander';
import { loadAllMaps, listMaps, readMap, editMap, exportMap, revertEdit } from './tuningTool';
import { diffBins } from './diff';

import { getPlugin } from './checksums';
import { fixChecksum, validateChecksum } from './checksum';

 

const program = new Command();

program
    .name('ecu-tool')
    .description('Professional ECU Calibration Tool – Siemens MS43')
    .version('1.0.0')
    .option('-x, --xdf <path>', 'XDF definition file (default: bundled MS43 XDF)')
    .option('-b, --bin <path>', 'ECU binary dump (default: bundled MS43 bin)');

// Load maps once before any command runs
let mapsLoaded = false;
const ensureLoaded = async () => {
    if (!mapsLoaded) {
        const opts = program.opts();
        await loadAllMaps(opts.xdf, opts.bin);
        mapsLoaded = true;
    }
};

program.command('list')
    .description('List all available maps')
    .argument('[term]', 'Filter map names containing this term')
    .option('-f, --filter <term>', 'Filter map names containing this term')
    .action(async (term, options) => {
        await ensureLoaded();
        listMaps(term || options.filter);
    });

program.command('read')
    .description('Read a map and display as a table')
    .argument('<mapName>', 'Exact map name or a substring to match one map')
    .option('-e, --engineering', 'Show engineering values only (default: raw + engineering)')
    .option('-j, --json', 'Output as JSON instead of a table')
    .action(async (mapName, options) => {
        await ensureLoaded();
        readMap(mapName, options.engineering, options.json);
    });

program.command('edit')
    .description('Edit a single cell in a map (raw value)')
    .argument('<mapName>', 'Map name')
    .argument('<row>', 'Row index (0-based)')
    .argument('<col>', 'Column index (0-based)')
    .argument('<value>', 'New raw value to write')
    .action(async (mapName, row, col, value) => {
        await ensureLoaded();
        editMap(mapName, parseInt(row), parseInt(col), parseFloat(value));
    });

 program.command('revert')
    .description('Revert a previous edit using the edit log')
    .argument('<mapName>', 'Map name to revert')
    .option('-e, --entry <index>', 'Log entry index to revert (default: last edit for this map)')
    .action(async (mapName, options) => {
        await ensureLoaded();
        revertEdit(mapName, options.entry ? parseInt(options.entry, 10) : undefined);
    });

program.command('export')
    .description('Export a map to a CSV file')
    .argument('<mapName>', 'Map name')
    .option('-o, --output <file>', 'Output CSV file path (default: <mapName>.csv)')
    .action(async (mapName, options) => {
        await ensureLoaded();
        exportMap(mapName, options.output);
    });

program.command('diff')
    .description('Compare two binary files map-by-map (engineering values)')
    .argument('<file1>', 'First binary file (e.g. stock)')
    .argument('<file2>', 'Second binary file (e.g. tuned)')
    .option('-m, --map <name>', 'Only diff maps containing this string')
    .option('-j, --json', 'Output as JSON instead of a table')
    .action(async (file1, file2, options) => {
        // diff loads the XDF itself - no need to load the default binary
        await diffBins(file1, file2, options.map, options.json, program.opts().xdf);
    });

program.command('checksum')
    .description('Recompute and patch the ECU checksum(s), writing a <file>.fixed copy')
    .argument('<file>', 'binary file to correct')
    .option('-e, --ecu <name>', 'checksum plugin to use', 'ms43')
    .action((file, options) => {
        // Checksum works on the raw binary only - no XDF/map load needed
        const plugin = getPlugin(options.ecu);
        fixChecksum(file, plugin);
    });  


    program.command('validate')
    .description('Verify checksums in a binary without modifying it')
    .argument('<file>', 'binary file to check')
    .option('-e, --ecu <name>', 'checksum plugin to use', 'ms43')
    .action((file, options) => {
        const plugin = getPlugin(options.ecu);
        const valid = validateChecksum(file, plugin);
        if (!valid) process.exitCode = 1;
    });

program.parseAsync(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
