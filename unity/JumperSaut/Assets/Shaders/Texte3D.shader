// Le texte 3D des panneaux, du dossard et de l'ecran geant. Le shader de
// texte d'Unity (GUI/Text Shader) ignore la profondeur : les lettres d'un
// panneau passaient DEVANT l'athlete. Celui-ci teste la profondeur, et sa
// couleur peut depasser 1 pour que le bloom fasse briller les LED.
Shader "Jumper/Texte3D"
{
    Properties
    {
        _MainTex ("Police", 2D) = "white" {}
        _Color ("Couleur", Color) = (1,1,1,1)
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" "RenderPipeline"="UniversalPipeline" }
        Cull Off ZWrite Off ZTest LEqual
        Blend SrcAlpha OneMinusSrcAlpha
        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            struct A { float4 pos : POSITION; float4 col : COLOR; float2 uv : TEXCOORD0; };
            struct V { float4 pos : SV_POSITION; float4 col : COLOR; float2 uv : TEXCOORD0; };
            TEXTURE2D(_MainTex); SAMPLER(sampler_MainTex);
            CBUFFER_START(UnityPerMaterial)
            float4 _MainTex_ST;
            float4 _Color;
            CBUFFER_END
            V vert(A i)
            {
                V o;
                o.pos = TransformObjectToHClip(i.pos.xyz);
                o.col = i.col * _Color;
                o.uv = i.uv;
                return o;
            }
            half4 frag(V i) : SV_Target
            {
                half a = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, i.uv).a;
                return half4(i.col.rgb, i.col.a * a);
            }
            ENDHLSL
        }
    }
}
