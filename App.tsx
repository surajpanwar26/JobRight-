import React, { useState, useEffect, useRef } from 'react';
import { LLMService } from './services/llmService';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import JobCard from './components/JobCard';
import ResumeAnalyzer from './components/ResumeAnalyzer';
import Settings from './components/Settings';
import UpdateModal from './components/UpdateModal';
import { AppView, ChatMessage as IChatMessage, MessageRole, Job, LLMSettings, DEFAULT_SETTINGS } from './types';
import { Send, Search, Key, BrainCircuit, Trash2, Sparkles } from 'lucide-react';
import { APP_VERSION, CHANGELOG, VERSION_STORAGE_KEY } from './constants';

const STORAGE_KEY_CHAT = 'jobright_chat_history';
const STORAGE_KEY_SETTINGS = 'jobright_llm_settings';

function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  
  // Settings State
  const [llmSettings, setLlmSettings] = useState<LLMSettings>(() => {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return saved ? JSON.parse(saved) : { ...DEFAULT_SETTINGS, apiKey: process.env.API_KEY || '' };
  });

  const [geminiService, setGeminiService] = useState<LLMService | null>(null);
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<IChatMessage[]>(() => {
    const savedChat = localStorage.getItem(STORAGE_KEY_CHAT);
    if (savedChat) {
      try { return JSON.parse(savedChat); } catch (e) { console.error(e); }
    }
    return [{ id: '1', role: MessageRole.MODEL, content: "Hello! I'm JobRight AI. I can help you find jobs, analyze your resume, or provide deep career advice. How can I help you today?" }];
  });

  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [useDeepThink, setUseDeepThink] = useState(false);
  
  // Update Modal State
  const [showUpdateLog, setShowUpdateLog] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Job Search State
  const [jobQuery, setJobQuery] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isSearchingJobs, setIsSearchingJobs] = useState(false);

  // Initialization & Version Check
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(llmSettings));
    setGeminiService(new LLMService(llmSettings));

    // Check for updates
    const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    if (storedVersion !== APP_VERSION) {
        setShowUpdateLog(true);
    }
  }, [llmSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(chatHistory));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  const handleCloseUpdates = () => {
      setShowUpdateLog(false);
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
  };

  const handleSaveSettings = (newSettings: LLMSettings) => {
      setLlmSettings(newSettings);
      setCurrentView(AppView.CHAT); 
      setChatHistory(prev => [...prev, {
          id: Date.now().toString(),
          role: MessageRole.SYSTEM,
          content: `**System:** Switched provider to ${newSettings.provider} (${newSettings.modelName}).`
      }]);
  };

  const clearChat = () => {
    if (window.confirm("Are you sure you want to clear the chat history?")) {
      const initialMsg: IChatMessage = { id: Date.now().toString(), role: MessageRole.MODEL, content: "Chat cleared. How can I help you now?" };
      setChatHistory([initialMsg]);
      localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify([initialMsg]));
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !geminiService) return;

    const userMsg: IChatMessage = { id: Date.now().toString(), role: MessageRole.USER, content: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      if (useDeepThink) {
        const responseText = await geminiService.generateDeepThinkResponse(
          chatHistory.map(m => ({ role: m.role, content: m.content })),
          userMsg.content
        );
         setChatHistory(prev => [...prev, { id: (Date.now() + 1).toString(), role: MessageRole.MODEL, content: responseText, isThinking: true }]);
      } else {
        let fullResponse = '';
        const modelMsgId = (Date.now() + 1).toString();
        setChatHistory(prev => [...prev, { id: modelMsgId, role: MessageRole.MODEL, content: '' }]);
        await geminiService.streamChatResponse(
          chatHistory.map(m => ({ role: m.role, content: m.content })),
          userMsg.content,
          (chunk) => {
            fullResponse += chunk;
            setChatHistory(prev => prev.map(msg => msg.id === modelMsgId ? { ...msg, content: fullResponse } : msg));
          }
        );
      }
    } catch (err: any) {
      setChatHistory(prev => [...prev, { id: Date.now().toString(), role: MessageRole.SYSTEM, content: `**Error:** ${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleJobSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobQuery.trim() || !geminiService) return;
    setIsSearchingJobs(true);
    setJobs([]);
    try {
      const results = await geminiService.searchJobs(jobQuery);
      setJobs(results);
    } catch (err) { console.error(err); } finally { setIsSearchingJobs(false); }
  };

  const isConfigMissing = !llmSettings.apiKey && llmSettings.provider !== 'ollama';

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <UpdateModal 
        isOpen={showUpdateLog} 
        onClose={handleCloseUpdates} 
        changelog={CHANGELOG} 
        currentVersion={APP_VERSION} 
      />

      {/* Sidebar is responsive: icons only on small screens (extension mode), full on desktop */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        onShowUpdates={() => setShowUpdateLog(true)} 
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        
        {currentView === AppView.SETTINGS && (
            <div className="flex-1 overflow-y-auto bg-gray-50">
                <Settings settings={llmSettings} onSave={handleSaveSettings} />
            </div>
        )}

        {isConfigMissing && currentView !== AppView.SETTINGS && (
             <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
                 <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm text-center">
                     <Key size={40} className="mx-auto text-brand-600 mb-4" />
                     <h2 className="text-xl font-bold text-gray-900 mb-2">Setup Required</h2>
                     <p className="text-sm text-gray-600 mb-6">Please configure your AI provider to start.</p>
                     <button onClick={() => setCurrentView(AppView.SETTINGS)} className="w-full bg-brand-600 text-white font-bold py-2.5 rounded-xl text-sm">Go to Settings</button>
                 </div>
             </div>
        )}

        {currentView === AppView.CHAT && (
          <div className="flex flex-col h-full">
            <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white z-10 shrink-0">
              <h2 className="font-semibold text-gray-800 text-sm md:text-base">JobRight Copilot</h2>
               <div className="flex items-center gap-2 md:gap-4">
                 <button onClick={clearChat} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg" title="Clear History"><Trash2 size={16} /></button>
                 <div className="flex items-center gap-2">
                   <span className={`text-[10px] md:text-xs font-medium ${useDeepThink ? 'text-purple-600' : 'text-gray-500'}`}>Deep Think</span>
                   <button onClick={() => setUseDeepThink(!useDeepThink)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useDeepThink ? 'bg-purple-600' : 'bg-gray-200'}`}>
                     <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useDeepThink ? 'translate-x-4' : 'translate-x-1'}`} />
                   </button>
                 </div>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
              <div className="max-w-3xl mx-auto pb-4">
                {chatHistory.map(msg => <ChatMessage key={msg.id} message={msg} />)}
                {isChatLoading && !chatHistory[chatHistory.length-1].content && (
                    <div className="p-4 flex gap-3 animate-pulse">
                         <div className="w-6 h-6 rounded-full bg-brand-100"></div>
                         <div className="flex-1 space-y-2"><div className="h-3 bg-gray-100 rounded w-1/4"></div><div className="h-3 bg-gray-100 rounded w-1/2"></div></div>
                    </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            <div className="p-3 bg-white border-t border-gray-100">
              <div className="max-w-3xl mx-auto relative">
                <form onSubmit={handleChatSubmit}>
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask career advice..." className={`w-full pl-4 pr-10 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 shadow-sm transition-all ${useDeepThink ? 'border-purple-200 focus:ring-purple-500 bg-purple-50/30' : 'border-gray-200 focus:ring-brand-500 bg-white'}`} />
                  <button type="submit" disabled={!chatInput.trim() || isChatLoading} className={`absolute right-2 top-2 p-1.5 rounded-lg transition-colors ${chatInput.trim() ? (useDeepThink ? 'bg-purple-600 text-white' : 'bg-brand-600 text-white') : 'bg-gray-100 text-gray-400'}`}>
                    {isChatLoading ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : (useDeepThink ? <BrainCircuit size={16} /> : <Send size={16} />)}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {currentView === AppView.JOBS && (
          <div className="flex flex-col h-full bg-gray-50">
             <div className="bg-white border-b border-gray-200 p-4 shadow-sm z-10">
               <div className="max-w-5xl mx-auto">
                 <form onSubmit={handleJobSearch} className="flex gap-2">
                   <div className="relative flex-1">
                     <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                     <input type="text" value={jobQuery} onChange={(e) => setJobQuery(e.target.value)} placeholder="Job title..." className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
                   </div>
                   <button type="submit" className="px-4 py-2 bg-brand-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50" disabled={isSearchingJobs}>{isSearchingJobs ? '...' : 'Find'}</button>
                 </form>
               </div>
             </div>
             <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-5xl mx-auto space-y-4">
                  {isSearchingJobs && [1, 2, 3].map(i => <div key={i} className="h-40 bg-white rounded-xl shadow-sm animate-pulse" />)}
                  {!isSearchingJobs && jobs.map(job => <JobCard key={job.id} job={job} />)}
                  {!isSearchingJobs && jobs.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No jobs found.</div>}
                </div>
             </div>
          </div>
        )}

        {currentView === AppView.RESUME && (
           <div className="h-full overflow-y-auto bg-gray-50">
             <ResumeAnalyzer geminiService={geminiService} />
           </div>
        )}
      </main>
    </div>
  );
}

export default App;