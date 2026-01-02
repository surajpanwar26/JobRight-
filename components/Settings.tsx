import React, { useState } from 'react';
import { LLMSettings, LLMProvider } from '../types';
import { Settings as SettingsIcon, Save, Server, Key, Box, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

interface SettingsProps {
  settings: LLMSettings;
  onSave: (settings: LLMSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
  const [formData, setFormData] = useState<LLMSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);

  const providers: { id: LLMProvider; name: string; defaultModel: string; defaultBaseUrl?: string }[] = [
    { id: 'gemini', name: 'Google Gemini', defaultModel: 'gemini-3-flash-preview' },
    { id: 'groq', name: 'Groq (Llama 3/Mixtral)', defaultModel: 'llama3-70b-8192' },
    { id: 'ollama', name: 'Ollama (Local)', defaultModel: 'llama3', defaultBaseUrl: 'http://localhost:11434' },
    { id: 'openai-compatible', name: 'Custom / OpenAI Compatible', defaultModel: 'gpt-4o', defaultBaseUrl: 'https://api.openai.com/v1' }
  ];

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as LLMProvider;
    const providerConfig = providers.find(p => p.id === newProvider);
    
    setFormData(prev => ({
      ...prev,
      provider: newProvider,
      modelName: providerConfig?.defaultModel || '',
      baseUrl: providerConfig?.defaultBaseUrl || ''
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-12 animate-fadeIn">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <SettingsIcon className="text-brand-600" size={32} />
          AI Provider Settings
        </h2>
        <p className="text-gray-600 mt-2 text-lg">
          Configure which AI model powers JobRight AI. You can use Google Gemini (Free Tier available), blazing fast Groq, or run locally with Ollama.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center gap-2 text-sm font-medium text-gray-600">
            <AlertTriangle size={16} className="text-amber-500" />
            <span>Your API keys are stored locally in your browser and never sent to our servers.</span>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          
          {/* Provider Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-900 flex items-center gap-2">
              <Box size={18} className="text-brand-500" /> AI Provider
            </label>
            <div className="relative">
                <select
                value={formData.provider}
                onChange={handleProviderChange}
                className="w-full p-4 pl-4 pr-10 bg-white border border-gray-300 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 text-base font-medium transition-shadow"
                >
                {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                </div>
            </div>
          </div>

          {/* API Key Input */}
          {(formData.provider as string) !== 'ollama' && (
             <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-900 flex items-center justify-between">
                  <span className="flex items-center gap-2"><Key size={18} className="text-brand-500" /> API Key</span>
                  {formData.provider === 'gemini' && (
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-600 text-xs flex items-center gap-1 hover:underline">
                          Get Free Gemini Key <ExternalLink size={10} />
                      </a>
                  )}
                  {formData.provider === 'groq' && (
                      <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-brand-600 text-xs flex items-center gap-1 hover:underline">
                          Get Groq Key <ExternalLink size={10} />
                      </a>
                  )}
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                  placeholder={`Enter your ${providers.find(p => p.id === formData.provider)?.name} API Key`}
                  className="w-full p-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
                  required
                />
             </div>
          )}

          {/* Base URL (For Ollama or Custom) */}
          {(formData.provider === 'ollama' || formData.provider === 'openai-compatible') && (
            <div className="space-y-3">
               <label className="block text-sm font-bold text-gray-900 flex items-center gap-2">
                 <Server size={18} className="text-brand-500" /> Base URL / Endpoint
               </label>
               <input
                 type="text"
                 value={formData.baseUrl}
                 onChange={(e) => setFormData({...formData, baseUrl: e.target.value})}
                 placeholder="e.g., http://localhost:11434"
                 className="w-full p-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
               />
               {formData.provider === 'ollama' && (
                   <p className="text-xs text-gray-500">Ensure Ollama is running (`ollama serve`). You may need to set `OLLAMA_ORIGINS="*"` environment variable for browser access.</p>
               )}
            </div>
          )}

          {/* Model Name */}
          <div className="space-y-3">
             <label className="block text-sm font-bold text-gray-900 flex items-center gap-2">
               <Box size={18} className="text-brand-500" /> Model Name
             </label>
             <input
               type="text"
               value={formData.modelName}
               onChange={(e) => setFormData({...formData, modelName: e.target.value})}
               placeholder="e.g. gemini-3-pro, llama3, mixstral"
               className="w-full p-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
             />
             <p className="text-xs text-gray-500">
                {formData.provider === 'gemini' ? 'We recommend gemini-3-flash-preview for speed or gemini-3-pro-preview for deep reasoning.' : 'Make sure you have this model installed/available in your provider.'}
             </p>
          </div>

          <button
            type="submit"
            className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all transform hover:-translate-y-1 ${
              isSaved ? 'bg-green-500 hover:bg-green-600' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {isSaved ? (
                <span className="flex items-center justify-center gap-2"><CheckCircle /> Settings Saved!</span>
            ) : (
                <span className="flex items-center justify-center gap-2"><Save /> Save Configuration</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;