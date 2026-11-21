import json, sys
SLIDES = [
  ("accueil",  "LE SPRINT<br>DANS TA POCHE", "100, 200, 400 m · haies · relais"),
  ("depart-2", "PRÊT ?<br>PARTEZ !", "Un faux départ, et la course est perdue"),
  ("depart-4", "TAPE<br>EN RYTHME", "Un bon départ, une foulée qui file"),
  ("monde-4",  "DE L’ÉCOLE<br>AUX JEUX", "Six étapes, six stades, un seul chrono"),
  ("fin-4",    "DÉFIE<br>TES AMIS", "Duels, TOP 500 et championnats"),
]
FMT = {"iphone": (1290, 2796, 1000, 122, 58), "ipad": (2064, 2752, 1000, 140, 64)}
for fmt, (W, H, larg, titre_px, sous_px) in FMT.items():
  for i, (img, titre, sous) in enumerate(SLIDES, 1):
    haut = round(larg * 2220 / 1080)
    html = f'''<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Public+Sans:wght@600;700&display=block" rel="stylesheet">
<style>
html,body{{margin:0;width:{W}px;height:{H}px;overflow:hidden}}
body{{background:
  repeating-linear-gradient(115deg, rgba(255,255,255,.0) 0 120px, rgba(255,255,255,.18) 120px 128px),
  linear-gradient(170deg,#ffe45c 0%,#ffcc1a 55%,#ff9f1a 100%);
  font-family:'Public Sans',sans-serif;display:flex;flex-direction:column;align-items:center}}
h1{{font-family:'Archivo Black',sans-serif;font-size:{titre_px}px;line-height:.98;letter-spacing:-1px;color:#0b1020;text-align:center;margin:{round(H*0.045)}px 40px 0}}
p{{font-weight:700;font-size:{sous_px}px;color:#3a2904;margin:28px 40px 0;text-align:center}}
.ecran{{margin-top:auto;margin-bottom:{round(H*0.035)}px;width:{larg}px;height:{haut}px;border-radius:70px;border:16px solid #0b1020;overflow:hidden;
  box-shadow:0 40px 90px rgba(80,40,0,.45);background:#0b1020}}
.ecran img{{width:100%;height:100%;display:block}}
</style></head><body><h1>{titre}</h1><p>{sous}</p><div class="ecran"><img src="../hd/{img}.png"></div></body></html>'''
    open(f"sortie/{fmt}-{i}.html","w").write(html)
