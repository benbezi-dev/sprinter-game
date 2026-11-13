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
