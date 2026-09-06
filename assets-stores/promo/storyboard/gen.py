# -*- coding: utf-8 -*-
# Genere les artboards .dc.html du storyboard Sprinter (echelle 1/2 du master 1080x1920)
import json, os, io
OUT = os.path.dirname(os.path.abspath(__file__))

GOLD, CYAN, FUX, SILV, BRZ = '#F8CD4A', '#5FD3E8', '#F0ABFC', '#CBD5E1', '#B45309'
MUT, FG, LINE = '#94A3B8', '#EEF0F8', '#1E293B'

FRAME = ("width:540px;height:960px;box-sizing:border-box;overflow:hidden;position:relative;"
  "font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#EEF0F8;"
  "background:radial-gradient(115% 75% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,.78) 100%),"
  "repeating-linear-gradient(180deg, rgba(255,255,255,.045) 0 1px, transparent 1px 60px),"
  "radial-gradient(125% 75% at 28% 16%, rgba(23,36,80,.55) 0%, rgba(10,15,34,0) 55%),#060913;"
  "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:42px;")
MONO = "font-family:'Space Mono',monospace;"
KICK = MONO + "font-weight:700;font-size:13px;letter-spacing:.42em;color:%s;text-transform:uppercase;text-align:center;margin:0;"
H1   = "font-family:'Outfit',sans-serif;font-weight:900;font-size:60px;line-height:.92;letter-spacing:-.02em;text-transform:uppercase;text-align:center;margin:0;"
H2   = "font-family:'Outfit',sans-serif;font-weight:900;font-size:41px;line-height:.95;letter-spacing:-.015em;text-transform:uppercase;text-align:center;margin:0;"
H3   = "font-family:'Outfit',sans-serif;font-weight:800;font-size:26px;line-height:1.05;letter-spacing:-.01em;text-transform:uppercase;text-align:center;margin:0;"
P    = "font-size:18px;line-height:1.34;color:#94A3B8;text-align:center;font-weight:600;margin:0;max-width:430px;"
CARD = "background:linear-gradient(180deg,#0d1322,#0a0e1a);border:1px solid #1E293B;border-radius:13px;box-shadow:0 12px 30px rgba(0,0,0,.5);"
RULE = "height:3px;width:85px;border-radius:3px;background:%s;flex:none;"

def runner(size, color):
    return ('<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:%dpx;height:%dpx;fill:%s;flex:none">'
            '<path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3'
            'C14.7 12 16 13 17.49 13v-2c-1.5 0-2.8-.8-3.4-2l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4'
            'l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/></svg>') % (size, size, color)

def logo(d=100):
    return ('<div style="width:%dpx;height:%dpx;border-radius:50%%;display:flex;align-items:center;justify-content:center;flex:none;'
            'background:radial-gradient(85%% 85%% at 35%% 28%%,#22315c,#060a14);border:4px solid #F8CD4A;'
            'box-shadow:0 0 35px rgba(248,205,74,.26)">%s</div>') % (d, d, runner(round(d*.56), GOLD))

def prog(f):
    bars = "".join('<div style="flex:1;height:4px;border-radius:4px;background:rgba(255,255,255,.10);overflow:hidden">'
                   '<div style="height:100%%;width:%d%%;background:#F8CD4A;border-radius:4px"></div></div>' % p for p in f)
    return '<div style="position:absolute;top:66px;left:42px;right:42px;display:flex;gap:8px">%s</div>' % bars

def lane(n, name, x, color, tag_extra=""):
    return ('<div style="position:relative;height:48px;border-bottom:1px dashed rgba(255,255,255,.08)">'
            '<span style="position:absolute;left:11px;top:50%%;transform:translateY(-50%%);%sfont-size:13px;font-weight:700;color:rgba(255,255,255,.18)">%d</span>'
            '<div style="position:absolute;top:50%%;left:%dpx;transform:translateY(-50%%);display:flex;align-items:center;gap:6px">'
            '%s<span style="%sfont-size:12px;font-weight:700;color:#dbe3f5;background:rgba(11,16,32,.8);border:1px solid #1E293B;'
            'border-radius:5px;padding:2px 6px;white-space:nowrap">%s</span>%s</div></div>') % (
            MONO, n, x, runner(28, color), MONO, name, tag_extra)

def track(rows, width=456):
    inner = "".join(rows)
    return ('<div style="position:relative;width:%dpx;border-radius:11px;overflow:hidden;'
            'background:linear-gradient(180deg,#0e1526,#0a0f1d);border:1px solid #1E293B">%s'
            '<div style="position:absolute;top:0;bottom:0;right:13px;width:6px;opacity:.9;'
            'background:repeating-linear-gradient(180deg,#fff 0 6px,#0b1020 6px 12px)"></div></div>') % (width, inner)

# ---------------------------------------------------------------- artboards
def a_intro():
    chips = "".join(
      ('<div style="display:inline-flex;align-items:center;gap:9px;padding:10px 17px;border-radius:11px;'
       'background:rgba(13,19,34,.9);border:1px solid #1E293B;font-weight:800;font-size:18px">'
       '<span style="%scolor:%s">%s</span>%s</div>') % (MONO, GOLD, n, t)
      for n, t in [('01','DUEL EN LIGNE'), ('02','COURSE EN DIRECT'), ('03','RELAIS 4×100')])
    return (logo(100) +
      '<h1 style="%sfont-size:79px;letter-spacing:.02em">SPRINTER</h1>' % H1 +
      '<div style="%s"></div>' % (RULE % GOLD) +
      '<p style="%s">La mise à jour</p>' % (KICK % GOLD) +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">%s</div>' % chips)

def a_titre(num, l1, l2, color, sub):
    return (
      '<div style="font-family:\'Outfit\',sans-serif;font-weight:900;font-size:210px;line-height:.8;'
      'color:transparent;-webkit-text-stroke:3px %s">%s</div>' % (color + '55', num) +
      '<h1 style="%s">%s<br>%s</h1>' % (H1, l1, l2) +
      '<div style="%s"></div>' % (RULE % color) +
      '<p style="%s">%s</p>' % (P, sub))

def a_duel():
    side = ('<div style="%swidth:200px;padding:19px 15px;text-align:center">'
            '<div style="%sfont-size:12px;color:%s;letter-spacing:.2em">%s</div>'
            '<div style="font-family:\'Outfit\',sans-serif;font-weight:900;font-size:28px;margin:7px 0 9px">%s</div>'
            '<div style="%sfont-size:23px;color:%s">%s</div></div>')
    return (prog([28, 0, 0]) +
      '<p style="%s">Duel en ligne</p>' % (KICK % GOLD) +
      '<div style="display:flex;align-items:center;gap:14px;margin-top:6px">' +
      side % (CARD, MONO, MUT, 'CELUI QUI LANCE', 'KAYS', MONO, GOLD, '10&quot;42') +
      '<div style="font-family:\'Outfit\',sans-serif;font-weight:900;font-size:48px;color:%s;'
      'text-shadow:0 0 25px rgba(248,205,74,.55)">VS</div>' % GOLD +
      side % (CARD, MONO, MUT, 'CELUI QUI RELÈVE', 'NORA', MONO, CYAN, '10&quot;39') +
      '</div>' +
      '<div style="%swidth:456px;padding:17px;text-align:center;margin-top:6px">'
      '<div style="font-size:19px;font-weight:800">Relever un défi rapporte '
      '<span style="color:%s">plus</span> que le lancer.</div></div>' % (CARD, GOLD) +
      '<p style="%s">Tous les duels comptent — lancés comme relevés.</p>' % P)

def a_lp():
    return (prog([44, 0, 0]) +
      '<p style="%s">Points de ligue</p>' % (KICK % GOLD) +
      '<div style="%swidth:456px;padding:29px 27px">' % CARD +
      '<div style="display:flex;align-items:center;justify-content:space-between">'
      '<span style="display:inline-flex;padding:6px 11px;border-radius:7px;border:1px solid rgba(248,205,74,.4);'
      'background:rgba(248,205,74,.08);%sfont-weight:700;font-size:15px;letter-spacing:.16em;color:%s">NATIONAL III</span>'
      '<span style="%sfont-size:26px;font-weight:700">100<span style="font-size:16px;color:%s"> LP</span></span></div>' % (MONO, GOLD, MONO, MUT) +
      '<div style="margin-top:19px;height:13px;border-radius:13px;background:rgba(255,255,255,.07);overflow:hidden">'
      '<div style="height:100%%;width:100%%;border-radius:13px;background:linear-gradient(90deg,#F8CD4A,#ffe89a)"></div></div>'
      '<div style="display:flex;justify-content:space-between;margin-top:9px">'
      '<span style="%sfont-size:12px;color:%s;letter-spacing:.12em">DIVISION III</span>'
      '<span style="%sfont-size:12px;color:%s;letter-spacing:.12em">100 LP → DIVISION II</span></div></div>' % (MONO, MUT, MONO, MUT) +
      '<div style="%sfont-size:48px;font-weight:700;color:%s;text-shadow:0 0 30px rgba(248,205,74,.4)">+27 LP</div>' % (MONO, GOLD) +
      '<div style="%sfont-size:41px;color:%s">Promotion</div>' % (H2, GOLD) +
      '<p style="%s">Cinq étages, quatre divisions chacun.<br>Le sommet n\'en a pas.</p>' % P)

def a_echelle():
    tiers = [('DÉPARTEMENTAL', BRZ), ('RÉGIONAL', SILV), ('NATIONAL', GOLD), ('ÉLITE', CYAN), ('LÉGENDE', FUX)]
    rows = []
    for i, (nom, c) in enumerate(tiers):
        if i < 4:
            divs = "".join('<b style="%sfont-size:13px;font-weight:700;color:rgba(255,255,255,.2);'
                           'border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:1px 6px">%s</b>' % (MONO, d)
                           for d in ['IV', 'III', 'II', 'I'])
        else:
            divs = ('<b style="%sfont-size:13px;font-weight:700;color:%s;border:1px solid %s55;'
                    'border-radius:4px;padding:1px 6px">SANS DIVISION</b>') % (MONO, c, c)
        rows.append('<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 17px;'
                    'border-radius:10px;border:1px solid %s5c;background:linear-gradient(90deg,%s1f,#0b1020 62%%);'
                    'box-shadow:0 0 19px %s33">'
                    '<span style="%sfont-weight:700;font-size:20px;letter-spacing:.14em;color:%s">%s</span>'
                    '<span style="display:flex;gap:5px">%s</span></div>' % (c, c, c, MONO, c, nom, divs))
    return (prog([58, 0, 0]) +
      '<p style="%s">L\'échelle</p>' % (KICK % GOLD) +
      '<div style="display:flex;flex-direction:column;gap:10px;width:456px">%s</div>' % "".join(rows) +
      '<p style="%s">De départemental IV à Légende.</p>' % P)

def a_nat():
    return (prog([76, 0, 0]) +
      '<p style="%s">Nouveau — nationalité</p>' % (KICK % GOLD) +
      '<div style="%swidth:456px;padding:28px;display:flex;flex-direction:column;align-items:center;gap:15px;position:relative">' % CARD +
      '<div style="%sfont-size:13px;color:%s;letter-spacing:.22em">CHOISIS TON DRAPEAU</div>' % (MONO, MUT) +
      '<div style="font-size:72px;line-height:1">🇫🇷</div>'
      '<div style="font-family:\'Outfit\',sans-serif;font-weight:900;font-size:32px;letter-spacing:.02em">FRANCE</div>'
      '<div style="position:absolute;right:19px;bottom:-21px;border:3px solid %s;color:%s;border-radius:8px;'
      'padding:6px 14px;%sfont-weight:700;font-size:22px;letter-spacing:.22em;background:rgba(11,16,32,.95);'
      'transform:rotate(-12deg)">DÉFINITIF</div></div>' % (GOLD, GOLD, MONO) +
      '<p style="%smargin-top:14px">Un seul choix, une seule fois.<br>'
      '<span style="color:%s">Détecté n\'est pas choisi</span> — tu joues de Bruxelles, tu cours pour le Maroc.</p>' % (P, CYAN))

def a_champ():
    rows = "".join(
      ('<div style="%spadding:15px 17px;display:flex;align-items:center;gap:13px;border-color:%s3a">'
       '<span style="font-size:29px;line-height:1">%s</span><span style="flex:1">'
       '<span style="display:block;%sfont-size:12px;letter-spacing:.22em;color:%s">%s</span>'
       '<span style="font-family:\'Outfit\',sans-serif;font-weight:800;font-size:20px">%s</span></span></div>')
      % (CARD, c, f, MONO, c, k, n)
      for k, n, f, c in [('NATIONAL', 'Championnat national de France', '🇫🇷', GOLD),
                         ('CONTINENTAL', "Championnat d'Europe", '🇪🇺', CYAN),
                         ('MONDIAL', 'Championnat du monde', '🌍', FUX)])
    meds = "".join(
      ('<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:7px;'
       'border:1px solid %s66;background:%s18;color:%s;%sfont-weight:700;font-size:13px;letter-spacing:.16em">'
       '<i style="width:8px;height:8px;border-radius:50%%;background:%s;display:inline-block"></i>%s</span>')
      % (c, c, c, MONO, c, s) for c, s in [(GOLD, 'FRA'), (SILV, 'EUR'), ('#C1803F', 'MONDE')])
    return (prog([100, 0, 0]) +
      '<p style="%s">La conséquence</p>' % (KICK % GOLD) +
      '<h2 style="%s">Ton drapeau<br>t\'ouvre les championnats</h2>' % H2 +
      '<div style="display:flex;flex-direction:column;gap:11px;width:456px">%s</div>' % rows +
      '<p style="%s">Une médaille reste accrochée à ton nom, partout dans le jeu.</p>' % P +
      '<div style="display:flex;gap:10px">%s</div>' % meds)

def a_salle():
    noms = ['KAYS', 'NORA', 'SAM', 'ILAN', 'MAYA', 'TEO', 'LINA', 'OMAR']
    slots = "".join(
      ('<div style="display:flex;align-items:center;gap:12px;padding:8px 13px;border-radius:9px;'
       'border:1px solid rgba(248,205,74,.33);background:rgba(248,205,74,.055)">'
       '<span style="width:29px;height:29px;border-radius:8px;display:flex;align-items:center;justify-content:center;'
       '%sfont-weight:700;font-size:15px;background:#111a30;color:%s;border:1px solid #1E293B">%d</span>'
       '<span style="font-family:\'Outfit\',sans-serif;font-weight:800;font-size:19px;flex:1">%s</span>'
       '<span style="%sfont-weight:700;font-size:13px;letter-spacing:.12em;color:%s">PRÊT</span></div>')
      % (MONO, GOLD, i + 1, n, MONO, GOLD) for i, n in enumerate(noms))
    return (prog([100, 26, 0]) +
      '<p style="%s">La salle</p>' % (KICK % CYAN) +
      '<h3 style="%s">De 1 à 8 couloirs — même les impairs</h3>' % H3 +
      '<div style="%swidth:456px;padding:13px;display:flex;flex-direction:column;gap:7px">%s</div>' % (CARD, slots) +
      '<p style="%s">Le départ attend que la piste soit pleine.</p>' % P)

def a_direct():
    noms = ['KAYS', 'NORA', 'SAM', 'ILAN', 'MAYA', 'TEO', 'LINA', 'OMAR']
    xs = [196, 232, 205, 168, 178, 152, 186, 161]
    rows = [lane(i + 1, n, xs[i], GOLD) for i, n in enumerate(noms)]
    return (prog([100, 56, 0]) +
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;width:456px">'
      '<span style="%s">En direct</span>'
      '<span style="%sfont-size:32px;font-weight:700;color:%s">3.72</span></div>' % (KICK % CYAN, MONO, GOLD) +
      track(rows) +
      '<p style="%s">Pas de « partez » diffusé : une date. Chacun part à la milliseconde exacte.</p>' % P)

def a_arrivee():
    rows = "".join(
      ('<div style="display:flex;align-items:center;gap:11px;width:456px;padding:10px 14px;border-radius:9px;'
       'border:1px solid %s55;background:%s0f">'
       '<span style="%sfont-weight:700;font-size:16px;color:%s;width:30px">%s</span>'
       '<span style="font-size:22px">%s</span>'
       '<span style="font-family:\'Outfit\',sans-serif;font-weight:800;font-size:19px;flex:1">%s</span>'
       '<span style="%sfont-weight:700;font-size:17px;color:%s">%s</span></div>')
      % (c, c, MONO, c, r, f, n, MONO, c, t)
      for r, n, f, t, c in [('1', 'NORA', '🇫🇷', '10&quot;38', GOLD), ('2', 'KAYS', '🇲🇦', '10&quot;42', SILV),
                            ('3', 'SAM', '🇨🇦', '10&quot;51', '#C1803F')])
    return (prog([100, 100, 0]) +
      '<p style="%s">Arrivée</p>' % (KICK % CYAN) +
      '<h2 style="%s">Personne ne connaît<br>l\'issue avant la ligne</h2>' % H2 +
      '<div style="display:flex;flex-direction:column;gap:10px">%s</div>' % rows)

def a_equipe():
    slots = "".join(
      ('<div style="display:flex;align-items:center;gap:12px;width:456px;padding:11px 15px;border-radius:10px;'
       'border:1px solid rgba(240,171,252,.33);background:rgba(240,171,252,.055)">'
       '<span style="width:31px;height:31px;border-radius:8px;display:flex;align-items:center;justify-content:center;'
       '%sfont-weight:700;font-size:16px;background:#111a30;color:%s;border:1px solid #1E293B">%d</span>'
       '<span style="font-family:\'Outfit\',sans-serif;font-weight:800;font-size:20px;flex:1">%s</span>'
       '<span style="%sfont-weight:700;font-size:13px;letter-spacing:.12em;color:%s">✓ DANS L\'ÉQUIPE</span></div>')
      % (MONO, FUX, i + 1, n, MONO, FUX) for i, n in enumerate(['KAYS', 'NORA', 'SAM', 'ILAN']))
    return (prog([100, 100, 24]) +
      '<p style="%s">L\'équipe</p>' % (KICK % FUX) +
      '<h3 style="%s">Personne n\'est inscrit sans l\'avoir accepté</h3>' % H3 +
      '<div style="display:flex;flex-direction:column;gap:9px">%s</div>' % slots +
      '<p style="%s">Quatre noms, quel que soit l\'ordre : c\'est toujours la même équipe.</p>' % P)

def a_relais():
    baton = ('<span style="width:17px;height:6px;border-radius:4px;background:%s;'
             'box-shadow:0 0 13px rgba(248,205,74,.7);margin-left:4px"></span>') % GOLD
    labs = ['1ᵉʳ · KAYS', '2ᵉ · NORA', '3ᵉ · SAM', '4ᵉ · ILAN']
    xs = [337, 218, 22, 22]
    rows = [lane(i + 1, labs[i], xs[i], FUX, baton if i == 1 else "") for i in range(4)]
    return (prog([100, 100, 55]) +
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;width:456px">'
      '<span style="%s">Relais 4×100</span>'
      '<span style="%sfont-size:30px;font-weight:700;color:%s">16.63</span></div>' % (KICK % FUX, MONO, FUX) +
      track(rows) +
      '<h3 style="%scolor:%s">2<sup style="font-size:13px">e</sup> relayeur</h3>' % (H3, FUX) +
      '<p style="%s">Le témoin passe dans la zone. Ou il tombe.</p>' % P)

def a_classement():
    rows = "".join(
      ('<div style="display:flex;align-items:center;gap:11px;width:456px;padding:10px 14px;border-radius:9px;'
       'border:1px solid %s;background:%s">'
       '<span style="%sfont-weight:700;font-size:16px;color:%s;width:30px">%s</span>'
       '<span style="font-family:\'Outfit\',sans-serif;font-weight:800;font-size:19px;flex:1">%s</span>'
       '<span style="%sfont-weight:700;font-size:17px;color:%s">%s</span></div>')
      % ('rgba(240,171,252,.53)' if me else LINE, 'rgba(240,171,252,.07)' if me else '#0b1020',
         MONO, FUX if me else MUT, r, n, MONO, FUX if me else GOLD, t)
      for r, n, t, me in [('1', 'LES FOUDRES', '41&quot;08', True), ('2', 'TEAM AZUR', '41&quot;62', False),
                          ('3', 'LES RAPACES', '42&quot;15', False), ('4', 'NORD RELAY', '42&quot;90', False)])
    return (prog([100, 100, 100]) +
      '<p style="%s">Classement des équipes</p>' % (KICK % FUX) +
      '<div style="display:flex;flex-direction:column;gap:9px">%s</div>' % rows)

def a_outro():
    return (logo(100) +
      '<h1 style="%sfont-size:66px;letter-spacing:.02em">SPRINTER</h1>' % H1 +
      '<div style="%s"></div>' % (RULE % GOLD) +
      '<h3 style="%sfont-size:22px">Duel en ligne · Course en direct · Relais</h3>' % H3 +
      '<p style="%s">sprinter-game.com</p>' % (KICK % GOLD))

def a_main():
    def row(k, v):
        return ('<div style="display:flex;gap:16px;align-items:baseline">'
                '<span style="%sfont-size:12px;letter-spacing:.18em;color:%s;width:118px;flex:none">%s</span>'
                '<span style="font-size:16px;font-weight:600;color:%s">%s</span></div>') % (MONO, MUT, k, FG, v)
    plan = [('00:00 – 00:03,4', 'Ouverture — logo, « la mise à jour », les 3 nouveautés'),
            ('00:03,4 – 00:28,0', 'Chapitre 01 — duel en ligne, points de ligue, nationalité, championnats'),
            ('00:28,0 – 00:43,6', 'Chapitre 02 — course en direct, 1 à 8 couloirs, photo-finish'),
            ('00:43,6 – 00:58,2', 'Chapitre 03 — relais 4×100, équipe, témoin, classement'),
            ('00:58,2 – 01:01,5', 'Sortie — logo, récap, sprinter-game.com')]
    plan_html = "".join(
      ('<div style="display:flex;gap:14px;align-items:baseline;padding:9px 0;border-bottom:1px solid rgba(30,41,59,.75)">'
       '<span style="%sfont-size:12px;font-weight:700;color:%s;width:132px;flex:none">%s</span>'
       '<span style="font-size:15px;font-weight:600;line-height:1.35">%s</span></div>') % (MONO, GOLD, t, d)
      for t, d in plan)
    sw = "".join(
      ('<div style="display:flex;flex-direction:column;gap:6px;align-items:center">'
       '<div style="width:52px;height:52px;border-radius:9px;background:%s;border:1px solid rgba(255,255,255,.09)"></div>'
       '<span style="%sfont-size:10px;color:%s;letter-spacing:.06em">%s</span></div>') % (c, MONO, MUT, n)
      for c, n in [('#060913', 'fond'), (GOLD, 'primaire'), (CYAN, 'direct'), (FUX, 'relais'),
                   ('#2563EB', 'accent'), (LINE, 'bordure')])
    return ('<div style="display:flex;flex-direction:column;gap:26px;width:100%;align-items:flex-start;text-align:left">'
      + logo(76) +
      '<div><div style="%stext-align:left">Storyboard</div>'
      '<h1 style="%sfont-size:52px;text-align:left;margin-top:9px">Sprinter<br>vidéo nouveautés</h1></div>' % (KICK % GOLD, H1) +
      '<div style="%s"></div>' % (RULE % GOLD) +
      '<div style="display:flex;flex-direction:column;gap:7px;width:100%">'
      + row('FORMAT', '1080 × 1920 — 9:16 vertical')
      + row('CADENCE', '30 images/s')
      + row('DURÉE', '61,5 s (1 845 images)')
      + row('ENCODAGE', 'H.264 High · yuv420p · faststart')
      + row('SON', 'aucun — musique à poser au montage')
      + row('DESTINATION', 'Reels · TikTok · Shorts') +
      '</div>'
      '<div style="width:100%%"><div style="%stext-align:left;margin-bottom:8px">Chapitrage</div>%s</div>' % (KICK % GOLD, plan_html) +
      '<div style="width:100%%"><div style="%stext-align:left;margin-bottom:11px">Palette</div>'
      '<div style="display:flex;gap:13px">%s</div></div>' % (KICK % GOLD, sw) +
      '<div style="width:100%%"><div style="%stext-align:left;margin-bottom:8px">Typographies</div>'
      '<div style="font-size:15px;font-weight:600;color:%s;line-height:1.5">'
      'Outfit 900 — titres · Plus Jakarta Sans 600/800 — textes · Space Mono 700 — chiffres et libellés</div></div>' % (KICK % GOLD, MUT) +
      '</div>')

TPL = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&family=Space+Mono:wght@400;700&display=swap">
  <style>
    body { margin: 0; }
    a { color: #F8CD4A; } a:hover { color: #FFE08A; }
  </style>
</helmet>
<div style="%s">
%s
</div>
</x-dc>
</body>
</html>
"""

BOARDS = [
  ('Main.dc.html',           720, a_main()),
  ('S01Ouverture.dc.html',   540, a_intro()),
  ('S16Sortie.dc.html',      540, a_outro()),
  ('S02Titre01.dc.html',     540, a_titre('01', 'Duel', 'en ligne', GOLD,
      "Un classement qui ne récompense pas la vitesse pure.<br>Il récompense l'engagement.")),
  ('S03Duel.dc.html',        540, a_duel()),
  ('S04PointsLigue.dc.html', 540, a_lp()),
  ('S05Echelle.dc.html',     540, a_echelle()),
  ('S06Nationalite.dc.html', 540, a_nat()),
  ('S07Championnats.dc.html',540, a_champ()),
  ('S08Titre02.dc.html',     540, a_titre('02', 'Course', 'en direct', CYAN,
      "Jusqu'à 8 coureurs. Une piste.<br>Tout le monde part en même temps.")),
  ('S09Salle.dc.html',       540, a_salle()),
  ('S10Direct.dc.html',      540, a_direct()),
  ('S11Arrivee.dc.html',     540, a_arrivee()),
  ('S12Titre03.dc.html',     540, a_titre('03', 'Relais', '4×100', FUX,
      "Quatre noms. Une équipe.<br>Un témoin à ne pas lâcher.")),
  ('S13Equipe.dc.html',      540, a_equipe()),
  ('S14Relais.dc.html',      540, a_relais()),
  ('S15Classement.dc.html',  540, a_classement()),
]

for name, w, body in BOARDS:
    frame = FRAME if w == 540 else FRAME.replace('width:540px', 'width:720px').replace('justify-content:center', 'justify-content:flex-start').replace('height:960px', 'height:1080px')
    with io.open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(TPL % (frame, body))

# ------------------------------------------------------------- canvas.json
TITRES = {
 'Main.dc.html': 'Plan de la vidéo', 'S01Ouverture.dc.html': '00:00 · Ouverture',
 'S16Sortie.dc.html': '00:58,2 · Sortie', 'S02Titre01.dc.html': '00:03,4 · Titre 01',
 'S03Duel.dc.html': '00:05,4 · Le duel', 'S04PointsLigue.dc.html': '00:09,4 · Points de ligue',
 'S05Echelle.dc.html': '00:13,8 · L’échelle', 'S06Nationalite.dc.html': '00:18,0 · Nationalité',
 'S07Championnats.dc.html': '00:22,8 · Championnats', 'S08Titre02.dc.html': '00:28,0 · Titre 02',
 'S09Salle.dc.html': '00:30,0 · La salle', 'S10Direct.dc.html': '00:34,0 · La course',
 'S11Arrivee.dc.html': '00:40,4 · L’arrivée', 'S12Titre03.dc.html': '00:43,6 · Titre 03',
 'S13Equipe.dc.html': '00:45,6 · L’équipe', 'S14Relais.dc.html': '00:49,8 · Le témoin',
 'S15Classement.dc.html': '00:55,4 · Classement',
}
ROWS = [
  (['Main.dc.html', 'S01Ouverture.dc.html', 'S16Sortie.dc.html'], 0),
  (['S02Titre01.dc.html', 'S03Duel.dc.html', 'S04PointsLigue.dc.html', 'S05Echelle.dc.html',
    'S06Nationalite.dc.html', 'S07Championnats.dc.html'], 1240),
  (['S08Titre02.dc.html', 'S09Salle.dc.html', 'S10Direct.dc.html', 'S11Arrivee.dc.html'], 2360),
  (['S12Titre03.dc.html', 'S13Equipe.dc.html', 'S14Relais.dc.html', 'S15Classement.dc.html'], 3480),
]
arts, x = [], 0
for files, y in ROWS:
    x = 0
    for fn in files:
        main = fn == 'Main.dc.html'
        w = 720 if main else 540
        arts.append({'file': fn, 'x': x, 'y': y, 'w': w, 'h': 1080 if main else 960, 'title': TITRES[fn]})
        x += w + 110
notes = [
  {'id': 'brief', 'x': 0, 'y': -170, 'w': 900,
   'text': "Master vidéo : 1080×1920, 30 i/s, 61,5 s, muet — la musique se pose au montage.\nChaque cadre ci-dessous est une étape du film, à l’échelle 1/2 (540×960)."},
  {'id': 'ch1', 'x': 0, 'y': 1120, 'w': 900,
   'text': "Chapitre 01 · duel en ligne — 00:03,4 → 00:28,0\nDu défi relevé aux championnats ouverts par le drapeau."},
  {'id': 'ch2', 'x': 0, 'y': 2240, 'w': 900,
   'text': "Chapitre 02 · course en direct — 00:28,0 → 00:43,6\nSalle de 1 à 8 couloirs, départ synchronisé, arrivée serrée."},
  {'id': 'ch3', 'x': 0, 'y': 3360, 'w': 900,
   'text': "Chapitre 03 · relais 4×100 — 00:43,6 → 00:58,2\nÉquipe de quatre, passages de témoin, classement des équipes."},
]
with io.open(os.path.join(OUT, 'canvas.json'), 'w', encoding='utf-8') as f:
    json.dump({'artboards': arts, 'annotations': notes, 'launch': {'view': 'canvas'}},
              f, ensure_ascii=False, indent=2)
print("artboards:", len(BOARDS))
