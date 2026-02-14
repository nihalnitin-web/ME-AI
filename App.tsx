
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from './components/Layout';
import { CameraView } from './components/CameraView';
import { VerificationService } from './services/verificationService';
import { AppState, Challenge, FrameData, LandmarkData, VerificationResult } from './types';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [countdown, setCountdown] = useState(5);
  const [result, setResult] = useState<VerificationResult & { aiAudit?: string } | null>(null);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startVerification = () => {
    const newChallenge = VerificationService.generateChallenge();
    setChallenge(newChallenge);
    setFrames([]);
    setCountdown(5);
    setState(AppState.CHALLENGE);
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (countdown === 0 && state === AppState.CHALLENGE) {
      handleFinalize();
    }
  }, [countdown, state]);

  const handleFinalize = async () => {
    setState(AppState.VERIFYING);
    if (challenge) {
      // 1. Run local mathematical verification
      const localRes = VerificationService.verify(challenge, frames);
      
      // 2. Run AI Forensic Audit via Gemini
      let aiAuditSummary = "AI Audit skipped: connectivity issue.";
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const auditResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Perform a forensic liveness audit. 
            Challenge: Gesture ${challenge.gesture}, Expression ${challenge.expression}. 
            Data: ${frames.length} frames captured. 
            Local Result: ${localRes.success ? 'PASS' : 'FAIL'}. 
            Score: ${localRes.score}%.
            Summarize the authenticity of the temporal biometric stream in 2 sentences.`,
          config: {
            systemInstruction: "You are a high-security biometric auditor. Analyze the provided data for liveness and provide a professional, concise verdict."
          }
        });
        aiAuditSummary = auditResponse.text || "No audit notes recorded.";
      } catch (err) {
        console.error("AI Audit Error:", err);
      }

      setResult({ ...localRes, aiAudit: aiAuditSummary });
      setState(AppState.RESULT);
    }
  };

  const handleFrame = useCallback((landmarks: LandmarkData) => {
    if (state === AppState.CHALLENGE) {
      setFrames(prev => [...prev, { 
        timestamp: Date.now(), 
        eye_ratio: landmarks.eye_ratio, 
        landmarks 
      }]);
    }
  }, [state]);

  const reset = () => {
    setState(AppState.IDLE);
    setChallenge(null);
    setFrames([]);
    setResult(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <Layout>
      <div className="space-y-8 flex flex-col items-center">
        
        {state === AppState.IDLE && (
          <div className="text-center max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Access Control Protocol</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              To proceed, you must complete a multi-factor biometric challenge. This protocol verifies identity through dynamic gesture sequence and micro-expression analysis.
            </p>
            <button 
              onClick={startVerification}
              className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all hover:scale-105 shadow-[0_0_30px_rgba(37,99,235,0.4)] uppercase tracking-widest text-sm"
            >
              Initiate Biometric Link
            </button>
          </div>
        )}

        {(state === AppState.CHALLENGE || state === AppState.VERIFYING) && challenge && (
          <div className="w-full space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-stretch">
              <div className="flex-1">
                <CameraView isActive={state === AppState.CHALLENGE} onFrame={handleFrame} />
              </div>
              
              <div className="w-full md:w-80 flex flex-col gap-4">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex-1 flex flex-col justify-center">
                  <div className="mb-6">
                    <p className="text-[10px] text-slate-500 font-mono mb-1 uppercase tracking-widest">Protocol_ID</p>
                    <p className="text-xs font-mono text-blue-400">#{challenge.id.toUpperCase()}</p>
                  </div>
                  
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Target_Gesture</h4>
                      <p className="text-2xl font-bold text-white capitalize leading-tight">
                        {challenge.gesture.replace(/_/g, ' ')}
                      </p>
                      <div className="mt-2 h-1 w-12 bg-blue-500/50"></div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Target_Expression</h4>
                      <p className="text-2xl font-bold text-white capitalize leading-tight">
                        {challenge.expression}
                      </p>
                      <div className="mt-2 h-1 w-12 bg-blue-500/50"></div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-600 p-6 rounded-2xl text-center shadow-[0_0_20px_rgba(37,99,235,0.2)]">
                  <p className="text-[10px] text-blue-200 font-mono mb-1 uppercase tracking-widest">Window_Closes_In</p>
                  <p className="text-5xl font-black tabular-nums">{countdown}s</p>
                </div>
              </div>
            </div>

            {state === AppState.VERIFYING && (
              <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center backdrop-blur-md">
                <div className="text-center space-y-8">
                  <div className="relative w-32 h-32 mx-auto">
                    <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-4 border-2 border-blue-400/20 rounded-full animate-pulse"></div>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black tracking-widest uppercase">AI_Forensic_Audit</h3>
                    <p className="text-slate-400 font-mono text-sm mt-2">Checking EAR variance & temporal noise patterns...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {state === AppState.RESULT && result && (
          <div className="max-w-2xl w-full bg-slate-900 rounded-3xl border border-slate-800 p-10 shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className={`absolute -top-24 -left-24 w-64 h-64 rounded-full blur-[100px] opacity-20 ${result.success ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>

            <div className="flex flex-col items-center text-center mb-10 relative">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 border-4 ${result.success ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'bg-rose-500/10 text-rose-500 border-rose-500/30 shadow-[0_0_40px_rgba(244,63,94,0.2)]'}`}>
                {result.success ? (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                )}
              </div>
              
              <h2 className={`text-4xl font-black uppercase mb-3 tracking-tighter ${result.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.success ? 'Verification Success' : 'Security Breach'}
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-mono text-xs uppercase tracking-widest">Confidence_Score</span>
                <span className="text-white font-black text-xl">{result.score}%</span>
              </div>
            </div>

            <div className="space-y-4 mb-10">
              <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800">
                <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-4">Biometric_Logs</h4>
                <ul className="space-y-2">
                  {result.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-3 text-[11px] font-mono text-slate-400">
                      <span className={`w-1 h-1 mt-1.5 rounded-full ${result.success ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      <span className="opacity-80">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-blue-500/5 rounded-2xl p-6 border border-blue-500/20">
                <h4 className="text-[10px] font-mono text-blue-500 uppercase tracking-[0.3em] mb-4">AI_Forensic_Summary</h4>
                <p className="text-xs text-slate-300 italic leading-relaxed">
                  "{result.aiAudit}"
                </p>
              </div>
            </div>

            {result.success && result.token && (
              <div className="mb-10">
                <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-3">Ephemeral_Access_Token</h4>
                <div className="bg-slate-950 p-5 rounded-xl border border-blue-500/20 font-mono text-[10px] break-all text-blue-400/80 leading-relaxed select-all cursor-pointer hover:border-blue-500/40 transition-colors">
                  {result.token}
                </div>
              </div>
            )}

            <button 
              onClick={reset}
              className="w-full py-5 rounded-xl font-black bg-slate-800 hover:bg-slate-700 text-white transition-all uppercase tracking-widest text-xs shadow-lg hover:shadow-xl active:scale-95"
            >
              Terminate Session
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default App;
