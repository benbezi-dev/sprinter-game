// ---------------------------------------------------------------------------
// JUMPER — LA SCENE UNITY DU SAUT EN LONGUEUR ET DU TRIPLE SAUT.
//
// Elle ne decide de rien. Le jeu du saut reste celui de longueur-course.js :
// l'elan, l'appel, le vol, le ramene, la marque. A chaque image, le jeu ecrit
// son etat dans un tableau (src/game/sauts-unity.js) que la scene relit par
// le pont (Plugins/WebGL/Pont.jslib), et elle le montre comme la television
// montre un concours : un athlete sculpte, un stade plein, des officiels,
// des photographes, et une realisation — les plans changent avec le saut, et
// le saut se rejoue au ralenti sous un autre angle.
// ---------------------------------------------------------------------------
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public class Saut : MonoBehaviour
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] static extern int JumperLire(float[] tampon, int n);
    [DllImport("__Internal")] static extern void JumperPret();
#else
    static int JumperLire(float[] tampon, int n) => 0;
    static void JumperPret() { }
#endif

    readonly float[] lu = new float[Etat.N];
    float[] s = new float[Etat.N];
    bool recu;
    float dernierTic = -1, tempsSansEtat;

    Camera cam;
    Realisateur real;
    Light soleil;
    Athlete athlete, jugePlanche, jugeMesure;
    readonly List<Athlete> photographes = new List<Athlete>();
    readonly List<Transform> appareils = new List<Transform>();
    Stade stade;
    Fosse fosse;
    string cleStade;
    Transform drapeau, prisme;
    Material drapeauMat;
    ParticleSystem flashs;
    Qualite qualite;

    // le ralenti
    readonly List<float[]> film = new List<float[]>();
    readonly List<float> filmT = new List<float>();
    float horloge;
    public float ralentiDebut = -1, ralentiT, ralentiDe, ralentiA;
    float excitation, tempsMarque;
    int phasePrec = -1;
    bool empreintePrec, gerbePrecVue;
    float gerbeIdPrec;
    bool ralentiFait;

    void Start()
    {
        Application.targetFrameRate = 60;
        QualitySettings.vSyncCount = 0;

        // LA LUMIERE D'UN APRES-MIDI DE CHAMPIONNAT : un soleil de trois
        // quarts arriere, haut, qui pose l'ombre de l'athlete sur la piste, et
        // un ciel qui eclaire les ombres en bleu.
        soleil = new GameObject("Soleil").AddComponent<Light>();
        soleil.type = LightType.Directional;
        soleil.color = new Color(1f, 0.95f, 0.86f);
        soleil.intensity = 2.1f;
        soleil.shadows = LightShadows.Soft;
        soleil.shadowStrength = 0.82f;
        soleil.shadowBias = 0.03f;
        soleil.shadowNormalBias = 0.25f;
        soleil.transform.rotation = Quaternion.Euler(48, -35, 0);
        RenderSettings.ambientMode = AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(0.62f, 0.72f, 0.88f);
        RenderSettings.ambientEquatorColor = new Color(0.55f, 0.58f, 0.55f);
        RenderSettings.ambientGroundColor = new Color(0.28f, 0.30f, 0.22f);
        var ciel = new Material(Resources.Load<Material>("Materiaux/Ciel"));
        ciel.SetFloat("_SunSize", 0.035f);
        ciel.SetFloat("_AtmosphereThickness", 0.85f);
        ciel.SetColor("_SkyTint", new Color(0.45f, 0.62f, 0.9f));
        ciel.SetColor("_GroundColor", new Color(0.4f, 0.42f, 0.4f));
        ciel.SetFloat("_Exposure", 1.25f);
        RenderSettings.skybox = ciel;
        RenderSettings.sun = soleil;
        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.Linear;
        RenderSettings.fogColor = new Color(0.74f, 0.82f, 0.9f);
        RenderSettings.fogStartDistance = 60;
        RenderSettings.fogEndDistance = 320;

        cam = new GameObject("Camera").AddComponent<Camera>();
        cam.nearClipPlane = 0.1f; cam.farClipPlane = 700f;
        cam.clearFlags = CameraClearFlags.Skybox;
        var donnees = cam.GetUniversalAdditionalCameraData();
        donnees.renderPostProcessing = true;
        donnees.antialiasing = AntialiasingMode.None;
        donnees.renderShadows = true;
        real = new Realisateur(cam, this);
        qualite = new Qualite(real);

        athlete = Athlete.Creer("Athlete", transform);
        athlete.Habiller(new Color(0.45f, 0.28f, 0.18f), new Color(0.1f, 0.3f, 0.85f), new Color(0.05f, 0.06f, 0.1f),
            new Color(0.95f, 0.35f, 0.1f), new Color(0.05f, 0.04f, 0.03f));

        // LE DOSSARD, sur la poitrine : une feuille blanche et son numero.
        {
            var dos = new GameObject("dossard").transform;
            dos.SetParent(transform, false);
            var feuille = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Destroy(feuille.GetComponent<Collider>());
            feuille.transform.SetParent(dos, false);
            feuille.transform.localScale = new Vector3(0.17f, 0.13f, 1);
            feuille.GetComponent<MeshRenderer>().sharedMaterial = Mat.Lit(new Color(0.96f, 0.96f, 0.94f), 0.3f);
            feuille.GetComponent<MeshRenderer>().shadowCastingMode = ShadowCastingMode.Off;
            var num = Stade.Texte(dos, "1027", new Vector3(0, -0.005f, -0.004f), 0.075f, new Color(0.08f, 0.08f, 0.1f));
            float x = athlete.Poitrine(1.16f, 1.26f) + 0.006f;
            athlete.Accrocher(global::Athlete.Os.Buste, dos, new Vector3(x, 1.21f, 0), Quaternion.LookRotation(Vector3.left));
        }

        Officiels();
        JumperPret();
    }

    /* ------------------------------------------------------------ officiels */

    void Officiels()
    {
        var blazer = new Color(0.10f, 0.16f, 0.36f);
        var pantalon = new Color(0.55f, 0.56f, 0.58f);
        jugePlanche = Athlete.Creer("Juge de planche", transform);
        jugePlanche.Habiller(new Color(0.9f, 0.72f, 0.58f), blazer, pantalon, new Color(0.08f, 0.08f, 0.1f), new Color(0.55f, 0.55f, 0.55f));
        jugeMesure = Athlete.Creer("Juge de mesure", transform);
        jugeMesure.Habiller(new Color(0.55f, 0.36f, 0.24f), blazer, pantalon, new Color(0.08f, 0.08f, 0.1f), new Color(0.1f, 0.08f, 0.06f));
        var gilets = new[] { new Color(0.95f, 0.85f, 0.1f), new Color(0.2f, 0.2f, 0.22f), new Color(0.95f, 0.85f, 0.1f), new Color(0.85f, 0.35f, 0.1f) };
        for (int i = 0; i < 4; i++)
        {
            var p = Athlete.Creer("Photographe", transform);
            p.Habiller(new Color(0.8f - i * 0.12f, 0.6f - i * 0.08f, 0.45f - i * 0.06f), gilets[i], new Color(0.12f, 0.13f, 0.16f),
                new Color(0.2f, 0.2f, 0.2f), new Color(0.1f, 0.08f, 0.05f));
            // le boitier et son teleobjectif, devant le visage
            var app = new GameObject("appareil").transform;
            app.SetParent(p.transform, false);
            var noir = Mat.Lit(new Color(0.08f, 0.08f, 0.09f), 0.4f);
            Stade.Boite(app, Vector3.zero, new Vector3(0.12f, 0.1f, 0.09f), noir);
            var obj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Destroy(obj.GetComponent<Collider>());
            obj.transform.SetParent(app, false);
            obj.transform.localRotation = Quaternion.Euler(0, 0, -90);
            obj.transform.localPosition = new Vector3(0.2f, 0, 0);
            obj.transform.localScale = new Vector3(0.075f, 0.16f, 0.075f);
            obj.GetComponent<MeshRenderer>().sharedMaterial = Mat.Lit(new Color(0.9f, 0.9f, 0.88f), 0.5f);
            p.Accrocher(global::Athlete.Os.Tete, app, new Vector3(0.14f, 1.54f, 0), Quaternion.identity);
            appareils.Add(app);
            photographes.Add(p);
        }

        // le drapeau du juge, dans sa main droite
        drapeau = new GameObject("drapeau").transform;
        drapeau.SetParent(transform, false);
        Stade.Cylindre(drapeau, Vector3.zero, 0.55f, 0.01f, Mat.Lit(new Color(0.4f, 0.3f, 0.2f), 0.2f));
        drapeauMat = Mat.Lit(Color.white, 0.2f);
        Stade.Boite(drapeau, new Vector3(0.16f, 0.4f, 0), new Vector3(0.32f, 0.22f, 0.005f), drapeauMat, false);
        drapeau.gameObject.SetActive(false);

        // le prisme du juge de mesure
        prisme = new GameObject("prisme").transform;
        prisme.SetParent(transform, false);
        Stade.Cylindre(prisme, Vector3.zero, 1.5f, 0.012f, Mat.Lit(new Color(0.95f, 0.8f, 0.1f), 0.5f));
        Stade.Boite(prisme, new Vector3(0, 1.55f, 0), new Vector3(0.08f, 0.1f, 0.08f), Mat.Lit(new Color(0.15f, 0.15f, 0.18f), 0.7f));
        prisme.gameObject.SetActive(false);

        // les flashs des photographes et du public
        var go = new GameObject("flashs");
        go.transform.SetParent(transform, false);
        flashs = go.AddComponent<ParticleSystem>();
        flashs.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
        var m = flashs.main;
        m.playOnAwake = false; m.loop = false; m.maxParticles = 200;
        m.startLifetime = 0.07f; m.startSize = 0.35f; m.simulationSpace = ParticleSystemSimulationSpace.World;
        var em = flashs.emission; em.rateOverTime = 0;
        var sh = flashs.shape; sh.enabled = false;
        var r = go.GetComponent<ParticleSystemRenderer>();
        r.sharedMaterial = Mat.Particule(Color.white * 6f, Mat.Disque(32, 1.5f));
    }

    void Flashs(int n, bool tribune)
    {
        var ep = new ParticleSystem.EmitParams();
        for (int i = 0; i < n; i++)
        {
            if (tribune && stade != null)
                ep.position = new Vector3(Random.Range(stade.debut - 20, stade.fosseFin + 40), Random.Range(2f, 12f), Stade.TRIBUNE_Z + Random.Range(0.5f, 20f));
            else
            {
                var ph = photographes[Random.Range(0, photographes.Count)];
                ep.position = ph.PositionOs(Athlete.Os.Tete) + new Vector3(-0.2f, 0.1f, 0);
            }
            ep.startSize = tribune ? Random.Range(0.3f, 0.6f) : 0.5f;
            flashs.Emit(ep, 1);
        }
    }

    /* ------------------------------------------------------------ l'etat */

    public float V(int i) => s[i];
    public int Phase => (int)s[Etat.Phase];
    public bool Triple => s[Etat.Epreuve] > 0.5f;
    public bool Portrait => cam.aspect < 1f;
    public Athlete Sauteur => athlete;
    public Stade LeStade => stade;
    public bool EnRalenti => ralentiDebut >= 0;

    Color Couleur(int i) => new Color(s[i], s[i + 1], s[i + 2]);

    void Update()
    {
        float dt = Mathf.Min(0.05f, Time.unscaledDeltaTime);
        horloge += dt;
        qualite.Mesurer(dt);

        int n = JumperLire(lu, Etat.N);
        if (n >= Etat.N && lu[Etat.Tic] != dernierTic)
        {
            dernierTic = lu[Etat.Tic];
            System.Array.Copy(lu, s, Etat.N);
            recu = true;
            tempsSansEtat = 0;
        }
        else tempsSansEtat += dt;

        if (!recu) { Demo(dt); return; }

        // UN NOUVEAU CONCOURS, UN NOUVEAU STADE.
        string cle = $"{s[Etat.Epreuve]}|{s[Etat.Etape]}|{s[Etat.Ligne]}";
        if (cle != cleStade)
        {
            cleStade = cle;
            if (stade != null) Destroy(stade.gameObject);
            if (fosse != null) Destroy(fosse.gameObject);
            stade = new GameObject("Stade").AddComponent<Stade>();
            stade.transform.SetParent(transform, false);
            float autre = s[Etat.Planches] == s[Etat.Ligne] ? s[Etat.Planches + 2] : s[Etat.Planches];
            stade.Construire(s[Etat.Ligne], autre, s[Etat.FosseX], s[Etat.FosseFin], Triple, (int)s[Etat.Etape]);
            fosse = new GameObject("Fosse").AddComponent<Fosse>();
            fosse.transform.SetParent(transform, false);
            fosse.Construire(s[Etat.FosseX], s[Etat.FosseFin], Stade.LARGEUR_FOSSE);
            athlete.Habiller(Couleur(Etat.Look), Couleur(Etat.Look + 3), Couleur(Etat.Look + 6), Couleur(Etat.Look + 9), Couleur(Etat.Look + 12));
        }

        Filmer();
        var etat = EnRalenti ? ImageDuRalenti(dt) : s;
        Montrer(etat, dt);
        real.Cadrer(etat, dt);
        stade.Animer(horloge, excitation);
    }

    /* ------------------------------------------------------------ le ralenti */

    /**
     * On garde chaque image de l'essai. Des que le juge a mesure, on la
     * rejoue au ralenti, de l'appel a la reception, sous un autre angle —
     * c'est ce que la television fait de chaque saut.
     */
    void Filmer()
    {
        int ph = Phase;
        if (ph == Etat.Attente && phasePrec != Etat.Attente)
        {
            film.Clear(); filmT.Clear();
            ralentiFait = false;
            ralentiDebut = -1;
            if (fosse) fosse.Ratisser();
            tempsMarque = 0;
        }
        if (ph == Etat.Elan || ph == Etat.Appel || ph == Etat.Vol || ph == Etat.Pose || ph == Etat.Reception_)
        {
            film.Add((float[])s.Clone()); filmT.Add(horloge);
            if (film.Count > 900) { film.RemoveAt(0); filmT.RemoveAt(0); }
        }
        // LE DECLENCHEMENT : 1,7 s apres le contact, une fois le sable mesure
        // (ou le drapeau rouge leve), et seulement pour un saut arrive dans la
        // fosse.
        if (!ralentiFait && ph == Etat.Reception_ && s[Etat.Reception] > 1.7f && film.Count > 10)
        {
            Debug.Log($"[jumper] ralenti ? images {film.Count}, de {filmT[0]:0.00} a {filmT[film.Count - 1]:0.00}");
            float tAppel = -1, tContact = -1;
            for (int i = 0; i < film.Count; i++)
            {
                int p = (int)film[i][Etat.Phase];
                // L'appel dure un dixieme de seconde : une image lente peut le
                // manquer. Le debut du vol en tient lieu.
                if (tAppel < 0 && (p == Etat.Appel || p == Etat.Vol)) tAppel = filmT[i] - (p == Etat.Vol ? 0.15f : 0f);
                if (tContact < 0 && p == Etat.Reception_) tContact = filmT[i];
            }
            if (tAppel > 0 && tContact > 0)
            {
                ralentiFait = true;
                ralentiDe = tAppel - (Triple ? 0.8f : 1.1f);
                ralentiA = tContact + 0.9f;
                ralentiDebut = horloge;
                ralentiT = 0;
                if (fosse) fosse.Ratisser();
                empreintePrec = false;
                gerbeIdPrec = -1;
                real.Ralenti(true);
                Debug.Log($"[jumper] ralenti de {ralentiDe:0.00} a {ralentiA:0.00}");
            }
            else Debug.Log($"[jumper] pas de ralenti : appel {tAppel:0.00}, contact {tContact:0.00}");
        }
        phasePrec = ph;
    }

    readonly float[] entre = new float[Etat.N];
    const float VITESSE_RALENTI = 0.3f;

    float[] ImageDuRalenti(float dt)
    {
        ralentiT += dt * VITESSE_RALENTI;
        float t = ralentiDe + ralentiT;
        if (t >= ralentiA || Phase == Etat.Attente)
        {
            Debug.Log($"[jumper] fin du ralenti a {t:0.00}");
            ralentiDebut = -1;
            real.Ralenti(false);
            return s;
        }
        int i = filmT.BinarySearch(t);
        if (i < 0) i = ~i;
        i = Mathf.Clamp(i, 1, film.Count - 1);
        float u = Mathf.InverseLerp(filmT[i - 1], filmT[i], t);
        var a = film[i - 1]; var b = film[i];
        for (int k = 0; k < Etat.N; k++) entre[k] = Mathf.Lerp(a[k], b[k], u);
        // ce qui ne s'interpole pas : les phases, les compteurs, les drapeaux
        foreach (int k in new[] { Etat.Phase, Etat.Gerbe, Etat.Empreinte, Etat.Drapeau, Etat.Mesure, Etat.Bond })
            entre[k] = u < 0.5f ? a[k] : b[k];
        return entre;
    }

    /* ------------------------------------------------------------ montrer */

    float wRituel, wReaction, tRituel;

    void Montrer(float[] e, float dt)
    {
        int ph = (int)e[Etat.Phase];
        var p = athlete.pose;
        p.hanche = new Vector3(e[Etat.HipX], e[Etat.HipZ], e[Etat.HipY]);
        p.bassin = e[Etat.Bassin]; p.buste = e[Etat.Buste]; p.tete = e[Etat.Tete];
        p.lacetBas = e[Etat.LacetBas]; p.lacetHaut = e[Etat.LacetHaut]; p.chute = e[Etat.Chute];
        for (int i = 0; i < 3; i++) { p.jambeG[i] = e[Etat.JambeA + i]; p.jambeD[i] = e[Etat.JambeB + i]; }
        for (int i = 0; i < 2; i++) { p.brasG[i] = e[Etat.BrasA + i]; p.brasD[i] = e[Etat.BrasB + i]; }
        p.ecartG = p.ecartD = 0.06f;

        // LES CODES DU SAUTEUR, par-dessus le geste du jeu.
        bool surMarque = (ph == Etat.Attente || ph == Etat.Repos) && !EnRalenti;
        wRituel = Mathf.MoveTowards(wRituel, surMarque ? 1 : 0, dt * (surMarque ? 1.5f : 6f));
        if (surMarque) tRituel += dt; else tRituel = 0;
        Athlete.Rituel(p, tRituel, wRituel);
        bool sorti = ph == Etat.Reception_ && e[Etat.Reception] > 1.75f && !EnRalenti;
        wReaction = Mathf.MoveTowards(wReaction, sorti ? 1 : 0, dt * 2.5f);
        Athlete.Reaction(p, e[Etat.Drapeau] < 1.5f && e[Etat.Metres] > 0, e[Etat.Reception], wReaction);

        athlete.Appliquer(new Vector3(e[Etat.D], 0, e[Etat.Y]), e[Etat.K]);

        // LE SABLE : la trace et la gerbe, au moment ou le jeu les pose.
        bool emp = e[Etat.Empreinte] > 0.5f;
        if (emp && !empreintePrec) fosse.Creuser(e[Etat.EmpreinteX], e[Etat.EmpreinteY], "avant");
        empreintePrec = emp;
        if (e[Etat.Gerbe] > 0 && e[Etat.Gerbe] != gerbeIdPrec)
        {
            gerbeIdPrec = e[Etat.Gerbe];
            fosse.Gerbe(new Vector3(e[Etat.GerbeX], 0, e[Etat.GerbeY]), e[Etat.GerbeForce]);
            Flashs(10, false);
            Flashs(26, true);
        }

        // LE PUBLIC : il monte avec l'elan, explose au contact.
        float cible = ph == Etat.Elan ? 0.25f + 0.4f * Mathf.Clamp01(e[Etat.Vitesse] / 11f)
            : ph == Etat.Appel || ph == Etat.Vol || ph == Etat.Pose ? 0.9f
            : ph == Etat.Reception_ && e[Etat.Drapeau] < 1.5f ? Mathf.Clamp01(1.2f - e[Etat.Reception] * 0.25f)
            : 0f;
        excitation = Mathf.MoveTowards(excitation, cible, dt * 1.5f);
        if ((ph == Etat.Vol || ph == Etat.Appel) && Random.value < dt * 18f) Flashs(1, true);

        Juges(e, dt);
        Photographes(dt);
        Panneaux(e);
    }

    float tJuge;

    void Juges(float[] e, float dt)
    {
        tJuge += dt;
        // LE JUGE DE PLANCHE, assis sur le bord de la piste, du cote de la
        // tribune ; il se leve et leve son drapeau : blanc, le saut est bon ;
        // rouge, il est nul.
        var j = jugePlanche.pose;
        int dr = (int)e[Etat.Drapeau];
        j.hanche = new Vector3(0, 0.87f, 0);
        j.bassin = 0; j.buste = 0.04f; j.tete = -0.1f + Mathf.Sin(tJuge * 0.7f) * 0.05f;
        j.lacetBas = j.lacetHaut = 0; j.chute = 0;
        j.jambeG[0] = 0; j.jambeG[1] = 0; j.jambeG[2] = 0;
        j.jambeD[0] = 0; j.jambeD[1] = 0; j.jambeD[2] = 0;
        j.brasG[0] = 0.05f; j.brasG[1] = 0.3f;
        j.ecartG = j.ecartD = 0.08f;
        bool leve = dr > 0;
        j.brasD[0] = leve ? 2.9f : 0.1f; j.brasD[1] = leve ? 3.0f : 0.25f;
        drapeau.gameObject.SetActive(leve);
        if (leve) drapeauMat.SetColor("_BaseColor", dr == 1 ? new Color(0.97f, 0.97f, 0.97f) : new Color(0.9f, 0.08f, 0.1f));
        jugePlanche.cap = Quaternion.Euler(0, 90, 0);    // face a la piste
        jugePlanche.Appliquer(new Vector3(e[Etat.Ligne] + 0.35f, 0, Stade.LARGEUR_ELAN * 0.5f + 1.1f), 1f);
        if (leve)
        {
            float a = j.brasD[1];
            var dir = jugePlanche.cap * new Vector3(Mathf.Sin(a), -Mathf.Cos(a), 0);
            drapeau.position = jugePlanche.PositionOs(Athlete.Os.AvantBrasD) + dir * 0.27f - Vector3.up * 0.1f;
            drapeau.rotation = jugePlanche.cap * Quaternion.Euler(0, 0, Mathf.Sin(tJuge * 9f) * 6f);
        }

        // LE JUGE DE MESURE, dans le sable, son prisme sur la trace.
        var m = jugeMesure.pose;
        bool mesure = e[Etat.Mesure] > 0.5f;
        m.hanche = new Vector3(0, mesure ? 0.8f : 0.87f, 0);
        m.bassin = 0; m.buste = mesure ? -0.35f : 0; m.tete = mesure ? -0.3f : 0;
        m.lacetBas = m.lacetHaut = 0; m.chute = 0;
        m.jambeG[0] = mesure ? 0.35f : 0; m.jambeG[1] = mesure ? -0.2f : 0; m.jambeG[2] = 0;
        m.jambeD[0] = mesure ? -0.15f : 0; m.jambeD[1] = mesure ? -0.3f : 0; m.jambeD[2] = 0;
        m.brasG[0] = mesure ? 1.1f : 0.05f; m.brasG[1] = mesure ? 1.3f : 0.2f;
        m.brasD[0] = 0.1f; m.brasD[1] = 0.2f;
        m.ecartG = m.ecartD = 0.08f;
        float fosseX = e[Etat.FosseX];
        var ouMesure = mesure ? new Vector3(e[Etat.EmpreinteX] + 0.55f, 0.01f, 0.55f) : new Vector3(e[Etat.FosseX] + 0.6f, 0, Stade.LARGEUR_FOSSE * 0.5f + 2.2f);
        // Hors de la fosse, il attend au debut du sable, loin de l'axe de la
        // camera du triple saut qu'il masquait au bout de la fosse.
        jugeMesure.cap = Quaternion.Euler(0, mesure ? 200 : 150, 0);
        jugeMesure.Appliquer(ouMesure, 1f);
        prisme.gameObject.SetActive(mesure);
        if (mesure) prisme.position = new Vector3(e[Etat.EmpreinteX], 0, e[Etat.EmpreinteY]);
    }

    float tPhoto;

    void Photographes(float dt)
    {
        if (stade == null) return;
        tPhoto += dt;
        for (int i = 0; i < photographes.Count; i++)
        {
            var ph = photographes[i];
            var p = ph.pose;
            // accroupis, un genou au sol, le teleobjectif sur le sable
            p.hanche = new Vector3(0, 0.46f, 0);
            p.bassin = 0; p.buste = -0.25f; p.tete = 0.1f + Mathf.Sin(tPhoto * 1.3f + i) * 0.04f;
            p.lacetBas = p.lacetHaut = 0; p.chute = 0;
            p.jambeG[0] = 1.45f; p.jambeG[1] = -0.2f; p.jambeG[2] = 0;
            p.jambeD[0] = 0.2f; p.jambeD[1] = -1.4f; p.jambeD[2] = -1.2f;
            p.brasG[0] = 1.2f; p.brasG[1] = 2.2f; p.brasD[0] = 1.1f; p.brasD[1] = 2.4f;
            p.ecartG = p.ecartD = -0.1f;
            ph.cap = Quaternion.Euler(0, 180 + (i - 1.5f) * 12f, 0);
            ph.Appliquer(new Vector3(stade.fosseFin + 2.2f + (i % 2) * 0.8f, 0, -Stade.LARGEUR_FOSSE * 0.5f - 0.6f - i * 0.95f), 1f);

        }
    }

    void Panneaux(float[] e)
    {
        bool marque = e[Etat.Mesure] > 0.5f || e[Etat.Drapeau] > 1.5f;
        string txt = !marque ? "" : e[Etat.Drapeau] > 1.5f ? "X" : Chiffre(e[Etat.Metres]);
        if (stade.panneauMarque.text != txt) stade.panneauMarque.text = txt;
        string ecran = !marque ? "" : e[Etat.Drapeau] > 1.5f ? "MORDU" : Chiffre(e[Etat.Metres]) + " m";
        if (stade.ecranMarque.text != ecran) stade.ecranMarque.text = ecran;
    }

    static string Chiffre(float m) => m.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture).Replace('.', ',');

    /* ------------------------------------------------------------ attente */

    /**
     * Rien n'arrive encore du jeu (la page charge, ou la scene tourne seule
     * pour etre regardee) : un sautoir d'essai et un athlete sur sa marque.
     */
    void Demo(float dt)
    {
        s[Etat.Tic] = horloge; s[Etat.Phase] = Etat.Attente; s[Etat.Epreuve] = 0; s[Etat.Etape] = 3;
        s[Etat.Ligne] = 50; s[Etat.FosseX] = 52; s[Etat.FosseFin] = 61;
        s[Etat.Planches] = 50; s[Etat.Planches + 1] = 1; s[Etat.Planches + 2] = 39; s[Etat.Planches + 3] = 0;
        s[Etat.D] = 10; s[Etat.K] = 1; s[Etat.HipZ] = 0.87f;
        for (int i = Etat.Look; i < Etat.Look + 15; i++) s[i] = 0.5f;
        s[Etat.Look] = 0.45f; s[Etat.Look + 1] = 0.28f; s[Etat.Look + 2] = 0.18f;
        s[Etat.Look + 3] = 0.1f; s[Etat.Look + 4] = 0.3f; s[Etat.Look + 5] = 0.85f;
        s[Etat.Look + 6] = 0.05f; s[Etat.Look + 7] = 0.06f; s[Etat.Look + 8] = 0.1f;
        s[Etat.Look + 9] = 0.95f; s[Etat.Look + 10] = 0.35f; s[Etat.Look + 11] = 0.1f;
        s[Etat.Look + 12] = 0.05f; s[Etat.Look + 13] = 0.04f; s[Etat.Look + 14] = 0.03f;
        recu = true;
        dernierTic = -1;
    }
}
