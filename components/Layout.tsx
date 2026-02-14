
import React from 'react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 bg-[radial-gradient(circle_at_center,_#0f172a_0%,_#020617_100%)]">
      <header className="fixed top-0 left-0 w-full p-6 flex justify-between items-center z-50 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500/50 flex items-center justify-center rotate-45 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <div className="w-5 h-5 bg-blue-500 -rotate-45"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black tracking-tighter text-white uppercase leading-none">MF-PROOF-OF-LIFE</h1>
            <span className="text-[10px] text-blue-500/70 font-mono tracking-widest">PROTOCOL VERSION 4.1.0</span>
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.3em] hidden md:block">
          STATUS: <span className="text-emerald-500 animate-pulse">ENCRYPTED_CONNECTION</span>
        </div>
      </header>
      
      <main className="w-full max-w-5xl relative z-10">
        {children}
      </main>

      <footer className="fixed bottom-0 w-full p-6 flex justify-between pointer-events-none">
        <p className="text-[8px] font-mono text-slate-700 tracking-[0.4em] uppercase">
          Biometric hash: 0x9f2a...8c11
        </p>
        <p className="text-[8px] font-mono text-slate-700 tracking-[0.4em] uppercase">
          Zero-Knowledge Execution
        </p>
      </footer>
    </div>
  );
};
