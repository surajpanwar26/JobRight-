import { GoogleGenAI, Type } from "@google/genai";
import { Job, ResumeAnalysis, TailoredResumeResponse, LLMSettings, ReferralResponse } from "../types";
import { SYSTEM_INSTRUCTION_JOBS } from "../constants";

export class LLMService {
  private settings: LLMSettings;
  private googleClient: GoogleGenAI | null = null;

  constructor(settings: LLMSettings) {
    this.settings = settings;
    if (this.settings.provider === 'gemini') {
      // In a browser extension, we must rely on the user providing the key via Settings
      // or a hardcoded env var if you build it specifically for yourself.
      const apiKey = this.settings.apiKey || process.env.API_KEY;
      if (apiKey) {
        this.googleClient = new GoogleGenAI({ apiKey });
      }
    }
  }

  // --- HELPER: GENERIC FETCH FOR OPENAI-COMPATIBLE APIS (Groq, Ollama, etc.) ---
  private async fetchOpenAICompatible(
    messages: { role: string; content: string }[], 
    jsonMode: boolean = false
  ): Promise<string> {
    const isOllama = this.settings.provider === 'ollama';
    
    // Default URL handling
    let url = this.settings.baseUrl || 'https://api.openai.com/v1';
    if (this.settings.provider === 'groq') url = 'https://api.groq.com/openai/v1';
    if (isOllama && !this.settings.baseUrl) url = 'http://localhost:11434/v1';
    
    // Remove trailing slash and append chat/completions
    url = url.replace(/\/$/, '') + '/chat/completions';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.settings.apiKey) {
      headers['Authorization'] = `Bearer ${this.settings.apiKey}`;
    }

    const body: any = {
      model: this.settings.modelName,
      messages: messages,
      temperature: 0.7,
    };

    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
      console.error("LLM Request Failed:", error);
      throw new Error(`LLM Connection Failed: ${error.message}. Check your API Key and Settings.`);
    }
  }

  // --- FEATURE 1: CHAT ---

  async streamChatResponse(
    history: { role: string; content: string }[],
    message: string,
    onChunk: (text: string) => void
  ) {
    // GEMINI IMPLEMENTATION
    if (this.settings.provider === 'gemini' && this.googleClient) {
      const model = "gemini-3-flash-preview"; 
      const chat = this.googleClient.chats.create({
        model,
        config: { systemInstruction: "You are JobRight AI, a helpful career assistant." },
        history: history.map(h => ({ role: h.role, parts: [{ text: h.content }] }))
      });
      
      try {
        const result = await chat.sendMessageStream({ message });
        for await (const chunk of result) {
          if (chunk.text) onChunk(chunk.text);
        }
      } catch (e: any) {
        throw new Error(`Gemini Error: ${e.message}`);
      }
      return;
    }

    // GENERIC IMPLEMENTATION
    const messages = [
        { role: 'system', content: "You are JobRight AI, a helpful career assistant." },
        ...history,
        { role: 'user', content: message }
    ];
    
    const text = await this.fetchOpenAICompatible(messages);
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
        onChunk(words[i] + ' ');
        await new Promise(r => setTimeout(r, 10)); 
    }
  }

  // --- FEATURE 2: DEEP REASONING ---

  async generateDeepThinkResponse(
    history: { role: string; content: string }[],
    prompt: string
  ): Promise<string> {
    if (this.settings.provider === 'gemini' && this.googleClient) {
      // Keep Gemini 3 Pro for explicit Deep Think requests
      const response = await this.googleClient.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: [
          ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
          { role: 'user', parts: [{ text: prompt }] }
        ],
        config: { thinkingConfig: { thinkingBudget: 8192 } } 
      });
      return response.text || "No response generated.";
    }

    // Generic
    const messages = [...history, { role: 'user', content: prompt }];
    return await this.fetchOpenAICompatible(messages);
  }

  // --- FEATURE 3: JOB SEARCH ---

  async searchJobs(query: string): Promise<Job[]> {
    if (this.settings.provider === 'gemini' && this.googleClient) {
      const response = await this.googleClient.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 6 realistic job listings for: "${query}".`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_JOBS,
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.ARRAY,
              items: {
                  type: Type.OBJECT,
                  properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING },
                      company: { type: Type.STRING },
                      location: { type: Type.STRING },
                      salary: { type: Type.STRING },
                      type: { type: Type.STRING },
                      description: { type: Type.STRING },
                      matchScore: { type: Type.INTEGER },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      postedAt: { type: Type.STRING }
                  },
                  required: ["id", "title", "company", "location", "matchScore"]
              }
          }
        }
      });
      if (response.text) return JSON.parse(response.text) as Job[];
      return [];
    }

    // GENERIC
    const prompt = `Generate 6 realistic job listings for: "${query}".
    ${SYSTEM_INSTRUCTION_JOBS}
    Ensure the output is strictly valid JSON array.`;

    const text = await this.fetchOpenAICompatible([
        { role: 'user', content: prompt }
    ], true);

    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON from generic provider", e);
        return [];
    }
  }

  // --- FEATURE 4: RESUME ANALYSIS ---
  
  private getResumeAnalysisPrompt(resumeText: string): string {
      return `Analyze this resume text and provide structured feedback.
    
      RESUME TEXT:
      ${resumeText}
      
      Return the response in JSON format matching this structure:
      {
        "score": number (0-100),
        "summary": "Overall impression",
        "strengths": ["point 1", "point 2"],
        "weaknesses": ["point 1", "point 2"],
        "improvements": ["action 1", "action 2"]
      }`;
  }

  async analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
    const prompt = this.getResumeAnalysisPrompt(resumeText);

    if (this.settings.provider === 'gemini' && this.googleClient) {
        const response = await this.googleClient.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { 
                responseMimeType: "application/json" 
            }
        });
        if (response.text) return JSON.parse(response.text) as ResumeAnalysis;
    } else {
        const text = await this.fetchOpenAICompatible([{ role: 'user', content: prompt }], true);
        return JSON.parse(text);
    }
    throw new Error("Analysis failed");
  }

  // --- FEATURE 5: TAILOR RESUME ---
  
  async tailorResume(resumeText: string, jobDescription: string, country: string = "Global"): Promise<TailoredResumeResponse> {
    const prompt = `You are an expert International Resume Strategist.
    
    GOAL: Tailor the candidate's resume to the Job Description (JD) specifically for the job market in: ${country}.
    
    INPUT DATA:
    RESUME: ${resumeText}
    JD: ${jobDescription}
    TARGET COUNTRY: ${country}
    
    INSTRUCTIONS:
    1. **Format Nuances**: Apply ${country}-specific formatting norms.
    2. **Content**: Use JD keywords. Remove irrelevant info.
    3. **Data Integrity (CRITICAL)**: Do NOT invent contact details.
    
    OUTPUT JSON STRUCTURE:
    {
      "candidateName": "First Last",
      "targetJobTitle": "Job Title",
      "targetCountry": "${country}",
      "originalScore": number (0-100),
      "shortlistingChanceBefore": "Low" | "Medium" | "High",
      "shortlistingChanceAfter": "High",
      "improvementSummary": "Briefly explain changes.",
      "jobHuntStrategy": ["Strategy 1", "Strategy 2"],
      "analysis": {
         "score": number (0-100),
         "summary": "Tailored Match summary",
         "strengths": ["string"],
         "weaknesses": ["string"],
         "improvements": ["string"]
      },
      "internationalInsights": {
         "salaryRaw": "e.g. $120,000 / year",
         "salaryInINR": "e.g. ₹1,00,00,000 / year",
         "monthlyInHandINR": "e.g. ₹5,50,000 (approx)",
         "visaLikelihood": "High" | "Medium" | "Low" | "Remote Only",
         "visaReasoning": "One sentence explanation.",
         "costOfLivingAnalysis": "Brief comment on salary vs city cost."
      },
      "tailoredResumeMarkdown": "# Name\n\n## Summary\n...",
      "missingKeywords": ["keyword1"],
      "atsChecklist": [
        {"item": "Correct Country Format", "passed": true},
        {"item": "Single Column Layout", "passed": true}
      ]
    }`;

    if (this.settings.provider === 'gemini' && this.googleClient) {
        const response = await this.googleClient.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { 
                responseMimeType: "application/json" 
            }
        });
        if (response.text) return JSON.parse(response.text) as TailoredResumeResponse;
    } else {
        const text = await this.fetchOpenAICompatible([{ role: 'user', content: prompt }], true);
        return JSON.parse(text);
    }
    throw new Error("Tailoring failed");
  }

  // --- FEATURE 6: SEPARATE COVER LETTER ---
  async generateCoverLetter(resumeText: string, jobDescription: string): Promise<string> {
      const prompt = `Write a professional cover letter for this candidate based on the JD.
      Resume: ${resumeText.substring(0, 5000)}
      JD: ${jobDescription.substring(0, 2000)}
      
      Output ONLY the markdown text of the letter.`;
      
      if (this.settings.provider === 'gemini' && this.googleClient) {
          const response = await this.googleClient.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: prompt
          });
          return response.text || "";
      } else {
          return await this.fetchOpenAICompatible([{ role: 'user', content: prompt }]);
      }
  }

  // --- FEATURE 7: HUMAN-LIKE REFERRAL MESSAGE ---
  async generateReferralMessage(
      resumeText: string, 
      jobDescription: string, 
      referrerName: string, 
      relationship: string, 
      platform: 'Email' | 'LinkedIn'
  ): Promise<ReferralResponse> {
      
      const prompt = `You are a human ghostwriter. Write a referral request message for me to send to ${referrerName}.
      
      CONTEXT:
      My Resume Snippet: ${resumeText.substring(0, 3000)}
      Job Description Snippet: ${jobDescription.substring(0, 1000)}
      Relationship: ${relationship}
      Platform: ${platform}
      
      Output JSON:
      {
          "subject": "Subject line",
          "messageBody": "The message text",
          "explanation": "Why you wrote it this way"
      }`;

      if (this.settings.provider === 'gemini' && this.googleClient) {
          const response = await this.googleClient.models.generateContent({
              model: "gemini-3-pro-preview",
              contents: prompt,
              config: { responseMimeType: "application/json" }
          });
          if (response.text) return JSON.parse(response.text);
      } else {
          const text = await this.fetchOpenAICompatible([{ role: 'user', content: prompt }], true);
          return JSON.parse(text);
      }
      return { subject: "", messageBody: "", explanation: "" };
  }

  // --- FEATURE 8: AUTO DETECT ---
  async extractJobMetaData(jdText: string): Promise<{title: string, company: string}> {
      const prompt = `Extract Job Title and Company from: ${jdText.substring(0, 1000)}. Return JSON: {"title": "string", "company": "string"}`;
      
      if (this.settings.provider === 'gemini' && this.googleClient) {
         const response = await this.googleClient.models.generateContent({
             model: "gemini-3-flash-preview",
             contents: prompt,
             config: { 
                 responseMimeType: "application/json",
                 responseSchema: {
                     type: Type.OBJECT,
                     properties: { title: {type: Type.STRING}, company: {type: Type.STRING} }
                 }
             }
         });
         if (response.text) return JSON.parse(response.text);
      } else {
          const text = await this.fetchOpenAICompatible([{ role: 'user', content: prompt }], true);
          return JSON.parse(text);
      }
      return { title: "Unknown", company: "Unknown" };
  }
}