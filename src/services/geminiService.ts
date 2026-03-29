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
  // Robust key detection
  const key = process.env.GEMINI_API_KEY || 
              (import.meta as any).env?.VITE_GEMINI_API_KEY || 
              (window as any).GEMINI_API_KEY;

  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'undefined' || key === '') {
    const debugInfo = `(Status: ${!key ? 'missing' : 'invalid'}, Mode: ${process.env.NODE_ENV})`;
    throw new Error(`API Key Missing. ${debugInfo} If you are on Vercel, please add GEMINI_API_KEY to your Environment Variables and REDEPLOY. If you are in the preview, please refresh the page.`);
  }
  const ai = new GoogleGenAI({ apiKey: key });
  
  // Switching to Gemini 3 Flash for better quota and stability
  const model = "gemini-3-flash-preview";
  
  const prompts: Record<EnhancementMode, string> = {
    'ultra-hd': "Enhance this image to Ultra HD. Restore fine details, textures, and edges. Output ONLY the enhanced image.",
    'denoise': "Remove noise and grain while preserving sharpness. Output ONLY the cleaned image.",
    'sharpen': "Sharpen edges and fine details naturally. Output ONLY the sharpened image.",
    'portrait': "Retouch portrait: enhance skin, eyes, and hair. Output ONLY the retouched image.",
    'anime': "Enhance this anime/artwork. Clean lines and vibrant colors. Output ONLY the enhanced artwork.",
    'standard': "Perform a balanced enhancement: upscale and improve overall quality. Output ONLY the enhanced image."
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
      throw new Error("Google is temporarily busy (Limit Reached). Please wait 60 seconds and try again.");
    }
    
    throw new Error(textResponse || "No image data returned. Try a different enhancement mode or a clearer image.");
  } catch (error: any) {
    console.error("Enhancement failed:", error);
    
    const msg = error?.message || String(error);
    if (msg.includes("429") || msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Google is temporarily busy (Limit Reached). Please wait 60 seconds and try again.");
    }
    
    throw error;
  }
}
