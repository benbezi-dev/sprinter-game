# Genere src/game/bareme-ffa-donnees.ts depuis tools/bareme-ffa-hommes.json
# (tableau releve sur https://www.athle.fr/contenu/baremes-hommes-classement-des-clubs/125).
# Usage : python3 tools/bareme-ffa-generer.py tools/bareme-ffa-hommes.json > src/game/bareme-ffa-donnees.ts
import json,re,sys
d=json.load(open(sys.argv[1]))
def val(s):
    s=s.strip()
    if not s: return None
    m=re.fullmatch(r"(\d+)h(\d*)'?(\d*)'*",s)
    if m: return int(m[1])*3600+int(m[2] or 0)*60+int(m[3] or 0)
    m=re.fullmatch(r"(\d+)'(\d+)''(\d+)",s)
    if m: return int(m[1])*60+int(m[2])+int(m[3])/100
    m=re.fullmatch(r"(\d+)'(\d+)",s)
    if m: return int(m[1])*60+int(m[2])
    m=re.fullmatch(r"(\d+)''(\d+)",s)
    if m: return int(m[1])+int(m[2])/100
    m=re.fullmatch(r"(\d+)m(\d+)",s)
    if m: return int(m[1])+int(m[2])/100
    m=re.fullmatch(r"(\d+)m",s)
    if m: return int(m[1])
    m=re.fullmatch(r"(\d+)km",s)
    if m: return int(m[1])*1000
    m=re.fullmatch(r"(\d+) pt",s)
    if m: return int(m[1])
    m=re.fullmatch(r"(\d+)",s)   # « 55 » au 15 km : 55 minutes (case sans apostrophe)
    if m: return int(m[1])*60
    raise SystemExit('format inconnu: '+s)
niv=[]
for h in d['niveaux']:
    m=re.fullmatch(r"(IA|IB|IR\d|N\d|R\d|D\d)(\d+) pt",h); niv.append((m[1],int(m[2])))
print("""/* -----------------------------------------------------------------------
   Barème Hommes — classement des clubs, Fédération Française d'Athlétisme
   (« Barème Hommes au 1er janvier 2010 »).
   Source : https://www.athle.fr/contenu/baremes-hommes-classement-des-clubs/125
   Relevé le 20 novembre 2026. FICHIER GÉNÉRÉ depuis la page : ne pas retoucher
   les chiffres à la main, les relever à nouveau.

   Chaque ligne donne, pour une épreuve, la performance minimale de chacun des
   23 niveaux, du meilleur (IA, 40 pts) au plus modeste (D7, 2 pts).
   `perfs` : secondes pour un chrono, mètres pour une distance, points pour une
   épreuve combinée ; null quand la case est vide (catégorie jeune qui
   n'atteint pas ce niveau). `textes` garde l'écriture de la Fédération
   (la case « 55 » du 15 km, sans apostrophe sur le site, se lit 55 minutes).
   ----------------------------------------------------------------------- */
""")
print("export const NIVEAUX_FFA = [")
for c,p in niv: print(f"  {{ code: '{c}', points: {p} }},")
print("] as const;\n")
print("export type LigneBaremeFFA = {\n  epreuve: string;\n  /** Catégories concernées : C cadets, J juniors, E espoirs, S seniors, M masters. */\n  categories: string;\n  /** Épreuve en salle (astérisque de la Fédération). */\n  salle: boolean;\n  /** 'temps' : plus petit = meilleur ; 'marque' : plus grand = meilleur. */\n  sens: 'temps' | 'marque';\n  perfs: (number | null)[];\n  textes: string[];\n};\n")
print("export const BAREME_HOMMES_FFA: LigneBaremeFFA[] = [")
for e in d['epreuves']:
    name=e['epreuve'].strip(); salle=name.startswith('*'); name=name.lstrip('*').strip()
    perfs=[val(s) for s in e['seuils']]
    xs=[p for p in perfs if p is not None]
    sens='temps' if xs[0]<xs[-1] else 'marque'
    assert all((a<b if sens=='temps' else a>b) for a,b in zip(xs,xs[1:])), name
    ps=', '.join('null' if p is None else str(round(p,2)) for p in perfs)
    ts=', '.join(json.dumps(s.strip(),ensure_ascii=False) for s in e['seuils'])
    print(f"  {{ epreuve: {json.dumps(name,ensure_ascii=False)}, categories: '{e['cat']}', salle: {str(salle).lower()}, sens: '{sens}',\n    perfs: [{ps}],\n    textes: [{ts}] }},")
print("];")
