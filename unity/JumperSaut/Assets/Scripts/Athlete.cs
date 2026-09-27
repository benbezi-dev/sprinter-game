// ---------------------------------------------------------------------------
// L'ATHLETE : LE CORPS SCULPTE DANS BLENDER, LE GESTE CALCULE PAR LE JEU.
//
// Le modele (tools/blender/unity/athlete.py) porte les os du rig de pose()
// (sprinter-core.js), aux memes cotes. Le jeu envoie a chaque image les
// angles de ce rig — bassin, buste, tete, cuisses, jambes, pieds, bras,
// avant-bras — et on les pose tels quels : l'athlete fait exactement le
// geste que le moteur calcule, foulee, appel, ciseau et ramene compris.
//
// LA CONVENTION DU RIG : angles absolus, dans le plan de course, 0 vers le
// bas pour un membre (0 vers le haut pour le buste, 0 a plat pour le pied),
// positif vers l'avant. Dans Unity, X est le sens de la course, Y le haut,
// Z le cote gauche de l'athlete. Une rotation de θ autour de Z envoie le bas
// (0,-1) sur (sin θ, -cos θ) — exactement la direction d'un membre du rig.
//
// PAR-DESSUS, LES CODES DU SAUTEUR, que le moteur ne connait pas : les mains
// qui claquent au-dessus de la tete pour lancer le public avant l'elan, le
// balancement sur la marque, puis, sorti du sable, le poing serre ou les
// mains sur la tete. Le jeu ne les joue pas : ils n'y changent rien.
// ---------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;

public class Athlete : MonoBehaviour
{
    public enum Os { Hanches, Bassin, Buste, Tete, BrasG, AvantBrasG, BrasD, AvantBrasD,
        CuisseG, JambeG, PiedG, CuisseD, JambeD, PiedD }
    static readonly string[] NOMS = { "Hanches", "Bassin", "Buste", "Tete", "Bras.G", "AvantBras.G",
        "Bras.D", "AvantBras.D", "Cuisse.G", "Jambe.G", "Pied.G", "Cuisse.D", "Jambe.D", "Pied.D" };

    readonly Transform[] os = new Transform[NOMS.Length];
    readonly Quaternion[] repos = new Quaternion[NOMS.Length];
    Transform modele;
    SkinnedMeshRenderer peau;
    readonly Dictionary<string, Material> matieres = new Dictionary<string, Material>();

    /** La posture du rig, en radians et en unites du rig. */
    public class Pose
    {
        public Vector3 hanche = new Vector3(0, 0.87f, 0);   // x devant, y haut, z cote
        public float bassin, buste, tete, lacetBas, lacetHaut, chute;
        public float[] jambeG = new float[3], jambeD = new float[3];
        public float[] brasG = new float[2], brasD = new float[2];
        // l'ecart des bras sur le cote (radians, positif vers l'exterieur) :
        // le rig du jeu n'en a pas, les rituels en ont besoin
        public float ecartG, ecartD;

        public void Copier(Pose p)
        {
            hanche = p.hanche; bassin = p.bassin; buste = p.buste; tete = p.tete;
            lacetBas = p.lacetBas; lacetHaut = p.lacetHaut; chute = p.chute;
            System.Array.Copy(p.jambeG, jambeG, 3); System.Array.Copy(p.jambeD, jambeD, 3);
            System.Array.Copy(p.brasG, brasG, 2); System.Array.Copy(p.brasD, brasD, 2);
            ecartG = p.ecartG; ecartD = p.ecartD;
        }
    }

    public readonly Pose pose = new Pose();
    /** Vers ou regarde le corps entier (les officiels ne regardent pas la fosse). */
    public Quaternion cap = Quaternion.identity;

    public static Athlete Creer(string nom, Transform parent)
    {
        var go = new GameObject(nom);
        go.transform.SetParent(parent, false);
        var a = go.AddComponent<Athlete>();
        a.Monter();
        return a;
    }

    void Monter()
    {
        var modeleSource = Resources.Load<GameObject>("Athlete");
        var inst = Instantiate(modeleSource);
        modele = inst.transform;
        modele.SetParent(transform, false);
        modele.localPosition = Vector3.zero;
        modele.localRotation = Quaternion.identity;
        modele.localScale = Vector3.one;
        var tous = modele.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < NOMS.Length; i++)
            foreach (var t in tous) if (t.name == NOMS[i]) { os[i] = t; break; }
        peau = modele.GetComponentInChildren<SkinnedMeshRenderer>();
        peau.updateWhenOffscreen = true;
        peau.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;

        // REDRESSER LE MODELE, QUEL QUE SOIT LE CHEMIN QU'IL A PRIS. Blender
        // est en Z haut, le FBX en Y haut, Unity retourne un axe a l'import :
        // plutot que de parier sur la combinaison, on mesure. La tete donne
        // le haut, les deux cuisses le cote ; et c'est la pointe des
        // chaussures qui dit ou est l'avant (une premiere version s'en
        // remettait a la main droite des axes : l'athlete regardait derriere
        // lui, vu le 27 sept. 2026).
        var haut = (os[(int)Os.Tete].position - os[(int)Os.Hanches].position).normalized;
        var gauche = (os[(int)Os.CuisseG].position - os[(int)Os.CuisseD].position).normalized;
        modele.rotation = Quaternion.Inverse(Quaternion.LookRotation(gauche, haut)) * modele.rotation;
        if (PointeDesPieds() < 0) modele.rotation = Quaternion.AngleAxis(180, Vector3.up) * modele.rotation;
        sensG = os[(int)Os.CuisseG].position.z > os[(int)Os.CuisseD].position.z ? 1f : -1f;
        // et le posera a la hauteur du rig : les os sont deja aux cotes, le
        // pied au sol.
        var h = transform.InverseTransformPoint(os[(int)Os.Hanches].position);
        modele.localPosition -= new Vector3(h.x, 0, h.z);

        for (int i = 0; i < NOMS.Length; i++)
            repos[i] = Quaternion.Inverse(transform.rotation) * os[i].rotation;

        // Les matieres de Blender deviennent des matieres URP, une par role.
        var mats = peau.sharedMaterials;
        var neuves = new Material[mats.Length];
        for (int i = 0; i < mats.Length; i++)
        {
            string n = mats[i] != null ? mats[i].name : "Peau";
            string role = n.Contains("Maillot") ? "Maillot" : n.Contains("Short") ? "Short"
                : n.Contains("Chaussure") ? "Chaussure" : n.Contains("Cheveux") ? "Cheveux" : "Peau";
            float lisse = role == "Peau" ? 0.42f : role == "Maillot" ? 0.35f : role == "Short" ? 0.3f
                : role == "Chaussure" ? 0.5f : 0.15f;
            neuves[i] = Mat.Lit(Color.gray, lisse);
            matieres[role] = neuves[i];
        }
        peau.sharedMaterials = neuves;
    }

    float sensG = 1;

    /**
     * De combien les chaussures depassent les chevilles vers +X. Positif :
     * le corps regarde vers +X, comme la course.
     */
    /**
     * Jusqu'ou va la poitrine vers l'avant, entre deux hauteurs, au repos.
     * C'est la que se pose le dossard : ni enfonce dans le torse, ni flottant
     * devant.
     */
    public float Poitrine(float y0, float y1)
    {
        var m = new Mesh();
        peau.BakeMesh(m, true);
        var l2w = peau.transform.localToWorldMatrix;
        float x = 0.1f;
        foreach (var v in m.vertices)
        {
            var w = transform.InverseTransformPoint(l2w.MultiplyPoint3x4(v));
            if (w.y > y0 && w.y < y1 && Mathf.Abs(w.z) < 0.06f) x = Mathf.Max(x, w.x);
        }
        Destroy(m);
        return x;
    }

    float PointeDesPieds()
    {
        var m = new Mesh();
        peau.BakeMesh(m, true);
        var v = m.vertices;
        var l2w = peau.transform.localToWorldMatrix;
        float cheville = (os[(int)Os.PiedG].position.x + os[(int)Os.PiedD].position.x) * 0.5f;
        float bas = Mathf.Min(os[(int)Os.PiedG].position.y, os[(int)Os.PiedD].position.y);
        float somme = 0; int n = 0;
        foreach (var x in v)
        {
            var w = l2w.MultiplyPoint3x4(x);
            if (w.y < bas + 0.02f) { somme += w.x - cheville; n++; }
        }
        Destroy(m);
        return n > 0 ? somme / n : 1f;
    }

    /**
     * Accrocher un objet a un os, pose ou il doit etre AU REPOS (dans le
     * repere de l'athlete : x devant, y haut, z a gauche). Il suit l'os
     * ensuite, sans qu'on ait a connaitre les axes de l'os.
     */
    public Transform Accrocher(Os o, Transform objet, Vector3 posRepos, Quaternion rotRepos)
    {
        objet.SetParent(os[(int)o], true);
        objet.position = transform.TransformPoint(posRepos);
        objet.rotation = transform.rotation * rotRepos;
        return objet;
    }

    public void Habiller(Color peauC, Color maillot, Color shortC, Color chaussure, Color cheveux)
    {
        void Poser(string r, Color c) { if (matieres.TryGetValue(r, out var m)) m.SetColor("_BaseColor", c); }
        Poser("Peau", peauC); Poser("Maillot", maillot); Poser("Short", shortC);
        Poser("Chaussure", chaussure); Poser("Cheveux", cheveux);
    }

    public Vector3 PositionOs(Os o) => os[(int)o].position;
    public Transform TransformOs(Os o) => os[(int)o];

    static Quaternion Plan(float a) => Quaternion.AngleAxis(a * Mathf.Rad2Deg, Vector3.forward);
    static Quaternion Lacet(float a) => Quaternion.AngleAxis(-a * Mathf.Rad2Deg, Vector3.up);
    static Quaternion Ecart(float a, float cote) => Quaternion.AngleAxis(-cote * a * Mathf.Rad2Deg, Vector3.right);

    void Poser(Os o, Quaternion q)
    {
        os[(int)o].rotation = transform.rotation * q * repos[(int)o];
    }

    /**
     * Poser la posture. `racine` est la place de l'athlete sur le sautoir (au
     * sol, sous le bassin) ; `k` l'echelle du rig (taille / taille du rig).
     */
    public void Appliquer(Vector3 racine, float k)
    {
        var p = pose;
        transform.position = racine;
        transform.rotation = cap * Quaternion.AngleAxis(p.chute * Mathf.Rad2Deg, Vector3.forward);
        transform.localScale = Vector3.one * k;

        var t = os[(int)Os.Hanches];
        t.position = transform.TransformPoint(p.hanche);
        Poser(Os.Hanches, Lacet(p.lacetBas));
        Poser(Os.Bassin, Lacet(p.lacetBas) * Plan(p.bassin));
        Poser(Os.Buste, Lacet(p.lacetHaut) * Plan(p.buste));
        Poser(Os.Tete, Lacet(p.lacetHaut * 0.2f) * Plan(p.buste + p.tete));
        var lh = Lacet(p.lacetHaut);
        Poser(Os.BrasG, lh * Ecart(p.ecartG, sensG) * Plan(p.brasG[0]));
        Poser(Os.AvantBrasG, lh * Ecart(p.ecartG * 0.6f, sensG) * Plan(p.brasG[1]));
        Poser(Os.BrasD, lh * Ecart(p.ecartD, -sensG) * Plan(p.brasD[0]));
        Poser(Os.AvantBrasD, lh * Ecart(p.ecartD * 0.6f, -sensG) * Plan(p.brasD[1]));
        var lb = Lacet(p.lacetBas);
        Poser(Os.CuisseG, lb * Plan(p.jambeG[0]));
        Poser(Os.JambeG, lb * Plan(p.jambeG[1]));
        Poser(Os.PiedG, lb * Plan(p.jambeG[2]));
        Poser(Os.CuisseD, lb * Plan(p.jambeD[0]));
        Poser(Os.JambeD, lb * Plan(p.jambeD[1]));
        Poser(Os.PiedD, lb * Plan(p.jambeD[2]));
    }

    /* ------------------------------------------------------------ rituels */

    /**
     * LE SAUTEUR SUR SA MARQUE. Il se concentre, tete basse, puis leve les
     * bras et claque des mains au-dessus de la tete, en rythme — le public
     * repond et accelere avec lui. Puis il se balance d'avant en arriere, et
     * s'elance. `t` est le temps passe sur la marque.
     */
    public static void Rituel(Pose p, float t, float w)
    {
        if (w <= 0) return;
        float cycle = t % 9f;
        // 0 - 2,2 s : concentre, tete basse, les mains qui secouent les bras
        // 2,2 - 6,5 s : les applaudissements au-dessus de la tete
        // 6,5 - 9 s : le balancement, le regard sur la planche
        float clap = Mathf.Clamp01((cycle - 2.2f) / 0.4f) * Mathf.Clamp01((6.5f - cycle) / 0.4f);
        float balance = Mathf.Clamp01((cycle - 6.5f) / 0.4f) * Mathf.Clamp01((9f - cycle) / 0.3f);
        float repos = 1 - Mathf.Max(clap, balance);

        // les applaudissements : 1,6 claquement par seconde, qui accelere
        float f = 1.6f + 0.35f * Mathf.Max(0, cycle - 2.2f);
        float ph = Mathf.Sin(t * f * Mathf.PI * 2);
        float bras = 2.75f, avant = 3.05f;
        float ecart = 0.34f - 0.20f * Mathf.Max(0, ph);   // les mains se rejoignent
        float balanceX = Mathf.Sin(t * 2.6f) * 0.05f;

        void Melange(float[] a, float[] b, float x) { for (int i = 0; i < a.Length; i++) a[i] = Mathf.Lerp(a[i], b[i], x); }

        // concentre : les bras le long du corps, les poignets qui secouent
        var brasRepos = new[] { 0.08f + 0.06f * Mathf.Sin(t * 7f), 0.2f + 0.08f * Mathf.Sin(t * 7f + 1) };
        var brasClap = new[] { bras, avant };
        var brasBal = new[] { -0.25f + balanceX * 4, 0.35f };
        var g = new float[2]; var d = new float[2];
        for (int i = 0; i < 2; i++)
        {
            g[i] = brasRepos[i] * repos + brasClap[i] * clap + brasBal[i] * balance;
            d[i] = brasRepos[i] * repos + brasClap[i] * clap + brasBal[i] * balance;
        }
        Melange(p.brasG, g, w); Melange(p.brasD, d, w);
        p.ecartG = Mathf.Lerp(p.ecartG, ecart * clap - 0.12f * clap, w);
        p.ecartD = p.ecartG;
        p.tete = Mathf.Lerp(p.tete, -0.35f * repos - 0.05f * clap - 0.3f * balance, w);
        p.buste = Mathf.Lerp(p.buste, -0.04f * clap - 0.12f * balance + balanceX, w);
        p.hanche.x = Mathf.Lerp(p.hanche.x, balanceX * 1.6f * balance, w);
        // le pied d'appel en arriere pendant le balancement
        p.jambeD[0] = Mathf.Lerp(p.jambeD[0], p.jambeD[0] - 0.28f * balance, w);
        p.jambeD[1] = Mathf.Lerp(p.jambeD[1], p.jambeD[1] - 0.22f * balance, w);
    }

    /**
     * SORTI DU SABLE. Un bon saut : le poing serre, puis les bras vers la
     * foule. Un essai nul : les mains sur la tete, le regard vers le juge.
     */
    public static void Reaction(Pose p, bool reussi, float t, float w)
    {
        if (w <= 0) return;
        if (reussi)
        {
            float coup = Mathf.Abs(Mathf.Sin(t * 5.5f));
            var g = new[] { 2.2f + 0.3f * coup, 2.9f + 0.4f * coup };
            var d = new[] { 0.3f, 1.9f };
            for (int i = 0; i < 2; i++) { p.brasG[i] = Mathf.Lerp(p.brasG[i], g[i], w); p.brasD[i] = Mathf.Lerp(p.brasD[i], d[i], w); }
            p.ecartG = Mathf.Lerp(p.ecartG, 0.25f, w);
            p.tete = Mathf.Lerp(p.tete, 0.25f, w);
        }
        else
        {
            var b = new[] { 2.5f, 4.5f };
            for (int i = 0; i < 2; i++) { p.brasG[i] = Mathf.Lerp(p.brasG[i], b[i], w); p.brasD[i] = Mathf.Lerp(p.brasD[i], b[i], w); }
            p.ecartG = Mathf.Lerp(p.ecartG, 0.62f, w);
            p.ecartD = Mathf.Lerp(p.ecartD, 0.62f, w);
            p.tete = Mathf.Lerp(p.tete, 0.2f, w);
        }
    }
}
