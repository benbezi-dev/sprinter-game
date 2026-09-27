// ---------------------------------------------------------------------------
// LES MATIERES ET LES TEXTURES, FABRIQUEES AU LANCEMENT.
//
// Aucune image n'est chargee : le gazon, le tartan, le sable, la foule sont
// peints ici, pixel par pixel. Le build reste leger, et rien ne depend d'un
// fichier qu'on aurait oublie de publier.
//
// Les matieres partent de modeles poses dans Resources/Materiaux par
// l'editeur (Construire.cs) : c'est ce qui garantit que les variantes de
// shader dont on a besoin survivent au tri du build WebGL.
// ---------------------------------------------------------------------------
using UnityEngine;

public static class Mat
{
    static Material lit, unlit, unlitT, part;

    static Material Base(ref Material m, string nom)
    {
        if (m == null) m = Resources.Load<Material>("Materiaux/" + nom);
        return m;
    }

    public static Material Lit(Color c, float lisse = 0.25f, Texture t = null, Vector2? rep = null)
    {
        var m = new Material(Base(ref lit, "Lit"));
        m.SetColor("_BaseColor", c);
        m.SetFloat("_Smoothness", lisse);
        m.SetFloat("_Metallic", 0f);
        if (t != null)
        {
            m.SetTexture("_BaseMap", t);
            if (rep.HasValue) m.SetTextureScale("_BaseMap", rep.Value);
        }
        return m;
    }

    static Material decoupe;

    /** Une matiere eclairee dont le fond transparent est decoupe : le public. */
    public static Material LitDecoupe(Texture t)
    {
        var m = new Material(Base(ref decoupe, "LitDecoupe"));
        m.SetColor("_BaseColor", Color.white);
        m.SetTexture("_BaseMap", t);
        m.SetFloat("_Smoothness", 0.05f);
        return m;
    }

    /** Une matiere qui ne recoit pas la lumiere : ecrans, LED, ciel peint. */
    public static Material Unlit(Color c, Texture t = null, bool transparent = false)
    {
        var m = new Material(transparent ? Base(ref unlitT, "UnlitTransparent") : Base(ref unlit, "Unlit"));
        m.SetColor("_BaseColor", c);
        if (t != null) m.SetTexture("_BaseMap", t);
        return m;
    }

    public static Material Particule(Color c, Texture t)
    {
        var m = new Material(Base(ref part, "Particule"));
        m.SetColor("_BaseColor", c);
        if (t != null) m.SetTexture("_BaseMap", t);
        return m;
    }

    /* ------------------------------------------------------------ outils */

    static float Bruit(int x, int y, int graine)
    {
        unchecked
        {
            int n = x * 374761393 + y * 668265263 + graine * 982451653;
            n = (n ^ (n >> 13)) * 1274126177;
            return ((n ^ (n >> 16)) & 0xffff) / 65535f;
        }
    }

    static Texture2D Tex(int l, int h, Color32[] px, bool repete = true, FilterMode f = FilterMode.Trilinear)
    {
        var t = new Texture2D(l, h, TextureFormat.RGBA32, true, false);
        t.SetPixels32(px);
        t.wrapMode = repete ? TextureWrapMode.Repeat : TextureWrapMode.Clamp;
        t.filterMode = f;
        t.anisoLevel = 4;
        t.Apply(true, true);
        return t;
    }

    static Color32 C(Color c) => c;

    /** Un aplat granuleux : tartan, beton, sable. */
    public static Texture2D Grain(Color baseC, float ecart, int taille = 256, int graine = 1)
    {
        var px = new Color32[taille * taille];
        for (int y = 0; y < taille; y++)
            for (int x = 0; x < taille; x++)
            {
                float n = (Bruit(x, y, graine) - 0.5f) * ecart
                        + (Bruit(x / 4, y / 4, graine + 7) - 0.5f) * ecart * 0.6f;
                px[y * taille + x] = C(new Color(baseC.r + n, baseC.g + n, baseC.b + n, 1));
            }
        return Tex(taille, taille, px);
    }

    /** Le gazon tondu en bandes, comme dans tous les stades televises. */
    public static Texture2D Gazon()
    {
        int l = 256, h = 256;
        var a = new Color(0.19f, 0.42f, 0.13f); var b = new Color(0.24f, 0.50f, 0.16f);
        var px = new Color32[l * h];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < l; x++)
            {
                var c = (x < l / 2) ? a : b;
                float n = (Bruit(x, y, 3) - 0.5f) * 0.06f + (Bruit(x / 3, y / 5, 4) - 0.5f) * 0.05f;
                px[y * l + x] = C(new Color(c.r + n, c.g + n * 1.4f, c.b + n, 1));
            }
        return Tex(l, h, px);
    }

    /**
     * Le sable ratisse : un grain fin, et les sillons du rateau en travers de
     * la fosse, que le soleil rasant fait ressortir.
     */
    public static Texture2D Sable()
    {
        int t = 256;
        var baseC = new Color(0.86f, 0.74f, 0.53f);
        var px = new Color32[t * t];
        for (int y = 0; y < t; y++)
            for (int x = 0; x < t; x++)
            {
                float sillon = Mathf.Sin(y * Mathf.PI * 2f / 16f + Bruit(x / 16, 0, 5) * 0.8f) * 0.035f;
                float n = (Bruit(x, y, 9) - 0.5f) * 0.16f + (Bruit(x / 2, y / 2, 11) - 0.5f) * 0.08f + sillon;
                px[y * t + x] = C(new Color(baseC.r + n, baseC.g + n * 0.95f, baseC.b + n * 0.85f, 1));
            }
        return Tex(t, t, px);
    }

    static readonly Color[] PEAUX = {
        new Color(0.94f, 0.78f, 0.65f), new Color(0.88f, 0.66f, 0.51f), new Color(0.78f, 0.54f, 0.38f),
        new Color(0.60f, 0.39f, 0.25f), new Color(0.43f, 0.27f, 0.16f), new Color(0.29f, 0.17f, 0.10f) };
    static readonly Color[] HABITS = {
        new Color(0.97f, 0.98f, 0.99f), new Color(0.88f, 0.11f, 0.28f), new Color(0.15f, 0.39f, 0.92f),
        new Color(0.09f, 0.64f, 0.29f), new Color(0.98f, 0.80f, 0.08f), new Color(0.06f, 0.09f, 0.16f),
        new Color(0.98f, 0.45f, 0.09f), new Color(0.49f, 0.23f, 0.93f), new Color(0.58f, 0.64f, 0.72f),
        new Color(0.05f, 0.65f, 0.91f), new Color(0.75f, 0.07f, 0.24f), new Color(0.99f, 0.90f, 0.54f),
        new Color(0.12f, 0.23f, 0.54f), new Color(0.90f, 0.91f, 0.92f) };

    /**
     * LA FOULE, DECOUPEE. Quatre rangees de spectateurs differentes, sur fond
     * transparent : chaque rang de la tribune en recoit une, posee debout sur
     * sa marche, comme une rangee de silhouettes. Vus de cote au
     * teleobjectif, les rangs se recouvrent — c'est ce qui fait une foule, la
     * ou des personnages peints a plat sur les gradins se lisaient comme des
     * barres de couleur (vu le 27 sept. 2026).
     *
     * Une cellule de 32 x 64 pixels par spectateur : 55 cm de large, un metre
     * de haut. v = 0 est en bas de l'image.
     */
    public static Texture2D Foule(int graine)
    {
        const int cl = 32, ch = 64, par = 32, bandes = 4;
        int l = cl * par, h = ch * bandes;
        var px = new Color32[l * h];
        var rnd = new System.Random(graine);
        void Pix(int x, int y, Color c) { if (x >= 0 && x < l && y >= 0 && y < h) px[y * l + x] = c; }
        for (int b = 0; b < bandes; b++)
            for (int k = 0; k < par; k++)
            {
                if (rnd.NextDouble() < 0.08) continue;          // une place vide
                var habit = HABITS[rnd.Next(HABITS.Length)];
                var peau = PEAUX[rnd.Next(PEAUX.Length)];
                var cheveux = rnd.NextDouble() < 0.5 ? new Color(0.08f, 0.06f, 0.05f) : rnd.NextDouble() < 0.5 ? new Color(0.45f, 0.3f, 0.15f) : peau * 0.8f;
                int y0 = b * ch;
                float cx = k * cl + cl * 0.5f + (float)(rnd.NextDouble() - 0.5) * 6;
                float echelle = 0.85f + (float)rnd.NextDouble() * 0.25f;
                bool debout = rnd.NextDouble() < 0.25;
                float haut = (debout ? 40 : 32) * echelle;
                // le buste : des epaules arrondies, qui s'evasent vers le bas
                for (int y = 0; y < (int)haut; y++)
                {
                    float t = y / haut;
                    float demi = (11f - 1.5f * t + (t > 0.8f ? -(t - 0.8f) * 25f : 0)) * echelle;
                    var c = habit * (0.72f + 0.35f * t);
                    c.a = 1;
                    for (int x = (int)(cx - demi); x <= (int)(cx + demi); x++) Pix(x, y0 + y, c);
                }
                // la tete et les cheveux
                float hy = y0 + haut + 6.5f * echelle, r = 6.2f * echelle;
                for (int y = (int)(hy - r); y <= (int)(hy + r); y++)
                    for (int x = (int)(cx - r); x <= (int)(cx + r); x++)
                    {
                        float dx = (x - cx) / r, dy = (y - hy) / r;
                        float d = dx * dx + dy * dy;
                        if (d < 1) Pix(x, y, dy > 0.25f ? cheveux : peau * (0.9f + 0.1f * dx));
                    }
                // des bras leves, ici et la : un drapeau, des applaudissements
                if (rnd.NextDouble() < 0.12)
                    for (int s2 = -1; s2 <= 1; s2 += 2)
                        for (int y = (int)(haut * 0.8f); y < ch - 2; y++)
                        {
                            int x = (int)(cx + s2 * (8 + (y - haut * 0.8f) * 0.18f) * echelle);
                            Pix(x, y0 + y, peau); Pix(x + 1, y0 + y, peau);
                        }
                if (rnd.NextDouble() < 0.04)
                {
                    var drap = HABITS[rnd.Next(HABITS.Length)];
                    for (int y = ch - 18; y < ch - 4; y++) for (int x = (int)cx + 6; x < (int)cx + 22; x++) Pix(x, y0 + y, drap);
                }
            }
        var t2 = new Texture2D(l, h, TextureFormat.RGBA32, true, false);
        t2.SetPixels32(px);
        t2.wrapModeU = TextureWrapMode.Repeat; t2.wrapModeV = TextureWrapMode.Clamp;
        t2.filterMode = FilterMode.Trilinear; t2.anisoLevel = 4;
        t2.Apply(true, true);
        return t2;
    }

    /** Un disque doux, pour les grains de sable, la poussiere, les flashs. */
    public static Texture2D Disque(int t = 64, float durete = 2f)
    {
        var px = new Color32[t * t];
        for (int y = 0; y < t; y++)
            for (int x = 0; x < t; x++)
            {
                float dx = (x + 0.5f) / t * 2 - 1, dy = (y + 0.5f) / t * 2 - 1;
                float a = Mathf.Clamp01(1 - Mathf.Sqrt(dx * dx + dy * dy));
                a = Mathf.Pow(a, 1f / durete);
                px[y * t + x] = new Color(1, 1, 1, a);
            }
        return Tex(t, t, px, false, FilterMode.Bilinear);
    }

    /** Un degrade vertical : le ciel peint derriere le toit des tribunes. */
    public static Texture2D Degrade(Color haut, Color bas, int h = 128)
    {
        var px = new Color32[h];
        for (int y = 0; y < h; y++) px[y] = Color.Lerp(bas, haut, y / (float)(h - 1));
        var t = new Texture2D(1, h, TextureFormat.RGBA32, false);
        t.SetPixels32(px); t.wrapMode = TextureWrapMode.Clamp; t.Apply();
        return t;
    }
}
