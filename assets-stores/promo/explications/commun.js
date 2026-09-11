/* ===========================================================================
   Le moteur commun des films d'explication.

   Meme principe que source-video/video.html : TOUT est pilote par le temps,
   aucune animation CSS. `window.renderFrame(t)` pose l'image de l'instant t,
   et deux appels avec le meme t donnent exactement la meme image. C'est ce qui
   rend un rendu reproductible — et ce qui permet d'extraire une photo a la
   milliseconde pres sans rejouer le film.

   Un film decrit sa timeline et ses plans, puis appelle monterFilm().
   =========================================================================== */

const q = s => document.querySelector(s);
const qa = s => [...document.querySelectorAll(s)];
const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
/** La part parcourue entre a et b, bornee a [0,1]. */
const sg = (t, a, b) => cl((t - a) / (b - a));

const E = {
  oc: t => 1 - Math.pow(1 - t, 3),
  oq: t => 1 - Math.pow(1 - t, 5),
  io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  ob: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  el: t => t <= 0 ? 0 : t >= 1 ? 1
        : Math.pow(2, -11 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1,
};

function T(el, { x = 0, y = 0, s = 1, r = 0, o = 1, b = 0 } = {}) {
  if (!el) return;
  el.style.opacity = o;
  el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${s.toFixed(4)}) rotate(${r.toFixed(2)}deg)`;
  el.style.filter = b ? `blur(${b.toFixed(2)}px)` : 'none';
}

/** Entree puis sortie standard : monte, se pose, repart en fondu. */
function io(el, t, i0, i1, o0 = 99, o1 = 99, dy = 70, sc = 1) {
  if (!el) return;
  const pi = E.oc(sg(t, i0, i1)), po = E.io(sg(t, o0, o1));
  T(el, { y: dy * (1 - pi) - 46 * po, s: (sc + (1 - sc) * pi) * (1 - .07 * po), o: pi * (1 - po), b: 10 * (1 - pi) });
}

/** La sortie de bloc : le contenu s'eloigne et se floute en fin de plan. */
function midOut(id, p) {
  const m = q('#' + id + ' .mid');
  if (!m) return;
  m.style.transform = `translateY(-50%) scale(${(1 + .10 * p).toFixed(4)})`;
  m.style.opacity = (1 - p).toFixed(3);
  m.style.filter = p > 0.001 ? `blur(${(16 * p).toFixed(1)}px)` : 'none';
}

/** Une liste qui se depose ligne a ligne, du bas vers sa place. */
function cascade(sel, l, depart, pas = .13, duree = .55, dx = 0, dy = 54) {
  qa(sel).forEach((el, i) => {
    const a = depart + i * pas, e = E.ob(sg(l, a, a + duree));
    T(el, { x: dx * (1 - e), y: dy * (1 - e), o: sg(l, a, a + duree * .45), s: .95 + .05 * e });
  });
}

const mover = (el, x) => { el.style.transform = `translate(${x.toFixed(1)}px,-50%)`; };

/** Construit n couloirs peuples de coureurs nommes. */
function lanes(host, n, names, color, avecLigne = true) {
  host.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'lane';
    d.innerHTML = `<span class="ln">${i + 1}</span>
      <div class="mover"><svg class="runner" style="fill:${color}"><use href="#run"/></svg>
      <span class="tag">${names[i]}</span></div>`;
    host.appendChild(d);
  }
  if (avecLigne) {
    const f = document.createElement('div');
    f.className = 'finline'; f.style.right = '26px';
    host.appendChild(f);
  }
}

/** Un chrono au format du jeu : 10"42. */
const chrono = ms => (ms / 1000).toFixed(2).replace('.', '"');

/* --------------------------------------------------------------- le montage */

/**
 * Monte un film et installe window.renderFrame.
 *
 * cfg = {
 *   duree, accent, etiquette,
 *   scenes    : { cle: [idDeLaSection, debut, fin] },
 *   anim      : { cle: (l, d) => void }   // l : temps local, d : duree du plan
 *   chapitres : [[debut, fin], ...]       // la barre de progression, facultatif
 *   cuts      : [t, ...]                  // les volets de transition
 *   flashes   : [{ t, force, secousse }]  // eclairs et secousses de camera
 * }
 */
function monterFilm(cfg) {
  const S = cfg.scenes, CH = cfg.chapitres || [], CUTS = cfg.cuts || [], FL = cfg.flashes || [];
  const cles = Object.keys(S);
  document.documentElement.style.setProperty('--ac', cfg.accent || '#F8CD4A');
  if (cfg.etiquette) q('#etiq').textContent = cfg.etiquette;

  q('#streaks').innerHTML = Array.from({ length: 9 }, (_, i) =>
    `<div class="streak" style="top:${120 + i * 190}px;width:${240 + ((i * 137) % 420)}px"></div>`).join('');
  const STR = qa('.streak');
  const prog = q('#prog');
  prog.innerHTML = (CH.length ? CH : [[0, cfg.duree]])
    .map(() => '<div class="pb"><i></i></div>').join('');
  const barres = qa('#prog .pb i');

  window.renderFrame = function (t) {
    /* le fond, qui derive en permanence */
    q('#bgtrack').style.transform = `rotate(-9deg) translateY(${(-t * 26).toFixed(1)}px)`;
    q('#glow').style.transform = `translate(${(Math.sin(t * .35) * 70).toFixed(1)}px,${(Math.cos(t * .28) * 50).toFixed(1)}px)`;
    q('#glow2').style.transform = `translate(${(Math.cos(t * .31) * -80).toFixed(1)}px,${(Math.sin(t * .24) * 60).toFixed(1)}px)`;
    STR.forEach((s, i) => {
      const ph = ((t * .62 + i * .311) % 1);
      s.style.opacity = (Math.sin(ph * Math.PI) * .34).toFixed(3);
      s.style.transform = `translateX(${(-380 + ph * 1560).toFixed(0)}px)`;
    });

    /* progression et etiquette */
    const vis = sg(t, .9, 1.6) * (1 - sg(t, cfg.duree - 2.6, cfg.duree - 1.9));
    prog.style.opacity = vis.toFixed(2);
    q('#etiq').style.opacity = (vis * .9).toFixed(2);
    barres.forEach((b, i) => {
      const c = CH[i] || [0, cfg.duree];
      b.style.width = (sg(t, c[0], c[1]) * 100).toFixed(1) + '%';
    });

    /* le plan courant */
    let act = null;
    for (const k of cles) {
      const [id, a, b] = S[k];
      const el = document.getElementById(id);
      if (t >= a && t < b) { el.classList.add('on'); act = [k, t - a, b - a]; }
      else el.classList.remove('on');
    }
    if (!act) {
      const k = t < 0 ? cles[0] : cles[cles.length - 1];
      const [id, a, b] = S[k];
      document.getElementById(id).classList.add('on');
      act = [k, cl(t - a, 0, b - a), b - a];
    }
    cfg.anim[act[0]](act[1], act[2]);

    /* les volets de chapitre */
    let wy = 100;
    for (const c of CUTS) {
      if (t > c - .36 && t < c + .42) {
        wy = t < c ? 100 * (1 - E.oq(sg(t, c - .36, c))) : -100 * E.io(sg(t, c, c + .42));
      }
    }
    q('#wipe').style.transform = `translateY(${wy.toFixed(2)}%)`;

    /* eclairs et secousses */
    let fo = 0, sh = 0;
    for (const f of FL) {
      const d = f.duree || .3;
      if (t > f.t && t < f.t + d) fo = Math.max(fo, (f.force ?? .8) * (1 - sg(t, f.t, f.t + d)));
      const sd = f.secousse || 0;
      if (sd && t > f.t && t < f.t + sd) sh = Math.max(sh, 1 - sg(t, f.t, f.t + sd));
    }
    q('#flash').style.opacity = fo.toFixed(3);
    const stg = q('#stage');
    if (sh > .002) {
      const a = sh * sh * 14;
      stg.style.transform = `scale(1.022) translate(${(Math.sin(t * 103) * a).toFixed(2)}px,${(Math.cos(t * 79) * a).toFixed(2)}px)`;
    } else stg.style.transform = 'none';
  };

  window.VIDEO_DURATION = cfg.duree;
  window.PHOTOS = cfg.photos || [];
  window.renderFrame(0);
}
