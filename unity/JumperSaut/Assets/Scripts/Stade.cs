// ---------------------------------------------------------------------------
// LE STADE, CONSTRUIT AU LANCEMENT, DANS LES COTES DU SAUTOIR DU JEU.
//
// X le long de la piste d'elan (vers la fosse), Y en haut, Z en travers : 0
// sur l'axe de la piste, la grande tribune vers +Z, la camera de cote vers
// -Z. La planche, la fosse et la ligne sont a la place exacte ou le jeu les
// met (longueur.js, longueur-course.js) : ce que le joueur voit est ce que
// le jeu juge.
//
// CE QU'ON VOIT A LA TELEVISION D'UN CONCOURS DE LONGUEUR, et rien d'autre :
// la piste d'elan et ses deux planches, la fosse et ses reperes, l'anemometre,
// le juge et ses drapeaux, la piste du stade derriere, les panneaux lumineux
// au pied d'une tribune pleine, le toit, les mats d'eclairage, l'ecran geant,
// et les photographes accroupis au bout du sable.
// ---------------------------------------------------------------------------
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class Stade : MonoBehaviour
{
    public float ligne, fosseX, fosseFin, debut;
    public readonly List<Transform> foules = new List<Transform>();
    readonly List<Material> leds = new List<Material>();
    readonly List<TextMesh> textesLed = new List<TextMesh>();
    public TextMesh ecranTitre, ecranMarque, panneauMarque;
    public Transform panneauMarqueRacine;
    static Font police;
    static Material texteMat;

    public const float LARGEUR_ELAN = 1.22f, LARGEUR_FOSSE = 2.75f;
    public const float TRIBUNE_Z = 19f;

    /* ------------------------------------------------------------ outils */

    public static GameObject Boite(Transform p, Vector3 centre, Vector3 taille, Material m, bool ombre = true)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        Object.Destroy(go.GetComponent<Collider>());
        go.transform.SetParent(p, false);
        go.transform.localPosition = centre;
        go.transform.localScale = taille;
        var r = go.GetComponent<MeshRenderer>();
        r.sharedMaterial = m;
        r.shadowCastingMode = ombre ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
        return go;
    }

    public static GameObject Cylindre(Transform p, Vector3 bas, float h, float r, Material m)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        Object.Destroy(go.GetComponent<Collider>());
        go.transform.SetParent(p, false);
        go.transform.localPosition = bas + Vector3.up * h * 0.5f;
        go.transform.localScale = new Vector3(r * 2, h * 0.5f, r * 2);
        go.GetComponent<MeshRenderer>().sharedMaterial = m;
        return go;
    }

    /** Un plan horizontal, en metres, pose a la hauteur y. */
    public static GameObject Sol(Transform p, float x0, float x1, float z0, float z1, float y, Material m, bool recoit = true)
    {
        var go = new GameObject("sol");
        go.transform.SetParent(p, false);
        var me = new Mesh();
        me.vertices = new[] { new Vector3(x0, y, z0), new Vector3(x1, y, z0), new Vector3(x1, y, z1), new Vector3(x0, y, z1) };
        me.uv = new[] { new Vector2(x0, z0), new Vector2(x1, z0), new Vector2(x1, z1), new Vector2(x0, z1) };
        me.triangles = new[] { 0, 2, 1, 0, 3, 2 };
        me.RecalculateNormals(); me.RecalculateBounds();
        go.AddComponent<MeshFilter>().sharedMesh = me;
        var r = go.AddComponent<MeshRenderer>();
        r.sharedMaterial = m;
        r.receiveShadows = recoit;
        r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        return go;
    }

    public static TextMesh Texte(Transform p, string s, Vector3 pos, float taille, Color c, TextAnchor ancre = TextAnchor.MiddleCenter)
    {
        if (police == null) police = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        var go = new GameObject("texte");
        go.transform.SetParent(p, false);
        go.transform.localPosition = pos;
        var t = go.AddComponent<TextMesh>();
        t.font = police;
        t.fontSize = 96;
        t.characterSize = taille / 96f * 10f;
        t.anchor = ancre;
        t.alignment = TextAlignment.Center;
        t.fontStyle = FontStyle.Bold;
        t.color = c;
        t.text = s;
        var r = go.GetComponent<MeshRenderer>();
        if (texteMat == null)
        {
            texteMat = new Material(Resources.Load<Material>("Materiaux/Texte"));
            texteMat.mainTexture = police.material.mainTexture;
            // la police est dynamique : sa texture change quand elle grandit
            Font.textureRebuilt += f => { if (f == police) texteMat.mainTexture = f.material.mainTexture; };
        }
        r.sharedMaterial = texteMat;
        r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        return t;
    }

    /* ------------------------------------------------------------ le stade */

    public void Construire(float ligne, float autreLigne, float fosseX, float fosseFin, bool triple, int etape)
    {
        this.ligne = ligne; this.fosseX = fosseX; this.fosseFin = fosseFin;
        debut = Mathf.Min(ligne, autreLigne) - 45f;
        var t = transform;

        var gazon = Mat.Lit(Color.white, 0.12f, Mat.Gazon(), new Vector2(0.1f, 0.1f));
        var tartan = Mat.Lit(new Color(0.78f, 0.30f, 0.20f), 0.18f, Mat.Grain(new Color(0.85f, 0.85f, 0.85f), 0.14f), new Vector2(1.5f, 1.5f));
        var tartanBleu = Mat.Lit(new Color(0.20f, 0.36f, 0.66f), 0.18f, Mat.Grain(new Color(0.85f, 0.85f, 0.85f), 0.14f), new Vector2(1.5f, 1.5f));
        var blanc = Mat.Lit(new Color(0.95f, 0.95f, 0.93f), 0.3f);
        var beton = Mat.Lit(new Color(0.72f, 0.72f, 0.70f), 0.1f, Mat.Grain(Color.white, 0.12f, 128, 4), new Vector2(0.5f, 0.5f));
        var sombre = Mat.Lit(new Color(0.13f, 0.14f, 0.17f), 0.3f);
        var metal = Mat.Lit(new Color(0.62f, 0.65f, 0.70f), 0.55f);

        // Le gazon, jusqu'aux tribunes d'en face.
        Sol(t, debut - 120, fosseFin + 160, -95, TRIBUNE_Z, 0f, gazon);

        // LA PISTE DU STADE, derriere le sautoir : huit couloirs, et la corde.
        float pz0 = 4.2f, pz1 = pz0 + 8 * 1.22f;
        var piste = etape >= 5 ? tartanBleu : tartan;
        Sol(t, debut - 120, fosseFin + 160, pz0 - 0.9f, pz1 + 2.2f, 0.01f, piste);
        for (int i = 0; i <= 8; i++)
            Sol(t, debut - 120, fosseFin + 160, pz0 + i * 1.22f - 0.025f, pz0 + i * 1.22f + 0.025f, 0.02f, blanc);
        Boite(t, new Vector3((debut + fosseFin) * 0.5f + 20, 0.03f, pz0 - 0.9f), new Vector3(fosseFin - debut + 280, 0.06f, 0.05f), blanc);

        // LA PISTE D'ELAN, bordee de ses deux lignes blanches, et le tartan
        // qui entoure la fosse.
        float e0 = debut, e1 = fosseX;
        Sol(t, e0, e1, -LARGEUR_ELAN * 0.5f - 0.6f, LARGEUR_ELAN * 0.5f + 0.6f, 0.015f, piste);
        Sol(t, e0, e1, -LARGEUR_ELAN * 0.5f - 0.05f, -LARGEUR_ELAN * 0.5f, 0.025f, blanc);
        Sol(t, e0, e1, LARGEUR_ELAN * 0.5f, LARGEUR_ELAN * 0.5f + 0.05f, 0.025f, blanc);
        Sol(t, fosseX - 0.2f, fosseFin + 1.2f, -LARGEUR_FOSSE * 0.5f - 0.9f, LARGEUR_FOSSE * 0.5f + 0.9f, 0.012f, piste);
        // les reperes d'elan tous les metres, sur la bordure
        for (float x = ligne - 1; x > e0 + 1; x -= 1)
        {
            float l = ((int)Mathf.Round(ligne - x)) % 5 == 0 ? 0.25f : 0.12f;
            Sol(t, x - 0.015f, x + 0.015f, LARGEUR_ELAN * 0.5f + 0.05f, LARGEUR_ELAN * 0.5f + 0.05f + l, 0.027f, blanc);
        }
        // la marque de l'athlete : un ruban adhesif, au depart et a six foulees
        var ruban = Mat.Lit(new Color(1f, 0.85f, 0.1f), 0.4f);
        Sol(t, ligne - 40.05f, ligne - 39.95f, -0.62f, -0.42f, 0.027f, ruban);
        Sol(t, ligne - 11.05f, ligne - 10.95f, -0.62f, -0.42f, 0.027f, ruban);

        // LES PLANCHES. Celle qui sert est blanche, avec sa plasticine devant ;
        // l'autre est la, grise, comme au stade.
        var plasticine = Mat.Lit(new Color(0.55f, 0.72f, 0.60f), 0.2f);
        var gris = Mat.Lit(new Color(0.72f, 0.72f, 0.70f), 0.3f);
        foreach (var (x, actif) in new[] { (ligne, true), (autreLigne, false) })
        {
            Boite(t, new Vector3(x - 0.1f, 0.01f, 0), new Vector3(0.2f, 0.02f, LARGEUR_ELAN), actif ? blanc : gris, false);
            if (actif) Boite(t, new Vector3(x + 0.05f, 0.012f, 0), new Vector3(0.1f, 0.024f, LARGEUR_ELAN), plasticine, false);
        }

        // LA FOSSE : sa bordure blanche, et les reperes de distance du cote
        // de la camera d'en face.
        float b = 0.1f, pf = LARGEUR_FOSSE;
        Boite(t, new Vector3((fosseX + fosseFin) * 0.5f, 0.02f, pf * 0.5f + b * 0.5f), new Vector3(fosseFin - fosseX + 2 * b, 0.04f, b), blanc);
        Boite(t, new Vector3((fosseX + fosseFin) * 0.5f, 0.02f, -pf * 0.5f - b * 0.5f), new Vector3(fosseFin - fosseX + 2 * b, 0.04f, b), blanc);
        Boite(t, new Vector3(fosseX - b * 0.5f, 0.02f, 0), new Vector3(b, 0.04f, pf), blanc);
        Boite(t, new Vector3(fosseFin + b * 0.5f, 0.02f, 0), new Vector3(b, 0.04f, pf), blanc);
        for (int m = Mathf.CeilToInt(fosseX - ligne + 0.5f); ligne + m <= fosseFin - 0.2f; m++)
        {
            float x = ligne + m;
            var pan = Boite(t, new Vector3(x, 0.14f, pf * 0.5f + 0.42f), new Vector3(0.36f, 0.24f, 0.03f), blanc);
            pan.transform.localRotation = Quaternion.Euler(-12, 0, 0);
            var tx = Texte(t, m.ToString(), new Vector3(x, 0.14f, pf * 0.5f + 0.40f), 0.18f, new Color(0.08f, 0.1f, 0.14f));
            tx.transform.localRotation = Quaternion.Euler(-12, 0, 0);
        }

        // LE PANNEAU DES MARQUES, au bord du sable : le juge y affiche la
        // distance, comme sur tous les sautoirs.
        panneauMarqueRacine = new GameObject("panneau").transform;
        panneauMarqueRacine.SetParent(t, false);
        panneauMarqueRacine.localPosition = new Vector3(fosseFin + 1.6f, 0, pf * 0.5f + 1.3f);
        Cylindre(panneauMarqueRacine, Vector3.zero, 1.1f, 0.03f, metal);
        Boite(panneauMarqueRacine, new Vector3(0, 1.35f, 0), new Vector3(1.3f, 0.55f, 0.08f), sombre);
        panneauMarque = Texte(panneauMarqueRacine, "", new Vector3(0, 1.35f, -0.05f), 0.36f, new Color(1f, 0.75f, 0.2f));
        panneauMarqueRacine.localRotation = Quaternion.Euler(0, -30, 0);

        // L'ANEMOMETRE, a vingt metres de la planche, cote camera.
        var an = new GameObject("anemometre").transform;
        an.SetParent(t, false);
        an.localPosition = new Vector3(ligne - 20, 0, -LARGEUR_ELAN * 0.5f - 1.0f);
        for (int i = 0; i < 3; i++)
        {
            var pied = Cylindre(an, Vector3.zero, 1.0f, 0.012f, metal);
            pied.transform.localRotation = Quaternion.Euler(0, i * 120, 14);
        }
        Boite(an, new Vector3(0, 1.08f, 0), new Vector3(0.22f, 0.14f, 0.14f), Mat.Lit(new Color(0.95f, 0.8f, 0.1f), 0.4f));
        Cylindre(an, new Vector3(0, 1.15f, 0), 0.22f, 0.01f, metal);

        // Le rateau, couche a cote du sable.
        var rateau = Boite(t, new Vector3(fosseFin - 1.5f, 0.03f, -pf * 0.5f - 0.9f), new Vector3(2.2f, 0.03f, 0.03f), Mat.Lit(new Color(0.55f, 0.38f, 0.2f), 0.2f));
        Boite(rateau.transform, new Vector3(0.5f, 0, 0), new Vector3(0.03f, 1, 16), metal);

        Tribunes(etape, metal, sombre, beton);
        Eclairages(metal);
        Ecran();
    }

    /* ------------------------------------------------------------ tribunes */

    /** Les marches : une contre-marche, puis une marche, rang apres rang. */
    static Mesh Gradins(float longueur, int rangs, float marche, float contre)
    {
        var v = new List<Vector3>(); var uv = new List<Vector2>(); var tri = new List<int>();
        for (int r = 0; r < rangs; r++)
        {
            float z = r * marche, y = r * contre;
            int i = v.Count;
            v.Add(new Vector3(0, y, z)); v.Add(new Vector3(longueur, y, z));
            v.Add(new Vector3(longueur, y + contre, z)); v.Add(new Vector3(0, y + contre, z));
            v.Add(new Vector3(0, y + contre, z)); v.Add(new Vector3(longueur, y + contre, z));
            v.Add(new Vector3(longueur, y + contre, z + marche)); v.Add(new Vector3(0, y + contre, z + marche));
            for (int k = 0; k < 8; k++) uv.Add(new Vector2(v[i + k].x * 0.5f, (v[i + k].y + v[i + k].z) * 0.5f));
            tri.AddRange(new[] { i, i + 2, i + 1, i, i + 3, i + 2, i + 4, i + 6, i + 5, i + 4, i + 7, i + 6 });
        }
        var me = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
        me.SetVertices(v); me.SetUVs(0, uv); me.SetTriangles(tri, 0);
        me.RecalculateNormals(); me.RecalculateBounds();
        return me;
    }

    /**
     * Les spectateurs : une carte debout par rang, sur le devant de sa marche,
     * haute d'un metre. Chaque rang prend une des quatre bandes de la texture
     * et un decalage a lui, pour que deux rangs ne se ressemblent pas.
     */
    static Mesh Spectateurs(float longueur, int rangs, float marche, float contre, System.Random rnd)
    {
        var v = new List<Vector3>(); var uv = new List<Vector2>(); var tri = new List<int>();
        const float largeurTexture = 32 * 0.55f;
        for (int r = 0; r < rangs; r++)
        {
            float z = r * marche + 0.3f, y = (r + 1) * contre - 0.12f;
            float u0 = (float)rnd.NextDouble(), u1 = u0 + longueur / largeurTexture;
            int bande = rnd.Next(4);
            float v0 = bande / 4f + 0.002f, v1 = (bande + 1) / 4f - 0.002f;
            int i = v.Count;
            v.Add(new Vector3(0, y, z)); v.Add(new Vector3(longueur, y, z));
            v.Add(new Vector3(longueur, y + 1f, z)); v.Add(new Vector3(0, y + 1f, z));
            uv.Add(new Vector2(u0, v0)); uv.Add(new Vector2(u1, v0)); uv.Add(new Vector2(u1, v1)); uv.Add(new Vector2(u0, v1));
            tri.AddRange(new[] { i, i + 2, i + 1, i, i + 3, i + 2 });
        }
        var me = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
        me.SetVertices(v); me.SetUVs(0, uv); me.SetTriangles(tri, 0);
        me.normals = System.Linq.Enumerable.Repeat(Vector3.back, v.Count).ToArray();
        me.RecalculateBounds();
        return me;
    }

    static Texture2D texFoule;

    /**
     * Une tribune : les gradins et leur foule, un mur de publicite lumineuse
     * devant, un toit porte par des poteaux. Posee le long de X, le public
     * regarde vers -Z ; on la tourne pour les autres cotes.
     */
    Transform Tribune(string nom, float longueur, int rangs, int graine, Material metal, Material sombre, Material beton, bool avecLeds = true)
    {
        var racine = new GameObject(nom).transform;
        racine.SetParent(transform, false);
        const float marche = 0.82f, contre = 0.44f;
        int segments = Mathf.Max(1, Mathf.RoundToInt(longueur / 24f));
        float lseg = longueur / segments;
        if (texFoule == null) texFoule = Mat.Foule(7);
        var sieges = Mat.Lit(new Color(0.16f, 0.30f, 0.58f), 0.2f, Mat.Grain(Color.white, 0.1f, 64, 3), new Vector2(1, 1));
        var gens = Mat.LitDecoupe(texFoule);
        var rnd = new System.Random(graine);
        var marches = new GameObject("gradins");
        marches.transform.SetParent(racine, false);
        marches.transform.localPosition = new Vector3(0, 1.2f, 0);
        marches.AddComponent<MeshFilter>().sharedMesh = Gradins(longueur, rangs, marche, contre);
        var rm = marches.AddComponent<MeshRenderer>();
        rm.sharedMaterial = sieges;
        rm.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        for (int s = 0; s < segments; s++)
        {
            var go = new GameObject("foule");
            go.transform.SetParent(racine, false);
            go.transform.localPosition = new Vector3(s * lseg, 1.2f, 0);
            go.AddComponent<MeshFilter>().sharedMesh = Spectateurs(lseg, rangs, marche, contre, rnd);
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = gens;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            foules.Add(go.transform);
        }
        float h = 1.2f + rangs * contre, p = rangs * marche;
        // le mur du bas, et le dos de la tribune
        Boite(racine, new Vector3(longueur * 0.5f, 0.6f, -0.05f), new Vector3(longueur, 1.2f, 0.1f), beton);
        Boite(racine, new Vector3(longueur * 0.5f, h * 0.5f + 0.5f, p + 0.3f), new Vector3(longueur, h + 1, 0.6f), beton);
        // le toit, et ses poteaux
        float ht = h + 4.5f;
        var toit = Boite(racine, new Vector3(longueur * 0.5f, ht, p * 0.45f), new Vector3(longueur + 2, 0.5f, p + 7), Mat.Lit(new Color(0.9f, 0.92f, 0.95f), 0.4f));
        toit.transform.localRotation = Quaternion.Euler(-4, 0, 0);
        Boite(racine, new Vector3(longueur * 0.5f, ht - 0.7f, -2.8f), new Vector3(longueur + 2, 1.0f, 0.25f), sombre);
        for (float x = 0; x <= longueur; x += 24f)
            Boite(racine, new Vector3(x, ht * 0.5f, p + 0.2f), new Vector3(0.5f, ht, 0.5f), metal);
        if (avecLeds)
        {
            // LA PUBLICITE LUMINEUSE, au pied de la tribune.
            for (float x = 0; x < longueur - 1; x += 12f)
            {
                var m = Mat.Unlit(Color.black);
                leds.Add(m);
                Boite(racine, new Vector3(x + 6, 0.55f, -1.4f), new Vector3(11.8f, 0.9f, 0.12f), m, false);
                var tx = Texte(racine, "", new Vector3(x + 6, 0.55f, -1.47f), 0.5f, Color.white);
                tx.GetComponent<MeshRenderer>().sharedMaterial = MatTexteLumineux();
                textesLed.Add(tx);
                Boite(racine, new Vector3(x + 6, 0.05f, -1.3f), new Vector3(11.8f, 0.1f, 0.4f), sombre, false);
            }
        }
        return racine;
    }

    static Material texteLumineux;
    /** Le texte des LED : plus clair que blanc, pour que le bloom le fasse briller. */
    static Material MatTexteLumineux()
    {
        if (texteLumineux == null)
        {
            Texte(null, "", Vector3.zero, 1, Color.white).gameObject.SetActive(false);
            texteLumineux = new Material(texteMat);
            texteLumineux.SetColor("_Color", new Color(1.8f, 1.8f, 1.8f, 1f));
            Font.textureRebuilt += f => { if (f == police) texteLumineux.mainTexture = f.material.mainTexture; };
        }
        return texteLumineux;
    }

    void Tribunes(int etape, Material metal, Material sombre, Material beton)
    {
        float longueur = (fosseFin + 60) - (debut - 40);
        // la grande tribune, face a la camera de cote
        var a = Tribune("tribune", longueur, 26, 11, metal, sombre, beton);
        a.localPosition = new Vector3(debut - 40, 0, TRIBUNE_Z);
        a.localRotation = Quaternion.Euler(0, 0, 0);
        // la tribune d'en face : on ne la voit que dans les plans inverses
        var b = Tribune("face", longueur, 26, 12, metal, sombre, beton, false);
        b.localPosition = new Vector3(fosseFin + 60, 0, -78);
        b.localRotation = Quaternion.Euler(0, 180, 0);
        // les deux virages
        var c = Tribune("virage", 90, 26, 13, metal, sombre, beton);
        c.localPosition = new Vector3(debut - 44, 0, -70);
        c.localRotation = Quaternion.Euler(0, -90, 0);
        var d = Tribune("virage2", 90, 26, 14, metal, sombre, beton);
        d.localPosition = new Vector3(fosseFin + 64, 0, 22);
        d.localRotation = Quaternion.Euler(0, 90, 0);
    }

    void Eclairages(Material metal)
    {
        var lampe = Mat.Unlit(new Color(1f, 0.97f, 0.9f) * 6f);
        var dos = Mat.Lit(new Color(0.25f, 0.27f, 0.3f), 0.3f);
        foreach (var pos in new[] {
                     new Vector3(debut - 36, 0, TRIBUNE_Z + 26), new Vector3(fosseFin + 56, 0, TRIBUNE_Z + 26),
                     new Vector3(debut - 36, 0, -86), new Vector3(fosseFin + 56, 0, -86) })
        {
            var m = new GameObject("mat").transform;
            m.SetParent(transform, false);
            m.localPosition = pos;
            Cylindre(m, Vector3.zero, 44, 0.7f, metal);
            var tete = new GameObject("tete").transform;
            tete.SetParent(m, false);
            tete.localPosition = new Vector3(0, 46, 0);
            var vers = new Vector3((debut + fosseFin) * 0.5f, 0, -30) - pos;
            tete.localRotation = Quaternion.LookRotation(new Vector3(vers.x, 0, vers.z)) * Quaternion.Euler(20, 0, 0);
            Boite(tete, Vector3.zero, new Vector3(9, 5, 0.6f), dos, false);
            for (int i = 0; i < 4; i++)
                for (int j = 0; j < 3; j++)
                    Boite(tete, new Vector3(-3.3f + i * 2.2f, -1.6f + j * 1.6f, 0.35f), new Vector3(1.8f, 1.2f, 0.05f), lampe, false);
        }
    }

    void Ecran()
    {
        var e = new GameObject("ecran").transform;
        e.SetParent(transform, false);
        e.localPosition = new Vector3(fosseFin + 50, 14, -18);
        e.localRotation = Quaternion.Euler(0, 60, 0);
        Boite(e, Vector3.zero, new Vector3(17, 8.2f, 0.8f), Mat.Lit(new Color(0.12f, 0.13f, 0.16f), 0.3f));
        Boite(e, new Vector3(0, 0, -0.42f), new Vector3(16, 7.4f, 0.02f), Mat.Unlit(new Color(0.02f, 0.05f, 0.12f)), false);
        Cylindre(e, new Vector3(0, -14, 0.6f), 10, 0.4f, Mat.Lit(new Color(0.6f, 0.62f, 0.66f), 0.5f));
        ecranTitre = Texte(e, "JUMPER", new Vector3(0, 2.2f, -0.45f), 2.2f, new Color(1f, 0.8f, 0.2f));
        ecranMarque = Texte(e, "", new Vector3(0, -1.2f, -0.45f), 3.0f, Color.white);
    }

    /* ------------------------------------------------------------ la vie */

    static readonly string[] PUBS = { "SPRINTER", "JUMPER", "HURDLERS", "SPRINTER-GAME.COM", "JUMPER", "WORLD TOUR" };
    static readonly Color[] FONDS = {
        new Color(0.05f, 0.2f, 0.75f), new Color(0.9f, 0.1f, 0.2f), new Color(1f, 0.75f, 0.05f),
        new Color(0.05f, 0.65f, 0.35f), new Color(0.95f, 0.45f, 0.05f), new Color(0.45f, 0.1f, 0.85f) };

    float tLed = -1;
    int tourLed;

    /**
     * La vie du stade. `excitation` monte avec le saut : la foule bouge, les
     * panneaux s'allument sur le nom de l'epreuve.
     */
    public void Animer(float t, float excitation)
    {
        // Les panneaux tournent toutes les six secondes, en decale.
        int tour = Mathf.FloorToInt(t / 6f);
        if (tour != tourLed || tLed < 0)
        {
            tourLed = tour; tLed = t;
            for (int i = 0; i < leds.Count; i++)
            {
                int k = (i + tour) % PUBS.Length;
                leds[i].SetColor("_BaseColor", FONDS[k] * 1.6f);
                textesLed[i].text = PUBS[k];
                textesLed[i].color = Color.white;
                textesLed[i].transform.localRotation = Quaternion.Euler(0, 0, 0);
            }
        }
        // La foule : elle ondule un peu, et saute quand l'athlete s'envole.
        for (int i = 0; i < foules.Count; i++)
        {
            var f = foules[i];
            float ph = i * 1.7f;
            float saut = excitation * Mathf.Max(0, Mathf.Sin(t * 9f + ph)) * 0.06f;
            var p = f.localPosition;
            f.localPosition = new Vector3(p.x, 1.2f + saut, p.z);
        }
    }
}
