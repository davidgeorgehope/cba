#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load .env from cwd, then from ~/.cba/.env as fallback
config();
config({ path: resolve(process.env['HOME'] ?? '', '.cba', '.env') });

import { createProgram } from './program.js';

const program = createProgram();
program.parse(process.argv);
