/* ---------------------------------------------------------------------------
   JUMPER — les presentations d'etape
   ---------------------------------------------------------------------------
   Ce que la carte de chaque etape raconte du favori, comme Sprinter le fait de
   son rival (sprinter-i18n.js, CUT_INTRO) : quatre lignes qui arrivent une a
   une, deux variantes par etape, dans les deux langues. `{n}` est le prenom du
   favori.

   Elles valent pour tous les sauts — longueur, triple, hauteur, et la perche
   le jour venu : ce qu'elles moquent, ce sont les sauteurs, pas une epreuve.

   Ce fichier ne voyage qu'avec les concours de saut (canal.ts, SAUTS_OUVERTS).
--------------------------------------------------------------------------- */

export const RECITS = [
  [ // etape 1 — competition scolaire
    [["{n} saute dans le bac à sable de la maternelle depuis qu’il sait marcher.",
      "Il appelle ça de l’entraînement. La maîtresse appelle ça du sable partout.",
      "Il a mesuré son record avec une ficelle. La ficelle a été perdue.",
      "Le record, lui, grandit à chaque récréation."],
     ["{n} has been jumping into the nursery sandpit since he could walk.",
      "He calls it training. The teacher calls it sand everywhere.",
      "He measured his record with a piece of string. The string is lost.",
      "The record, however, grows every break time."]],
    [["{n} a apporté ses pointes, un peu grandes : ce sont celles de son frère.",
      "Il fait trois pas d’élan pour vérifier, puis trois autres pour être sûr.",
      "Il a demandé au public de taper dans ses mains.",
      "Le public, c’est sa grand-mère. Elle tape très fort."],
     ["{n} brought his spikes, a little big: they are his brother’s.",
      "He takes three run-up steps to check, then three more to be sure.",
      "He asked the crowd for a slow clap.",
      "The crowd is his grandmother. She claps very hard."]],
  ],
  [ // etape 2 — niveau regional
    [["{n} colle ses marques d’élan au ruban fluo, au millimètre.",
      "Il les recolle. Puis il les décolle pour les recoller.",
      "Le juge lui a rappelé qu’il avait une minute.",
      "Il a demandé si le décollage comptait dans la minute."],
     ["{n} tapes his run-up marks down in fluorescent tape, to the millimetre.",
      "He tapes them again. Then peels them off to tape them again.",
      "The judge reminded him he has one minute.",
      "He asked whether the peeling counts toward the minute."]],
    [["{n} a sauté plus haut et plus loin l’an dernier, avec le vent.",
      "Il ne parle que de ce saut-là, et jamais du vent.",
      "Aujourd’hui, la manche à air pend, immobile.",
      "Il la regarde comme on regarde un traître."],
     ["{n} jumped higher and further last year, with the wind.",
      "He only ever talks about that jump, never about the wind.",
      "Today the windsock hangs, motionless.",
      "He looks at it the way you look at a traitor."]],
  ],
  [ // etape 3 — niveau national
    [["{n} a un rituel : il parle à sa marque avant chaque essai.",
      "Il lui parle doucement. Personne n’a jamais entendu la réponse.",
      "Il a été champion de France chez les jeunes.",
      "Il le rappelle à la marque, au cas où elle l’aurait oublié."],
     ["{n} has a ritual: he talks to his mark before every attempt.",
      "Softly. Nobody has ever heard the answer.",
      "He was national youth champion.",
      "He reminds the mark of it, in case it forgot."]],
    [["{n} est passé à la télévision régionale, au ralenti.",
      "On voyait surtout le tapis, mais c’était son tapis.",
      "Il a demandé au caméraman d’attendre son troisième essai.",
      "Le caméraman est parti déjeuner."],
     ["{n} has been on regional television, in slow motion.",
      "You mostly saw the mat, but it was his mat.",
      "He asked the cameraman to wait for his third attempt.",
      "The cameraman went to lunch."]],
  ],
  [ // etape 4 — championnat du monde
    [["{n} a un entraîneur, un kiné et un préparateur mental.",
      "Le préparateur lui a appris à visualiser le saut parfait.",
      "Il le visualise depuis ce matin. Il ne l’a pas encore sauté.",
      "Le stade entier frappe dans ses mains pour lui."],
     ["{n} has a coach, a physio and a mental trainer.",
      "The mental trainer taught him to visualise the perfect jump.",
      "He has been visualising it since this morning. He has not jumped it yet.",
      "The whole stadium is clapping for him."]],
    [["{n} arrive avec la meilleure performance mondiale de l’année.",
      "Elle est écrite sur son dossard, en tout petit, mais on la voit.",
      "Il ne s’échauffe pas : il se laisse regarder s’échauffer.",
      "C’est une technique. On ne sait pas encore laquelle."],
     ["{n} arrives with the world lead of the year.",
      "It is written on his bib, very small, but you can see it.",
      "He does not warm up: he lets people watch him warm up.",
      "It is a technique. Nobody knows which one yet."]],
  ],
  [ // etape 5 — 0.Games
    [["{n} a signé avec une marque de pointes.",
      "Les pointes sont dorées. Les lacets aussi.",
      "Il a promis un record du monde au sponsor.",
      "Le sponsor a déjà imprimé les affiches."],
     ["{n} has signed with a spike brand.",
      "The spikes are gold. So are the laces.",
      "He promised the sponsor a world record.",
      "The sponsor has already printed the posters."]],
    [["{n} ne saute que dans les grands rendez-vous.",
      "Les autres concours, estime-t-il, ne méritent pas son élan.",
      "Celui-ci, il l’attend depuis quatre ans.",
      "Il a quatre ans d’élan en réserve."],
     ["{n} only jumps at the big meets.",
      "Other competitions, he feels, do not deserve his run-up.",
      "He has waited four years for this one.",
      "He has four years of run-up in reserve."]],
  ],
  [ // etape 6 — inter galactique
    [["{n} vient d’une planète où la pesanteur est une suggestion.",
      "Il a découvert le sable en arrivant. Il n’est pas impressionné.",
      "Chez lui, on saute sans élan, par politesse.",
      "Par respect pour vous, il prendra quand même trois pas."],
     ["{n} comes from a planet where gravity is a suggestion.",
      "He discovered sand on arrival. He is not impressed.",
      "At home, you jump without a run-up, out of politeness.",
      "Out of respect for you, he will still take three steps."]],
    [["{n} ne mesure pas ses sauts en mètres, mais en orbites.",
      "La station a dû rallonger la fosse et relever les montants.",
      "Il s’excuse d’avance auprès du tableau d’affichage.",
      "Le tableau n’a pas assez de chiffres."],
     ["{n} does not measure his jumps in metres, but in orbits.",
      "The station had to lengthen the pit and raise the uprights.",
      "He apologises in advance to the scoreboard.",
      "It does not have enough digits."]],
  ],
];

/** Les quatre lignes d'une etape, dans la langue du jeu, pour ce favori. */
export function recitDe(etape, lang, prenom, alea = Math.random) {
  const e = RECITS[Math.max(0, Math.min(RECITS.length - 1, etape | 0))];
  const v = e[Math.floor(alea() * e.length) % e.length];
  const l = v[lang === 'fr' ? 0 : 1];
  return l.map((s) => s.split('{n}').join(prenom));
}
