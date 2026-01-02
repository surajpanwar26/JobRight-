export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  type: string;
  description: string;
  matchScore: number;
  tags: string[];
  postedAt: string;
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  isThinking?: boolean;
}

export enum AppView {
  CHAT = 'chat',
  JOBS = 'jobs',
  RESUME = 'resume',
  SETTINGS = 'settings'
}

export interface ResumeAnalysis {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
}

export interface JobInsights {
  salaryRaw: string;
  salaryInINR: string;
  monthlyInHandINR: string;
  visaLikelihood: 'High' | 'Medium' | 'Low' | 'Remote Only';
  visaReasoning: string;
  costOfLivingAnalysis: string;
}

export interface TailoredResumeResponse {
  analysis: ResumeAnalysis;
  tailoredResumeMarkdown: string;
  coverLetterMarkdown?: string; // Optional now
  missingKeywords: string[];
  atsChecklist: { item: string; passed: boolean }[];
  candidateName: string;
  targetJobTitle: string;
  targetCountry: string;
  originalScore: number;
  shortlistingChanceBefore: 'Low' | 'Medium' | 'High';
  shortlistingChanceAfter: 'Low' | 'Medium' | 'High';
  improvementSummary: string;
  jobHuntStrategy: string[];
  internationalInsights: JobInsights;
}

export interface ReferralResponse {
  subject: string;
  messageBody: string;
  explanation: string;
}

export type LLMProvider = 'gemini' | 'groq' | 'ollama' | 'openai-compatible';

export interface LLMSettings {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string; // For Ollama or Custom
  modelName: string; // e.g., "llama3", "mixtral-8x7b", "gemini-1.5-pro"
}

export const DEFAULT_SETTINGS: LLMSettings = {
  provider: 'gemini',
  apiKey: '',
  modelName: 'gemini-3-flash-preview'
};

export interface ChangeLogEntry {
  version: string;
  date: string;
  title: string;
  features: string[];
}