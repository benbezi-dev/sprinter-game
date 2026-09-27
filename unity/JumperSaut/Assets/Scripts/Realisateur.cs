// ---------------------------------------------------------------------------
// LA REALISATION : CE QUE FAIT LE CAR-REGIE D'UN CONCOURS DE LONGUEUR.
//
//  - SUR LA MARQUE : un plan serre, de trois quarts face, au teleobjectif.
//    Le fond fond dans le flou ; on voit le visage, les mains qui claquent.
//  - L'ELAN, L'APPEL, LE VOL : la camera de cote, en travelling, un peu
//    devant l'athlete, pour que la planche puis le sable entrent dans le
//    cadre. C'est le plan du joueur : on ne coupe JAMAIS pendant qu'il vise
//    la planche. Au triple saut, la camera est dans l'axe, derriere la fosse.
//  - LA RECEPTION : on reste de cote le temps du contact, puis on coupe sur
//    la camera basse du bout de la fosse — l'athlete se releve face a nous,
//    le juge plante son prisme.
//  - LE RALENTI : de trois quarts avant, au ras de la piste, a 30 % de la
//    vitesse, avec son bandeau.
//  - ENTRE DEUX ESSAIS : le stade en plan large, qui glisse lentement.
//
// Les coupes sont franches ; a l'interieur d'un plan, la camera suit par un
// ressort amorti, sans jamais sortir l'athlete du cadre.
// ---------------------------------------------------------------------------
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public class Realisateur
{
    readonly Camera cam;
    readonly Saut saut;
    readonly DepthOfField dof;
    readonly Vignette vignette;
    readonly ColorAdjustments couleurs;
    readonly Bloom bloom;
    readonly TextMesh bandeau;
    readonly Transform bandeauFond;
    public bool flouPermis = true;

    enum Plan { Aucun, Marque, Cote, Axe, Reception, Ralenti, Large }
    Plan plan = Plan.Aucun;
    float tPlan;
    Vector3 visee, vitesseVisee, position;
    float focale = 30, flash;

    public Realisateur(Camera cam, Saut saut)
    {
        this.cam = cam; this.saut = saut;
        var go = new GameObject("Post");
        var vol = go.AddComponent<Volume>();
        vol.isGlobal = true;
        var p = ScriptableObject.CreateInstance<VolumeProfile>();
        vol.profile = p;
        var tm = p.Add<Tonemapping>(true); tm.mode.Override(TonemappingMode.ACES);
        bloom = p.Add<Bloom>(true); bloom.intensity.Override(0.55f); bloom.threshold.Override(1.05f); bloom.scatter.Override(0.6f);
        couleurs = p.Add<ColorAdjustments>(true);
        couleurs.postExposure.Override(0.35f); couleurs.contrast.Override(14f); couleurs.saturation.Override(10f);
        vignette = p.Add<Vignette>(true); vignette.intensity.Override(0.24f); vignette.smoothness.Override(0.45f);
        dof = p.Add<DepthOfField>(true);
        dof.mode.Override(DepthOfFieldMode.Gaussian);
        dof.gaussianStart.Override(20f); dof.gaussianEnd.Override(60f); dof.gaussianMaxRadius.Override(1.5f);
        dof.highQualitySampling.Override(false);

        // LE BANDEAU DU RALENTI, en bas a gauche de l'image.
        var b = new GameObject("bandeau").transform;
        b.SetParent(cam.transform, false);
        bandeauFond = GameObject.CreatePrimitive(PrimitiveType.Quad).transform;
        Object.Destroy(bandeauFond.GetComponent<Collider>());
        bandeauFond.SetParent(b, false);
        bandeauFond.GetComponent<MeshRenderer>().sharedMaterial = Mat.Unlit(new Color(0.9f, 0.1f, 0.15f));
        bandeau = Stade.Texte(b, "RALENTI", Vector3.zero, 0.02f, Color.white);
        b.gameObject.SetActive(false);
    }

    public void Ralenti(bool oui)
    {
        flash = 1f;
        bandeau.transform.parent.gameObject.SetActive(oui);
        plan = Plan.Aucun;
    }

    Vector3 Athlete(float[] e) => new Vector3(e[Etat.D], 0, e[Etat.Y]);

    void Couper(Plan p)
    {
        if (p == plan) return;
        plan = p; tPlan = 0;
        position = Vector3.zero;
        vitesseVisee = Vector3.zero;
        visee = Vector3.zero;
    }

    static Vector3 Ressort(Vector3 x, Vector3 cible, ref Vector3 v, float w, float dt)
    {
        if (x == Vector3.zero) { v = Vector3.zero; return cible; }
        var f = 1 + 2 * dt * w + dt * dt * w * w;
        var a = (v - w * w * dt * (x - cible)) / f;
        v = a;
        return x + dt * a;
    }

    float Fov(float largeurVisible, float distance, bool horizontale)
    {
        float h = horizontale ? largeurVisible / Mathf.Max(0.3f, cam.aspect) : largeurVisible;
        return 2 * Mathf.Atan(h * 0.5f / distance) * Mathf.Rad2Deg;
    }

    public void Cadrer(float[] e, float dt)
    {
        int ph = (int)e[Etat.Phase];
        var st = saut.LeStade;
        if (st == null) return;
        tPlan += dt;
        bool portrait = cam.aspect < 1f;
        float fosseFin = e[Etat.FosseFin];
        var a = Athlete(e);
        var torse = saut.Sauteur.PositionOs(global::Athlete.Os.Buste) ;

        // Le choix du plan.
        Plan voulu;
        if (saut.EnRalenti) voulu = Plan.Ralenti;
        else if (ph == Etat.Attente) voulu = Plan.Marque;
        else if (ph == Etat.Repos) voulu = plan == Plan.Ralenti || plan == Plan.Reception || plan == Plan.Large ? Plan.Large : Plan.Marque;
        else if (ph == Etat.Reception_ && e[Etat.Reception] > 1.15f && !saut.Triple) voulu = Plan.Reception;
        else voulu = saut.Triple && ph != Etat.Reception_ && ph != Etat.Casse && ph != Etat.Traverse ? Plan.Axe
            : saut.Triple ? Plan.Axe : Plan.Cote;
        Couper(voulu);

        Vector3 pos, cible; float fov; float foyer;
        switch (plan)
        {
            case Plan.Marque:
            {
                // TROIS QUARTS FACE, en pied jusqu'aux mains levees : le
                // sauteur sur sa marque, la piste d'elan qui file derriere lui.
                var c = a + new Vector3(0, 1.15f, 0);
                float d = portrait ? 7.5f : 6.5f;
                float derive = Mathf.Sin(tPlan * 0.25f) * 0.4f;
                pos = c + new Vector3(d * 0.8f, 0.1f, -d * 0.6f + derive);
                cible = c + new Vector3(0, 0.05f, 0);
                fov = Fov(portrait ? 5.0f : 2.6f, Vector3.Distance(pos, cible), false);
                foyer = Vector3.Distance(pos, cible);
                break;
            }
            case Plan.Cote:
            {
                // LE TRAVELLING DE COTE. Le cadre fait 6 m de large a la
                // distance de l'athlete (7,5 m en portrait) ; il est devant
                // lui, d'autant plus que la planche approche.
                float visible = portrait ? 7.8f : 6.2f;
                float large = portrait ? visible : visible;
                float recul = portrait ? 19f : 16f;
                float part = ph == Etat.Reception_ ? 0.1f : ph == Etat.Vol || ph == Etat.Pose ? 0.2f
                    : 0.14f + 0.14f * Mathf.Clamp01((a.x - (e[Etat.Ligne] - 16)) / 12f);
                float cx = Mathf.Min(a.x + part * large, fosseFin - 1.5f);
                float cy = (ph == Etat.Vol ? 1.1f : 0.85f) + (portrait ? 0.9f : 0f);
                cible = new Vector3(cx, cy, 0);
                pos = new Vector3(cx, 2.3f, -recul);
                fov = Fov(visible, recul, !portrait);
                if (portrait) fov = Fov(visible * 1.25f, recul, false);
                foyer = recul;
                break;
            }
            case Plan.Axe:
            {
                // LE TRIPLE, DANS L'AXE : derriere la fosse, au teleobjectif,
                // l'athlete garde sa taille a l'ecran en venant vers nous.
                var cp = new Vector3(fosseFin + 14, 2.4f, 0.6f);
                var c = new Vector3(a.x, ph == Etat.Vol ? 1.0f : 0.8f, a.z);
                pos = cp; cible = c;
                float dist = Mathf.Max(4, Vector3.Distance(cp, c));
                fov = Mathf.Clamp(Fov(portrait ? 4.4f : 5.0f, dist, false), 3f, 55f);
                foyer = dist;
                break;
            }
            case Plan.Reception:
            {
                // LA CAMERA BASSE DU BOUT DE LA FOSSE, face a l'athlete.
                pos = new Vector3(fosseFin + 4.5f, 0.75f, -1.4f);
                cible = torse + new Vector3(0, -0.2f, 0);
                float dist = Vector3.Distance(pos, cible);
                fov = Fov(portrait ? 5.5f : 2.8f, dist, false);
                foyer = dist;
                break;
            }
            case Plan.Ralenti:
            {
                // DE TROIS QUARTS AVANT, AU RAS DE LA PISTE.
                float ligne = e[Etat.Ligne];
                pos = new Vector3(ligne + 5.5f, 0.45f, -3.4f);
                if (saut.Triple) pos = new Vector3(a.x + 2.5f, 0.5f, -6.5f);
                cible = torse + new Vector3(0, -0.15f, 0);
                float dist = Vector3.Distance(pos, cible);
                fov = Fov(portrait ? 6.0f : 3.2f, dist, false);
                foyer = dist;
                break;
            }
            default:
            {
                // LE PLAN LARGE : le sautoir et la tribune, qui glissent.
                float x = e[Etat.FosseX] - 6 + Mathf.Sin(tPlan * 0.12f) * 8f;
                pos = new Vector3(x - 14, 9f, -22f);
                cible = new Vector3(x + 2, 1.5f, 4f);
                fov = portrait ? 48 : 34;
                foyer = 26;
                break;
            }
        }

        // Le suivi : la visee file au ressort, la position aussi pour les plans
        // qui bougent ; aucun retard sur l'athlete lui-meme (le ressort porte
        // sur le cadre, qui est deja devant lui).
        float raideur = plan == Plan.Cote ? 7f : plan == Plan.Ralenti ? 5f : plan == Plan.Axe ? 9f : 3f;
        // Le travelling et l'axe suivent l'athlete sans retard : un ressort
        // sur un coureur lance a onze metres par seconde le laisse filer de
        // trois metres, et le sort du cadre (vu en capture le 27 sept. 2026).
        // Le cadre, lui, est deja devant lui, et il avance sans a-coup.
        if (plan == Plan.Cote || plan == Plan.Axe) { visee = cible; vitesseVisee = Vector3.zero; }
        else visee = Ressort(visee, cible, ref vitesseVisee, raideur, dt);
        position = pos;
        cam.transform.position = position;
        cam.transform.rotation = Quaternion.LookRotation(visee - position, Vector3.up);
        // un souffle de camera a l'epaule, jamais sur le travelling
        if (plan == Plan.Marque || plan == Plan.Reception || plan == Plan.Ralenti)
            cam.transform.rotation *= Quaternion.Euler(Mathf.Sin(Time.time * 0.9f) * 0.25f, Mathf.Sin(Time.time * 0.63f) * 0.3f, 0);
        focale = plan == Plan.Aucun ? fov : Mathf.Lerp(focale, fov, 1 - Mathf.Exp(-12 * dt));
        if (tPlan < 0.05f) focale = fov;
        cam.fieldOfView = focale;

        // Le flou du teleobjectif : le fond part, l'athlete reste net.
        bool flou = flouPermis && plan != Plan.Large;
        dof.active = flou;
        if (flou)
        {
            dof.gaussianStart.Override(foyer + (plan == Plan.Cote || plan == Plan.Axe ? 6f : 1.2f));
            dof.gaussianEnd.Override(foyer + (plan == Plan.Cote || plan == Plan.Axe ? 40f : 14f));
        }

        // Le bandeau du ralenti, et l'eclair blanc des coupes du ralenti.
        if (bandeau.transform.parent.gameObject.activeSelf)
        {
            float d = 1f, hauteur = 2 * d * Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad);
            float largeur = hauteur * cam.aspect;
            var b = bandeau.transform.parent;
            // Sur le plus petit cote de l'image : tenu droit, un telephone est
            // etroit, et un bandeau regle sur la hauteur mangeait la moitie de
            // la largeur (vu en capture portrait le 27 sept. 2026). En
            // portrait, il remonte au-dessus des paves.
            float k = Mathf.Min(hauteur, largeur);
            float bas = portrait ? hauteur * 0.30f : k * 0.14f;
            b.localPosition = new Vector3(-largeur * 0.5f + k * 0.16f, -hauteur * 0.5f + bas, d);
            b.localRotation = Quaternion.identity;
            b.localScale = Vector3.one * k * (portrait ? 0.8f : 1f);
            bandeauFond.localScale = new Vector3(0.2f, 0.05f, 1);
            bandeauFond.localPosition = new Vector3(0.05f, 0, 0.001f);
            bandeau.characterSize = 0.028f * 10f / 96f;
            bandeau.transform.localPosition = new Vector3(0.05f, 0, 0);
        }
        flash = Mathf.MoveTowards(flash, 0, dt * 3f);
        couleurs.postExposure.Override(0.35f + flash * 2.2f);
        couleurs.saturation.Override(saut.EnRalenti ? -8f : 10f);
    }
}

/**
 * LA QUALITE SUIT LE TELEPHONE. Si l'image descend sous 40 par seconde, on
 * baisse la definition du rendu, puis on coupe le flou de profondeur ; on ne
 * remonte jamais pendant un saut.
 */
public class Qualite
{
    readonly Realisateur real;
    float moyenne = 1f / 60f, tNiveau;
    int niveau;
    static readonly float[] ECHELLES = { 1f, 0.85f, 0.72f, 0.6f };

    public Qualite(Realisateur r) { real = r; Poser(0); }

    void Poser(int n)
    {
        niveau = n;
        var urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
        if (urp != null)
        {
            urp.renderScale = ECHELLES[Mathf.Min(n, ECHELLES.Length - 1)];
            urp.msaaSampleCount = n >= 2 ? 1 : n == 1 ? 2 : 4;
            urp.shadowDistance = n >= 3 ? 25f : 40f;
        }
        real.flouPermis = n < 2;
    }

    public void Mesurer(float dt)
    {
        if (dt <= 0) return;
        moyenne = Mathf.Lerp(moyenne, dt, 0.03f);
        tNiveau += dt;
        if (tNiveau > 2.5f && moyenne > 1f / 38f && niveau < ECHELLES.Length - 1)
        {
            Poser(niveau + 1);
            tNiveau = 0;
            moyenne = 1f / 50f;
        }
    }
}
