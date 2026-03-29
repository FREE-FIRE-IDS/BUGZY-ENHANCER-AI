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
  
  // Use a list of models to try in case one is busy (503), limited (429), or fails to return an image
  const modelsToTry = ["gemini-3-flash-preview", "gemini-2.5-flash-image", "gemini-3.1-flash-lite-preview"];
  let lastError = "";

  for (const modelName of modelsToTry) {
    try {
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

      const response = await ai.models.generateContent({
        model: modelName,
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

      // Check for safety blocks
      if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        lastError = "Image blocked by safety filters. Try a different image.";
        continue;
      }

      let textResponse = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
        if (part.text) {
          textResponse += part.text;
        }
      }

      // If we get here, no image was returned in the parts
      lastError = textResponse || "No image data returned by this model.";
      
      // If it's a known "busy" text response, continue. Otherwise, it might be a real error.
      if (textResponse.includes("429") || textResponse.includes("Quota") || textResponse.includes("503") || textResponse.includes("demand") || textResponse.includes("overloaded")) {
        continue;
      }
      
      // If the model just returned some text instead of an image, try the next model
      continue;
    } catch (error: any) {
      const msg = error?.message || String(error);
      lastError = msg;
      
      // If it's a "busy" error or a model-specific failure, try the next model
      if (msg.includes("503") || msg.includes("demand") || msg.includes("429") || msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("overloaded") || msg.includes("not found")) {
        continue;
      }
      // For other unexpected errors, we still try the next model to be safe
      continue;
    }
  }

  // If we get here, all models failed
  if (lastError.includes("503") || lastError.includes("demand") || lastError.includes("overloaded")) {
    throw new Error("Google servers are currently overloaded. Please wait 1-2 minutes and try again.");
  }
  if (lastError.includes("429") || lastError.includes("Quota") || lastError.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("API Limit Reached. Please wait a minute or try a different image.");
  }
  if (lastError.includes("SAFETY")) {
    throw new Error("This image was flagged by safety filters. Please try a different image.");
  }
  throw new Error(lastError || "Enhancement failed across all available models. Please try again later.");
}
