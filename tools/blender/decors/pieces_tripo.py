# -----------------------------------------------------------------------
# SPRINTER — les pieces generees par Tripo, posees dans le repere du jeu.
#
# Les autres pieces sont modelisees ici meme, en boites et en tubes. Celles-
# ci viennent de Tripo Studio : une photo du lieu, une image propre generee
# d'apres elle (sans personne, sans marque), puis le modele 3D texture. Les
# sources — photos, variantes, modeles bruts — sont hors du depot, dans
# BENBEZI/assets-sources/tripo-stade-jean-delbert/ (voir le memo du 03/10).
#
# Ce module ne fait que trois choses a un modele Tripo :
#
#   1. LE METTRE A L'ECHELLE. Tripo rend un objet d'environ une unite de
#      haut ; on le ramene a sa taille reelle, mesuree sur la photo du lieu.
#   2. LE TOURNER ET LE POSER dans le repere de pieces.py : +X le long de la
#      piste, +Y vers elle, pied a l'origine. La camera du jeu regarde depuis
#      la pelouse : la face qu'on veut voir regarde donc -Y, a l'oppose de la
#      piste (voir `quart`).
#   3. LUI DONNER LA LUMIERE DU JEU. Sa texture devient la couleur de base de
#      la formule de matiere.py, a la place d'un aplat : la piece prend le
#      soleil comme les coureurs, et garde ses fenetres, sa grille et son
#      escalier. La texture est lue SANS conversion de couleur, comme les
#      couleurs du jeu (voir matiere.rgb).
#
# Un modele Tripo HD fait pres de deux millions de faces. On le reduit avant
# le rendu : a quatre-vingt-seize pixels par metre, une cabine de six metres
# n'en montre pas le dixieme.
# -----------------------------------------------------------------------

import bpy
import math
import os
from mathutils import Matrix, Vector

import matiere as M
import pieces as PC

SOURCES = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..',
                       'assets-sources', 'tripo-stade-jean-delbert', 'modeles')

# nom -> le fichier, la dimension qui fixe l'echelle (en metres, mesuree sur
# la photo), l'axe qui la porte dans le modele importe, et le quart de tour
# qui amene sa face avant vers -Y du jeu (vers la camera).
MODELES = {
    # La cabine du chronometrage : six metres de long, sur ses pilotis. Sa
    # facade — la baie grillagee, la porte, l'escalier — tourne le dos a la
    # piste : la camera du jeu regarde depuis la pelouse, et une cabine
    # tournee vers les couloirs ne lui montrait que son mur aveugle.
    'cabine': dict(f='cabine-tripo-meshopt.glb', taille=6.0, axe='long', quart=2),
    # Le mat d'eclairage : vingt-cinq metres, projecteurs compris.
    'mat': dict(f='mat-tripo-meshopt.glb', taille=25.0, axe='z', quart=0),
}

# LA RUELLE DE LA NUIT DU MOLOSSE (09/10, « creer un decor dans une ruelle,
# on fait le decor avec Tripo »). Texte vers 3D, compte secondaire de
# l'auteur ; registre dans assets-sources/molosse-ruelle/projets-tripo.txt.
RUELLE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..',
                      'assets-sources', 'molosse-ruelle', 'modeles')
MODELES.update({
    # La maison etroite a colombages : trois etages et le pignon, onze metres.
    'maison': dict(chemin=os.path.join(RUELLE, 'facade-tripo-meshopt.glb'), taille=11.0,
                   axe='z', quart=0),
    # Le reverbere en fonte : quatre metres vingt, lanterne comprise.
    'reverbere': dict(chemin=os.path.join(RUELLE, 'reverbere-tripo-meshopt.glb'), taille=4.2,
                      axe='z', quart=0),
})

# La part des faces gardee au rendu (voir l'en-tete).
REDUCTION = 0.12


def _texture(mat_tripo):
    """L'image de couleur de base du materiau Tripo, ou None."""
    if not mat_tripo or not mat_tripo.use_nodes:
        return None
    for n in mat_tripo.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            lien = n.inputs['Base Color'].links
            if lien and lien[0].from_node.type == 'TEX_IMAGE':
                return lien[0].from_node.image
    for n in mat_tripo.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            return n.image
    return None


def matiere_texturee(nom, image, gain=1.0):
    """La matiere a facettes du jeu, sa couleur prise dans `image`."""
    m = M.peinture(nom, (255, 255, 255))
    nt = m.node_tree
    rgb = next(n for n in nt.nodes if n.type == 'RGB')
    tex = nt.nodes.new('ShaderNodeTexImage')
    image.colorspace_settings.name = 'Non-Color'
    tex.image = image
    sortie = tex.outputs['Color']
    if gain != 1.0:
        g = nt.nodes.new('ShaderNodeVectorMath')
        g.operation = 'SCALE'
        g.inputs['Scale'].default_value = gain
        nt.links.new(tex.outputs['Color'], g.inputs[0])
        sortie = g.outputs[0]
    for l in list(rgb.outputs[0].links):
        nt.links.new(sortie, l.to_socket)
    nt.nodes.remove(rgb)
    return m


def _cache(nom, cfg, gain):
    """Le fichier ou garder le modele deja reduit, mis a l'echelle et peint.

    fabriquer.py vide la scene a CHAQUE cap ; sans cache, un modele Tripo de
    deux millions de faces etait reimporte et reduit vingt fois (six minutes
    chacune pour la maison de la ruelle). La cle suit le fichier source et
    les reglages : un modele change ou une autre reduction refont le cache.
    """
    src = cfg.get('chemin') or os.path.join(SOURCES, cfg['f'])
    cle = '%s-%d-%s-%s-%s-%s' % (nom, int(os.path.getmtime(src)), REDUCTION, cfg['taille'],
                                 cfg['quart'], gain)
    return os.path.join('/tmp', 'tripo-cache-%s.blend' % cle)


def importer(nom, gain=1.0):
    """Importe le modele `nom`, a l'echelle et a sa place ; rend l'objet."""
    cfg = MODELES[nom]
    f_cache = _cache(nom, cfg, gain)
    if os.path.exists(f_cache):
        with bpy.data.libraries.load(f_cache) as (src, dst):
            dst.meshes = list(src.meshes)
        me = dst.meshes[0]
        o = bpy.data.objects.new('tripo_' + nom, me)
        bpy.context.collection.objects.link(o)
        o.parent = PC._racine
        return o
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=cfg.get('chemin') or os.path.join(SOURCES, cfg['f']))
    neufs = [o for o in bpy.data.objects if o not in avant and o.type == 'MESH']
    if len(neufs) != 1:
        raise RuntimeError('%s : %d maillages importes, un attendu' % (nom, len(neufs)))
    o = neufs[0]
    # les transformations de l'import dans le maillage, et plus de parent
    o.parent = None
    me = o.data
    me.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
    for x in list(bpy.data.objects):
        if x not in avant and x is not o:
            bpy.data.objects.remove(x, do_unlink=True)

    # la reduction, appliquee : le rendu et la portee la lisent toutes deux
    dec = o.modifiers.new('reduction', 'DECIMATE')
    dec.ratio = REDUCTION
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier=dec.name)

    # l'echelle
    vs = [v.co for v in me.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    dim = mx - mn
    ref = dim.z if cfg['axe'] == 'z' else max(dim.x, dim.y)
    k = cfg['taille'] / ref
    # pied a l'origine : centre de l'empreinte, bas du modele a z = 0
    centre = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    # La scene Blender importe le modele dans SON repere ; la piece doit etre
    # dans celui du jeu (X le long de la piste). La cabine importee a sa
    # longueur sur Y : un quart de tour la couche le long de la piste, puis
    # `quart` quarts de plus amenent sa face avant ou on la veut.
    tours = cfg['quart'] + (1 if cfg['axe'] == 'long' and dim.y > dim.x else 0)
    me.transform(Matrix.Rotation(math.pi / 2 * tours, 4, 'Z') @
                 Matrix.Scale(k, 4) @ Matrix.Translation(-centre))

    # la lumiere du jeu, sa texture en couleur de base
    image = _texture(me.materials[0] if me.materials else None)
    if image is None:
        raise RuntimeError('%s : pas de texture de couleur dans le modele Tripo' % nom)
    me.materials.clear()
    PC._poser(o, matiere_texturee('tripo_' + nom, image, gain))
    # l'image doit voyager dans le cache : elle vient du glb, emballee
    if not image.packed_file:
        image.pack()
    bpy.data.libraries.write(f_cache, {me}, fake_user=True, compress=True)
    return o


def cabine(P):
    importer('cabine', gain=P.get('gainTripo', 1.0))


def mat(P):
    importer('mat', gain=P.get('gainTripo', 1.0))


def maison(P):
    importer('maison', gain=P.get('gainTripo', 1.0))


def reverbere(P):
    importer('reverbere', gain=P.get('gainTripo', 1.0))


PC.DEBOUT.update({'cabine': cabine, 'mat': mat, 'maison': maison, 'reverbere': reverbere})
