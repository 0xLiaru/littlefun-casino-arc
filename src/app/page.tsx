import { PlinkoGame } from "@/components/game/PlinkoGame";

export default function Home() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-start py-12 px-4 bg-[#0a0a0c]">
      {/* Site Header */}
      <div className="relative z-30 mb-12 text-center">
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-2">
          ARC<span className="text-emerald-500">PLINKO</span>
        </h1>
        <p className="text-white/20 text-xs tracking-[0.5em] uppercase font-bold">
          Exclusive Web3 Gaming Experience
        </p>
      </div>

      {/* Main Game Interface */}
      <div className="w-full max-w-7xl relative z-30">
        <PlinkoGame />
      </div>

      {/* Footer Info */}
      <div className="mt-12 text-center">
        <p className="text-white/10 text-[9px] tracking-[0.4em] uppercase font-bold">
          Secure Smart Contracts • Provably Fair
        </p>
      </div>
    </main>
  );
}
