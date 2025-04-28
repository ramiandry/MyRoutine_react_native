// types/gemini.ts
export interface GeminiPart {
    text: string;
  }
  
  export interface GeminiContent {
    parts: GeminiPart[];
  }
  
  export interface GeminiCandidate {
    content: GeminiContent;
    finishReason: string;
    index: number;
    safetyRatings: any[];
  }
  
  export interface GeminiResponse {
    candidates: GeminiCandidate[];
    promptFeedback?: {
      safetyRatings: any[];
    };
  }
  
  export interface GeminiError {
    error: {
      code: number;
      message: string;
      status: string;
    };
  }