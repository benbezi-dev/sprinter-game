// ---------------------------------------------------------------------------
// L'ETAT DU SAUT, TEL QUE LE JEU L'ENVOIE. Les memes indices sont ecrits par
// src/game/sauts-unity.js (ETAT) : changer l'un, c'est changer l'autre.
// ---------------------------------------------------------------------------
public static class Etat
{
    public const int N = 96;

    public const int Tic = 0, Phase = 1, Epreuve = 2, T = 3;
    public const int D = 4, Y = 5, K = 6;
    public const int HipX = 7, HipY = 8, HipZ = 9;
    public const int Bassin = 10, Buste = 11, Tete = 12, LacetBas = 13, LacetHaut = 14, Chute = 15;
    public const int JambeA = 16, JambeB = 19, BrasA = 22, BrasB = 24;   // 3, 3, 2, 2
    public const int Epaule = 26, Hanche = 27;
    public const int Ligne = 28, FosseX = 29, FosseFin = 30;
    public const int Gerbe = 31, GerbeX = 32, GerbeY = 33, GerbeForce = 34;
    public const int Empreinte = 35, EmpreinteX = 36, EmpreinteY = 37;
    public const int Drapeau = 38;           // 0 rien, 1 blanc, 2 rouge
    public const int Mesure = 39, MesureA = 40, Metres = 41;
    public const int Vitesse = 42, Vent = 43, Bond = 44, Etape = 45;
    public const int Planches = 46;          // [x, actif] x 2
    public const int Lignes = 50;            // [metres, r, g, b] x 3
    public const int Look = 62;              // peau, maillot, short, chaussure, cheveux : 5 x rgb
    public const int Tenu = 77;              // part de l'appel deja faite (0..1)
    public const int Portrait = 78;
    public const int Reception = 79;         // temps depuis le contact

    // Les phases de longueur-course.js.
    public const int Repos = 0, Attente = 1, Elan = 2, Appel = 3, Vol = 4, Pose = 5,
        Reception_ = 6, Temps = 7, Traverse = 8, Casse = 9;
}
