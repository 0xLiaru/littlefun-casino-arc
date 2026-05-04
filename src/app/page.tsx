"use client";

import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lrekxibbwyeklpcgpyet.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZWt4aWJid3lla2xwY2dweWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4Nzc2MzAsImV4cCI6MjA5MzQ1MzYzMH0.wAnAkfN0n0Un-1kZ4skASTjfFdHWniMOUqNcXKMWo5I";
const API_URL = "https://lrekxibbwyeklpcgpyet.supabase.co/functions/v1";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function Home() {
    const [walletAddress, setWalletAddress] = useState("");
    const [balance, setBalance] = useState("0.000");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [liveWins, setLiveWins] = useState([]);

    useEffect(() => {
        const savedAddr = localStorage.getItem('walletAddress');
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (savedAddr && loggedIn) {
            setWalletAddress(savedAddr);
            setIsLoggedIn(true);
            updateBalance(savedAddr);
        }
        loadLiveWins();
        const interval = setInterval(loadLiveWins, 15000);
        return () => clearInterval(interval);
    }, []);

    const updateBalance = async (addr: string) => {
        if (window.ethereum) {
            try {
                const provider = new ethers.BrowserProvider(window.ethereum as any);
                const b = await provider.getBalance(addr);
                setBalance(parseFloat(ethers.formatEther(b)).toFixed(3));
            } catch (e) {
                console.error("Balance error:", e);
            }
        }
    };

    const loadLiveWins = async () => {
        try {
            const r = await fetch(API_URL + '/api/live-wins?limit=20');
            const data = await r.json();
            if (Array.isArray(data)) {
                setLiveWins(data);
            } else {
                console.log('Live wins data is not an array:', data);
                setLiveWins([]);
            }
        } catch (e) {
            console.log('Live wins error:', e);
            setLiveWins([]);
        }
    };

    const connectWallet = async (type: string) => {
        let eth = window.ethereum as any;
        if (type === 'okx') eth = (window as any).okxwallet || eth;
        if (!eth) return alert("Wallet not found!");
        
        try {
            const provider = new ethers.BrowserProvider(eth);
            const accs = await eth.request({ method: 'eth_requestAccounts' });
            const addr = accs[0];
            const signer = await provider.getSigner();
            await signer.signMessage("LITTLEFUN Verification");
            
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('walletAddress', addr);
            setWalletAddress(addr);
            setIsLoggedIn(true);
            setShowModal(false);
            updateBalance(addr);
        } catch (e) {
            console.error(e);
        }
    };

    const logout = () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('walletAddress');
        setIsLoggedIn(false);
        setWalletAddress("");
        window.location.reload();
    };

    const enterGame = (url: string) => {
        if (isLoggedIn) window.location.href = url;
        else {
            alert("Connect wallet first!");
            setShowModal(true);
        }
    };

    return (
        <div style={{ backgroundColor: '#0d1117', color: '#ffffff', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <header style={{ padding: '15px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', background: 'rgba(13, 17, 23, 0.9)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ fontSize: '24px', fontBold: 900, color: '#2081e2', fontWeight: 900, cursor: 'pointer' }}>LITTLEFUN</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {isLoggedIn && (
                        <div style={{ background: 'rgba(32, 129, 226, 0.1)', color: '#2081e2', padding: '8px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', border: '1px solid rgba(32, 129, 226, 0.2)' }}>
                            {balance} ETH
                        </div>
                    )}
                    {!isLoggedIn ? (
                        <button 
                            onClick={() => setShowModal(true)}
                            style={{ background: '#2081e2', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Connect wallet
                        </button>
                    ) : (
                        <button 
                            onClick={logout}
                            style={{ background: '#f85149', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                            {walletAddress.slice(0,6)}...{walletAddress.slice(-4)} (Logout)
                        </button>
                    )}
                </div>
            </header>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }} onClick={() => setShowModal(false)}>
                    <div style={{ background: '#1c2128', borderRadius: '28px', width: '420px', border: '1px solid #30363d', padding: '20px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <span style={{ fontWeight: 800, fontSize: '18px' }}>Connect your wallet</span>
                            <span style={{ cursor: 'pointer', fontSize: '20px' }} onClick={() => setShowModal(false)}>✕</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px', borderRadius: '18px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', marginBottom: '10px' }} onClick={() => connectWallet('metamask')}>
                            <div style={{ width: '32px', height: '32px' }}><svg viewBox="0 0 320 311"><path fill="#E17726" d="M304.5 34.3L166.4 1l-138.1 33.3 18.6 102.7 113.1-41.2 6.4 21.6-96.1 38.6 20.3 84.8 77.2-28.5 7.1 23.9-63.7 23.5L166.4 310l58.2-50.6-63.7-23.5 7.1-23.9 77.2 28.5 20.3-84.8-96.1-38.6 6.4-21.6 113.1 41.2z"/></svg></div>
                            <span style={{ fontWeight: 800 }}>MetaMask</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px', borderRadius: '18px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }} onClick={() => connectWallet('okx')}>
                            <div style={{ width: '32px', height: '32px' }}><svg viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="white"/><path d="M25 25h20v20H25zM55 25h20v20H55zM25 55h20v20H25zM55 55h20v20H55z" fill="black"/></svg></div>
                            <span style={{ fontWeight: 800 }}>OKX Wallet</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero */}
            <div style={{ padding: '60px 40px', maxWidth: '1200px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '44px', fontWeight: 900, marginBottom: '15px' }}>GAMES</h1>
            </div>

            {/* Game List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '0 40px 100px', maxWidth: '1200px', margin: '0 auto' }}>
                {/* Plinko Card */}
                <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', background: '#16181d', borderRadius: '20px', overflow: 'hidden' }}>
                    <div style={{ background: '#0a0b0e', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="https://lrekxibbwyeklpcgpyet.supabase.co/storage/v1/object/public/assets/arciko.png" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '36px', fontWeight: 900, color: '#2081e2' }}>ARCIKO</div>
                            <button onClick={() => enterGame('plinko.html')} style={{ background: '#2081e2', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Play Now</button>
                        </div>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>
                        <table style={{ width: '100%', fontSize: '14px' }}>
                            <tbody>
                                <tr><td style={{ color: '#8b949e' }}>GAME TYPE</td><td style={{ textAlign: 'right', fontWeight: 800 }}>Web3 Plinko</td></tr>
                                <tr><td style={{ color: '#8b949e' }}>FAIRNESS</td><td style={{ textAlign: 'right', color: '#10b981', fontWeight: 800 }}>Provably Fair ✅</td></tr>
                                <tr><td style={{ color: '#8b949e' }}>DESCRIPTION</td><td style={{ textAlign: 'right', color: '#8b949e' }}>On-chain ball drop with instant rewards.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Blackjack Card */}
                <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', background: '#16181d', borderRadius: '20px', overflow: 'hidden' }}>
                    <div style={{ background: '#0a0b0e', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="https://lrekxibbwyeklpcgpyet.supabase.co/storage/v1/object/public/assets/blackjack.png" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '36px', fontWeight: 900, color: '#10b981' }}>BLACKJACK</div>
                            <button onClick={() => enterGame('blackjack.html')} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Play Now</button>
                        </div>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>
                        <table style={{ width: '100%', fontSize: '14px' }}>
                            <tbody>
                                <tr><td style={{ color: '#8b949e' }}>GAME TYPE</td><td style={{ textAlign: 'right', fontWeight: 800 }}>Classic Casino</td></tr>
                                <tr><td style={{ color: '#8b949e' }}>FAIRNESS</td><td style={{ textAlign: 'right', color: '#10b981', fontWeight: 800 }}>Provably Fair ✅</td></tr>
                                <tr><td style={{ color: '#8b949e' }}>DESCRIPTION</td><td style={{ textAlign: 'right', color: '#8b949e' }}>Classic 21 card game. Hit, Stand, or Double Down.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Live Ticker */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', borderTop: '1px solid #30363d', padding: '10px 0', overflow: 'hidden', zIndex: 999 }}>
                <div style={{ display: 'flex', animation: 'tickerScroll 30s linear infinite', gap: '30px', whiteSpace: 'nowrap', paddingLeft: '100%' }}>
                    {!Array.isArray(liveWins) || liveWins.length === 0 ? (
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>🔴 LIVE Loading...</span>
                    ) : (
                        liveWins.map((w: any, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '12px', fontWeight: 700 }}>
                                <span style={{ color: '#2081e2' }}>{w.displayName}</span>
                                <span style={{ color: '#8b949e' }}>{w.gameType}</span>
                                <span style={{ color: w.payoutETH > w.betETH ? '#238636' : '#f85149', fontWeight: 900 }}>
                                    {w.payoutETH > w.betETH ? '+' : ''}{(w.payoutETH - w.betETH).toFixed(4)} ETH
                                </span>
                            </span>
                        ))
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes tickerScroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
            `}</style>
        </div>
    );
}
