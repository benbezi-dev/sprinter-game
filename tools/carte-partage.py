#!/usr/bin/env python3
"""
La carte de partage du jeu — public/partage-1200x630.png

C'est l'image qu'affichent WhatsApp, Discord, X, Facebook et iMessage quand
quelqu'un envoie le lien du jeu. Elle etait absente : les balises og:image
pointaient vers l'icone carree de 512 px, que les reseaux rognaient ou
reduisaient a une vignette alors que la page s'annonce en
« summary_large_image ». 1200x630 est le format qu'ils attendent tous.

POURQUOI CE FICHIER N'EST PAS DU JAVASCRIPT
Le langage visuel du jeu vit dans src/game/trace-affiche.js, et il dessine sur
un canvas : il lui faut un navigateur. Cette carte-ci, elle, ne change qu'au
rythme de la charte — quelques fois par an — et n'a donc rien a faire dans le
build du jeu. On la fabrique une fois, on la commite, et le site la sert comme
un fichier statique. Le jeu ne depend de rien de tout ceci : ni Python, ni
Pillow n'apparaissent dans package.json.

Les valeurs sont reprises de trace-affiche.js (fonction poserFond) pour que la
carte, les affiches partagees par les joueurs et le pictogramme se lisent comme
un seul dessin : la nuit #060913, la lueur doree #F8CD4A, les couloirs en
diagonale, et Outfit pour le titre.

REFABRIQUER L'IMAGE
    pip install pillow
    python3 tools/carte-partage.py           # depuis la racine du depot

Les polices sont cherchees dans POLICES ci-dessous ; Outfit se telecharge
depuis fonts.google.com/specimen/Outfit si le dossier ne l'a pas.
"""

import math
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
except ImportError:
    sys.exit("Pillow est requis : pip install pillow")

# 1200x630 : le format des grandes cartes de partage (Open Graph, X).
L, H = 1200, 630
NUIT = (6, 9, 19)          # --background du jeu
OR = (248, 205, 74)        # --primary du jeu
CREME = (238, 240, 248)    # --foreground du jeu

SORTIE = 'public/partage-1200x630.png'
PICTO = 'assets/icon.png'  # la source de @capacitor/assets, deja a la charte

# Ou trouver Outfit. Le premier dossier qui la contient gagne.
POLICES = [
    'tools/polices',
    os.path.expanduser('~/.fonts'),
    '/usr/share/fonts/truetype/outfit',
    '/mnt/skills/examples/canvas-design/canvas-fonts',
]


def police(fichier, taille):
    for dossier in POLICES:
        chemin = os.path.join(dossier, fichier)
        if os.path.exists(chemin):
            return ImageFont.truetype(chemin, taille)
    sys.exit(f"police introuvable : {fichier} (cherchee dans {', '.join(POLICES)})")


if not os.path.exists(PICTO):
    sys.exit(f"{PICTO} introuvable — lance ce script depuis la racine du depot")

img = Image.new('RGB', (L, H), NUIT)

# --- la lueur doree, comme poserFond() de trace-affiche.js -------------------
# Un degrade radial pose haut et a gauche du titre : c'est lui qui fait la
# « nuit de stade » du jeu plutot qu'un simple fond noir.
lueur = Image.new('L', (L, H), 0)
px = lueur.load()
cx, cy, rayon = L * 0.40, H * 0.02, L * 0.62
for y in range(H):
    for x in range(0, L, 2):
        d = math.hypot(x - cx, y - cy) / rayon
        v = 0 if d >= 1 else int(255 * 0.16 * (1 - d) ** 1.9)
        px[x, y] = v
        if x + 1 < L:
            px[x + 1, y] = v
img = Image.composite(Image.new('RGB', (L, H), OR),
                      img, lueur.filter(ImageFilter.GaussianBlur(2)))

# --- les couloirs ------------------------------------------------------------
# trace-affiche.js pose trois traits en fuite, horizontaux, parce que ses
# affiches sont verticales et que le chrono y tient le centre. Ici la carte est
# large et le pictogramme est dans l'image : les couloirs suivent donc SA pente,
# pour que les deux se lisent comme un seul dessin.
couloirs = Image.new('L', (L * 2, H * 2), 0)
dc = ImageDraw.Draw(couloirs)
for i in range(3):
    dec = i * 470 - 240
    dc.polygon([(dec, H * 2), (dec + 150, H * 2),
                (dec + 1050, -20), (dec + 900, -20)], fill=15)
img = Image.composite(
    Image.new('RGB', (L, H), OR), img,
    couloirs.resize((L, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1)))

# --- le pictogramme, a droite, en pastille arrondie -------------------------
COTE = 300
icone = Image.open(PICTO).convert('RGB').resize((COTE, COTE), Image.LANCZOS)
# Le masque est trace en quadruple puis reduit : c'est ce qui donne un bord
# arrondi net plutot que l'escalier de pixels d'un rounded_rectangle direct.
masque = Image.new('L', (COTE * 4, COTE * 4), 0)
ImageDraw.Draw(masque).rounded_rectangle(
    [0, 0, COTE * 4 - 1, COTE * 4 - 1], radius=COTE * 4 * 0.22, fill=255)
masque = masque.resize((COTE, COTE), Image.LANCZOS)

MARGE = 84
IX, IY = L - COTE - MARGE, (H - COTE) // 2

halo = Image.new('L', (L, H), 0)
ImageDraw.Draw(halo).rounded_rectangle(
    [IX - 10, IY - 10, IX + COTE + 10, IY + COTE + 10], radius=COTE * 0.26, fill=44)
img = Image.composite(Image.new('RGB', (L, H), OR), img,
                      halo.filter(ImageFilter.GaussianBlur(34)))
img.paste(icone, (IX, IY), masque)

# --- le texte ---------------------------------------------------------------
d = ImageDraw.Draw(img, 'RGBA')

# L'inter-lettrage du sur-titre est ecrit dans la chaine : Pillow n'a pas de
# reglage de letterSpacing, contrairement au canvas.
d.text((MARGE, 150), 'J E U   D E   S P R I N T',
       font=police('Outfit-Bold.ttf', 22), fill=(255, 255, 255, 120))
d.text((MARGE - 6, 186), 'SPRINTER', font=police('Outfit-Bold.ttf', 128), fill=OR)
d.line([(MARGE, 344), (MARGE + 120, 344)], fill=(248, 205, 74, 170), width=4)

corps = police('Outfit-Regular.ttf', 33)
d.text((MARGE, 378), 'Alterne les deux touches.', font=corps, fill=CREME + (240,))
d.text((MARGE, 420), 'Six étapes, un seul chrono à battre.', font=corps, fill=CREME + (240,))
d.text((MARGE, 486), '100 m   ·   200 m   ·   400 m',
       font=police('Outfit-Bold.ttf', 27), fill=OR + (225,))

# Le pied, comme poserPied() de trace-affiche.js : un filet, l'adresse a
# gauche, la mention a droite.
pied = police('Outfit-Bold.ttf', 22)
d.line([(MARGE, H - 74), (L - MARGE, H - 74)], fill=(255, 255, 255, 26), width=1)
d.text((MARGE, H - 54), 'sprinter-game.com', font=pied, fill=(255, 255, 255, 118))
mention = 'GRATUIT · SANS INSTALLATION'
d.text((L - MARGE - d.textlength(mention, font=pied), H - 54), mention,
       font=pied, fill=(255, 255, 255, 77))

img.save(SORTIE, optimize=True)
print(f'{SORTIE} — {img.size[0]}x{img.size[1]}, {os.path.getsize(SORTIE) // 1024} ko')
