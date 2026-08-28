import React, { useEffect, useRef } from 'react';
import { SprinterApp, updateLogic, useGameStore, syncHtmlLang, primeTopNames } from '@/game/engine';

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
    // Les Jeux olympiques courent contre le vrai TOP 500 : on va chercher les
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
    
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
      lastTime = now;
      
      updateLogic(dt);

      ctx.setTransform(SprinterApp.G.dpr, 0, 0, SprinterApp.G.dpr, 0, 0);
      ctx.clearRect(0, 0, SprinterApp.G.VW, SprinterApp.G.VH);

      const { G, THEMES, LEVELS, drawWorld, drawAthletes, drawIcon } = SprinterApp;
      const { SprinterCore } = (globalThis as any);
      // We only draw the canvas world if we are in certain states, or we just draw it always?
      // Original UI draws world for title, cut, result, over, winall, race, count.
      // For open, it draws a gradient.
      if (G.state === 'open') {
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
        drawWorld(ctx, theme);
        
        if (G.state === 'race' || G.state === 'count') {
          drawAthletes(ctx);
        } else if (G.state === 'title') {
          // Title screen athletes
          const tick = performance.now() / 1000;
          const zeze = Object.values(SprinterCore.ZEZE);
          for (let i = 0; i < 3; i++) {
            const man = { look: zeze[i], stride: tick * 10 + i * 2.1, v: 12, maxSpeed: 12, fallAnim: 0, celebrate: 0 };
            drawIcon(ctx, man, G.VW * (G.portrait ? 0.22 : 0.16) + i * SprinterApp.ui() * 96,
                       G.VH * (G.portrait ? 0.34 : 0.66), SprinterApp.ui() * 160);
          }
        } else if (G.state === 'cut') {
          // Cutscene athlete
          const cut = G.cut;
          if (cut) {
            const ct = cut.t;
            const intro = cut.kind === 'intro';
            const champ = cut.kind === 'champion';
            const accent = champ ? [248, 205, 74] : theme.accent;
            
            // Speed lines
            ctx.strokeStyle = `rgba(${accent.join(',')},0.07)`;
            ctx.lineWidth = SprinterApp.ui() * 26;
            for (let i = -4; i < 24; i++) {
              const x = i * (SprinterApp.ui() * 62) + (ct * SprinterApp.ui() * 34) % (SprinterApp.ui() * 62);
              ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - SprinterApp.ui() * 240, G.VH); ctx.stroke();
            }

            const gx = G.portrait ? G.VW * 0.5 : G.VW * 0.26;
            const gy = G.portrait ? G.VH * 0.46 : G.VH * 0.72;
            const app = SprinterApp.clamp(ct / 0.55, 0, 1);
            const ease = 1 - Math.pow(1 - app, 3);
            drawIcon(ctx, cut.man, gx - SprinterApp.ui() * 240 * (1 - ease), gy,
                       SprinterApp.ui() * (champ ? 300 : (intro ? 280 : 250)), !intro && !champ);
                       
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
        }
        
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(frame);
    };
    
    rafRef.current = requestAnimationFrame(frame);
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
