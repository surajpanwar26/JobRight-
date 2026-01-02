import { ChangeLogEntry } from "./types";

export const GEMINI_API_KEY_STORAGE_KEY = 'jobright_gemini_api_key';
export const VERSION_STORAGE_KEY = 'jobright_app_version';

// INCREMENT THIS VERSION WHEN YOU UPDATE THE APP
export const APP_VERSION = '1.0.0'; 

export const CHANGELOG: ChangeLogEntry[] = [
  {
    version: '1.0.0',
    date: '2024-05-20',
    title: 'Initial Release',
    features: [
      'Launch of JobRight AI Extension.',
      'Added "Side Panel" support for local usage.',
      'Implemented "Deep Think" reasoning with Gemini models.',
      'Added Resume Analyzer with PDF/DOCX support.',
      'Integrated Local LLM support via Ollama.',
      'Added "Grab from Tab" to instantly extract JDs from browser.'
    ]
  }
];

export const SYSTEM_INSTRUCTION_CHAT = `You are JobRight AI, an advanced career assistant. 
Your goal is to help users find the right job, improve their resumes, and navigate their careers.
Be professional, encouraging, and concise. Use Markdown for formatting.`;

export const SYSTEM_INSTRUCTION_JOBS = `You are a job search engine. Generate realistic, high-quality job listings based on the user's query. 
Return ONLY valid JSON. The JSON should be an array of objects with the following schema:
{
  "id": "unique_string",
  "title": "Job Title",
  "company": "Company Name",
  "location": "City, Country or Remote",
  "salary": "$XXXk - $XXXk",
  "type": "Full-time" | "Contract" | "Part-time",
  "description": "Short description (2 sentences)",
  "matchScore": number (0-100 based on relevance),
  "tags": ["tag1", "tag2"],
  "postedAt": "2d ago"
}
`;

export const SYSTEM_INSTRUCTION_RESUME = `You are an expert resume reviewer and career coach. 
Analyze the provided resume text deeply. 
Provide specific, actionable feedback. 
Identify keywords, formatting issues, and impact gaps.`;