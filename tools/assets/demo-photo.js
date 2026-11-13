// OUTIL DE CONTROLE LOCAL (non suivi par git) : gros plans dans le jeu, via window.__vue / __cam / __corps
window.cadrer = (lane, os, l) => { let d = null; for (const [r, c] of window.__corps) if (r.lane === lane) d = c; if (!d) return;
  const b = d.m.os.get(os), v = b.getWorldPosition(b.position.clone()), cam = window.__cam; cam.clearViewOffset(); cam.updateMatrixWorld(); v.project(cam);
  window.__vue = [(v.x + 1) / 2 - l / 2, (1 - v.y) / 2 - l / 2, l, l]; };
clearInterval(window.__int); window.__int = setInterval(() => { try { const s = window.__s; if (s) window.cadrer(s.lane, s.os, s.l); } catch (e) {} }, 30);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// etat : 'count' (debout sur la ligne) ou 'race' ; ms : attente apres l'entree dans cet etat
window.photo = async (lane, os, l, ms, etat) => { window.__s = { lane, os, l }; const A = window.SprinterApp; A.G.state = 'title'; A.startOneShot(['100'], { levelIdx: 4 });
  const t0 = Date.now(); while (A.G.state !== (etat || 'count') && Date.now() - t0 < 30000) await dormir(30);
  document.querySelectorAll('body *').forEach((e) => { if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden'; });
  await dormir(ms || 250); return [A.G.state, innerWidth, innerHeight]; };
window.pret = async () => { const A = window.SprinterApp; A.G.state = 'title'; A.startOneShot(['100'], { levelIdx: 4 }); const t0 = Date.now();
  while (!(window.__corps && window.__corps.size >= 8) && Date.now() - t0 < 30000) await dormir(200); await dormir(12000); return window.__corps && window.__corps.size; };
window.ips = async (ms) => { let n = 0; const t = performance.now(); await new Promise((r) => { const f = () => { n++; performance.now() - t < ms ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }); return Math.round(n * 1000 / ms); };
// camera posee devant (ou derriere, sens = -1) un coureur, a `dist` metres
window.face = (lane, dist, sens, haut) => { clearInterval(window.__intF); window.__s = null; window.__vue = null; window.__cam && window.__cam.clearViewOffset();
  window.__intF = setInterval(() => { let d = null; for (const [r, c] of window.__corps) if (r.lane === lane) d = c; if (!d) return;
    const b = d.m.os.get('spine_02'), p = b.getWorldPosition(b.position.clone()), m = d.m.racine.matrixWorld.elements;
    // (le monde du jeu a z vers le haut : avant et haut sont lus dans la matrice du coureur)
    const k = (sens || 1) * dist / (Math.hypot(m[0], m[1], m[2]) || 1), h = (haut || 0.1) / (Math.hypot(m[4], m[5], m[6]) || 1);
    const o = p.clone().set(p.x + m[0] * k + m[4] * h, p.y + m[1] * k + m[5] * h, p.z + m[2] * k + m[6] * h), cam = window.__cam;
    if (cam.parent) cam.parent.worldToLocal(o);   // (position locale au parent de la camera ; lookAt prend le monde)
    window.__camFace = [o.x, o.y, o.z, p.x, p.y, p.z]; }, 30); };
window.libre = () => { clearInterval(window.__intF); window.__camFace = null; };
