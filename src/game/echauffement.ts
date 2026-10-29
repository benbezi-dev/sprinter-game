// L'ECHAUFFEMENT PENDANT LA PRESENTATION (23/10/2026, l'auteur : « cette position des
// joueurs pendant la presentation de la carte de l'adversaire n'est pas bonne. Les
// personnages sont en mouvement pre-course : ils font des accelerations pour s'echauffer,
// ou ils font des tests de starting-blocks »).
//
// Pendant la cinematique d'intro, personne n'etait anime : les coureurs restaient figes au
// milieu d'une foulee devant leurs blocs, et la course en 3D les montrait ainsi tout le
// survol. Chacun suit maintenant sa routine, en boucle, decalee d'un couloir a l'autre :
//   - LA LIGNE DROITE : il accelere sur une douzaine de metres, relache, se retourne et
//     revient au pas jusqu'a ses blocs ;
//   - L'ESSAI DE DEPART : il s'installe dans ses blocs, se met prets, part en poussant sur
//     cinq metres, puis revient au pas ;
//   - LES MONTEES DE GENOUX, sur place, entre deux temps debout a souffler.
// C'est un etat d'AFFICHAGE, comme phaseBlocs : la physique de la course n'en lit rien, et
// tout est remis en place a la fin de la presentation (finirLEchauffement).

const doux = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
type Phase = 'souffle' | 'elan' | 'bloc' | 'retour' | 'genoux';
type Etat = { routine: number; phase: Phase; t: number; d0: number };
const etats = new WeakMap<any, Etat>();

/** Une image d'echauffement pour chaque coureur (la cinematique d'intro). */
export function echauffer(G: any, C: any, dt: number) {
  for (const r of G.runners || []) {
    if (!r || r.finished) continue;
    let e = etats.get(r);
    if (!e) {
      const lane = r.lane | 0;
      // un temps debout d'abord, decale d'un couloir a l'autre : la ligne ne part pas d'un bloc
      e = { routine: lane % 3, phase: 'souffle', t: -((lane * 1.37) % 2.2), d0: r.d || 0 };
      etats.set(r, e);
    }
    e.t += dt;
    r.echauffe = true;
    r.attitudeW = 0;
    if (r !== G.presente) r.celebrate = 0;
    const passe = (ph: Phase) => { e!.phase = ph; e!.t = 0; };
    const courir = (v: number) => {
      r.retour = false; r.marche = 0; r.debout = 0;
      r.v = v; r.d += v * dt;
      r.stride += v * dt * (Math.PI / r.strideLength());
    };
    const t = e.t;
    switch (e.phase) {
      case 'souffle':
        // debout, a souffler, les jambes deliees
        r.retour = false; r.marche = 0; r.enBloc = 0; r.prets = 0; r.v = 0; r.drivePitch = 0; r.d = e.d0;
        r.debout = Math.min(1, (r.debout || 0) + dt * 3);
        r.stride += dt * 0.4;
        if (t > 1.4) passe(e.routine === 0 ? 'elan' : e.routine === 1 ? 'bloc' : 'genoux');
        break;
      case 'elan':
        // LA LIGNE DROITE : 1,8 s d'acceleration, 1,2 s de relache
        r.enBloc = 0;
        r.drivePitch = 0.12 * (1 - doux(t / 1.8));
        courir(t < 1.8 ? 1.2 + 6.4 * doux(t / 1.4) : 0.4 + 7.2 * (1 - doux((t - 1.8) / 1.2)));
        if (t > 3.0) passe('retour');
        break;
      case 'bloc': {
        // L'ESSAI DE DEPART : dans les blocs, prets, la poussee sur cinq metres
        if (t < 1.6) {
          r.retour = false; r.marche = 0; r.debout = 0; r.v = 0; r.d = e.d0; r.drivePitch = 0;
          r.enBloc = doux(t / 0.6); r.prets = doux((t - 0.9) / 0.4);
        } else {
          const u = (t - 1.6) / 1.4;
          r.enBloc = 1 - doux(u / 0.18); r.prets = 1;
          r.drivePitch = C.DRIVE_PITCH * (1 - doux(u / 0.7));
          courir(6.2 * doux(u / 0.4) * (1 - doux((u - 0.55) / 0.45)) + 0.2);
          if (u >= 1) { r.enBloc = 0; r.drivePitch = 0; passe('retour'); }
        }
        break;
      }
      case 'retour':
        // il se retourne et revient au pas jusqu'a ses blocs
        r.retour = true; r.marche = 1; r.debout = 0; r.enBloc = 0; r.drivePitch = 0; r.v = 0;
        r.marcheT = (r.marcheT || 0) + dt * Math.PI * 1.8;     // pres de deux pas par seconde
        r.d = Math.max(e.d0, r.d - 1.35 * dt);
        if (r.d <= e.d0 + 1e-3) { r.retour = false; r.marche = 0; passe('souffle'); }
        break;
      case 'genoux':
        // LES MONTEES DE GENOUX, sur place : la foulee d'un coureur a 6 m/s, sans avancer
        r.d = e.d0; r.enBloc = 0; r.retour = false; r.marche = 0; r.debout = 0; r.drivePitch = 0;
        r.v = 6; r.stride += 9.5 * dt;
        if (t > 2.4) passe('souffle');
        break;
    }
  }
}

/** La presentation est finie : chacun revient a sa place, debout derriere ses blocs. */
export function finirLEchauffement(G: any) {
  for (const r of G.runners || []) {
    if (!r || !r.echauffe) continue;
    const e = etats.get(r);
    r.echauffe = false;
    if (e) r.d = e.d0;
    r.v = 0; r.retour = false; r.marche = 0; r.debout = 0; r.enBloc = 0; r.prets = 0; r.drivePitch = 0;
    etats.delete(r);
  }
}
