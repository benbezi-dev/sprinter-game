// Playwright : celui du projet s'il existe, sinon celui installe globalement (machine de tournage).
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { pw = req(p); break; } catch {} }
if (!pw) throw new Error('playwright introuvable : npm i -D playwright');
export const { chromium } = pw;
