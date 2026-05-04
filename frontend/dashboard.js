const API = 'http://localhost:3001/api';
let walletAddress = null;
let ethPrice = 3500;
let userData = null;

function switchTab(id, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');
}

async function init() {
    if (localStorage.getItem('isLoggedIn') !== 'true') { location.href = 'index.html'; return; }
    walletAddress = localStorage.getItem('walletAddress');
    
    // Fetch ETH price (backend proxy → CoinGecko direct fallback)
    try {
        const r = await fetch(API + '/eth-price'); const d = await r.json(); ethPrice = d.usd;
    } catch(e) {
        try { const r2 = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'); const d2 = await r2.json(); ethPrice = d2.ethereum.usd; } catch(e2) { console.log('ETH price fetch failed'); }
    }
    console.log('ETH Price: $' + ethPrice);

    // Fetch/create user from backend
    try {
        const r = await fetch(API + '/user/' + walletAddress);
        userData = await r.json();
    } catch(e) { console.error('API error:', e); userData = null; }

    renderUI();
    updateBalance();
}

function renderUI() {
    if (!userData) return;
    const name = userData.displayName || 'Player';
    document.getElementById('userName').innerText = name;
    document.getElementById('nameIn').value = userData.displayName || '';
    document.getElementById('emailIn').value = userData.email || '';
    
    // Parse phone: stored as "+90 5551234567"
    if (userData.phone) {
        const parts = userData.phone.match(/^(\+\d+)\s(.+)$/);
        if (parts) {
            document.getElementById('countryCode').value = parts[1];
            document.getElementById('phoneIn').value = parts[2];
        } else {
            document.getElementById('phoneIn').value = userData.phone;
        }
    }
    document.getElementById('reLink').value = 'https://littlefun.io/join/' + walletAddress.slice(2,10);

    // Email status
    if (userData.emailVerified && userData.email) {
        document.getElementById('emailStatus').innerHTML = '✅ <span style="color:#238636">' + userData.email + ' doğrulandı</span>';
        document.getElementById('sendCodeBtn').style.display = 'none';
    }

    // Stats
    document.getElementById('stWager').innerText = (userData.totalWageredETH || 0).toFixed(4) + ' ETH';
    document.getElementById('stWon').innerText = (userData.totalWonETH || 0).toFixed(4) + ' ETH';
    document.getElementById('stGames').innerText = userData.totalGames || 0;

    // Tier
    renderTier(userData.tierInfo || { tier:'bronze', tierName:'Bronze', xp:0, tierMin:0, tierMax:10000, progress:0 });

    // Games history
    renderGames(userData.gameHistory || []);
    
    // Transaction history
    loadTx();

    // 2FA status
    render2FA();
}

function renderTier(info) {
    const banner = document.getElementById('tierBanner');
    banner.className = 'tier-banner ' + info.tier + '-tier';
    
    const icons = { bronze:'🥉', silver:'🥈', gold:'🥇' };
    document.getElementById('tierIcon').innerText = icons[info.tier];
    document.getElementById('tierName').innerText = info.tierName.toUpperCase() + ' TIER';
    document.getElementById('xpDisplay').innerText = info.xp.toLocaleString() + ' / ' + info.tierMax.toLocaleString() + ' XP';
    document.getElementById('progressFill').style.width = info.progress.toFixed(1) + '%';
    
    const remaining = info.tierMax - info.xp;
    if (info.tier === 'gold' && info.xp >= 1000000) {
        document.getElementById('tierSub').innerText = '🏆 MAX LEVEL — Tebrikler!';
    } else {
        const nextTier = info.tier === 'bronze' ? 'Silver' : info.tier === 'silver' ? 'Gold' : 'MAX';
        document.getElementById('tierSub').innerText = nextTier + "'a " + remaining.toLocaleString() + ' XP kaldı';
    }
}

function renderGames(games) {
    const tbody = document.getElementById('gamesList');
    tbody.innerHTML = games.map(g => {
        const cls = g.result === 'win' ? 'green' : 'red';
        const d = new Date(g.date).toLocaleString('tr-TR');
        return `<tr><td>${g.gameName}</td><td class="muted">${d}</td><td>${g.betETH} ETH</td><td class="${cls}">${g.multiplier}x</td><td class="${cls}">${g.payoutETH} ETH</td><td>+${g.xpEarned}</td></tr>`;
    }).join('');
}

async function convertToUSD(id) {
    const el = document.getElementById(id);
    const ethVal = parseFloat(el.innerText);
    if (isNaN(ethVal)) return;
    const usd = (ethVal * ethPrice).toFixed(2);
    document.getElementById(id + '_usd').innerText = '≈ $' + Number(usd).toLocaleString() + ' USD (1 ETH = $' + ethPrice.toLocaleString() + ')';
}

async function updateBalance() {
    if (window.ethereum) {
        try {
            const p = new ethers.BrowserProvider(window.ethereum);
            const b = await p.getBalance(walletAddress);
            document.getElementById('balanceBadge').innerText = parseFloat(ethers.formatEther(b)).toFixed(3) + ' ETH';
        } catch(e) {}
    }
}

// Display name availability check
let nameTimer = null;
async function checkName() {
    clearTimeout(nameTimer);
    const name = document.getElementById('nameIn').value.trim();
    const st = document.getElementById('nameStatus');
    if (!name || name.length < 2) { st.innerText = ''; return; }
    st.innerText = '⏳';
    nameTimer = setTimeout(async () => {
        try {
            const r = await fetch(API + '/check-name/' + encodeURIComponent(name) + '?address=' + walletAddress);
            const d = await r.json();
            st.innerText = d.available ? '✅' : '❌';
        } catch(e) { st.innerText = '⚠️'; }
    }, 500);
}

// Email verification
async function sendCode() {
    const email = document.getElementById('emailIn').value.trim();
    if (!email || !email.includes('@')) { alert('Geçerli bir email girin!'); return; }
    
    document.getElementById('sendCodeBtn').disabled = true;
    document.getElementById('sendCodeBtn').innerText = 'Gönderiliyor...';
    
    try {
        const r = await fetch(API + '/user/send-verification', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress, email })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('verifySection').style.display = 'flex';
            document.getElementById('emailStatus').innerHTML = '📧 <span style="color:var(--primary)">' + email + ' adresine kod gönderildi</span>';
            if (d.devMode && d.devCode) {
                document.getElementById('emailStatus').innerHTML += '<br><small style="color:var(--muted)">Dev Mode Kod: ' + d.devCode + '</small>';
            }
        } else {
            document.getElementById('emailStatus').innerHTML = '❌ ' + (d.error || 'Hata oluştu');
        }
    } catch(e) {
        document.getElementById('emailStatus').innerHTML = '❌ Sunucu bağlantı hatası';
    }
    document.getElementById('sendCodeBtn').disabled = false;
    document.getElementById('sendCodeBtn').innerText = 'Kod Gönder';
}

async function verifyCode() {
    const code = document.getElementById('codeIn').value.trim();
    if (code.length !== 6) { alert('6 haneli kodu girin!'); return; }
    try {
        const r = await fetch(API + '/user/verify-email', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress, code })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('emailStatus').innerHTML = '✅ <span style="color:#238636">Email başarıyla doğrulandı!</span>';
            document.getElementById('verifySection').style.display = 'none';
            document.getElementById('sendCodeBtn').style.display = 'none';
        } else {
            document.getElementById('emailStatus').innerHTML = '❌ <span style="color:var(--red)">' + d.error + '</span>';
        }
    } catch(e) {
        document.getElementById('emailStatus').innerHTML = '❌ Sunucu hatası';
    }
}

async function saveProfile() {
    const name = document.getElementById('nameIn').value.trim();
    const phone = document.getElementById('phoneIn').value.trim();
    
    if (name) {
        try {
            const r = await fetch(API + '/user/profile', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ address: walletAddress, displayName: name })
            });
            const d = await r.json();
            if (d.error) { alert(d.error); return; }
        } catch(e) { alert('Bağlantı hatası!'); return; }
    }
    if (phone) {
        const countryCode = document.getElementById('countryCode').value;
        const fullPhone = countryCode + ' ' + phone;
        try { await fetch(API + '/user/phone', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ address: walletAddress, phone: fullPhone }) }); } catch(e) {}
    }
    
    localStorage.setItem('pName', name);
    alert('✅ Profil kaydedildi!');
    init();
}

async function loadTx() {
    try {
        const r = await fetch(API + '/user/' + walletAddress + '/transactions');
        const txs = await r.json();
        document.getElementById('txList').innerHTML = txs.map(t => {
            const cls = t.result === 'profit' ? 'green' : 'red';
            const d = new Date(t.date).toLocaleString('tr-TR');
            const txShort = t.txHash ? t.txHash.slice(0, 10) + '...' : '-';
            return `<tr><td class="muted">${d}</td><td>${t.gameName}</td><td>${t.ballCount}</td><td>${t.totalBetETH} ETH</td><td>${t.totalPayoutETH} ETH</td><td class="${cls}">${t.profit} ETH</td><td class="muted" style="font-size:11px">${txShort}</td></tr>`;
        }).join('');
    } catch(e) {
        console.log('Transactions fetch failed:', e);
    }
}

function copyLink() { document.getElementById('reLink').select(); document.execCommand('copy'); alert('Kopyalandı!'); }
function logout() { localStorage.clear(); location.href = 'index.html'; }

// ─── 2FA FUNCTIONS ───────────────────────────────
function render2FA() {
    const enabled = userData && userData.twoFactorEnabled;
    const statusEl = document.getElementById('tfaStatus');
    if (enabled) {
        statusEl.innerHTML = '✅ <span style="color:#238636">2FA Aktif — Hesabınız korunuyor</span>';
        document.getElementById('tfaSetupArea').style.display = 'none';
        document.getElementById('tfaQRArea').style.display = 'none';
        document.getElementById('tfaDisableArea').style.display = 'flex';
    } else {
        statusEl.innerHTML = '⚠️ <span style="color:#f85149">2FA Kapalı</span>';
        document.getElementById('tfaSetupArea').style.display = 'block';
        document.getElementById('tfaQRArea').style.display = 'none';
        document.getElementById('tfaDisableArea').style.display = 'none';
    }
}

async function setup2FA() {
    try {
        document.getElementById('tfaSetupBtn').disabled = true;
        document.getElementById('tfaSetupBtn').innerText = 'QR oluşturuluyor...';
        const r = await fetch(API + '/user/2fa/setup', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('tfaQRImg').src = d.qrCode;
            document.getElementById('tfaSecretDisplay').value = d.secret;
            document.getElementById('tfaQRArea').style.display = 'block';
            document.getElementById('tfaSetupArea').style.display = 'none';
        } else {
            alert('Hata: ' + (d.error || 'Bilinmeyen hata'));
        }
    } catch(e) {
        alert('Sunucu bağlantı hatası!');
    }
    document.getElementById('tfaSetupBtn').disabled = false;
    document.getElementById('tfaSetupBtn').innerText = '🔐 2FA Kurulumunu Başlat';
}

async function verify2FA() {
    const token = document.getElementById('tfaCodeIn').value.trim();
    if (token.length !== 6) { alert('6 haneli kodu girin!'); return; }
    try {
        const r = await fetch(API + '/user/2fa/verify', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress, token })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('tfaVerifyStatus').innerHTML = '✅ <span style="color:#238636">' + d.message + '</span>';
            setTimeout(() => init(), 1500);
        } else {
            document.getElementById('tfaVerifyStatus').innerHTML = '❌ <span style="color:var(--red)">' + d.error + '</span>';
        }
    } catch(e) {
        document.getElementById('tfaVerifyStatus').innerHTML = '❌ Sunucu hatası';
    }
}

async function disable2FA() {
    const token = document.getElementById('tfaDisableCode').value.trim();
    if (token.length !== 6) { alert('6 haneli kodu girin!'); return; }
    try {
        const r = await fetch(API + '/user/2fa/disable', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress, token })
        });
        const d = await r.json();
        if (d.success) { alert('2FA kapatıldı.'); init(); }
        else { alert(d.error); }
    } catch(e) { alert('Sunucu hatası!'); }
}

window.onload = init;
