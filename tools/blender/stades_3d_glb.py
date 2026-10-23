# -----------------------------------------------------------------------
# SPRINTER — les stades du jeu, exportes en GLB pour la course 3D.
#
#   Blender -b --factory-startup -P tools/blender/stades_3d_glb.py -- [stade ...]
#
# Rien n'est remodele : ce sont les pieces des images 2D (decors/pieces*.py,
# rendues par fabriquer.py), construites par les memes fonctions et ecrits tels quels, dans le repere du
# jeu (x le long de la piste, z en haut, sans le miroir de vue.py).
#
# LA MATIERE DU JEU NE PASSE PAS L'EXPORT. `matiere.peinture` est une formule
# de lumiere en noeuds, que glTF ne lit pas : tout sortait noir. On retient
# donc la couleur donnee a chaque peinture et on la remplace, juste avant
# l'export, par une matiere standard de cette couleur. Les matieres deja
# standard (l'Arc-en-ciel en eclairage reel, les textures Tripo) restent.
#
# Le public, lui, sort en cartes : voir public_cartes.py.
#
# Sortie : public/modeles/stades/<stade>/<piece>.glb
# -----------------------------------------------------------------------
import bpy
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, 'decors'))
import matiere
import palettes
import pieces
import pieces_arcenciel  # noqa: F401  (ajoute ses pieces a DEBOUT)
import pieces_tripo      # noqa: F401

RACINE = os.path.abspath(os.path.join(ICI, '..', '..'))
# --ultra : le palier ULTRA de la course 3D (« les assets dans leur plein potentiel, sans
# compression ni reduction de qualite », l'auteur, 23/10) — textures d'origine, sans perte,
# geometrie non compressee ; seul plafond, 250 000 faces par piece (une maison Tripo en a
# 1,8 million, et la ruelle en aligne des dizaines : aucun appareil ne les tiendrait)
ULTRA = '--ultra' in sys.argv
SORTIE = os.path.join(RACINE, 'public', 'modeles', 'stades-ultra' if ULTRA else 'stades')

_peinture = matiere.peinture


def peinture_retenue(nom, couleur, liseret=1.0, alpha=1.0, paliers=0):
    m = _peinture(nom, couleur, liseret=liseret, alpha=alpha, paliers=paliers)
    m['rgb'] = list(couleur)
    m['alpha'] = alpha
    return m


matiere.peinture = peinture_retenue


def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def standard(m):
    """La peinture du jeu remplacee par une matiere que glTF sait lire."""
    if 'rgb' not in m:
        return
    r, g, b = (lin(v) for v in m['rgb'])
    a = float(m.get('alpha', 1.0))
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf.inputs['Base Color'].default_value = (r, g, b, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Alpha'].default_value = a
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    if a < 1.0:
        m.blend_method = 'BLEND'


def vider():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# Les textures Tripo font 2 a 4 k : sept megaoctets la piece. Vue de la piste,
# une piece ne depasse pas quelques centaines de pixels a l'ecran.
TEXTURE_MAX = None if ULTRA else 1024
FACES_MAX = 250000 if ULTRA else 30000


def exporter(chemin):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    for m in bpy.data.materials:
        standard(m)
    # ... et leurs maillages, jusqu'a un million huit cent mille faces : decimes
    for o in bpy.data.objects:
        if o.type == 'MESH' and len(o.data.polygons) > FACES_MAX:
            d = o.modifiers.new('alleger', 'DECIMATE')
            d.ratio = FACES_MAX / len(o.data.polygons)
    for im in bpy.data.images:
        w, h = im.size
        if TEXTURE_MAX and max(w, h) > TEXTURE_MAX:
            k = TEXTURE_MAX / max(w, h)
            im.scale(max(1, int(w * k)), max(1, int(h * k)))
    for o in bpy.data.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=chemin, export_format='GLB', use_selection=True,
                              export_yup=False, export_apply=True, export_animations=False,
                              export_image_format='AUTO' if ULTRA else 'WEBP',
                              export_meshopt_compression_enable=not ULTRA)
    print('ECRIT', os.path.relpath(chemin, RACINE), os.path.getsize(chemin) // 1024, 'Ko')


def piece(stade, nom):
    vider()
    racine = bpy.data.objects.new(nom, None)
    bpy.context.collection.objects.link(racine)
    pieces.commencer(racine)
    P = palettes.PALETTES[stade]
    (pieces.DEBOUT.get(nom) or pieces.AU_SOL.get(nom))(P)
    bpy.context.view_layer.update()
    exporter(os.path.join(SORTIE, stade, nom + '.glb'))


def main():
    args = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if not a.startswith('--')]
    stades = [s for s in palettes.STADES if s != 'materiel']
    for st in (args or stades):
        S = palettes.STADES[st]
        for nom in S['debout'] + S['sol']:
            try:
                piece(st, nom)
            except Exception as err:  # une piece qui casse n'arrete pas les autres
                print('ECHEC', st, nom, err)


main()
