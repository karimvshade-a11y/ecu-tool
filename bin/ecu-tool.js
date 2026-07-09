#!/usr/bin/env node
// Launcher: registers the project's local ts-node, then runs the TypeScript CLI.
// This lets `npm link` / `npm i -g` work without a global ts-node install.
require('ts-node').register({ transpileOnly: true });
require('../src/cli.ts');
