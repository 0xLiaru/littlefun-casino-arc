"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ethers } from 'ethers';
import * as Matter from 'matter-js';
import { cn } from '@/lib/utils';

// Contract Config (Dinamik olarak contract-config.js'den de okunabilir ama React içinde sabit tutmak daha güvenli)
const ABI = [
    "function playMultiple(uint256 count, uint8 difficulty) external payable", 
    "function withdraw() external", "function deposit() external payable", "function owner() public view returns (address)",
    "event GameResult(address indexed player, uint256 amountIn, uint256 amountOut, uint256 multiplierScaled, uint256 slotIndex, uint8 difficulty)"
];

const diffData = [
    { name: 'EASY', mults: ['2x','1.5x','1x','0.5x','0.2x','0.1x','0.1x','0.1x','0.2x','0.5x','1x','1.5x','2x'], colors: ['#10b981','#10b981','#10b981','#94a3b8','#475569','#475569','#f43f5e','#475569','#475569','#94a3b8','#10b981','#10b981','#10b981'] },
    { name: 'MEDIUM', mults: ['8x','4x','2x','1.5x','1x','0.5x','0.2x','0.5x','1x','1.5x','2x','4x','8x'], colors: ['#fbbf24','#fbbf24','#fbbf24','#10b981','#94a3b8','#475569','#f43f5e','#475569','#94a3b8','#10b981','#fbbf24','#fbbf24','#fbbf24'] },
    { name: 'HARD', mults: ['1000x','100x','5x','1x','0.1x','0.1x','0.1x','0.1x','0.1x','1x','5x','100x','1000x'], colors: ['#f43f5e','#f43f5e','#fbbf24','#10b981','#475569','#475569','#475569','#475569','#475569','#10b981','#fbbf24','#f43f5e','#f43f5e'] }
];

export const PlinkoGame = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Matter.Engine | null>(null);
    const [balance, setBalance] = useState("0.0000");
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [difficulty, setDifficulty] = useState(0);
    const [betAmount, setBetAmount] = useState("0.1");
    const [ballCount, setBallCount] = useState(5);
    const [isAuto, setIsAuto] = useState(false);
    const [stats, setStats] = useState({ bet: 0, win: 0 });
    const [contract, setContract] = useState<ethers.Contract | null>(null);
    const [history, setHistory] = useState<any[]>([]);

    // Matter.js Initialization
    useEffect(() => {
        if (!canvasRef.current) return;

        const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;
        const engine = Engine.create();
        engineRef.current = engine;
        engine.gravity.y = 1.2;

        const render = Render.create({
            canvas: canvasRef.current,
            engine: engine,
            options: { width: 600, height: 600, wireframes: false, background: 'transparent' }
        });

        const pinSpacing = 44;
        const xOffset = (600 - 13 * pinSpacing) / 2;

        // Pins
        for (let i = 0; i < 12; i++) {
            const rowPins = i + 3;
            const rowOffset = (600 - (rowPins - 1) * pinSpacing) / 2;
            for (let j = 0; j < rowPins; j++) {
                Composite.add(engine.world, Bodies.circle(rowOffset + j * pinSpacing, 60 + i * 42, 3, {
                    isStatic: true,
                    restitution: 0.8,
                    friction: 0.1,
                    render: { fillStyle: '#ffffff20' }
                }));
            }
        }

        // Sensors
        for (let i = 0; i < 13; i++) {
            Composite.add(engine.world, Bodies.rectangle(xOffset + i * pinSpacing + (pinSpacing / 2), 560, 40, 60, {
                isSensor: true,
                isStatic: true,
                render: { fillStyle: 'transparent' },
                label: 's_' + i
            }));
        }

        // Collision Events
        Events.on(engine, 'collisionStart', (e) => {
            e.pairs.forEach(p => {
                const labels = [p.bodyA.label, p.bodyB.label];
                const sensorLabel = labels.find(l => l.startsWith('s_'));
                if (sensorLabel) {
                    const ball = p.bodyA.label === sensorLabel ? p.bodyB : p.bodyA;
                    if (ball.label === 'ball') {
                        const slotIdx = parseInt(sensorLabel.split('_')[1]);
                        // @ts-ignore
                        handleBallHit(slotIdx, ball.payout, ball.mult);
                        Composite.remove(engine.world, ball);
                    }
                }
            });
        });

        // Guidance Logic
        Events.on(engine, 'beforeUpdate', () => {
            const balls = Composite.allBodies(engine.world).filter(b => b.label === 'ball');
            balls.forEach(ball => {
                // @ts-ignore
                if (ball.position.y > 480 && ball.targetX) {
                    // @ts-ignore
                    Body.setVelocity(ball, { x: ball.velocity.x * 0.95 + (ball.targetX - ball.position.x) * 0.05, y: ball.velocity.y });
                }
            });
        });

        Render.run(render);
        const runner = Runner.create();
        Runner.run(runner, engine);

        return () => {
            Render.stop(render);
            Engine.clear(engine);
        };
    }, []);

    const handleBallHit = (idx: number, payout: number, mult: number) => {
        setStats(prev => ({ ...prev, win: prev.win + payout }));
        setHistory(prev => [{ time: new Date().toLocaleTimeString(), bet: (payout/mult).toFixed(3), mult, payout: payout.toFixed(3) }, ...prev].slice(0, 10));
    };

    const connectWallet = async () => {
        if (!window.ethereum) return alert("MetaMask not found!");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const signer = await provider.getSigner();
        setWalletAddress(accounts[0]);
        
        // Bu adresi contract-config.js'den almaliyiz
        const addr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
        const c = new ethers.Contract(addr, ABI, signer);
        setContract(c);
        updateBalance(provider, accounts[0]);
    };

    const updateBalance = async (provider: any, addr: string) => {
        const b = await provider.getBalance(addr);
        setBalance(parseFloat(ethers.formatEther(b)).toFixed(4));
    };

    const play = async () => {
        if (!contract) return;
        const totalVal = ethers.parseEther((parseFloat(betAmount) * ballCount).toString());
        setStats(prev => ({ ...prev, bet: prev.bet + parseFloat(betAmount) * ballCount }));
        
        try {
            const tx = await contract.playMultiple(ballCount, difficulty, { value: totalVal, gasLimit: 1200000 });
            const receipt = await tx.wait();
            const iface = new ethers.Interface(ABI);
            
            receipt.logs.forEach((l: any) => {
                const p = iface.parseLog(l);
                if (p && p.name === "GameResult") {
                    const s = Number(p.args.slotIndex);
                    const m = Number(p.args.multiplierScaled) / 100;
                    spawnBall(s, m, parseFloat(ethers.formatEther(p.args.amountOut)));
                }
            });
        } catch (e) { console.error(e); }
    };

    const spawnBall = (slotIndex: number, mult: number, payout: number) => {
        if (!engineRef.current) return;
        const { Bodies, Composite, Body } = Matter;
        const xOffset = (600 - 13 * 44) / 2;
        
        // Visual slot mapping
        let visualSlot = slotIndex;
        if (slotIndex === 0) visualSlot = Math.random() > 0.5 ? 0 : 12;
        else if (slotIndex === 1) visualSlot = Math.random() > 0.5 ? 1 : 11;
        else if (slotIndex === 2) visualSlot = Math.random() > 0.5 ? 2 : 10;
        else if (slotIndex === 3) visualSlot = Math.random() > 0.5 ? 3 : 9;
        else if (slotIndex === 4) visualSlot = Math.random() > 0.5 ? 4 : 8;
        else if (slotIndex === 5) visualSlot = Math.random() > 0.5 ? 5 : 7;
        else visualSlot = 6;

        const ball = Bodies.circle(300 + (Math.random() * 10 - 5), 5, 8, {
            restitution: 0.5,
            friction: 0.001,
            label: 'ball',
            render: { fillStyle: '#10b981' }
        });

        // @ts-ignore
        ball.payout = payout; ball.mult = mult; 
        // @ts-ignore
        ball.targetX = xOffset + visualSlot * 44 + (44 / 2);
        
        Composite.add(engineRef.current.world, ball);
        Body.setVelocity(ball, { x: (Math.random() - 0.5) * 2, y: 2 });
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center w-full max-w-7xl mx-auto p-4 relative z-30">
            {/* Sidebar Controls */}
            <div className="w-full lg:w-[350px] space-y-6">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-white/40 text-[10px] tracking-widest uppercase font-bold">Wallet</span>
                        <span className="text-emerald-400 font-mono font-bold">{balance} ETH</span>
                    </div>

                    {!walletAddress ? (
                        <button onClick={connectWallet} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                            CONNECT WALLET
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Difficulty</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {diffData.map((d, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => setDifficulty(i)}
                                            className={cn("py-3 rounded-xl font-bold text-[10px] transition-all border", 
                                                difficulty === i ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                                            )}
                                        >
                                            {d.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Bet Amount (ETH)</label>
                                <input 
                                    type="number" 
                                    value={betAmount} 
                                    onChange={(e) => setBetAmount(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Balls</label>
                                <input 
                                    type="number" 
                                    value={ballCount} 
                                    onChange={(e) => setBallCount(parseInt(e.target.value))}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
                                />
                            </div>

                            <button onClick={play} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                DROP BALLS
                            </button>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex justify-between items-center">
                    <div>
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Total Win</div>
                        <div className="text-xl font-black text-white">{stats.win.toFixed(3)} ETH</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Profit</div>
                        <div className={cn("text-xl font-black", stats.win > stats.bet ? "text-emerald-400" : "text-white/60")}>
                            {(stats.bet > 0 ? stats.win / stats.bet : 0).toFixed(2)}x
                        </div>
                    </div>
                </div>
            </div>

            {/* Game Canvas Area */}
            <div className="flex-1 w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 shadow-2xl flex flex-col items-center">
                <div className="relative">
                    <canvas ref={canvasRef} className="max-w-full h-auto" />
                    {/* Multipliers UI */}
                    <div className="flex justify-center w-full gap-1 mt-[-60px]">
                        {diffData[difficulty].mults.map((m, i) => (
                            <div 
                                key={i} 
                                className="w-[42px] h-[42px] rounded-lg border border-white/5 flex items-center justify-center text-[8px] font-black transition-all"
                                style={{ backgroundColor: diffData[difficulty].colors[i] + '20', color: diffData[difficulty].colors[i], borderColor: diffData[difficulty].colors[i] + '40' }}
                            >
                                {m}
                            </div>
                        ))}
                    </div>
                </div>

                {/* History Table */}
                <div className="w-full mt-12 overflow-hidden rounded-2xl border border-white/5">
                    <table className="w-full text-left text-[10px] uppercase font-bold tracking-widest">
                        <thead className="bg-white/5 text-white/40">
                            <tr>
                                <th className="p-4">Time</th>
                                <th className="p-4">Bet</th>
                                <th className="p-4">Mult</th>
                                <th className="p-4">Payout</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {history.map((h, i) => (
                                <tr key={i} className="text-white/80">
                                    <td className="p-4 opacity-40">{h.time}</td>
                                    <td className="p-4">{h.bet} ETH</td>
                                    <td className={cn("p-4", h.mult >= 1 ? "text-emerald-400" : "text-rose-400")}>{h.mult}x</td>
                                    <td className={cn("p-4", h.mult >= 1 ? "text-emerald-400" : "text-rose-400")}>{h.payout} ETH</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
