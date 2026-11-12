// Writes the web game's level data as JSON for the native app (native/data/levels.json), so both builds share
// one source of truth: src/data/levels.js (itself generated from specs.js by tools/gen.mjs).
import { writeFileSync } from 'node:fs';
import { LEVELS } from '../src/data/levels.js';
const out = new URL('../native/data/levels.json', import.meta.url);
writeFileSync(out, JSON.stringify(LEVELS, null, 1));
console.log(`wrote ${LEVELS.length} levels to native/data/levels.json`);
