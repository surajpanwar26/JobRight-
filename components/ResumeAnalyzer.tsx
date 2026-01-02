import React, { useState, useRef, useMemo, useEffect } from 'react';
import { FileText, CheckCircle, AlertCircle, ArrowRight, Loader2, Target, Download, Sparkles, Layout, FileType, Search, UploadCloud, TrendingUp, Briefcase, Zap, ChevronLeft, Printer, Share2, Eye, GitCompare, RotateCcw, Save, Trash2, Clipboard, Globe, Plane, Coins, Wallet, Edit2, X, Globe2, Mail, UserPlus, Linkedin, Copy, FileCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { LLMService } from '../services/llmService';
import { TailoredResumeResponse, ReferralResponse } from '../types';
import * as Diff from 'diff';
import html2pdf from 'html2pdf.js';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import mammoth from 'mammoth';

// WORKAROUND: Use CDN for PDF worker to avoid Vite/Rollup build errors 
// regarding "default export" in the worker file.
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

declare var chrome: any; 

interface ResumeAnalyzerProps {
  geminiService: LLMService | null;
}

const STORAGE_KEY_RESUME = 'jobright_saved_resume_text';
const STORAGE_KEY_FILENAME = 'jobright_saved_filename';

// --- CUSTOM STYLING FOR RESUME PREVIEW ---
// This ensures the Markdown renders with Brand Colors and Resume formatting
const MarkdownComponents = {
  h1: ({node, ...props}: any) => <h1 className="text-3xl md:text-4xl font-extrabold text-blue-800 mb-2 border-b-4 border-blue-200 pb-2" {...props} />,
  h2: ({node, ...props}: any) => <h2 className="text-lg font-bold text-blue-700 uppercase tracking-widest mt-6 mb-3 border-b border-gray-200 pb-1" {...props} />,
  h3: ({node, ...props}: any) => <h3 className="text-base font-bold text-gray-900 mt-4 mb-1" {...props} />,
  h4: ({node, ...props}: any) => <h4 className="text-sm font-semibold text-gray-700 mt-2" {...props} />,
  p: ({node, ...props}: any) => <p className="text-sm text-gray-700 mb-2 leading-relaxed" {...props} />,
  ul: ({node, ...props}: any) => <ul className="list-disc list-outside ml-5 space-y-1 mb-3 text-sm text-gray-700" {...props} />,
  li: ({node, ...props}: any) => <li className="pl-1" {...props} />,
  strong: ({node, ...props}: any) => <strong className="font-bold text-gray-900" {...props} />,
  hr: ({node, ...props}: any) => <hr className="border-gray-200 my-4" {...props} />,
  a: ({node, ...props}: any) => <a className="text-blue-600 hover:underline" {...props} />,
};

const ResumeAnalyzer: React.FC<ResumeAnalyzerProps> = ({ geminiService }) => {
  // Steps: Input -> Result
  const [step, setStep] = useState<'input' | 'result'>('input');
  
  // Data Inputs
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [jdText, setJdText] = useState('');
  const [targetCountry, setTargetCountry] = useState('Global/USA');
  
  // UI States
  const [isEditingResume, setIsEditingResume] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDetectingJD, setIsDetectingJD] = useState(false);
  const [detectedJob, setDetectedJob] = useState<{title: string, company: string} | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Result Data
  const [result, setResult] = useState<TailoredResumeResponse | null>(null);
  
  // Separate Generation States
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [isGeneratingCL, setIsGeneratingCL] = useState(false);
  
  const [referral, setReferral] = useState<ReferralResponse | null>(null);
  const [isGeneratingReferral, setIsGeneratingReferral] = useState(false);
  const [referralParams, setReferralParams] = useState({
      name: '',
      relationship: 'Cold Outreach',
      platform: 'Linkedin' as 'Linkedin' | 'Email'
  });

  // Tab View Control
  const [activeTab, setActiveTab] = useState<'analysis' | 'resume' | 'coverletter' | 'referral'>('resume');
  const [resumeViewMode, setResumeViewMode] = useState<'preview' | 'diff'>('diff');

  const resumeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const countries = ["Global/USA", "India", "Canada", "United Kingdom", "Germany", "Australia", "UAE", "Singapore", "Japan"];

  useEffect(() => {
    const savedResume = localStorage.getItem(STORAGE_KEY_RESUME);
    const savedName = localStorage.getItem(STORAGE_KEY_FILENAME);
    if (savedResume) {
        setResumeText(savedResume);
        if (savedName) setFileName(savedName);
    } 
  }, []);

  // --- HANDLERS ---
  const handleGrabFromTab = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) { handleSmartPaste(); return; }
    setIsDetectingJD(true);
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
             const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => { const main = document.querySelector('main'); return main ? main.innerText : document.body.innerText; }
             });
             if (results && results[0]?.result) {
                 const text = results[0].result;
                 setJdText(text.substring(0, 5000));
                 if (geminiService) {
                    const meta = await geminiService.extractJobMetaData(text.substring(0, 2000));
                    setDetectedJob(meta);
                 }
             }
        }
    } catch (e: any) { setError("Could not read tab content."); } finally { setIsDetectingJD(false); }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items.filter((item: any) => item.str.trim().length > 0);
        // Basic sorting attempting to respect layout
        items.sort((a: any, b: any) => (b.transform[5] - a.transform[5]) || (a.transform[4] - b.transform[4]));
        fullText += items.map((item: any) => item.str).join(' ') + '\n\n';
      }
      return fullText;
    } catch (e: any) {
      console.error("PDF Extraction Error:", e);
      throw new Error("Failed to parse PDF. Ensure it is text-based, not scanned.");
    }
  };

  const processFile = async (file: File) => {
      setIsReadingFile(true); 
      setError(null);
      try {
        let text = '';
        if (file.type === 'application/pdf') text = await extractTextFromPDF(file);
        else if (file.name.endsWith('.docx')) text = await (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
        else text = await file.text();
        
        if (!text.trim()) throw new Error("The file appears to be empty.");

        setResumeText(text); 
        setFileName(file.name);
        localStorage.setItem(STORAGE_KEY_RESUME, text);
        localStorage.setItem(STORAGE_KEY_FILENAME, file.name);
        setIsEditingResume(false);
      } catch (err: any) { 
          console.error(err);
          setError(err.message || "Failed to read file."); 
      } finally { 
          setIsReadingFile(false); 
          if(fileInputRef.current) fileInputRef.current.value = ''; 
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && (file.type === 'application/pdf' || file.name.endsWith('.docx') || file.type === 'text/plain')) {
          processFile(file);
      } else {
          setError("Invalid file type. Please drop a PDF, DOCX, or TXT file.");
      }
  };

  const handleSmartPaste = async () => {
      try {
          const text = await navigator.clipboard.readText();
          if (text) {
              setJdText(text);
              if (geminiService) {
                setIsDetectingJD(true);
                const meta = await geminiService.extractJobMetaData(text);
                setDetectedJob(meta);
                setIsDetectingJD(false);
              }
          }
      } catch (err) { setError("Could not read clipboard permission."); }
  };

  const clearSavedResume = () => {
    setResumeText('');
    setFileName('');
    localStorage.removeItem(STORAGE_KEY_RESUME);
    localStorage.removeItem(STORAGE_KEY_FILENAME);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError(null);
  };

  // --- ACTIONS ---
  const handleAnalyze = async () => {
    if (!resumeText.trim() || !jdText.trim() || !geminiService) return;
    setIsAnalyzing(true); setError(null);
    try {
      const data = await geminiService.tailorResume(resumeText, jdText, targetCountry);
      setResult(data);
      setCoverLetter('');
      setReferral(null);
      setStep('result');
      setActiveTab('resume');
      setResumeViewMode('diff');
    } catch (err: any) { setError(err.message); } finally { setIsAnalyzing(false); }
  };

  const handleGenerateCoverLetter = async () => {
      if (!geminiService || !result) return;
      setIsGeneratingCL(true);
      try {
          const cl = await geminiService.generateCoverLetter(resumeText, jdText);
          setCoverLetter(cl);
      } catch(e) { console.error(e); } finally { setIsGeneratingCL(false); }
  };

  const handleGenerateReferral = async () => {
      if (!geminiService || !referralParams.name) return;
      setIsGeneratingReferral(true);
      try {
          const ref = await geminiService.generateReferralMessage(resumeText, jdText, referralParams.name, referralParams.relationship, referralParams.platform === 'Linkedin' ? 'LinkedIn' : 'Email');
          setReferral(ref);
      } catch(e) { console.error(e); } finally { setIsGeneratingReferral(false); }
  };

  const downloadPDF = () => {
      const elementId = activeTab === 'coverletter' ? 'cl-preview-content' : 'resume-preview-content';
      const filename = activeTab === 'coverletter' ? 'Cover_Letter.pdf' : 'Tailored_Resume.pdf';
      const element = document.getElementById(elementId);
      if (!element) return;
      const prevMode = resumeViewMode;
      if (activeTab === 'resume') setResumeViewMode('preview');
      setTimeout(() => {
        // Fix: Explicitly cast 'jpeg' as const to match Html2PdfOptions type
        const opt = { 
            margin: 0.5, 
            filename: filename, 
            image: { type: 'jpeg' as const, quality: 0.98 }, 
            html2canvas: { scale: 2 }, 
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const } 
        };
        html2pdf().set(opt).from(element).save();
        if (activeTab === 'resume') setTimeout(() => setResumeViewMode(prevMode), 100);
      }, 100);
  };

  // --- RENDER HELPERS ---
  const diffContent = useMemo(() => {
    if (!result || !resumeText) return [];
    return Diff.diffWords(resumeText.replace(/\r\n/g, '\n'), result.tailoredResumeMarkdown.replace(/[#*`]/g, ''));
  }, [result, resumeText]);

  const RenderDiff = () => (
    <div className="font-sans text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">
      {diffContent.map((part, index) => {
        if (part.added) return <span key={index} className="bg-emerald-100 text-emerald-800 font-bold px-0.5 rounded">{part.value}</span>;
        if (part.removed) return <span key={index} className="bg-red-50 text-red-600 line-through opacity-70 px-0.5 text-xs">{part.value}</span>;
        return <span key={index} className="text-gray-600">{part.value}</span>;
      })}
    </div>
  );

  const ScoreCard = ({ label, score, color }: { label: string, score: number, color: string }) => (
    <div className={`rounded-xl p-4 border ${color === 'green' ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-200'}`}>
        <span className="text-[10px] font-bold text-gray-500 uppercase">{label}</span>
        <div className="text-3xl font-black mt-1">{score}</div>
    </div>
  );

  // --- STEP 1: INPUT ---
  if (step === 'input') {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8 flex flex-col gap-6 animate-fadeIn">
        {/* Header Area */}
        <div className="text-center mb-2">
            <h2 className="text-2xl font-bold text-gray-900">Tailor Your Application</h2>
            <p className="text-gray-500 text-sm mt-1">Upload your resume and the job description to get started.</p>
        </div>

        {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium animate-pulse">
                <AlertCircle size={18} /> {error}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* LEFT: RESUME INPUT */}
          <div 
             className={`flex flex-col bg-white rounded-2xl border-2 transition-all duration-300 h-96 overflow-hidden ${isDragging ? 'border-brand-500 bg-brand-50 shadow-lg scale-[1.02]' : 'border-gray-100 shadow-sm hover:border-brand-200'}`}
             onDragOver={handleDragOver}
             onDragLeave={handleDragLeave}
             onDrop={handleDrop}
          >
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <div className="p-1.5 bg-brand-100 text-brand-600 rounded-lg"><FileText size={16} /></div> 
                    Resume
                </label>
                {resumeText.length > 0 && (
                   <div className="flex gap-2">
                       <button onClick={() => setIsEditingResume(!isEditingResume)} className="text-xs p-1.5 bg-gray-100 hover:bg-white border border-transparent hover:border-gray-200 rounded text-gray-600 transition-colors" title="Edit Text Manually"><Edit2 size={14} /></button>
                   </div>
                )}
            </div>

            <div className="flex-1 relative flex flex-col">
                 <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileUpload} />
                 
                 {isReadingFile ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10">
                         <Loader2 size={32} className="text-brand-600 animate-spin mb-3" />
                         <span className="text-sm font-medium text-gray-600">Reading Document...</span>
                     </div>
                 ) : null}

                 {resumeText.length > 0 ? (
                    isEditingResume ? (
                        <textarea 
                           className="flex-1 p-4 text-xs font-mono resize-none focus:outline-none bg-amber-50 text-gray-800" 
                           value={resumeText} 
                           onChange={(e) => { setResumeText(e.target.value); localStorage.setItem(STORAGE_KEY_RESUME, e.target.value); }} 
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                <FileCheck size={32} />
                            </div>
                            <h3 className="font-bold text-gray-900 text-lg mb-1 line-clamp-1 break-all max-w-[80%]">{fileName || "Uploaded Resume"}</h3>
                            <p className="text-xs text-gray-500 mb-6">Ready for analysis</p>
                            
                            <div className="flex gap-3">
                                <button onClick={() => setIsEditingResume(true)} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors">View Content</button>
                                <button onClick={clearSavedResume} className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"><Trash2 size={12} /> Remove</button>
                            </div>
                        </div>
                    )
                 ) : (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex flex-col items-center justify-center p-6 text-center cursor-pointer group"
                    >
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${isDragging ? 'bg-brand-200 text-brand-700' : 'bg-gray-50 text-gray-400 group-hover:bg-brand-50 group-hover:text-brand-600'}`}>
                            <UploadCloud size={32} />
                        </div>
                        <h3 className="font-bold text-gray-900 mb-1">
                            {isDragging ? "Drop it here!" : "Click or Drag to Upload"}
                        </h3>
                        <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">
                            Supports PDF, DOCX, or TXT. We'll parse the text instantly.
                        </p>
                    </div>
                 )}
            </div>
          </div>

          {/* RIGHT: JD INPUT */}
          <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm h-96 overflow-hidden hover:border-brand-200 transition-colors relative">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Briefcase size={16} /></div>
                    Job Description
                 </label>
                 
                 <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target:</span>
                     <select value={targetCountry} onChange={(e) => setTargetCountry(e.target.value)} className="text-xs border-none bg-transparent font-bold text-gray-700 focus:ring-0 cursor-pointer hover:text-brand-600">
                        {countries.map(c => <option key={c} value={c}>{c.split('/')[0]}</option>)}
                     </select>
                 </div>
            </div>

            <div className="absolute bottom-4 right-4 z-20 flex gap-2">
                <button 
                    onClick={handleGrabFromTab} 
                    disabled={isDetectingJD}
                    className="shadow-lg shadow-blue-100 text-xs flex items-center justify-center gap-1.5 bg-blue-600 text-white font-semibold px-3 py-2 rounded-lg hover:bg-blue-700 hover:scale-105 transition-all"
                >
                    {isDetectingJD ? <Loader2 size={12} className="animate-spin" /> : <Globe2 size={12} />} 
                    {isDetectingJD ? 'Scanning...' : 'Grab from Tab'}
                </button>
                <button 
                    onClick={handleSmartPaste} 
                    className="shadow-md text-xs flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all"
                >
                    <Clipboard size={12} /> Paste
                </button>
            </div>
            
            <div className="flex-1 relative group">
                 {/* Smart Badge for Detected Job */}
                 {detectedJob && (
                    <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-100 text-brand-800 text-[10px] px-3 py-1.5 rounded-full font-bold shadow-sm flex items-center gap-1.5 animate-fadeIn">
                        <CheckCircle size={10} className="text-green-500" />
                        {detectedJob.title} <span className="text-gray-400">@</span> {detectedJob.company}
                    </div>
                 )}
                
                <textarea 
                    className={`w-full h-full p-5 text-xs md:text-sm resize-none focus:outline-none transition-colors ${detectedJob ? 'pt-12' : ''} ${jdText ? 'bg-white' : 'bg-gray-50/30'}`} 
                    placeholder="Paste the Job Description here..." 
                    value={jdText} 
                    onChange={(e) => setJdText(e.target.value)} 
                />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
            <button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || !resumeText || !jdText} 
                className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-300 transform ${
                    isAnalyzing || !resumeText || !jdText 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1'
                }`}
            >
                {isAnalyzing ? (
                    <><Loader2 className="animate-spin" size={20} /> Analyzing Application...</>
                ) : (
                    <><Sparkles size={20} className={resumeText && jdText ? "animate-pulse" : ""} /> Generate Tailored Resume & Strategy</>
                )}
            </button>
        </div>
      </div>
    );
  }

  // --- STEP 2: RESULTS ---
  return (
    <div className="flex flex-col h-full bg-gray-50">
        <div className="bg-white px-4 py-2 border-b flex justify-between items-center shrink-0">
            <button onClick={() => setStep('input')} className="text-xs font-bold text-gray-600 flex items-center gap-1 hover:text-gray-900"><ChevronLeft size={14} /> Back</button>
            
            {/* TAB NAVIGATION */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setActiveTab('resume')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeTab === 'resume' ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}>Tailored Resume</button>
                <button onClick={() => setActiveTab('coverletter')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeTab === 'coverletter' ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}>Cover Letter</button>
                <button onClick={() => setActiveTab('referral')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeTab === 'referral' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Get Referral</button>
            </div>

            <div className="flex gap-2">
                 {(activeTab === 'resume' || (activeTab === 'coverletter' && coverLetter)) && (
                    <button onClick={downloadPDF} className="text-xs px-3 py-1 bg-brand-600 text-white rounded font-bold hover:bg-brand-700">PDF</button>
                 )}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {result && (
                <div className="space-y-4 max-w-4xl mx-auto">
                    
                    {/* TOP SUMMARY STATS (Only on Resume Tab) */}
                    {activeTab === 'resume' && (
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center gap-4">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="flex-1"><ScoreCard label="Old" score={result.originalScore} color="gray" /></div>
                                <ArrowRight className="text-gray-300" />
                                <div className="flex-1"><ScoreCard label="New" score={result.analysis.score} color="green" /></div>
                            </div>
                            <div className="flex-1 w-full bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Globe size={14} className="text-indigo-600" />
                                    <span className="text-xs font-bold text-indigo-900">Est. Salary ({targetCountry.split('/')[0]})</span>
                                </div>
                                <div className="text-lg font-bold text-indigo-800 leading-none">{result.internationalInsights.salaryInINR}</div>
                                <div className="text-[10px] text-indigo-600 mt-1">{result.internationalInsights.visaLikelihood} Visa Probability</div>
                            </div>
                        </div>
                    )}

                    {/* === TAB: RESUME === */}
                    {activeTab === 'resume' && (
                        <div className="flex flex-col gap-4">
                             <div className="flex justify-center">
                                 <div className="bg-white border rounded-full p-1 flex shadow-sm">
                                     <button onClick={() => setResumeViewMode('preview')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${resumeViewMode === 'preview' ? 'bg-gray-900 text-white' : 'text-gray-500'}`}>Clean Preview</button>
                                     <button onClick={() => setResumeViewMode('diff')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${resumeViewMode === 'diff' ? 'bg-brand-600 text-white' : 'text-gray-500'}`}>See Changes</button>
                                 </div>
                             </div>
                             <div id="resume-preview-content" className="bg-white shadow-lg p-8 min-h-[500px] text-xs md:text-sm border border-gray-100 rounded-lg">
                                {resumeViewMode === 'preview' ? (
                                    <div className="font-sans">
                                        <ReactMarkdown components={MarkdownComponents}>{result.tailoredResumeMarkdown}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <RenderDiff />
                                )}
                             </div>
                        </div>
                    )}

                    {/* === TAB: COVER LETTER === */}
                    {activeTab === 'coverletter' && (
                        <div className="flex flex-col gap-4 h-full">
                            {!coverLetter ? (
                                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
                                    <Mail size={48} className="text-brand-200 mb-4" />
                                    <h3 className="text-lg font-bold text-gray-800">Generate a Tailored Cover Letter?</h3>
                                    <p className="text-sm text-gray-500 mb-6 max-w-xs">AI will write a professional cover letter specifically for {detectedJob?.company || 'this role'}.</p>
                                    <button onClick={handleGenerateCoverLetter} disabled={isGeneratingCL} className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:bg-brand-700 transition-all flex items-center gap-2">
                                        {isGeneratingCL ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                        Generate Now
                                    </button>
                                </div>
                            ) : (
                                <div id="cl-preview-content" className="bg-white shadow-lg p-8 min-h-[500px] text-xs md:text-sm border border-gray-100 rounded-lg font-serif text-gray-800">
                                    <ReactMarkdown components={{
                                        p: ({node, ...props}: any) => <p className="mb-4 leading-relaxed" {...props} />,
                                    }}>{coverLetter}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === TAB: REFERRAL (NEW) === */}
                    {activeTab === 'referral' && (
                        <div className="flex flex-col gap-4">
                             <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-xl border border-purple-100 shadow-sm">
                                 <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2"><UserPlus size={20} /> Networking Assistant</h3>
                                 
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                     <div>
                                         <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Referrer Name</label>
                                         <input type="text" placeholder="e.g. John Doe" className="w-full p-2 rounded-lg border text-sm" value={referralParams.name} onChange={e => setReferralParams({...referralParams, name: e.target.value})} />
                                     </div>
                                     <div>
                                         <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Relationship</label>
                                         <select className="w-full p-2 rounded-lg border text-sm" value={referralParams.relationship} onChange={e => setReferralParams({...referralParams, relationship: e.target.value})}>
                                             <option>Cold Outreach</option>
                                             <option>Alumni / School Mate</option>
                                             <option>Ex-Colleague</option>
                                             <option>Friend of Friend</option>
                                         </select>
                                     </div>
                                     <div>
                                         <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Platform</label>
                                         <div className="flex bg-white rounded-lg border p-1">
                                             <button onClick={() => setReferralParams({...referralParams, platform: 'Linkedin'})} className={`flex-1 flex justify-center py-1 rounded text-xs font-bold ${referralParams.platform === 'Linkedin' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}><Linkedin size={14} /></button>
                                             <button onClick={() => setReferralParams({...referralParams, platform: 'Email'})} className={`flex-1 flex justify-center py-1 rounded text-xs font-bold ${referralParams.platform === 'Email' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}><Mail size={14} /></button>
                                         </div>
                                     </div>
                                 </div>

                                 <button onClick={handleGenerateReferral} disabled={isGeneratingReferral || !referralParams.name} className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-bold text-sm shadow hover:bg-purple-700 transition-all flex justify-center items-center gap-2">
                                     {isGeneratingReferral ? <Loader2 className="animate-spin" /> : <Zap size={16} />}
                                     Generate Human-Like Message
                                 </button>
                             </div>

                             {referral && (
                                 <div className="space-y-4 animate-fadeIn">
                                     {referral.subject && (
                                         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
                                             <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Subject Line</div>
                                             <div className="font-medium text-gray-800">{referral.subject}</div>
                                             <button onClick={() => navigator.clipboard.writeText(referral.subject)} className="absolute right-3 top-3 p-1.5 text-gray-400 hover:text-purple-600 bg-gray-50 rounded opacity-0 group-hover:opacity-100 transition-all"><Copy size={14} /></button>
                                         </div>
                                     )}
                                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
                                         <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Message Body ({referralParams.platform})</div>
                                         <div className="font-sans text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{referral.messageBody}</div>
                                         <button onClick={() => navigator.clipboard.writeText(referral.messageBody)} className="absolute right-3 top-3 p-1.5 text-gray-400 hover:text-purple-600 bg-gray-50 rounded opacity-0 group-hover:opacity-100 transition-all"><Copy size={14} /></button>
                                     </div>
                                     <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-xs text-purple-800 flex gap-2">
                                         <Sparkles size={14} className="shrink-0 mt-0.5" />
                                         <p><strong>Why this works:</strong> {referral.explanation}</p>
                                     </div>
                                 </div>
                             )}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default ResumeAnalyzer;