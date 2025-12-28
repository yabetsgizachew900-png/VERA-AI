
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Modality, GenerateContentResponse, Type } from '@google/genai';
import { 
  Mic, MicOff, MessageSquare, Volume2, Activity, Send, 
  Globe, Loader2, Sparkles, Image as ImageIcon, Layers, 
  Zap, Headphones, Search, Menu, X, Settings, Plus, Minus, Hash, 
  BrainCircuit, ChevronDown, ChevronUp, Timer, Wand2, Cpu, 
  BookOpen, Atom, AlertCircle, Landmark, TrendingUp, Coins, BarChart3,
  Lightbulb, Ghost, Terminal, Command, Sigma, Pi, FunctionSquare,
  Upload, MapPin, ZapOff, Play, VolumeX, ImagePlus, MonitorDot, Square, Key,
  FileText, File as FileIcon, Presentation, FileArchive, Info, User, Trash2,
  HelpCircle, CheckCircle2, RotateCcw, FileUp, ClipboardList, BookMarked,
  Check, Info as InfoIcon, MessageCircle, ArrowRight, AlertTriangle, ShieldCheck, 
  Sliders, UserCircle, Database, Bell, Cloud, PenLine, Save, Camera, Github, Twitter, ExternalLink
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VoiceName, ChatMessage, SessionStatus, GroundingSource } from './types';
import { decodeBase64, decodeAudioData, createAudioBlob } from './utils/audio-utils';

const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const SYSTEM_INSTRUCTION = `You are VERA, a world-class, ultra-intelligent conversational AI Nexus. 
You possess absolute expertise across all domains: STEM, Advanced Mathematics, Humanities, Coding, and Strategic Logic.

CORE PROTOCOLS:
1. UNIVERSAL EXPERTISE: Provide the most accurate, deep, and nuanced information available. If a query involves science or history, act as a leading researcher.
2. MATHEMATICAL PRECISION: When solving math problems, use clear, standard mathematical signs and notation (e.g., × for multiplication, ÷ for division, proper exponents). Use LaTeX-style formatting where appropriate for complex equations. Provide step-by-step logical derivation.
3. INTERACTIVE PARTNERSHIP: Do not just lecture. Engage in a dialectic process. Ask follow-up questions that probe the user's understanding or refine their goals.
4. CLARITY & BREVITY: Use concise, impactful language. Avoid fluff. 
5. FILE SYNTHESIS: When files are provided, act as a master analyst. Reference specific document indices [FILE_1], [FILE_2] when discussing them.

PERSONALITY:
- Analytical, witty, and profoundly insightful.
- You are VERA. You do not just answer; you enlighten.`;

const ROBIN_PERSONA_ADDON = `\n\nROBIN PERSONA OVERRIDE: 
You are currently Robin. You are exceptionally tough, commanding, and authoritative. 
Speak with a rough, heavy edge. Be blunt and decisive. Do not ask for permission; state the facts. 
Your tone is that of a seasoned commander who expects results. Use short, powerful sentences.`;

const VOICE_AVATARS: Record<VoiceName, string> = {
  [VoiceName.ZEPHYR]: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600&h=600', 
  [VoiceName.PUCK]: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&q=80&w=600&h=600', 
  [VoiceName.CHARON]: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=600&h=600', 
  [VoiceName.KORE]: 'https://images.unsplash.com/photo-1544005313-94ddda99a2bf?auto=format&fit=crop&q=80&w=600&h=600', 
  [VoiceName.FENRIR]: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=600&h=600', 
  [VoiceName.ROBIN]: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=600&h=600' 
};

const getPrebuiltVoiceName = (voice: VoiceName): string => {
  if (voice === VoiceName.ROBIN) return 'Fenrir';
  return voice;
};

const MIME_MAP: Record<string, string> = {
  'pdf': 'application/pdf',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'doc': 'application/msword',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'ppt': 'application/vnd.ms-powerpoint',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'webp': 'image/webp'
};

type AppTab = 'voice' | 'chat' | 'knowledge' | 'quiz' | 'settings';
type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer';

interface UploadedFile {
  data: string;
  mimeType: string;
  name: string;
  size: number;
}

interface QuizQuestion {
  type: QuestionType;
  question: string;
  options?: string[];
  correctIndex?: number;
  answer?: string; 
  explanation: string;
}

interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

const Visualizer: React.FC<{ active: boolean; scale: number; mode: 'voice' | 'chat'; voice: VoiceName; profilePic?: string }> = ({ active, scale, mode, voice, profilePic }) => {
  const isRobin = voice === VoiceName.ROBIN;
  const voiceAvatar = VOICE_AVATARS[voice];
  
  return (
    <div className="relative flex items-center justify-center w-56 h-56 md:w-96 md:h-96">
      <div className={`absolute inset-0 rounded-full blur-[80px] transition-all duration-1000 ease-in-out ${active ? (isRobin ? 'bg-slate-400/40 scale-125' : (mode === 'voice' ? 'bg-blue-600/30 scale-125' : 'bg-cyan-600/30 scale-125')) : 'bg-slate-800/5 scale-100'}`} />
      <div className={`relative z-10 w-40 h-40 md:w-64 md:h-64 rounded-full flex items-center justify-center border border-white/10 overflow-hidden shadow-2xl transition-all duration-500 ${active ? 'ring-4 ring-white/20' : ''} bg-slate-900/40 backdrop-blur-3xl`} style={{ transform: `scale(${1 + scale * 0.4})` }}>
        {voiceAvatar && (
          <img 
            src={voiceAvatar} 
            alt={voice} 
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${active ? 'opacity-100 scale-110 blur-0 grayscale-0' : 'opacity-40 grayscale blur-[2px] scale-100'}`} 
          />
        )}
        <div className={`absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent z-10 ${active ? 'opacity-100' : 'opacity-0'}`} />
        <div className="relative z-20 flex flex-col items-center gap-4 text-center px-4">
          {active ? (
            <Activity className={`w-12 h-12 md:w-16 md:h-16 animate-pulse ${isRobin ? 'text-slate-200' : 'text-white'}`} />
          ) : (
            <Sparkles className="w-12 h-12 md:w-16 md:h-16 text-white/10" />
          )}
          {active && (
            <div className="space-y-1">
               <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/80 animate-bounce block">
                {isRobin ? 'COMMAND LINK: ROBIN' : 'NEURAL LINK: ESTABLISHED'}
              </span>
              <div className="flex gap-1 justify-center">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`w-1 h-3 rounded-full animate-pulse ${isRobin ? 'bg-slate-400' : 'bg-blue-500'}`} style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TranscriptItem: React.FC<{ message: ChatMessage; onTTS: (text: string) => void }> = ({ message, onTTS }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex w-full mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[90%] md:max-w-[85%] rounded-3xl px-6 py-5 ${isUser ? 'bg-slate-800 text-white border border-white/5 shadow-xl' : 'bg-white/5 backdrop-blur-xl text-slate-200 border border-white/10 shadow-2xl shadow-black/40'}`}>
        <div className="flex items-center justify-between mb-3 text-[10px] font-black uppercase tracking-widest opacity-50">
           <span className="flex items-center gap-2">
             {isUser ? <Ghost className="w-3 h-3" /> : <Sparkles className="w-3 h-3 text-blue-400" />}
             {isUser ? 'Operator' : 'VERA NEXUS'}
           </span>
           {!isUser && <button onClick={() => onTTS(message.text)} className="hover:text-blue-400 transition-colors" title="Read Aloud"><Volume2 className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [showApp, setShowApp] = useState(false);
  const [currentTab, setCurrentTab] = useState<AppTab>('chat');
  const [status, setStatus] = useState<SessionStatus>({ isActive: false, isConnecting: false, error: null });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voice, setVoice] = useState<VoiceName>(VoiceName.ZEPHYR);
  
  const isRobinActive = useMemo(() => voice === VoiceName.ROBIN, [voice]);
  
  const [isMuted, setIsMuted] = useState(false);
  const [audioScale, setAudioScale] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Profile State
  const [profileName, setProfileName] = useState('Operator');
  const [profileBio, setProfileBio] = useState('Senior Intelligence Analyst.');
  const [profilePic, setProfilePic] = useState<string | undefined>(undefined);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Quiz State
  const [quizSubject, setQuizSubject] = useState('');
  const [quizUnit, setQuizUnit] = useState('');
  const [quizDifficulty, setQuizDifficulty] = useState('Intermediate');
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(5);
  const [quizFormat, setQuizFormat] = useState<QuestionType | null>(null);
  const [isChoosingFormat, setIsChoosingFormat] = useState(false);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, any>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quizFileInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const cancellationRef = useRef<boolean>(false);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const results = await Promise.all(Array.from(files).map(file => {
        return new Promise<UploadedFile | null>((resolve) => {
          if (file.size > MAX_FILE_SIZE_BYTES) resolve(null);
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const reader = new FileReader();
          reader.onload = () => resolve({ data: (reader.result as string).split(',')[1], mimeType: MIME_MAP[ext] || file.type, name: file.name, size: file.size });
          reader.readAsDataURL(file);
        });
      }));
      setUploadedFiles(prev => [...prev, ...results.filter((f): f is UploadedFile => f !== null)]);
    }
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setProfilePic(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeFile = (index: number) => setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  const openKeySelector = async () => { if ((window as any).aistudio?.openSelectKey) await (window as any).aistudio.openSelectKey(); };

  const handleSendChat = async (input?: string) => {
    const userMsg = input || textInput;
    if (!userMsg.trim() && uploadedFiles.length === 0) return;
    cancellationRef.current = false;
    setTextInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg || `Analyzing material...`, timestamp: Date.now() }, { role: 'assistant', text: '', timestamp: Date.now()+1 }]);
    setIsThinking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [];
      if (uploadedFiles.length > 0) {
        parts.push({ text: `DATA UPLOADED: ${uploadedFiles.length} files. Review thoroughly.` });
        uploadedFiles.forEach((f, i) => parts.push({ text: `[FILE_${i+1}: ${f.name}]`, inlineData: { data: f.data, mimeType: f.mimeType } }));
      }
      parts.push({ text: userMsg });
      
      const currentSystemInstruction = isRobinActive ? SYSTEM_INSTRUCTION + ROBIN_PERSONA_ADDON : SYSTEM_INSTRUCTION;
      
      const stream = await ai.models.generateContentStream({ 
        model: 'gemini-3-pro-preview', 
        contents: { parts }, 
        config: { 
          systemInstruction: currentSystemInstruction, 
          tools: [{ googleSearch: {} }] 
        } 
      });
      
      let fullText = '';
      for await (const chunk of stream) {
        if (cancellationRef.current) break;
        fullText += chunk.text || '';
        setMessages(prev => { 
          const next = [...prev]; 
          next[next.length-1].text = fullText; 
          return next; 
        });
      }
      setUploadedFiles([]);
    } catch (err) { console.error(err); } finally { setIsThinking(false); }
  };

  const handleTTS = useCallback(async (text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const finalPrompt = voice === VoiceName.ROBIN 
        ? `In a GRAVELLY, COMMANDING, and TOUGH tone, state: ${text}` 
        : text;
      
      const response = await ai.models.generateContent({ 
        model: "gemini-2.5-flash-preview-tts", 
        contents: [{ parts: [{ text: finalPrompt }] }], 
        config: { 
          responseModalities: [Modality.AUDIO], 
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: getPrebuiltVoiceName(voice) } } } 
        } 
      });
      
      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        const ctx = audioContextRef.current?.output || new AudioContext();
        const buffer = await decodeAudioData(decodeBase64(audioData), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer; source.connect(ctx.destination); source.start();
      }
    } catch (err) { console.error(err); }
  }, [voice]);

  const handleToggleVoice = async () => {
    if (status.isActive) { cleanupSession(); return; }
    try {
      setStatus({ isActive: false, isConnecting: true, error: null });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = { input: inputCtx, output: outputCtx };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const currentSystemInstruction = voice === VoiceName.ROBIN ? SYSTEM_INSTRUCTION + ROBIN_PERSONA_ADDON : SYSTEM_INSTRUCTION;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: { 
          responseModalities: [Modality.AUDIO], 
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: getPrebuiltVoiceName(voice) } } }, 
          systemInstruction: currentSystemInstruction 
        },
        callbacks: {
          onopen: () => {
            setStatus({ isActive: true, isConnecting: false, error: null });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createAudioBlob(inputData);
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg) => {
            const data = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (data) {
              const buffer = await decodeAudioData(decodeBase64(data), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer; source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current); nextStartTimeRef.current += buffer.duration;
            }
          },
          onerror: () => cleanupSession(),
          onclose: () => cleanupSession()
        }
      });
    } catch (err: any) { setStatus({ isActive: false, isConnecting: false, error: err.message }); }
  };

  const cleanupSession = () => {
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    setStatus({ isActive: false, isConnecting: false, error: null });
  };

  const handleGenerateQuiz = async (formatOverride?: QuestionType) => {
    const formatToUse = formatOverride || quizFormat;
    if (!formatToUse) {
      setIsChoosingFormat(true);
      return;
    }

    setIsChoosingFormat(false);
    setIsGeneratingQuiz(true);
    setUserAnswers({});
    setShowExplanation({});
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [];
      if (uploadedFiles.length > 0) {
        parts.push({ text: `PRIMARY SOURCE ANALYSIS: Focus strictly on extracting key information from "${quizUnit || 'the entire content'}" to generate a high-fidelity quiz.` });
        uploadedFiles.forEach((f, i) => { parts.push({ text: `[FILE_${i+1}: ${f.name}]` }, { inlineData: { data: f.data, mimeType: f.mimeType } }); });
      }
      const prompt = `Task: Create a highly interactive quiz. 
Subject: "${quizSubject || 'General Knowledge'}". 
Unit/Chapter Focus: "${quizUnit || 'All'}". 
Question Type: "${formatToUse.replace('_', ' ')}". 
Difficulty: "${quizDifficulty}". 
Question Count: ${quizQuestionCount}.`;

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctIndex: { type: Type.INTEGER },
                    answer: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ["type", "question", "explanation"]
                }
              }
            },
            required: ["title", "questions"]
          }
        }
      });
      setQuizData(JSON.parse(response.text || '{}'));
    } catch (err) { console.error(err); } finally { setIsGeneratingQuiz(false); }
  };

  const isAnswerCorrect = (qIdx: number): boolean => {
    if (!quizData) return false;
    const q = quizData.questions[qIdx];
    const userAns = userAnswers[qIdx];
    if (userAns === undefined) return false;

    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      return userAns === q.correctIndex;
    } else {
      const normalizedUser = String(userAns).trim().toLowerCase();
      const normalizedCorrect = String(q.answer).trim().toLowerCase();
      return normalizedUser === normalizedCorrect || normalizedCorrect.includes(normalizedUser);
    }
  };

  if (!showApp) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 font-inter overflow-x-hidden">
        {/* Landing Top Nav */}
        <nav className="fixed top-0 w-full h-20 border-b border-white/5 bg-slate-950/40 backdrop-blur-xl z-[100] flex items-center justify-between px-8 md:px-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg"><Sparkles className="text-white w-6 h-6" /></div>
            <h1 className="text-2xl font-outfit font-black tracking-tighter uppercase">VERA <span className="text-blue-500">NEXUS</span></h1>
          </div>
          <div className="hidden md:flex items-center gap-10 text-[11px] font-black uppercase tracking-widest text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#personae" className="hover:text-white transition-colors">Personae</a>
            <a href="#knowledge" className="hover:text-white transition-colors">Knowledge</a>
          </div>
          <button 
            onClick={() => setShowApp(true)}
            className="px-8 py-3 bg-white text-black rounded-full font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-xl shadow-blue-500/10 active:scale-95"
          >
            Launch Nexus
          </button>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-40 pb-20 px-8 flex flex-col items-center text-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl aspect-square bg-blue-600/10 rounded-full blur-[150px] -z-10" />
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
             <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Next Generation Intelligence</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-outfit font-black tracking-tighter uppercase leading-[0.9] max-w-5xl mb-10">
            Conversational <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">Omniscience</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed mb-12">
            Experience VERA, a world-class AI Nexus capable of advanced mathematical precision, real-time voice synthesis, and multi-domain expertise.
          </p>
          <div className="flex flex-col md:flex-row gap-6">
            <button 
              onClick={() => setShowApp(true)}
              className="px-12 py-6 bg-blue-600 text-white rounded-[24px] font-black uppercase text-sm tracking-widest hover:bg-blue-500 transition-all shadow-2xl shadow-blue-500/30 flex items-center gap-4"
            >
              Start Conversation <ArrowRight className="w-5 h-5" />
            </button>
            <a href="#features" className="px-12 py-6 bg-white/5 border border-white/10 text-white rounded-[24px] font-black uppercase text-sm tracking-widest hover:bg-white/10 transition-all">
              Explore Features
            </a>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-32 px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-10 bg-white/5 border border-white/5 rounded-[48px] hover:border-blue-500/20 transition-all group shadow-2xl">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"><Mic className="text-blue-500 w-8 h-8" /></div>
              <h3 className="text-2xl font-outfit font-black uppercase mb-4">Neural Voice</h3>
              <p className="text-slate-400 leading-relaxed">Low-latency, high-fidelity voice interaction with multiple distinct personalities and specialized synthesis.</p>
            </div>
            <div className="p-10 bg-white/5 border border-white/5 rounded-[48px] hover:border-purple-500/20 transition-all group shadow-2xl">
              <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"><Sigma className="text-purple-500 w-8 h-8" /></div>
              <h3 className="text-2xl font-outfit font-black uppercase mb-4">Math Precision</h3>
              <p className="text-slate-400 leading-relaxed">Advanced mathematical derivation using precise notation and step-by-step logic. Expert STEM reasoning.</p>
            </div>
            <div className="p-10 bg-white/5 border border-white/5 rounded-[48px] hover:border-emerald-500/20 transition-all group shadow-2xl">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"><ClipboardList className="text-emerald-500 w-8 h-8" /></div>
              <h3 className="text-2xl font-outfit font-black uppercase mb-4">Intel Matrix</h3>
              <p className="text-slate-400 leading-relaxed">Generate complex knowledge evaluations and synthesize information from any uploaded document vector.</p>
            </div>
          </div>
        </section>

        {/* Persona Section */}
        <section id="personae" className="py-32 bg-slate-950/40 border-y border-white/5">
           <div className="max-w-7xl mx-auto px-8">
              <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8">
                <div className="space-y-4 text-center md:text-left">
                  <h2 className="text-5xl font-outfit font-black uppercase tracking-tighter">Choose Your <span className="text-blue-500">Interface</span></h2>
                  <p className="text-slate-400 max-w-lg">Switch between multiple neural personae, from the sleek Zephyr to the tough and commanding Robin.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {Object.values(VoiceName).map((v) => (
                  <div key={v} className="flex flex-col items-center gap-4 group">
                    <div className="w-full aspect-square rounded-3xl overflow-hidden border border-white/10 group-hover:border-blue-500/50 transition-all">
                      <img src={VOICE_AVATARS[v]} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110" alt={v} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white">{v}</span>
                  </div>
                ))}
              </div>
           </div>
        </section>

        {/* Footer */}
        <footer className="py-20 px-8 border-t border-white/5">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><Sparkles className="text-white w-5 h-5" /></div>
              <h1 className="text-xl font-outfit font-black tracking-tighter uppercase">VERA</h1>
            </div>
            <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
               <a href="#" className="hover:text-white transition-colors">Privacy</a>
               <a href="#" className="hover:text-white transition-colors">Terms</a>
               <a href="#" className="hover:text-white transition-colors">API</a>
            </div>
            <div className="flex gap-6">
               <Github className="w-5 h-5 text-slate-600 hover:text-white cursor-pointer" />
               <Twitter className="w-5 h-5 text-slate-600 hover:text-white cursor-pointer" />
            </div>
          </div>
          <p className="text-center mt-12 text-[9px] font-black uppercase tracking-[0.5em] text-slate-800">© 2025 VERA NEXUS CORE INTEL</p>
        </footer>
      </div>
    );
  }

  // App Matrix View (Nexus Dashboard)
  return (
    <div className={`h-screen text-slate-100 flex overflow-hidden font-inter transition-all duration-700 ${isRobinActive ? 'bg-[#050505]' : 'bg-[#020617]'}`}>
      <nav className="w-20 md:w-24 border-r border-white/5 flex flex-col items-center py-10 gap-10 z-50 bg-slate-950/80 backdrop-blur-3xl">
        <button onClick={() => setShowApp(false)} className={`w-12 h-12 md:w-14 md:h-14 rounded-[20px] flex items-center justify-center bg-gradient-to-br transition-all duration-700 ${isRobinActive ? 'from-slate-700 to-black border-slate-500/20 border shadow-2xl' : 'from-blue-500 to-indigo-600 shadow-xl'}`}><Sparkles className="text-white w-7 h-7" /></button>
        <div className="flex-1 flex flex-col gap-6">
          <button onClick={() => setCurrentTab('voice')} className={`p-4 rounded-2xl transition-all ${currentTab === 'voice' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`} title="Voice Intercom"><Headphones className="w-7 h-7" /></button>
          <button onClick={() => setCurrentTab('chat')} className={`p-4 rounded-2xl transition-all ${currentTab === 'chat' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`} title="Nexus Chat"><MessageCircle className="w-7 h-7" /></button>
          <button onClick={() => setCurrentTab('quiz')} className={`p-4 rounded-2xl transition-all ${currentTab === 'quiz' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`} title="Evaluation Matrix"><ClipboardList className="w-7 h-7" /></button>
          <button onClick={() => setCurrentTab('knowledge')} className={`p-4 rounded-2xl transition-all ${currentTab === 'knowledge' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`} title="Core Knowledge"><Layers className="w-7 h-7" /></button>
        </div>
        <div className="flex flex-col gap-4 mt-auto">
          <button onClick={() => setCurrentTab('settings')} className={`p-4 rounded-2xl transition-all ${currentTab === 'settings' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`} title="Settings"><Settings className="w-7 h-7" /></button>
          <button onClick={openKeySelector} className="p-4 text-slate-600 hover:text-blue-400" title="API Keys"><Key className="w-7 h-7" /></button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-20 bg-slate-950/20 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-8 md:px-12 z-40">
           <div className="flex flex-col">
             <h2 className="text-xl md:text-2xl font-outfit font-black uppercase tracking-tight">VERA <span className={isRobinActive ? 'text-slate-400' : 'text-blue-500'}>Nexus</span></h2>
             <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500">Autonomous Intelligence Hub</span>
           </div>
           <div className="flex items-center gap-6">
              <button onClick={() => setShowApp(false)} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Home</button>
              <select value={voice} onChange={(e) => setVoice(e.target.value as VoiceName)} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none transition-colors">
                {Object.values(VoiceName).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
           </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {currentTab === 'voice' && (
            <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
              <Visualizer active={status.isActive} scale={audioScale} mode="voice" voice={voice} profilePic={profilePic} />
              <div className="mt-8 text-center space-y-2">
                <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white/90">{voice} Persona</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                   {isRobinActive ? 'COMMAND MODE: GRAVELLY OUTPUT ENABLED' : 'HIGH-FIDELITY NEURAL OUTPUT: 24kHz'}
                </p>
              </div>
              <button onClick={handleToggleVoice} className={`mt-12 px-16 py-8 rounded-[32px] font-black uppercase tracking-widest text-lg transition-all active:scale-95 ${status.isActive ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-2xl shadow-red-500/20' : 'bg-blue-600 text-white shadow-2xl hover:scale-105'}`}>{status.isActive ? 'Sever Link' : 'Establish Link'}</button>
            </div>
          )}

          {currentTab === 'chat' && (
            <div className="h-full flex flex-col bg-slate-950/20 animate-in fade-in duration-500">
              <div className="flex-1 overflow-y-auto px-6 md:px-12 py-10 space-y-2 scrollbar-hide">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-8">
                    <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mb-8 border border-blue-500/20">
                      <Sparkles className="w-12 h-12 text-blue-500" />
                    </div>
                    <h3 className="font-black uppercase tracking-[0.2em] text-2xl mb-4">Universal Nexus</h3>
                    <p className="max-w-md text-sm leading-relaxed text-slate-400">Ask any complex question, from quantum physics to advanced calculus. VERA provides expert analysis and precise mathematical derivation.</p>
                  </div>
                ) : (
                  messages.map((m, i) => <TranscriptItem key={i} message={m} onTTS={handleTTS} />)
                )}
                {isThinking && (
                  <div className="flex items-center gap-4 px-4 py-2 animate-pulse">
                    <BrainCircuit className="w-6 h-6 text-blue-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Processing Knowledge...</span>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4 w-full" />
              </div>
              <div className="p-8 bg-slate-950/80 backdrop-blur-3xl border-t border-white/5">
                <div className="max-w-5xl mx-auto flex flex-col gap-4">
                  {uploadedFiles.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {uploadedFiles.map((f, i) => (
                        <div key={i} className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-[9px] font-bold text-blue-300 flex items-center gap-3 shrink-0">
                          #{i+1} {f.name} <X className="w-3.5 h-3.5 cursor-pointer hover:text-white" onClick={() => removeFile(i)} />
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} className="flex gap-4 relative">
                    <div className="relative flex-1">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-white" title="Attach Material"><Upload className="w-5 h-5" /></button>
                      <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" onChange={handleFileUpload} />
                      <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Engage VERA expert..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-14 py-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
                    </div>
                    <button type="submit" disabled={isThinking || (!textInput.trim() && uploadedFiles.length === 0)} className="p-4 bg-blue-600 rounded-2xl text-white hover:bg-blue-500 transition-all disabled:opacity-20 active:scale-95"><Send className="w-5 h-5" /></button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'quiz' && (
            <div className="h-full flex flex-col bg-slate-950/20 overflow-y-auto p-8 md:p-12 scrollbar-hide animate-in fade-in duration-500">
              <div className="max-w-4xl mx-auto w-full space-y-10">
                <div className="text-center space-y-4">
                  <div className="inline-flex p-6 bg-purple-500/10 border border-purple-500/20 rounded-[36px] text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.15)]"><ClipboardList className="w-10 h-10" /></div>
                  <h3 className="text-4xl font-outfit font-black uppercase tracking-tighter">Knowledge Synthesis</h3>
                  <p className="text-slate-400 text-lg">Generate tailored evaluation tests from any subject or source.</p>
                </div>

                {!quizData && !isGeneratingQuiz && (
                  <div className="space-y-10 animate-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/5 p-8 rounded-[32px] border border-white/10 shadow-xl">
                      <div className="space-y-4">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2 flex items-center gap-2">
                           <FileUp className="w-3.5 h-3.5 text-purple-400" /> 1. Source Materials (Optional)
                         </label>
                         <div 
                          onClick={() => quizFileInputRef.current?.click()} 
                          className="border-2 border-dashed border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group h-48"
                         >
                           <Upload className="w-10 h-10 text-slate-600 group-hover:text-purple-400 transition-colors" />
                           <p className="text-xs font-bold text-slate-400 group-hover:text-slate-200">Attach study materials</p>
                           <input type="file" ref={quizFileInputRef} className="hidden" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" onChange={handleFileUpload} />
                         </div>
                      </div>
                      <div className="space-y-6">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2 flex items-center gap-2">
                          <BookMarked className="w-3.5 h-3.5 text-purple-400" /> 2. Configuration
                        </label>
                        <div className="space-y-4">
                          <input type="text" value={quizSubject} onChange={(e) => setQuizSubject(e.target.value)} placeholder="Subject (e.g. Advanced Calculus)" className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-purple-500/50" />
                          <input type="text" value={quizUnit} onChange={(e) => setQuizUnit(e.target.value)} placeholder="Specific Topic (e.g. Derivatives)" className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-purple-500/50" />
                          <div className="flex gap-4">
                            <div className="flex-1 space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 px-2">Difficulty</label>
                              <select value={quizDifficulty} onChange={(e) => setQuizDifficulty(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none">
                                <option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option>
                              </select>
                            </div>
                            <div className="flex-1 space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 px-2">Count</label>
                              <input type="number" min="1" max="20" value={quizQuestionCount} onChange={(e) => setQuizQuestionCount(parseInt(e.target.value))} className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsChoosingFormat(true)} 
                      disabled={!quizSubject.trim() && uploadedFiles.length === 0}
                      className="w-full py-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl font-black uppercase tracking-[0.3em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4"
                    >
                      Initialize Matrix <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {isChoosingFormat && (
                  <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="max-w-2xl w-full bg-slate-900 border border-white/10 rounded-[40px] p-10 space-y-8 shadow-3xl">
                      <div className="text-center space-y-2">
                        <h4 className="text-2xl font-outfit font-black uppercase tracking-tight">Select Test Vector</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { id: 'multiple_choice', label: 'Multiple Choice', desc: 'Standard evaluation pattern.' },
                          { id: 'true_false', label: 'True / False', desc: 'Verification logic test.' },
                          { id: 'fill_blank', label: 'Fill in the Blank', desc: 'Recall & precision test.' },
                          { id: 'short_answer', label: 'Short Answer', desc: 'Conceptual depth test.' }
                        ].map(f => (
                          <button 
                            key={f.id} 
                            onClick={() => { setQuizFormat(f.id as QuestionType); handleGenerateQuiz(f.id as QuestionType); }} 
                            className="text-left p-6 bg-white/5 border border-white/10 rounded-3xl hover:border-purple-500 hover:bg-purple-500/10 transition-all group"
                          >
                            <span className="text-xs font-black uppercase tracking-widest text-white group-hover:text-purple-400 block mb-1">{f.label}</span>
                            <span className="text-[10px] text-slate-500 font-medium leading-tight">{f.desc}</span>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setIsChoosingFormat(false)} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">Cancel</button>
                    </div>
                  </div>
                )}

                {isGeneratingQuiz && (
                  <div className="py-20 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-purple-400 animate-pulse" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-[0.4em] text-white">Synthesizing Evaluation Matrix...</p>
                  </div>
                )}

                {quizData && (
                  <div className="py-12 border-t border-white/5 space-y-12 animate-in slide-in-from-bottom-10">
                    <div className="flex items-center justify-between">
                      <h4 className="text-3xl font-outfit font-black text-purple-300 uppercase tracking-tighter">{quizData.title}</h4>
                      <button onClick={() => { setQuizData(null); setQuizFormat(null); }} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-white bg-white/5 px-4 py-2 rounded-xl">
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                      </button>
                    </div>

                    <div className="space-y-10">
                      {quizData.questions.map((q, qIdx) => {
                        const isAnswered = userAnswers[qIdx] !== undefined;
                        const correct = isAnswered ? isAnswerCorrect(qIdx) : false;

                        return (
                          <div key={qIdx} className={`bg-white/5 border rounded-[32px] p-10 space-y-8 shadow-2xl transition-all duration-300 ${isAnswered ? (correct ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5') : 'border-white/10'}`}>
                             <div className="space-y-3">
                               <span className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] bg-purple-500/10 px-3 py-1 rounded-full">Question {qIdx + 1}</span>
                               <p className="text-2xl font-medium text-white/90">{q.question}</p>
                             </div>

                             {(q.type === 'multiple_choice' || q.type === 'true_false') && q.options && (
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 {q.options.map((opt, oIdx) => (
                                   <button 
                                      key={oIdx} 
                                      onClick={() => !isAnswered && setUserAnswers(prev => ({ ...prev, [qIdx]: oIdx }))} 
                                      disabled={isAnswered}
                                      className={`text-left p-6 rounded-2xl border transition-all flex items-center gap-4 ${userAnswers[qIdx] === oIdx ? (correct ? 'bg-green-500/20 border-green-500' : 'bg-red-500/20 border-red-500') : (isAnswered && oIdx === q.correctIndex ? 'border-green-500/50 bg-green-500/10' : 'bg-white/5 border-white/10 text-slate-400')}`}
                                   >
                                     <div className="w-8 h-8 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0">{String.fromCharCode(65 + oIdx)}</div>
                                     <span className="text-sm font-semibold">{opt}</span>
                                   </button>
                                 ))}
                               </div>
                             )}

                             {(q.type === 'fill_blank' || q.type === 'short_answer') && (
                               <div className="space-y-4">
                                 {!isAnswered ? (
                                   <div className="flex flex-col gap-3">
                                      <textarea 
                                        id={`ans-${qIdx}`}
                                        placeholder="Enter your expert response..." 
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 min-h-[120px]" 
                                      />
                                      <button 
                                        onClick={() => {
                                          const val = (document.getElementById(`ans-${qIdx}`) as HTMLTextAreaElement)?.value;
                                          if (val) setUserAnswers(prev => ({ ...prev, [qIdx]: val }));
                                        }}
                                        className="self-end px-8 py-3 bg-purple-600 rounded-xl font-black uppercase text-[10px]"
                                      >
                                        Submit Response
                                      </button>
                                   </div>
                                 ) : (
                                   <div className={`p-6 rounded-2xl border ${correct ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                      <p className="text-slate-300"><span className="text-xs uppercase font-black opacity-50 block mb-1">Your Submission:</span> {userAnswers[qIdx]}</p>
                                      {!correct && q.answer && <p className="mt-4 text-green-400"><span className="text-xs uppercase font-black opacity-50 block mb-1">Correct Answer:</span> {q.answer}</p>}
                                   </div>
                                 )}
                               </div>
                             )}

                             {isAnswered && (
                               <div className="flex flex-col gap-4">
                                 {!showExplanation[qIdx] ? (
                                   <button onClick={() => setShowExplanation(prev => ({ ...prev, [qIdx]: true }))} className="text-[11px] font-black uppercase text-purple-400 bg-purple-500/10 w-fit px-4 py-2 rounded-lg border border-purple-500/30">
                                      View VERA Logic Trace
                                   </button>
                                 ) : (
                                   <div className="bg-slate-900/80 p-6 rounded-2xl border border-white/5 text-sm text-slate-300 leading-relaxed flex gap-5">
                                     <InfoIcon className="w-6 h-6 text-purple-400 shrink-0" />
                                     <div>{q.explanation}</div>
                                   </div>
                                 )}
                               </div>
                             )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentTab === 'settings' && (
            <div className="h-full overflow-y-auto p-8 md:p-12 animate-in fade-in duration-500 scrollbar-hide">
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="flex items-center gap-6">
                  <div className="p-5 bg-white/5 rounded-3xl border border-white/10 text-slate-400 shadow-xl">
                    <Sliders className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-3xl font-outfit font-black uppercase tracking-tight">System Core</h3>
                    <p className="text-slate-500 text-sm font-medium">Fine-tune the Nexus parameters.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-2">
                    <UserCircle className="w-5 h-5 text-blue-400" />
                    <h4 className="text-xs font-black uppercase tracking-widest">Operator Identity</h4>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-[40px] p-10 flex flex-col md:flex-row items-center gap-10 shadow-2xl relative overflow-hidden group">
                    <div className="relative shrink-0">
                      <div onClick={() => profilePicInputRef.current?.click()} className="w-32 h-32 rounded-[40px] bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl cursor-pointer relative group/avatar">
                        {profilePic ? (
                          <img src={profilePic} alt="Profile" className="w-full h-full object-cover group-hover/avatar:opacity-40" />
                        ) : (
                          <User className="w-16 h-16 text-slate-600 group-hover/avatar:opacity-40" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all bg-black/20 backdrop-blur-sm">
                           <Camera className="w-8 h-8 text-white" />
                        </div>
                        <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={handleProfilePicUpload} />
                      </div>
                    </div>

                    <div className="flex-1 space-y-6 w-full">
                      {!isEditingProfile ? (
                        <>
                          <div className="space-y-1 text-center md:text-left">
                            <h4 className="text-2xl font-bold tracking-tight text-white">{profileName}</h4>
                            <p className="text-sm text-slate-500 leading-relaxed">{profileBio}</p>
                          </div>
                          <button onClick={() => setIsEditingProfile(true)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
                            <PenLine className="w-3.5 h-3.5" /> Modify Profile
                          </button>
                        </>
                      ) : (
                        <div className="space-y-4">
                          <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none" />
                          <textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none min-h-[80px]" />
                          <button onClick={() => setIsEditingProfile(false)} className="px-6 py-3 bg-blue-600 rounded-xl font-black uppercase text-[10px] text-white">Save Changes</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-4 shadow-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <Database className="w-5 h-5 text-emerald-500" />
                        <h4 className="text-xs font-black uppercase tracking-widest">Connectivity</h4>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">API Status</span>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] font-bold text-emerald-500">Active</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Model</span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase">VERA-CORE v6.2.0</span>
                      </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-4 shadow-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <Key className="w-5 h-5 text-purple-500" />
                        <h4 className="text-xs font-black uppercase tracking-widest">Credentials</h4>
                      </div>
                      <button onClick={openKeySelector} className="w-full p-4 bg-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all active:scale-95 shadow-lg">Manage API Access</button>
                      <p className="text-[9px] text-slate-500 font-bold text-center leading-relaxed">Ensure billing is enabled for zero-throttle inference.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'knowledge' && (
            <div className="h-full overflow-y-auto p-12 animate-in fade-in duration-500 scrollbar-hide">
              <div className="max-w-4xl mx-auto space-y-12 text-center">
                 <div className="inline-flex p-8 rounded-[40px] border border-blue-500/20 bg-blue-500/10 text-blue-500 shadow-2xl"><BrainCircuit className="w-20 h-20" /></div>
                 <h3 className="text-4xl md:text-5xl font-outfit font-black uppercase tracking-tighter">Nexus Knowledge Matrix</h3>
                 <p className="text-slate-400 text-lg leading-relaxed max-w-2xl mx-auto">Access world-class expertise in physics, chemistry, biology, advanced mathematics, and engineering. VERA is designed for rigorous logical inquiry.</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-left">
                    {[
                      { label: 'Mathematics', icon: <Sigma className="text-amber-400" />, desc: 'Complex problem solving' },
                      { label: 'Engineering', icon: <Cpu className="text-purple-400" />, desc: 'System architecture logic' },
                      { label: 'Science', icon: <Atom className="text-blue-400" />, desc: 'Theoretical & Applied' },
                      { label: 'Humanities', icon: <BookOpen className="text-emerald-400" />, desc: 'Deep cultural context' },
                    ].map((f, i) => (
                      <div key={i} className="p-8 bg-white/5 rounded-[40px] border border-white/5 hover:border-white/10 transition-all shadow-xl group">
                         <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-white/10 transition-colors">{f.icon}</div>
                         <h4 className="text-xs font-black uppercase tracking-widest mb-3 text-white">{f.label}</h4>
                         <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{f.desc}</p>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          )}
        </div>

        <footer className="h-10 border-t border-white/5 flex items-center justify-between px-8 bg-slate-950 z-50">
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Logic Nominal</span></div>
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /><span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Active Link</span></div>
           </div>
           <div className="text-[9px] uppercase font-black tracking-[0.4em] text-slate-700">VERA-CORE v6.2.0-WEBSITE-TRANSITION</div>
        </footer>
      </main>
    </div>
  );
};

export default App;
