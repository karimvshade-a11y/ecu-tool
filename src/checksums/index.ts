// src/checksums/index.ts
import { ms43Plugin } from './ms43';

// 1. Export types (so src/checksum.ts can see them)
export * from './types';

// 2. Export the plugin instance
export { ms43Plugin };

// 3. Helper to get the plugin
export function getPlugin(name: string) {
    if (name === 'ms43') return ms43Plugin;
    throw new Error(`Plugin ${name} not found`);
}