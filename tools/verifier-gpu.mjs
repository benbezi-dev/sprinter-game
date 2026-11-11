// node --experimental-strip-types tools/verifier-gpu.mjs — le tri des puces graphiques (course-3d/gpu.ts)
import assert from 'node:assert';
import { gpuHautDeGamme as h } from '../src/game/course-3d/gpu.ts';
for (const [gpu, mem, attendu] of [
  ['Adreno (TM) 750', 8, true], ['Adreno (TM) 750', undefined, true], ['Adreno (TM) 750', 4, false],
  ['Adreno (TM) 730', 8, true], ['Adreno (TM) 660', 8, false], ['Adreno (TM) 619', 8, false],
  ['Mali-G715-Immortalis MC11', 8, true], ['Mali-G710 MC10', 8, true], ['Mali-G610 MC6', 8, false],
  ['Mali-G78 MP14', 8, false], ['Mali-G57 MC2', 8, false],
  ['ANGLE (Samsung Xclipse 940) on Vulkan 1.3', 8, true], ['Apple GPU', undefined, false], ['', undefined, false],
  ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', 8, false],
]) assert.strictEqual(h(gpu, mem), attendu, `${gpu} / ${mem}`);
console.log('gpu : 15 cas justes');
