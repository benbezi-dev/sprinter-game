// ---------------------------------------------------------------------------
// JUMPER — la construction de la scene Unity, en ligne de commande.
//
//   Unity -batchmode -quit -projectPath unity/JumperSaut \
//         -executeMethod Construire.WebGL
//
// Tout ce que l'editeur ferait a la souris est fait ici : le pipeline URP,
// la scene (un seul objet, le reste est construit au lancement par Saut.cs),
// les reglages du lecteur WebGL, et le build dans unity/build/jumper-saut.
// ---------------------------------------------------------------------------
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public static class Construire
{
    const string DossierRendu = "Assets/Rendu";
    const string Pipeline = DossierRendu + "/Jumper-URP.asset";
    const string Scene = "Assets/Scenes/Saut.unity";

    static UniversalRenderPipelineAsset AssurerPipeline()
    {
        Directory.CreateDirectory(DossierRendu);
        var urp = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(Pipeline);
        if (urp == null)
        {
            // CreateRendererAsset est interne : c'est lui qui branche les
            // ressources de post-traitement par defaut sur le renderer.
            var m = typeof(UniversalRenderPipelineAsset).GetMethod("CreateRendererAsset",
                BindingFlags.NonPublic | BindingFlags.Static);
            var donnees = (ScriptableRendererData)m.Invoke(null,
                new object[] { Pipeline, RendererType.UniversalRenderer, true, "Renderer" });
            urp = UniversalRenderPipelineAsset.Create(donnees);
            AssetDatabase.CreateAsset(urp, Pipeline);
        }
        // Le rendu d'un telephone : MSAA x4, ombres douces sur une seule
        // cascade (la camera ne regarde jamais loin de l'athlete), HDR pour le
        // bloom et le tonemapping.
        urp.msaaSampleCount = 4;
        urp.supportsHDR = true;
        urp.shadowDistance = 40f;
        urp.shadowCascadeCount = 1;
        urp.mainLightShadowmapResolution = 2048;
        urp.renderScale = 1f;
        var so = new SerializedObject(urp);
        var soft = so.FindProperty("m_SoftShadowsSupported");
        if (soft != null) soft.boolValue = true;
        var ombres = so.FindProperty("m_MainLightShadowsSupported");
        if (ombres != null) ombres.boolValue = true;
        so.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(urp);

        GraphicsSettings.defaultRenderPipeline = urp;
        for (int i = 0; i < QualitySettings.names.Length; i++)
        {
            QualitySettings.SetQualityLevel(i, false);
            QualitySettings.renderPipeline = urp;
        }
        AssetDatabase.SaveAssets();
        return urp;
    }

    static void AssurerScene()
    {
        Directory.CreateDirectory("Assets/Scenes");
        var s = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var go = new GameObject("Saut");
        go.AddComponent<Saut>();
        EditorSceneManager.SaveScene(s, Scene);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(Scene, true) };
    }

    /**
     * Les matieres-modeles, dans Resources : le jeu les clone au lancement
     * (Mat.cs). Posees ici, elles emmenent dans le build les variantes de
     * shader dont les clones auront besoin.
     */
    static void AssurerMatieres()
    {
        Directory.CreateDirectory("Assets/Resources/Materiaux");
        void Une(string nom, string shader, System.Action<Material> regler)
        {
            var chemin = "Assets/Resources/Materiaux/" + nom + ".mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(chemin);
            if (m == null) { m = new Material(Shader.Find(shader)); AssetDatabase.CreateAsset(m, chemin); }
            m.shader = Shader.Find(shader);
            regler(m);
            EditorUtility.SetDirty(m);
        }
        Une("Lit", "Universal Render Pipeline/Lit", m => { m.SetFloat("_Smoothness", 0.3f); });
        Une("Unlit", "Universal Render Pipeline/Unlit", m => { });
        // le public, decoupe en silhouettes : le fond de la texture est vide
        Une("LitDecoupe", "Universal Render Pipeline/Lit", m =>
        {
            m.SetFloat("_AlphaClip", 1); m.SetFloat("_Cutoff", 0.5f);
            m.EnableKeyword("_ALPHATEST_ON");
            m.SetFloat("_Cull", 0);
            m.renderQueue = (int)RenderQueue.AlphaTest;
            m.SetOverrideTag("RenderType", "TransparentCutout");
        });
        Une("UnlitTransparent", "Universal Render Pipeline/Unlit", m =>
        {
            m.SetFloat("_Surface", 1); m.SetFloat("_Blend", 0);
            m.SetOverrideTag("RenderType", "Transparent");
            m.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha); m.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
            m.SetInt("_ZWrite", 0); m.renderQueue = (int)RenderQueue.Transparent;
            m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
        });
        Une("Particule", "Universal Render Pipeline/Particles/Unlit", m =>
        {
            m.SetFloat("_Surface", 1); m.SetFloat("_Blend", 0);
            m.SetOverrideTag("RenderType", "Transparent");
            m.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha); m.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
            m.SetInt("_ZWrite", 0); m.renderQueue = (int)RenderQueue.Transparent;
            m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
        });
        // Le texte 3D (TextMesh) et le ciel suivent dans le build par leurs
        // matieres. Les ajouter aux « shaders toujours inclus » casse l'ecriture
        // de unity_builtin_extra (m_LockCount), mesure le 27 sept. 2026.
        Une("Texte", "Jumper/Texte3D", m => { });
        Une("Ciel", "Skybox/Procedural", m => { });
        AssetDatabase.SaveAssets();
    }

    /** L'athlete sorti de Blender : un squelette generique, sans animation. */
    static void AssurerAthlete()
    {
        const string chemin = "Assets/Resources/Athlete.fbx";
        var imp = AssetImporter.GetAtPath(chemin) as ModelImporter;
        if (imp == null) return;
        imp.animationType = ModelImporterAnimationType.Generic;
        imp.importAnimation = false;
        imp.importCameras = false;
        imp.importLights = false;
        imp.importBlendShapes = false;
        imp.materialImportMode = ModelImporterMaterialImportMode.ImportStandard;
        imp.optimizeGameObjects = false;
        imp.isReadable = true;
        imp.SaveAndReimport();
    }

    public static void Compiler()
    {
        AssurerPipeline();
        AssurerMatieres();
        AssurerAthlete();
        Debug.Log("JUMPER COMPILE OK");
    }

    public static void WebGL()
    {
        AssurerPipeline();
        AssurerMatieres();
        AssurerAthlete();
        AssurerScene();
        PlayerSettings.SplashScreen.show = false;
        PlayerSettings.SplashScreen.showUnityLogo = false;
        PlayerSettings.stripUnusedMeshComponents = true;

        PlayerSettings.colorSpace = ColorSpace.Linear;
        PlayerSettings.companyName = "Sprinter";
        PlayerSettings.productName = "Jumper";
        PlayerSettings.runInBackground = true;
        // Brotli, et le decompresseur du loader en secours : GitHub Pages ne
        // sert pas les .br avec leur en-tete, c'est donc le loader qui les
        // ouvre. Le poids a telecharger est celui qui compte sur un telephone.
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Brotli;
        PlayerSettings.WebGL.decompressionFallback = true;
        PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.None;
        PlayerSettings.WebGL.dataCaching = true;
        PlayerSettings.WebGL.template = "PROJECT:Nu";
        PlayerSettings.stripEngineCode = true;
        PlayerSettings.SetManagedStrippingLevel(UnityEditor.Build.NamedBuildTarget.WebGL, ManagedStrippingLevel.High);
        PlayerSettings.SetIl2CppCodeGeneration(UnityEditor.Build.NamedBuildTarget.WebGL, UnityEditor.Build.Il2CppCodeGeneration.OptimizeSize);

        var sortie = Path.GetFullPath(Path.Combine(Application.dataPath, "../../build/jumper-saut"));
        var r = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { Scene },
            locationPathName = sortie,
            target = BuildTarget.WebGL,
            options = BuildOptions.None,
        });
        Debug.Log("JUMPER BUILD " + r.summary.result + " " + r.summary.totalSize + " octets en " + r.summary.totalTime);
        if (r.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded) EditorApplication.Exit(1);
    }
}
