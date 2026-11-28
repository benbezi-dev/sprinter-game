// Horloge virtuelle : rien n'avance sans window.__pas(dt). Installée avant le jeu, inactive tant que __virtuel(true) n'est pas appelé.
(() => {
  const rN = performance.now.bind(performance), rD = Date.now, RD = Date;
  const rRAF = window.requestAnimationFrame.bind(window), rCAF = window.cancelAnimationFrame.bind(window);
  const rST = window.setTimeout.bind(window), rCT = window.clearTimeout.bind(window);
  const rSI = window.setInterval.bind(window), rCI = window.clearInterval.bind(window);
  let virt = false, t = 0, dBase = 0;
  const rafs = new Map(); let rid = 1;
  const minut = new Map(); let mid = 1e7;
  performance.now = () => (virt ? t : rN());
  const maintenant = () => (virt ? dBase + t : rD());
  class FDate extends RD { constructor(...a) { if (a.length === 0) super(maintenant()); else super(...a); } }
  FDate.now = maintenant; window.Date = FDate;
  window.requestAnimationFrame = cb => { if (!virt) return rRAF(cb); const id = rid++; rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = id => { if (rafs.has(id)) rafs.delete(id); else rCAF(id); };
  window.setTimeout = (cb, ms = 0, ...a) => { if (!virt || typeof cb !== 'function') return rST(cb, ms, ...a); const id = mid++; minut.set(id, { at: t + Math.max(0, +ms || 0), cb, a }); return id; };
  window.clearTimeout = id => { if (minut.has(id)) minut.delete(id); else rCT(id); };
  window.setInterval = (cb, ms = 0, ...a) => { if (!virt || typeof cb !== 'function') return rSI(cb, ms, ...a); const id = mid++; const p = Math.max(1, +ms || 1); minut.set(id, { at: t + p, cb, a, p }); return id; };
  window.clearInterval = id => { if (minut.has(id)) minut.delete(id); else rCI(id); };
  window.__virtuel = () => { if (virt) return; dBase = rD() - rN(); t = rN(); virt = true; };
  window.__pas = (dt) => new Promise(res => {
    const fin = t + dt * 1000;
    for (let garde = 0; garde < 5000; garde++) {
      let pro = null;
      for (const [id, m] of minut) if (m.at <= fin && (!pro || m.at < pro[1].at)) pro = [id, m];
      if (!pro) break;
      const [id, m] = pro; t = Math.max(t, m.at);
      if (m.p) m.at += m.p; else minut.delete(id);
      try { m.cb(...m.a); } catch (e) { console.error(e); }
    }
    t = fin;
    const lot = [...rafs]; rafs.clear();
    for (const [, cb] of lot) { try { cb(t); } catch (e) { console.error(e); } }
    // laisser React valider (MessageChannel) avant la capture
    const mc = new MessageChannel(); mc.port1.onmessage = () => rST(res, 0); mc.port2.postMessage(0);
  });
  window.__t = () => t;
})();
