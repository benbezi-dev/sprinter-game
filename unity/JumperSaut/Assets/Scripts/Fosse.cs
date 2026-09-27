// ---------------------------------------------------------------------------
// LE SABLE : UNE SURFACE QUI GARDE LA TRACE DU SAUT.
//
// Une grille de cinq centimetres sur toute la fosse. A la reception, le jeu
// dit ou tombent les talons et comment l'athlete s'est pose (longueur-
// course.js : empreinte, variante) ; on y creuse le cratere, son bourrelet
// de sable repousse, et la trace des mains ou des fesses quand il est
// retombe en arriere. Le rateau du juge la remet a plat pour l'essai suivant.
//
// La gerbe est un systeme de particules : des grains qui retombent, et une
// poussiere lente qui reste en l'air apres eux.
// ---------------------------------------------------------------------------
using UnityEngine;

public class Fosse : MonoBehaviour
{
    const float PAS = 0.05f;
    float x0, x1, largeur;
    int nx, nz;
    Vector3[] sommets, plats;
    Mesh mesh;
    ParticleSystem grains, poussiere;
    bool trace;

    public void Construire(float fosseX, float fosseFin, float largeur)
    {
        x0 = fosseX; x1 = fosseFin; this.largeur = largeur;
        nx = Mathf.CeilToInt((x1 - x0) / PAS) + 1;
        nz = Mathf.CeilToInt(largeur / PAS) + 1;
        sommets = new Vector3[nx * nz];
        var uv = new Vector2[nx * nz];
        var tri = new int[(nx - 1) * (nz - 1) * 6];
        for (int i = 0; i < nx; i++)
            for (int k = 0; k < nz; k++)
            {
                float x = Mathf.Min(x1, x0 + i * PAS), z = -largeur * 0.5f + Mathf.Min(largeur, k * PAS);
                sommets[i * nz + k] = new Vector3(x, Hauteur0(x, z), z);
                uv[i * nz + k] = new Vector2(x * 0.6f, z * 0.6f);
            }
        int n = 0;
        for (int i = 0; i < nx - 1; i++)
            for (int k = 0; k < nz - 1; k++)
            {
                int a = i * nz + k, b = a + 1, c = a + nz, d = c + 1;
                tri[n++] = a; tri[n++] = b; tri[n++] = c;
                tri[n++] = b; tri[n++] = d; tri[n++] = c;
            }
        plats = (Vector3[])sommets.Clone();
        mesh = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
        mesh.MarkDynamic();
        mesh.vertices = sommets; mesh.uv = uv; mesh.triangles = tri;
        mesh.RecalculateNormals(); mesh.RecalculateBounds();
        gameObject.AddComponent<MeshFilter>().sharedMesh = mesh;
        var r = gameObject.AddComponent<MeshRenderer>();
        r.sharedMaterial = Mat.Lit(Color.white, 0.05f, Mat.Sable(), new Vector2(1, 1));
        r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

        grains = Particules("grains", 0.035f, new Color(0.86f, 0.74f, 0.52f, 1f), 400, 1f);
        poussiere = Particules("poussiere", 0.5f, new Color(0.92f, 0.84f, 0.68f, 0.35f), 40, 0.12f);
    }

    /** Le sable ratisse n'est pas plat : de petites vagues, en travers. */
    static float Hauteur0(float x, float z)
    {
        return 0.03f + Mathf.Sin(x * 39f) * 0.0025f + Mathf.Sin(x * 7.1f + z * 3f) * 0.002f;
    }

    ParticleSystem Particules(string nom, float taille, Color c, int max, float gravite)
    {
        var go = new GameObject(nom);
        go.transform.SetParent(transform, false);
        var ps = go.AddComponent<ParticleSystem>();
        ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
        var m = ps.main;
        m.playOnAwake = false; m.loop = false; m.maxParticles = max;
        m.startSize = new ParticleSystem.MinMaxCurve(taille * 0.5f, taille);
        m.startColor = c;
        m.gravityModifier = gravite;
        m.startLifetime = new ParticleSystem.MinMaxCurve(gravite > 0.5f ? 0.7f : 1.8f, gravite > 0.5f ? 1.3f : 3f);
        m.simulationSpace = ParticleSystemSimulationSpace.World;
        var em = ps.emission; em.enabled = true; em.rateOverTime = 0;
        var sh = ps.shape; sh.enabled = false;
        var col = ps.colorOverLifetime; col.enabled = true;
        var g = new Gradient();
        g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                  new[] { new GradientAlphaKey(1, 0), new GradientAlphaKey(gravite > 0.5f ? 0.9f : 0.5f, 0.5f), new GradientAlphaKey(0, 1) });
        col.color = g;
        if (gravite < 0.5f)
        {
            var sz = ps.sizeOverLifetime; sz.enabled = true;
            sz.size = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.Linear(0, 0.6f, 1, 2.2f));
        }
        var r = go.GetComponent<ParticleSystemRenderer>();
        r.sharedMaterial = Mat.Particule(Color.white, Mat.Disque(64, gravite > 0.5f ? 4f : 1.2f));
        r.renderMode = ParticleSystemRenderMode.Billboard;
        return ps;
    }

    /** La gerbe : le sable qui gicle devant et sur les cotes des talons. */
    public void Gerbe(Vector3 ou, float force)
    {
        var ep = new ParticleSystem.EmitParams();
        for (int i = 0; i < 260; i++)
        {
            ep.position = ou + new Vector3(Random.Range(-0.15f, 0.25f), 0.03f, Random.Range(-0.25f, 0.25f));
            ep.velocity = new Vector3(Random.Range(0.6f, 3.4f), Random.Range(0.8f, 3.2f), Random.Range(-1.4f, 1.4f)) * force;
            ep.startSize = Random.Range(0.012f, 0.04f);
            grains.Emit(ep, 1);
        }
        for (int i = 0; i < 14; i++)
        {
            ep.position = ou + new Vector3(Random.Range(0f, 0.6f), Random.Range(0.05f, 0.3f), Random.Range(-0.4f, 0.4f));
            ep.velocity = new Vector3(Random.Range(0.2f, 1.2f), Random.Range(0.1f, 0.6f), Random.Range(-0.4f, 0.4f)) * force;
            ep.startSize = Random.Range(0.35f, 0.7f);
            poussiere.Emit(ep, 1);
        }
    }

    /**
     * Creuser la trace. `talons` est le point que le juge mesure ; la
     * variante dit ce qui a touche le sable apres les pieds : rien de plus
     * (avant), une main sur le cote (cote), les fesses (assis).
     */
    public void Creuser(float talons, float z, string variante)
    {
        if (trace) return;
        trace = true;
        void Cratere(float cx, float cz, float lx, float lz, float prof)
        {
            int i0 = Mathf.Max(0, (int)((cx - lx * 1.8f - x0) / PAS)), i1 = Mathf.Min(nx - 1, (int)((cx + lx * 1.8f - x0) / PAS) + 1);
            for (int i = i0; i <= i1; i++)
                for (int k = 0; k < nz; k++)
                {
                    var v = sommets[i * nz + k];
                    float dx = (v.x - cx) / lx, dz = (v.z - cz) / lz;
                    float d2 = dx * dx + dz * dz;
                    // le creux, puis le bourrelet de sable repousse autour
                    float h = -prof * Mathf.Exp(-d2 * 1.6f) + prof * 0.35f * Mathf.Exp(-(Mathf.Sqrt(d2) - 1.3f) * (Mathf.Sqrt(d2) - 1.3f) * 6f);
                    v.y += h;
                    sommets[i * nz + k] = v;
                }
        }
        // les deux talons, cote a cote, et le sable chasse vers l'avant
        Cratere(talons + 0.12f, z - 0.1f, 0.2f, 0.09f, 0.05f);
        Cratere(talons + 0.12f, z + 0.1f, 0.2f, 0.09f, 0.05f);
        Cratere(talons + 0.45f, z, 0.35f, 0.25f, 0.03f);
        if (variante == "assis") Cratere(talons - 0.05f, z, 0.22f, 0.2f, 0.06f);
        if (variante == "cote") Cratere(talons + 0.3f, z + 0.35f, 0.1f, 0.08f, 0.035f);
        mesh.vertices = sommets;
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
    }

    /** Le rateau : la fosse redevient plate pour l'essai suivant. */
    public void Ratisser()
    {
        if (!trace) return;
        trace = false;
        System.Array.Copy(plats, sommets, sommets.Length);
        mesh.vertices = sommets;
        mesh.RecalculateNormals();
    }

    public bool Trace => trace;
}
