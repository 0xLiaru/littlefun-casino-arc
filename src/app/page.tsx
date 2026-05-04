import { PlinkoGame } from "@/components/game/PlinkoGame";
import { GameCard } from "@/components/ui/GameCard";
import { Trophy, Wallet, Activity, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen w-full bg-[#050507] text-white selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Background Glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Navigation Header */}
      <nav className="relative z-50 border-b border-white/5 bg-black/20 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-black text-black text-xl shadow-lg shadow-emerald-500/20">L</div>
            <span className="text-xl font-black tracking-tighter uppercase">Little<span className="text-emerald-500">Fun</span></span>
          </div>
          <div className="flex items-center gap-6">
             <div className="hidden md:flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Secure</span>
                <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-blue-400" /> Live Stats</span>
             </div>
             <button className="bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Connect Wallet</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Welcome Section */}
        <div className="mb-16 text-center md:text-left">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 leading-tight">
            THE PREMIUM <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">WEB3 CASINO.</span>
          </h1>
          <p className="text-white/40 max-w-xl text-sm font-medium leading-relaxed">
            Experience next-generation gaming with provably fair mechanics, instant on-chain payouts, and an exclusive community of winners.
          </p>
        </div>

        {/* Featured Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
            <div className="group relative bg-white/5 border border-white/10 rounded-[2.5rem] p-8 hover:bg-white/[0.07] transition-all overflow-hidden cursor-pointer" onClick={() => window.location.href='/plinko.html'}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl -mr-32 -mt-32 group-hover:bg-emerald-500/20 transition-all" />
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
                        <Trophy className="text-emerald-500 w-6 h-6" />
                    </div>
                    <h2 className="text-3xl font-black mb-2 tracking-tight">ARCIKO</h2>
                    <p className="text-white/40 text-sm mb-8 font-medium">Classic Plinko mechanics reimagined for the blockchain.</p>
                    <div className="flex gap-2">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-3 py-1 rounded-full uppercase">1000x Multiplier</span>
                        <span className="bg-white/5 text-white/40 text-[9px] font-black px-3 py-1 rounded-full uppercase">Provably Fair</span>
                    </div>
                </div>
            </div>

            <div className="group relative bg-white/5 border border-white/10 rounded-[2.5rem] p-8 hover:bg-white/[0.07] transition-all overflow-hidden cursor-pointer" onClick={() => window.location.href='/blackjack.html'}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl -mr-32 -mt-32 group-hover:bg-blue-500/20 transition-all" />
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6">
                        <Wallet className="text-blue-400 w-6 h-6" />
                    </div>
                    <h2 className="text-3xl font-black mb-2 tracking-tight">BLACKJACK</h2>
                    <p className="text-white/40 text-sm mb-8 font-medium">Professional high-stakes 21. Win big, instantly.</p>
                    <div className="flex gap-2">
                        <span className="bg-blue-500/10 text-blue-400 text-[9px] font-black px-3 py-1 rounded-full uppercase">Instant Payouts</span>
                        <span className="bg-white/5 text-white/40 text-[9px] font-black px-3 py-1 rounded-full uppercase">Premium UI</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Live Action Section */}
        <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/40 pointer-events-none" />
             <div className="relative z-10 flex flex-col items-center">
                <div className="mb-12 text-center">
                    <h2 className="text-4xl font-black tracking-tighter mb-2 italic">LIVE PLINKO ACTION</h2>
                    <div className="w-20 h-1 bg-emerald-500 mx-auto rounded-full" />
                </div>
                <div className="w-full">
                    <PlinkoGame />
                </div>
             </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tighter uppercase opacity-40 italic">LITTLE<span className="text-emerald-500">FUN</span> © 2026</span>
            </div>
            <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-white/20">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
                <a href="#" className="hover:text-white transition-colors">Support</a>
                <a href="#" className="hover:text-white transition-colors">Twitter</a>
            </div>
        </div>
      </footer>
    </main>
  );
}
