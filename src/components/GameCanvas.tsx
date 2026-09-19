import React, { useEffect, useRef } from 'react';
import { SprinterApp, updateLogic, useGameStore, syncHtmlLang, primeTopNames } from '@/game/engine';
import { dessinerLeGenerique, placerLaCameraDuGenerique } from '@/game/scene-generique';
import { cameraPassage, appliquerCamera } from '@/game/passage';
import { dessinerMateriel, dessinerLesHaies } from '@/game/materiel';
import { mondeCourant } from '@/game/mondes';
import { cameraPour } from '@/game/cadrage';
import { POUSSEE_OUVERTE } from '@/game/canal';
import { guetteurDePoussee } from '@/game/poussee-gestes';
import { placerLaCameraDeLAccueil, dessinerLesCoureursDeLAccueil, brancherLeRedessin, profondeurDeLaMeute } from '@/game/scene-accueil';

/** Ou se tient le personnage d'une cinematique ordinaire : ses pieds, a l'ecran. */
function pointDuPersonnage(G: any): [number, number] {
  return G.portrait ? [G.VW * 0.5, G.VH * 0.46] : [G.VW * 0.26, G.VH * 0.72];
}

/**
 * LE PERSONNAGE D'UNE SCENETTE SE TIENT SUR LA PISTE.
 *
 * La camera restait ou la course l'avait laissee — au depart pour l'intro, sur
 * le coureur arrete pour les autres — et le personnage etait peint a une place
 * fixe de l'ecran, sans regarder ce qu'il y avait dessous. Sous le voile et le
 * flou, cela ne se voyait pas. Sur le stade net, on le trouvait debout dans la
 * pelouse, ou les pieds dans les sieges de la tribune du 200 et du 400, et le
 * coin du cadre montrait le bout du decor.
 *
 * On cadre maintenant l'inverse : le point de piste ou il se tient — couloir 4,
 * trois metres derriere la ligne de depart pour l'intro, la ou la course s'est
 * arretee pour les autres — tombe exactement sous ses pieds. Sous lui il y a
 * donc toujours la piste, et autour la ligne qui compte : les blocs avant la
 * course, la ligne d'arrivee apres. Recalcule a chaque image, le cadrage suit
 * aussi un telephone qu'on tourne. Le decompte, derriere l'intro, ramene la
 * camera sur le joueur en glissant (followCam).
 */
function placerLaCameraDeLaScenette(cut: any) {
  const { G, clamp } = SprinterApp;
  const T = G.track;
  if (!T) return;
  const d = cut.kind === 'intro'
    ? -3
    : clamp(G.player ? G.player.d : T.total + 9, T.total + 2, T.total + 14);
  const [x, y] = cameraPour(SprinterApp, T.pos(d, 3), pointDuPersonnage(G));
  G.camX = x; G.camY = y;
}

/**
 * UNE CINEMATIQUE ORDINAIRE : le coureur qui entre par la gauche, et les
 * confettis du sacre.
 *
 * Sortie de la boucle pour pouvoir etre dessinee DEUX fois dans la meme image :
 * la cinematique en cours, et — pendant les deux secondes du croisement — le
 * sacre qui s'efface par-dessus le generique qui vient de demarrer (G.sortie).
 * C'est le meme dessin a une opacite pres ; le dupliquer aurait fait deux
 * sacres a maintenir. Voir nextCut dans game/sprinter-app.js.
 *
 * PLUS DE BANDES EN TRAVERS DE L'ECRAN. Vingt-huit traits larges de la couleur
 * du stade balayaient toute l'image : sur le stade refait, c'etaient justement
 * les taches claires qu'on a retirees de la course. Le mouvement est porte par
 * le coureur, qui entre en courant.
 */
function dessinerCinematique(ctx: CanvasRenderingContext2D, cut: any, theme: any) {
  const { G, drawIcon } = SprinterApp;
  const ct = cut.t;
  const intro = cut.kind === 'intro';
  const champ = cut.kind === 'champion';
  void theme;

  const [gx, gy] = pointDuPersonnage(G);
  const app = SprinterApp.clamp(ct / 0.55, 0, 1);
  const ease = 1 - Math.pow(1 - app, 3);
  const taille = SprinterApp.ui() * (champ ? 300 : (intro ? 280 : 250));
  const x = gx - SprinterApp.ui() * 240 * (1 - ease);
  // SON OMBRE, CELLE DE LA COURSE. Un personnage de cette taille pose sur un
  // stade net sans rien sous les pieds flotte : on lui donne la meme double
  // ombre — penombre large, contact serre — que sur la piste, a son echelle
  // (taille = pixels pour deux metres). Voir ombre() dans rendu-premium.js.
  const Prem = (globalThis as any).RenduPremium;
  const { SprinterCore } = (globalThis as any);
  if (Prem && SprinterCore) {
    Prem.ombre(ctx, x, gy, taille / 2, cut.man.look.h / SprinterCore.C.MODEL_H,
               cut.man.stride, false);
  }
  drawIcon(ctx, cut.man, x, gy, taille, !intro && !champ);

  if (champ) {
    // Confettis qui tournent sur eux-memes en tombant, plutot que
    // de simples rectangles droits : plus vivant pour l'ecran de
    // sacre.
    for (let i = 0; i < 90; i++) {
      const sd = (i * 7919) % 997;
      const x = (sd * 13) % G.VW;
      const y = ((ct * (60 + sd % 90) + sd * 3) % (G.VH + 120)) - 60;
      if (y >= -10) {
        const cols = ['rgb(248,205,74)', 'rgb(104,216,236)', 'rgb(232,121,216)', 'rgb(108,226,138)', 'rgb(238,240,248)'];
        const cx2 = x + Math.sin(ct * 3 + sd) * 6;
        const spin = ct * (2 + (sd % 5)) + sd;
        const w = SprinterApp.ui() * (4 + sd % 4), h = SprinterApp.ui() * 7;
        ctx.save();
        ctx.translate(cx2, y);
        ctx.rotate(spin);
        ctx.fillStyle = cols[sd % 5];
        if (sd % 7 === 0) {
          ctx.beginPath(); ctx.arc(0, 0, w * 0.6, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(-w / 2, -h / 2, w, h);
        }
        ctx.restore();
      }
    }
  }
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep track of animation frame
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Add roundRect fallback if needed
    if (!ctx.roundRect) {
      ctx.roundRect = function (x, y, w, h, r) {
        this.moveTo(x + (r as number), y); this.arcTo(x + w, y, x + w, y + h, r as number);
        this.arcTo(x + w, y + h, x, y + h, r as number); this.arcTo(x, y + h, x, y, r as number);
        this.arcTo(x, y, x + w, y, r as number); this.closePath();
      };
    }

    SprinterApp.G.cv = canvas;
    SprinterApp.load();
    // load() fixe la langue (sauvegardee ou detectee) : on aligne le
    // document dessus pour ne pas declencher la traduction navigateur.
    syncHtmlLang();
    // Les Jeux mondiaux courent contre le vrai TOP 500 : on va chercher les
    // noms des maintenant, bien avant que le joueur n'y arrive.
    primeTopNames();

    const resize = () => {
      const box = canvas.parentElement || canvas;
      const r = box.getBoundingClientRect();
      const w = Math.round(r.width) || window.innerWidth;
      const h = Math.round(r.height) || window.innerHeight;
      SprinterApp.G.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * SprinterApp.G.dpr);
      canvas.height = Math.round(h * SprinterApp.G.dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      SprinterApp.G.VW = w;
      SprinterApp.G.VH = h;
      SprinterApp.G.portrait = h > w;
    };
    
    resize();

    // On observe le parent plutot que d'ecouter `resize` sur window, et ce
    // n'est pas un detail de style.
    //
    // La hauteur du conteneur vient d'une variable CSS que le composant parent
    // met a jour sur `resize`. Or les effets React s'executent des enfants vers
    // les parents : l'ecouteur du canvas etait donc pose en premier, et partait
    // en premier — il mesurait le conteneur avant que celui-ci n'ait recu sa
    // nouvelle hauteur, et gardait ainsi une mesure de retard en permanence.
    //
    // Invisible sur un ecran qui ne change jamais de taille. Mais une
    // application installee sur iOS stabilise sa hauteur une seule fois, juste
    // apres le lancement : le canvas restait alors bloque a la hauteur du
    // demarrage, et le jeu ne dessinait que dans le haut de l'ecran.
    //
    // Un ResizeObserver, lui, se declenche apres la mise en page, avec la
    // taille reelle, sans dependre de l'ordre des ecouteurs.
    const observateur = new ResizeObserver(resize);
    observateur.observe(canvas.parentElement || canvas);
    // Filet : la densite de pixels peut changer sans que le parent ne bouge.
    window.addEventListener('orientationchange', () => setTimeout(resize, 120));
    
    // Initial game state setup if needed
    if (SprinterApp.G.state === 'open' && !SprinterApp.G.track) {
      SprinterApp.G.race = SprinterApp.RACES[SprinterApp.G.raceKey];
      SprinterApp.buildLevel(0);
    }
    
    // Frame loop
    let lastTime = performance.now();
    
    // QUEL GESTE ALLUME QUOI : la regle est sortie d'ici, dans
    // game/poussee-gestes.ts, pour qu'un harnais puisse la jouer. Elle n'a
    // besoin ni de toile ni de stade — un coureur et trois nombres — et tant
    // qu'elle vivait dans cette boucle, personne ne pouvait verifier qu'un
    // depart manque laisse la relance se signer quand meme.
    //
    // Le guetteur tient le « une seule fois par course » : les deux notes
    // restent posees sur le coureur jusqu'a l'arrivee, et sans lui
    // l'impulsion se rearmerait a chaque image.
    const guetterLesGestes = guetteurDePoussee();

    // `redessin` : refaire l'image de cet instant sans faire avancer le jeu.
    // L'accueil le demande au moment ou il apparait — voir accueilPose dans
    // game/scene-accueil.ts.
    const frame = (now: number, redessin = false) => {
      const dt = redessin ? 0 : Math.min(0.05, (now - lastTime) / 1000 || 0.016);
      if (!redessin) {
        lastTime = now;
        updateLogic(dt);
      }

      // La couche de finition prend le pouls de l'image AVANT qu'on dessine :
      // c'est elle qui decide, au vu du temps reellement passe, si le
      // telephone tient le grain de piste et la poussiere ou s'il faut les
      // lui retirer. Voir game/rendu-premium.js.
      const Prem = (globalThis as any).RenduPremium;
      if (Prem && !redessin) Prem.mesurer(dt);

      ctx.setTransform(SprinterApp.G.dpr, 0, 0, SprinterApp.G.dpr, 0, 0);
      ctx.clearRect(0, 0, SprinterApp.G.VW, SprinterApp.G.VH);

      const { G, THEMES, LEVELS, drawWorld, drawAthletes } = SprinterApp;
      const { SprinterCore } = (globalThis as any);

      // LE PASSAGE D'UN JEU A L'AUTRE BOUGE LA CAMERA, ET RIEN D'AUTRE.
      //
      // On peint d'abord la couleur du jeu ou l'on va, puis le monde par
      // dessus, decale : ce qui se decouvre sur les bords, c'est la
      // destination. Rien de la projection n'est touche — `drawWorld` et les
      // coureurs se dessinent comme d'habitude, dans un repere que la toile a
      // simplement deplace. La camera se lit a l'horloge et non a un etat
      // React : un rendu en retard ne peut pas faire sauter le mouvement, et
      // un redessin a la demande retrouve la meme image.
      const cam = cameraPassage(now, G.VW, G.VH);
      if (cam) {
        ctx.fillStyle = cam.fond;
        ctx.fillRect(0, 0, G.VW, G.VH);
        ctx.save();
        appliquerCamera(ctx, cam, G.VW, G.VH);
      }
      // We only draw the canvas world if we are in certain states, or we just draw it always?
      // Original UI draws world for title, cut, result, over, winall, race, count.
      // For open, it draws a gradient.
      //
      // L'accueil pose sa camera avant tout le reste : la piste doit passer sur
      // la scene qu'il reserve a ses coureurs. Tant qu'il n'a jamais pu la
      // mesurer — l'image ou le jeu y arrive, avant que React ne le monte — on
      // garde le fond de l'ouverture plutot que de montrer le stade sous une
      // camera qui n'est pas la sienne. Voir game/scene-accueil.ts.
      const accueilSansScene = G.state === 'title' && !placerLaCameraDeLAccueil(SprinterApp);
      if (G.state === 'open' || accueilSansScene) {
        const g = ctx.createLinearGradient(0, 0, 0, G.VH);
        g.addColorStop(0, '#0a0f1c'); g.addColorStop(1, '#05070d');
        ctx.fillStyle = g; ctx.fillRect(0, 0, G.VW, G.VH);
        
        // Opening animation
        const tm = G.openT;
        if (tm < 2.4) {
          const x = -240 + (G.VW + 480) * SprinterApp.clamp(tm / 1.5, 0, 1);
          for (let i = 0; i < 22; i++) {
            ctx.strokeStyle = 'rgba(248, 205, 74,' + (0.10 * (1 - Math.abs(i - 11) / 11)).toFixed(3) + ')';
            ctx.lineWidth = 8;
            ctx.beginPath(); ctx.moveTo(x + i * 8 - 90, 0);
            ctx.lineTo(x + i * 8 - 260, G.VH); ctx.stroke();
          }
        }
        
        const zeze = Object.values(SprinterCore.ZEZE);
        for (let i = 0; i < 3; i++) {
          const st = tm - 0.25 * i;
          if (st > 0 && st < 3.4) {
            const man = { look: zeze[i * 2], stride: st * 11, v: 12, maxSpeed: 12, fallAnim: 0, celebrate: 0 };
            const px = G.VW + 120 - (G.VW + 320) * SprinterApp.clamp(st / 2.6, 0, 1);
            SprinterApp.drawIcon(ctx, man, px, G.VH * 0.70 + i * SprinterApp.ui() * 24, SprinterApp.ui() * (150 - i * 18));
          }
        }
      } else {
        const theme = THEMES[LEVELS[G.levelIdx].theme];
        ctx.save();
        if (G.shake > 0.01) {
          const a = G.shake * (9 * SprinterApp.ui());
          ctx.translate((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a);
        }
        // Les scenes posent leur camera avant que le monde soit dessine : le
        // personnage d'une scenette sur la piste, le generique sur le tour
        // d'honneur.
        if (G.state === 'cut' && G.cut) {
          if (G.cut.kind === 'ending') placerLaCameraDuGenerique(SprinterApp);
          else placerLaCameraDeLaScenette(G.cut);
        }
        drawWorld(ctx, theme);

        // LES HAIES VIVENT SUR LA PISTE TANT QUE LE MONDE EST HURDLERS,
        // passage ou non : un accueil de Hurdlers sans haies dans les couloirs
        // serait un accueil de Sprinter repeint. Le passage ne fait que les
        // relever — voir game/materiel.
        //
        // EN DEUX PASSES, DE PART ET D'AUTRE DES COUREURS. Une haie se
        // franchit : celles qui sont derriere la meute passent derriere elle,
        // celles qui sont devant la cachent. Toutes du meme cote, on voyait un
        // montant du premier plan traverser la jambe du coureur qu'il aurait
        // du masquer. C'est exactement ce que fait le rendu en course, ou les
        // haies prennent leur place dans l'ordre de profondeur.
        const haiesIci = G.state === 'title' && mondeCourant() === 'hurdlers';
        const meute = haiesIci ? profondeurDeLaMeute(SprinterApp) : null;
        if (haiesIci && meute !== null) {
          dessinerLesHaies(ctx, cam, { audela: meute, loin: true });
        } else if (haiesIci) {
          dessinerLesHaies(ctx, cam);
        }
        
        // L'elimination au faux depart se joue sur la piste figee : les
        // coureurs y restent. Sous l'ancien voile noir a 78 %, on ne voyait pas
        // qu'ils avaient disparu ; sous le voile allege, on voyait des blocs
        // vides.
        if (G.state === 'race' || G.state === 'count' || G.state === 'falseout') {
          drawAthletes(ctx);
        } else if (G.state === 'title') {
          // Les trois coureurs de l'accueil : sur la piste, hors des cartes.
          dessinerLesCoureursDeLAccueil(ctx, SprinterApp, theme);
          // Puis les haies qui sont devant eux.
          if (haiesIci && meute !== null) {
            dessinerLesHaies(ctx, cam, { audela: meute, loin: false });
          }
        } else if (G.state === 'cut' && G.cut && G.cut.kind === 'ending') {
          // Le generique de fin de carriere a sa propre scene : la nuit sur le
          // stade, le tour d'honneur, les feux d'artifice sur la musique. Elle
          // est dessinee ailleurs — trois cents lignes qui n'ont rien a faire
          // au milieu de la boucle.
          dessinerLeGenerique(ctx, SprinterApp);
          // LE FONDU ENCHAINE. Le sacre est dessine par-dessus la nuit qui
          // monte, a l'opacite qui lui reste : les deux scenes se croisent au
          // lieu de se couper, le temps que la musique s'installe.
          if (G.sortie && G.sortie.a > 0) {
            ctx.save();
            ctx.globalAlpha = G.sortie.a;
            dessinerCinematique(ctx, G.sortie, theme);
            ctx.restore();
          }
        } else if (G.state === 'cut') {
          if (G.cut) dessinerCinematique(ctx, G.cut, theme);
        }
        
        ctx.restore();
      }

      // LA PASSE FINALE, SUR L'IMAGE ENTIERE.
      //
      // Elle vient apres tout — monde, athletes, cinematiques — parce que
      // c'est ce qu'elle est : non plus un objet de plus dans le stade, mais
      // la facon dont on REGARDE le stade. Le vignettage ferme les bords,
      // l'etalonnage donne au lieu une lumiere commune, et a pleine vitesse
      // l'image se resserre autour du coureur.
      //
      // Le HUD est en React, au-dessus du canvas : il reste donc franc, et
      // c'est voulu — un chiffre de chrono assombri dans un coin serait
      // illisible, alors qu'une piste assombrie dans un coin est du cinema.
      // La camera du passage se retire AVANT la couche de finition : une
      // vignette est un effet d'image, elle n'a pas a glisser avec le stade.
      if (cam) {
        ctx.restore();
        if (cam.voile > 0.002) {
          ctx.globalAlpha = cam.voile;
          ctx.fillStyle = cam.fond;
          ctx.fillRect(0, 0, G.VW, G.VH);
          ctx.globalAlpha = 1;
        }
        // Puis ce que la camera est allee chercher, dans le meme repere mais
        // par-dessus le voile : le stade se dissout dans la couleur du jeu
        // qu'on rejoint, et ce qui reste net dedans est la fosse ou le cercle.
        ctx.save();
        appliquerCamera(ctx, cam, G.VW, G.VH);
        dessinerMateriel(ctx, cam, G.VW, G.VH);
        ctx.restore();
      }

      if (Prem) {
        const enCourse = G.state === 'race';
        // DEUX GESTES, DEUX COUPS DE VITESSE.
        //
        // L'effet suivait la vitesse : au-dela des trois quarts du maximum il
        // s'allumait, et comme une course se court presque entierement
        // au-dela de ce seuil, il etait la deux images sur trois. Ce qui est
        // toujours la n'est plus un effet.
        //
        // Il recompense maintenant ce que le joueur est venu chercher : la
        // reaction parfaite au pistolet et la transition parfaite en sortie
        // de poussee. Les memes deux gestes que le HUD annonce en toutes
        // lettres — l'image dit desormais la meme chose que le texte.
        //
        // ET DEUX GESTES, DEUX SIGNATURES. Ils recevaient la meme image, si
        // bien que la seconde recompense n'apprenait rien de plus que la
        // premiere. Le depart canon se signe donc du HALO — l'onde qui
        // s'ouvre sous ses appuis, l'aura sur son buste — et la transition
        // parfaite y ajoute l'IMAGE REMANENTE, les trois copies du coureur
        // derriere lui. Un declic contre une relance : ce qu'on laisse
        // derriere soi appartient a celle qui relance.
        //
        // C'est ici que ca se dit, parce que c'est ici qu'on sait quel geste
        // vient de tomber ; ce que la machine peut s'en payer reste la
        // decision de la couche de finition, qui seule connait son prix.
        // Le guetteur est consulte a chaque image, meme quand le
        // declenchement est ferme : c'est lui qui se remet a zero hors
        // course, et POUSSEE_OUVERTE ne ferme que l'armement, pas le
        // jugement du geste — voir canal.ts.
        for (const geste of guetterLesGestes(enCourse ? G.player : null, enCourse,
                                             SprinterApp.C.REACT_BONUS)) {
          if (POUSSEE_OUVERTE) Prem.poussee(geste.force, geste.echos);
        }
        // La vignette se resserre avec le coup de poussee, et avec lui seul.
        const pouss = POUSSEE_OUVERTE && Prem.partPoussee ? Prem.partPoussee() : 0;
        Prem.vignette(ctx, G, G.state === 'open' || accueilSansScene ? 0.5 : 0.85 + pouss * 0.15);
      }

      if (!redessin) rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    brancherLeRedessin(() => frame(performance.now(), true));

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      brancherLeRedessin(null);
      observateur.disconnect();
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full pointer-events-none" 
      style={{ zIndex: 0 }} 
    />
  );
}
