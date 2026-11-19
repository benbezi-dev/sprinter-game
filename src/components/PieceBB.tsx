import { useId } from 'react';

/**
 * LA PIECE DU JEU, LE BENBEDOLLAR (symbole B$) : le BB barre du logo Benbezi
 * (« NEW BB », Illustrator, 29/01/2024), reduit aux deux B et a leur barre.
 * La barre du bas, les ronds Z et S et le ® du logo complet disparaissent :
 * a 16 px ils ne seraient que des points. Une seule couleur, celle du texte
 * (currentColor) pour le disque ; le BB y est grave en sombre.
 * Les traits blancs du logo d'origine deviennent des decoupes (masque).
 */
const PLEINS = [
  'M1464.7,562.6c-3.7-33.5-20.5-58.8-48.9-76.5c-9-5.6-18.6-10.4-28-15.4c-1.7-0.9-3.4-1.6-4.9-2.3 c-0.8-0.3-0.8-1.4-0.1-1.8c10.3-6.1,20.7-12,30.7-18.5c24.2-15.6,37.8-37.7,39.9-66.6c1.9-26.1-2.8-50.5-19.3-71.7 c-14.7-18.8-33.8-31.8-55.6-41.1c-37.9-16.3-78-22.2-118.7-22.6c-26.4-0.2-52.8-0.3-79.2-0.4l-62.2,85.4h140.5 c21.1,0,42,1.6,62.2,8.7c14,5,21.2,14.8,22.6,29.1c0.5,5.1,0.5,10.4-0.1,15.5c-1.8,14.3-9.7,23.7-23.6,28.5 c-19.6,6.7-39.8,8.3-60.2,8.3c-50.3,0.1-100.6,0-150.8,0c-2.6,0-4.7,0.1-4.7-3.6c0.1-22.3,0.1-44.6,0-67.2L994.5,501.3v144.8 c0,7.6-0.1,15.2,0.1,22.8c0.1,4.8-1.9,7.6-6.5,8.3c-5.4,0.9-10.9,1.6-17.2,2.6l0,0h0c0,6.9,0.2,14.3-0.1,21.6c-0.1,3.8,1.1,5,5,5 c5.3,0,10.5,0,15.8,0c11.4-0.5,23.3-1.3,35.7-2.6c36.4-4,69.1-18.7,98.1-43.8c10.8-9.4,21.2-19.7,31.1-31c-17.7,0-35.4,0-53.2,0 c-3.6,0-5.3-0.7-5.3-4.8c0.1-27.8,0.1-55.6,0.1-83.4c0-0.5,0.2-1,0.3-2l0,0h0c31.4,0,62.5,0,93.6,0c25.8,0,51.5,0,77.2,0.3 c15.6,0.2,30.8,3.1,45.6,8.3c14.2,4.9,21.5,15,22.6,29.7c0.4,5.3,0.4,10.8-0.3,16c-1.9,13.5-9.4,22.4-22.4,27.1 c-20.3,7.3-41.5,8.8-62.7,8.8c-20.6,0.1-41.3,0.1-61.9,0.1l-24.7,77.3c42.4,0,84.7,0,127.1,0c27.4,0,54.4-3.2,80.6-11.9 c20.8-6.9,40-16.8,56.4-31.7C1459.2,635.7,1469,601.6,1464.7,562.6z',
  'M975.1,245.8c-1,0-2,0.2-3.4,0.3c-0.5,0.1-0.9,0.5-0.9,1v14.6c0,7.4,3.6,11.4,10.9,11.9c11.4,0.8,12.8,2.4,12.8,14V381 l98.5-135.3C1053.7,245.8,1014.4,245.8,975.1,245.8z',
  'M813.4,629c-50.3,0-100.6,0.1-150.8-0.1c-17.8-0.1-35.5-1.8-52.7-7c-19.7-5.9-29.1-17-27.9-42.3 c0.8-17.3,9.5-28.4,26.4-33.4c16.7-5,33.7-7.3,51-7.3c52.9,0,105.7,0,158.6,0c1,0,2,0.1,3.9,0.2v79l103.3-141.8V300.4 c0-4.5,0-9,0-13.5c0.1-10.3,2.1-12.4,12.2-13.2c3.4-0.3,6.8-0.5,10.4-0.8c0.5,0,0.9-0.5,0.9-1v-26c-8.5,0.2-15.6,0.5-21.3,0.7 c-17.1,0.9-32.5,4.3-46.2,10.1c-13.7,5.8-26.2,13.3-37.4,22.3c-5.4,4.5-12,10.7-19.9,18.5c-7.9,7.9-15.8,16.5-23.9,26 c-2.2,2.6-4.4,5.1-6.5,7.7c6.1,0,12.2,0,18.3,0c1.2,0,2.3,0.1,4.1,0.2l0,0h0c0,29.1,0,57.5,0,86c0,3.8-2.1,4-5,4 c-36.8-0.1-73.6,0-110.3-0.1c-18.6,0-37.3,0.7-55.9-0.6c-14-0.9-28.1-3.3-41.6-7c-19.7-5.4-27.6-17.5-27.3-37.9 c0.3-20.4,7.7-30.7,27-37.2c16.5-5.6,33.7-7.4,51-7.4c37.5-0.1,74.9-0.1,112.4-0.1l29.3-85.4c-35.8,0-71.6,0-107.4-0.1 c-25.6,0-51.1,0.7-76.5,4.3c-27.4,3.9-54.2,10.3-79.1,22.9c-44,22.4-69.7,56.1-65.8,107.7c1.8,24.3,10.8,45.2,30.6,60.3 c7.5,5.7,15.4,11.1,23.4,16.1c5.4,3.4,11.2,6.1,17.2,9.2c0.7,0.4,0.7,1.5-0.1,1.8c-2.1,0.9-4,1.8-6,2.7 c-19.9,8.9-38.8,19.7-52.7,36.6c-28.6,34.6-31.4,74.2-16.7,115c11,30.7,34.9,50.3,63.8,63.9c32,15.1,66.1,20.1,101.1,20.2 c43.5,0,87,0,130.4,0l56.3-77.4C813.8,629,813.6,629,813.4,629z',
  'M938.8,706.3c2.4,0,4.9,0.3,7.2,0c1-0.1,2.8-1.3,2.8-2c0.2-8,0.1-16.1,0.1-24.3c0-0.6-0.5-1-1-1c-2.3,0-4,0-5.6,0 c-14.6-0.2-17.1-2.7-17.1-17.1v-65.3l-79.9,109.8C876.5,706.3,907.6,706.3,938.8,706.3z',
];
const DECOUPES = [
  'M942,245.8c-48.9,0-97.7,0-146.6,0l-29.3,85.4l-15.4,44.9l7.4,2.7c4.9-8.1,11.1-17,18.5-26.6 c5.4-7,11-14,16.8-21c2.1-2.6,4.3-5.1,6.5-7.7c8.1-9.4,16.1-18.1,23.9-26c7.9-7.9,14.5-14,19.9-18.5c11.2-9,23.7-16.4,37.4-22.3 c13.7-5.8,29.1-9.2,46.2-10.1c5.7-0.3,12.8-0.5,21.3-0.7v-0.1l0,0H942z',
  'M822,618l-8,10.9l-56.3,77.4c29.2,0,58.4,0,87.7,0l79.9-109.8V476.2L822,618z',
  'M1202.6,564.3c-14.1,24.3-29.5,45.8-46.1,64.8c-9.9,11.3-20.3,21.6-31.1,31c-29,25.2-61.7,39.8-98.1,43.8 c-12.4,1.3-24.3,2.2-35.7,2.6c57.9-0.1,115.9-0.1,173.8-0.1l24.7-77.3L1210,567L1202.6,564.3z',
  'M1093,245.7L994.5,381v120.3l109.7-150.7l14.1-19.4l62.2-85.4C1151.3,245.7,1122.2,245.7,1093,245.7z',
];

// Le BB (boite 448,240 1024x472) ramene au centre de la piece (1000x1000).
// 520 unites de large quand il doit tenir dans la legende circulaire, 680
// dans la version petite, qui n'en a pas.
function placement(largeur: number) {
  const e = largeur / 1024;
  return `translate(${500 - (448 + 512) * e} ${500 - (240 + 236) * e}) scale(${e})`;
}

// Les stries de la tranche et les perles du grenetis, calculees une fois.
const STRIES = Array.from({ length: 96 }, (_, i) => (i * 360) / 96);
const PERLES = Array.from({ length: 64 }, (_, i) => {
  const a = (i / 64) * Math.PI * 2;
  return [500 + 392 * Math.cos(a), 500 + 392 * Math.sin(a)];
});

/**
 * Une piece de monnaie, pas un jeton : tranche striee, listel en relief,
 * grenetis (couronne de perles), legende « BENBEDOLLAR » en haut et
 * « B$ » en bas, et le BB frappe en relief (lumiere en haut a gauche,
 * ombre en bas a droite) sur un champ dore.
 * Couleurs fixes (l'or ne depend pas du texte autour). Carree : h-* = w-*.
 *
 * `detail` : la version complete, pour 48 px et plus. Sans lui (les pastilles
 * et boutons de 16 a 24 px), legende et grenetis disparaissent — ils n'y
 * seraient qu'une bouillie — et le BB grossit et fonce pour rester lisible.
 */
export function PieceBB({ className, titre, detail = false }: { className?: string; titre?: string; detail?: boolean }) {
  const id = useId();
  const u = (n: string) => `${id}-${n}`;
  const bb = (dx: number, dy: number, fill: string, op = 1) => (
    <rect x="0" y="0" width="1000" height="1000" fill={fill} opacity={op}
          mask={`url(#${u('bb')})`} transform={`translate(${dx} ${dy})`} />
  );
  return (
    <svg viewBox="0 0 1000 1000" className={className} role={titre ? 'img' : undefined}
         aria-hidden={titre ? undefined : true} aria-label={titre}>
      <defs>
        <mask id={u('bb')} maskUnits="userSpaceOnUse" x="-50" y="-50" width="1100" height="1100">
          <g transform={placement(detail ? 520 : 680)}>
            <g fill="#fff">{PLEINS.map((d, i) => <path key={i} d={d} />)}</g>
            <g fill="#000">{DECOUPES.map((d, i) => <path key={i} d={d} />)}</g>
          </g>
        </mask>
        <linearGradient id={u('listel')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.45" stopColor="#e7b53c" />
          <stop offset="1" stopColor="#8a5a0b" />
        </linearGradient>
        <radialGradient id={u('champ')} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#fdeaa0" />
          <stop offset="0.55" stopColor="#eab53a" />
          <stop offset="1" stopColor="#b97d12" />
        </radialGradient>
        <linearGradient id={u('frappe')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={detail ? '#d9a12a' : '#a46a0c'} />
          <stop offset="1" stopColor={detail ? '#9a650c' : '#5c3a05'} />
        </linearGradient>
        <path id={u('haut')} d="M 175 500 A 325 325 0 0 1 825 500" />
        <path id={u('bas')} d="M 140 500 A 360 360 0 0 0 860 500" />
      </defs>

      {/* La tranche striee. */}
      <circle cx="500" cy="500" r="496" fill="#7a4e08" />
      <g fill="#d9a43a">
        {STRIES.map(a => (
          <rect key={a} x="496" y="4" width="9" height="44" rx="2" transform={`rotate(${a} 500 500)`} />
        ))}
      </g>
      {/* Le listel en relief, puis le champ legerement creuse. */}
      <circle cx="500" cy="500" r="452" fill={`url(#${u('listel')})`} />
      <circle cx="500" cy="500" r="420" fill={`url(#${u('champ')})`} stroke="#8a5a0b" strokeWidth="8" />
      {detail && (<>
        {/* Le grenetis. */}
        <g fill="#a86d10">{PERLES.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7.5" />)}</g>
        {/* La legende. */}
        <g fill="#7a4e08" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" letterSpacing="10">
          <text fontSize="64"><textPath href={`#${u('haut')}`} startOffset="50%" textAnchor="middle">BENBEDOLLAR</textPath></text>
          <text fontSize="56"><textPath href={`#${u('bas')}`} startOffset="50%" textAnchor="middle">★ B$ ★</textPath></text>
        </g>
      </>)}
      {/* Le BB frappe : ombre, lumiere, puis le relief. */}
      {bb(10, 12, '#5c3a05', 0.85)}
      {bb(-6, -7, '#fff6cf', 0.9)}
      {bb(0, 0, `url(#${u('frappe')})`)}
    </svg>
  );
}
