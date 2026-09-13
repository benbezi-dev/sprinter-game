// Un pilote Chrome minimal, en CDP brut. Node 22 a WebSocket, Chrome a un port
// de debogage : il n'y a rien d'autre a installer.
import { writeFileSync } from 'node:fs';

export async function connecter(port = 9222) {
  let cible;
  for (let i = 0; i < 40 && !cible; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      cible = (await r.json()).find((t) => t.type === 'page');
    } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!cible) throw new Error('aucune page de debogage');
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });

  let id = 0;
  const attente = new Map();
  const ecoutes = new Map();   // methode -> [rappels]
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && attente.has(m.id)) {
      const { ok, ko } = attente.get(m.id); attente.delete(m.id);
      m.error ? ko(new Error(JSON.stringify(m.error))) : ok(m.result);
    } else if (m.method && ecoutes.has(m.method)) {
      for (const f of ecoutes.get(m.method)) f(m.params);
    }
  };
  const envoyer = (method, params = {}) => new Promise((ok, ko) => {
    const n = ++id; attente.set(n, { ok, ko });
    ws.send(JSON.stringify({ id: n, method, params }));
    setTimeout(() => { if (attente.has(n)) { attente.delete(n); ko(new Error('delai ' + method)); } }, 30000);
  });

  const api = {
    envoyer,
    /** S'abonner a un evenement du protocole (Page.screencastFrame, etc.). */
    sur(methode, rappel) {
      if (!ecoutes.has(methode)) ecoutes.set(methode, []);
      ecoutes.get(methode).push(rappel);
    },
    fermer: () => ws.close(),
    async aller(url) {
      await envoyer('Page.enable');
      await envoyer('Page.navigate', { url });
      await new Promise((r) => setTimeout(r, 2500));
    },
    async js(expression) {
      const r = await envoyer('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      return r.result?.value;
    },
    async photo(chemin) {
      const r = await envoyer('Page.captureScreenshot', { format: 'png' });
      if (chemin) writeFileSync(chemin, Buffer.from(r.data, 'base64'));
      return r.data;
    },
    // Un vrai appui : le jeu ecoute pointerdown/up, pas un click synthetique.
    async toucher(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await envoyer('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      }
    },
  };
  return api;
}

/** Le viewport d'un telephone, rendu en 1080 x 1920 reels. */
export async function ecranTelephone(p, l = 432, h = 768, dsf = 2.5) {
  await p.envoyer('Emulation.setDeviceMetricsOverride',
    { width: l, height: h, deviceScaleFactor: dsf, mobile: true });
  await p.envoyer('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}

/** Un vrai appui du doigt : c'est ce que le jeu ecoute. */
export async function doigt(p, x, y) {
  await p.envoyer('Input.dispatchTouchEvent',
    { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await p.envoyer('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
