import { GoogleGenAI } from "@google/genai";

export type EnhancementMode = 'ultra-hd' | 'denoise' | 'sharpen' | 'portrait' | 'anime' | 'standard';
export type ResolutionPreset = '1080p' | '2k' | '4k';
export type UpscaleFactor = '2x' | '4x' | '8x';

export interface EnhancementOptions {
  mode: EnhancementMode;
  resolution: ResolutionPreset;
  upscale: UpscaleFactor;
  faceEnhancement: boolean;
  noiseReduction: number;
  sharpening: number;
}

export async function enhanceImage(base64Image: string, mimeType: string, options: EnhancementOptions): Promise<string> {
  const key = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'undefined' || key === '') {
    const debugInfo = `(Key status: ${!key ? 'missing' : 'invalid/empty'}, env: ${process.env.NODE_ENV})`;
    throw new Error(`Missing Gemini API Key. ${debugInfo} Please add GEMINI_API_KEY or VITE_GEMINI_API_KEY to your Vercel environment variables and REDEPLOY.`);
  }
  const ai = new GoogleGenAI({ apiKey: key });
  
  const model = "gemini-2.5-flash-image";
  
  const prompts: Record<EnhancementMode, string> = {
    'ultra-hd': "Act as a professional image upscaler. Enhance this image to Ultra HD quality. Restore all fine details, textures, and edges. Output the enhanced image directly.",
    'denoise': "Act as a professional denoiser. Remove noise and grain from this image while preserving sharpness. Output the cleaned image directly.",
    'sharpen': "Act as a professional sharpening tool. Enhance edges and fine details naturally. Output the sharpened image directly.",
    'portrait': "Act as a professional portrait retoucher. Enhance skin, eyes, and hair details. Output the retouched portrait directly.",
    'anime': "Act as a professional anime upscaler. Clean up lines and vibrant colors. Output the enhanced artwork directly.",
    'standard': "Act as a professional image enhancer. Upscale and improve overall quality. Output the enhanced image directly."
  };

  let prompt = prompts[options.mode];
  if (options.faceEnhancement) {
    prompt += " Specifically detect and enhance any faces to high quality.";
  }
  prompt += ` Target resolution: ${options.resolution}. Upscale: ${options.upscale}. MAINTAIN ORIGINAL COLORS. DO NOT RETURN TEXT, ONLY THE ENHANCED IMAGE.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    let textResponse = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
      if (part.text) {
        textResponse += part.text;
      }
    }
    
    if (textResponse.includes("429") || textResponse.includes("Quota exceeded")) {
      throw new Error("Google API Limit Reached (Quota Exceeded). This is a limit on Google's free tier. Please wait 1 minute or try creating a NEW API key in a NEW project at aistudio.google.com.");
    }
    
    throw new Error(textResponse || "No image data returned. Try a different enhancement mode or a clearer image.");
  } catch (error) {
    console.error("Enhancement failed:", error);
    throw error;
  }
}
