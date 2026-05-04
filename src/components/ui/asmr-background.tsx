"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

export const AsmrBackground = () => {
  const [count, setCount] = useState(0);

  return (
    <div className={cn("flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl")}>
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-indigo-500 bg-clip-text text-transparent">
        Interactive Counter
      </h1>
      <div className="text-6xl font-black text-white tabular-nums drop-shadow-glow">
        {count}
      </div>
      <div className="flex gap-4">
        <button 
          onClick={() => setCount((prev) => prev - 1)}
          className="w-14 h-14 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all active:scale-95 text-2xl font-bold"
        >
          -
        </button>
        <button 
          onClick={() => setCount((prev) => prev + 1)}
          className="w-14 h-14 flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black transition-all active:scale-95 text-2xl font-bold shadow-lg shadow-emerald-500/20"
        >
          +
        </button>
      </div>
    </div>
  );
};
