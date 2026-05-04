const API = 'http://localhost:3001/api';
let walletAddress = null;
let ethPrice = 3500;
let userData = null;

function switchTab(id, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');

    // Lazy load data for tabs
    if (id === 'leaderboard') loadLeaderboard();
    if (id === 'daily') loadDailyBonus();
    if (id === 'affiliates') loadReferralStats();
    if (id === 'fairness') loadProvablyFair();
}

async function init() {
    if (localStorage.getItem('isLoggedIn') !== 'true') { location.href = 'index.html'; return; }
    walletAddress = localStorage.getItem('walletAddress');

    // Fetch ETH price
    try {
        const r = await fetch(API + '/eth-price'); const d = await r.json(); ethPrice = d.usd;
    } catch(e) {
        try { const r2 = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'); const d2 = await r2.json(); ethPrice = d2.ethereum.usd; } catch(e2) {}
    }

    // Fetch/create user
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

    if (userData.phone) {
        const parts = userData.phone.match(/^(\+\d+)\s(.+)$/);
        if (parts) {
            document.getElementById('countryCode').value = parts[1];
            document.getElementById('phoneIn').value = parts[2];
        } else {
            document.getElementById('phoneIn').value = userData.phone;
        }
    }

    // Referral link
    const refCode = userData.referralCode || walletAddress.slice(2, 10);
    document.getElementById('reLink').value = 'https://littlefun.io/ref/' + refCode;

    // Email status
    if (userData.emailVerified && userData.email) {
        document.getElementById('emailStatus').innerHTML = '✅ <span style="color:#238636">' + userData.email + ' verified</span>';
        document.getElementById('sendCodeBtn').style.display = 'none';
    }

    // Stats
    document.getElementById('stWager').innerText = (userData.totalWageredETH || 0).toFixed(4) + ' ETH';
    document.getElementById('stWon').innerText = (userData.totalWonETH || 0).toFixed(4) + ' ETH';
    document.getElementById('stGames').innerText = userData.totalGames || 0;

    // Tier
    renderTier(userData.tierInfo || { tier:'bronze', tierName:'Bronze', xp:0, tierMin:0, tierMax:10000, progress:0 });

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
        document.getElementById('tierSub').innerText = '🏆 MAX LEVEL — Congratulations!';
    } else {
        const nextTier = info.tier === 'bronze' ? 'Silver' : info.tier === 'silver' ? 'Gold' : 'MAX';
        document.getElementById('tierSub').innerText = remaining.toLocaleString() + ' XP left until ' + nextTier;
    }
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

// ─── NAME CHECK ──────────────────────────────────────
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

// ─── EMAIL ──────────────────────────────────────────
async function sendCode() {
    const email = document.getElementById('emailIn').value.trim();
    if (!email || !email.includes('@')) { alert('Enter a valid email!'); return; }
    document.getElementById('sendCodeBtn').disabled = true;
    document.getElementById('sendCodeBtn').innerText = 'Sending...';
    try {
        const r = await fetch(API + '/user/send-verification', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress, email })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('verifySection').style.display = 'flex';
            document.getElementById('emailStatus').innerHTML = '📧 <span style="color:var(--primary)">Code sent to ' + email + '</span>';
            if (d.devMode && d.devCode) {
                document.getElementById('emailStatus').innerHTML += '<br><small style="color:var(--muted)">Dev Mode Code: ' + d.devCode + '</small>';
            }
        } else {
            document.getElementById('emailStatus').innerHTML = '❌ ' + (d.error || 'Error occurred');
        }
    } catch(e) {
        document.getElementById('emailStatus').innerHTML = '❌ Server connection error';
    }
    document.getElementById('sendCodeBtn').disabled = false;
    document.getElementById('sendCodeBtn').innerText = 'Send Code';
}

async function verifyCode() {
    const code = document.getElementById('codeIn').value.trim();
    if (code.length !== 6) { alert('Enter 6-digit code!'); return; }
    try {
        const r = await fetch(API + '/user/verify-email', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress, code })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('emailStatus').innerHTML = '✅ <span style="color:#238636">Email successfully verified!</span>';
            document.getElementById('verifySection').style.display = 'none';
            document.getElementById('sendCodeBtn').style.display = 'none';
        } else {
            document.getElementById('emailStatus').innerHTML = '❌ <span style="color:var(--red)">' + d.error + '</span>';
        }
    } catch(e) {
        document.getElementById('emailStatus').innerHTML = '❌ Server error';
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
        } catch(e) { alert('Connection error!'); return; }
    }
    if (phone) {
        const countryCode = document.getElementById('countryCode').value;
        const fullPhone = countryCode + ' ' + phone;
        try { await fetch(API + '/user/phone', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ address: walletAddress, phone: fullPhone }) }); } catch(e) {}
    }
    localStorage.setItem('pName', name);
    alert('✅ Profile saved!');
    init();
}

// ─── TRANSACTIONS ────────────────────────────────────
async function loadTx() {
    try {
        const r = await fetch(API + '/user/' + walletAddress + '/transactions');
        const txs = await r.json();
        document.getElementById('txList').innerHTML = txs.map(t => {
            const d = new Date(t.created_at).toLocaleString('en-US');
            const txShort = t.tx_hash ? t.tx_hash.slice(0, 14) + '...' : '-';
            const statusCls = t.status === 'completed' ? 'green' : 'muted';
            return `<tr><td class="muted">${d}</td><td>${t.tx_type || '-'}</td><td>${parseFloat(t.amount_eth || 0).toFixed(4)} ETH</td><td class="muted" style="font-size:11px;font-family:monospace">${txShort}</td><td class="${statusCls}">${t.status || '-'}</td></tr>`;
        }).join('');
    } catch(e) { console.log('Transactions fetch failed:', e); }
}

function copyLink() { document.getElementById('reLink').select(); document.execCommand('copy'); alert('Copied!'); }
function logout() { localStorage.clear(); location.href = 'index.html'; }

// ═══════════════════════════════════════════════════════════
// ─── 2FA ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

function render2FA() {
    const enabled = userData && userData.twoFactorEnabled;
    const statusEl = document.getElementById('tfaStatus');
    if (enabled) {
        statusEl.innerHTML = '✅ <span style="color:#238636">2FA Active — Your account is protected</span>';
        document.getElementById('tfaSetupArea').style.display = 'none';
        document.getElementById('tfaQRArea').style.display = 'none';
        document.getElementById('tfaDisableArea').style.display = 'flex';
    } else {
        statusEl.innerHTML = '⚠️ <span style="color:#f85149">2FA Disabled</span>';
        document.getElementById('tfaSetupArea').style.display = 'block';
        document.getElementById('tfaQRArea').style.display = 'none';
        document.getElementById('tfaDisableArea').style.display = 'none';
    }
}

async function setup2FA() {
    try {
        document.getElementById('tfaSetupBtn').disabled = true;
        document.getElementById('tfaSetupBtn').innerText = 'Creating QR...';
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
        } else { alert('Error: ' + (d.error || 'Unknown error')); }
    } catch(e) { alert('Server connection error!'); }
    document.getElementById('tfaSetupBtn').disabled = false;
    document.getElementById('tfaSetupBtn').innerText = '🔐 Start 2FA Setup';
}

async function verify2FA() {
    const token = document.getElementById('tfaCodeIn').value.trim();
    if (token.length !== 6) { alert('Enter 6-digit code!'); return; }
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
    } catch(e) { document.getElementById('tfaVerifyStatus').innerHTML = '❌ Server error'; }
}

async function disable2FA() {
    const token = document.getElementById('tfaDisableCode').value.trim();
    if (token.length !== 6) { alert('Enter 6-digit code!'); return; }
    try {
        const r = await fetch(API + '/user/2fa/disable', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress, token })
        });
        const d = await r.json();
        if (d.success) { alert('2FA disabled.'); init(); }
        else { alert(d.error); }
    } catch(e) { alert('Server error!'); }
}

// ═══════════════════════════════════════════════════════════
// ─── LEADERBOARD ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

async function loadLeaderboard() {
    try {
        const r = await fetch(API + '/leaderboard?limit=20');
        const data = await r.json();
        const tbody = document.getElementById('leaderboardBody');

        tbody.innerHTML = data.map(p => {
            const isMe = walletAddress && p.address.toLowerCase() === walletAddress.toLowerCase();
            const rowCls = isMe ? 'my-row' : '';
            let rankHTML;
            if (p.rank === 1) rankHTML = '<span class="rank-badge rank-1">1</span>';
            else if (p.rank === 2) rankHTML = '<span class="rank-badge rank-2">2</span>';
            else if (p.rank === 3) rankHTML = '<span class="rank-badge rank-3">3</span>';
            else rankHTML = '<span class="rank-badge rank-other">' + p.rank + '</span>';

            const tierCls = 'tier-' + p.tier;
            const tierIcons = { bronze:'🥉', silver:'🥈', gold:'🥇' };

            return `<tr class="${rowCls}">
                <td>${rankHTML}</td>
                <td><strong>${p.displayName}</strong>${isMe ? ' <span style="color:var(--primary);font-size:10px">(YOU)</span>' : ''}</td>
                <td><span class="tier-badge ${tierCls}">${tierIcons[p.tier] || ''} ${p.tier}</span></td>
                <td style="font-weight:900">${p.xp.toLocaleString()}</td>
                <td>${p.totalWagered.toFixed(3)} ETH</td>
                <td class="green">${p.totalWon.toFixed(3)} ETH</td>
                <td>${p.totalGames}</td>
            </tr>`;
        }).join('');

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:40px">No players yet. Be the first! 🎮</td></tr>';
        }
    } catch(e) { console.error('Leaderboard error:', e); }
}

// ═══════════════════════════════════════════════════════════
// ─── DAILY BONUS ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

const DAILY_REWARDS_USD = [0.01, 0.02, 0.05, 0.10, 0.20, 0.50, 1.00];

function loadDailyBonus() {
    const streak = userData?.dailyStreak || 0;
    const bonusETH = userData?.bonusBalanceETH || 0;
    document.getElementById('streakNumber').innerText = streak;

    // Show bonus balance
    const statusEl = document.getElementById('dailyStatus');
    const withdrawBtn = document.getElementById('dailyWithdrawBtn');
    if (bonusETH > 0.00000001) {
        const bonusUSD = (bonusETH * ethPrice).toFixed(2);
        statusEl.innerHTML = `💰 Bonus Balance: <strong class="green">${bonusETH.toFixed(6)} ETH</strong> <span class="muted">(≈ $${bonusUSD})</span>`;
        withdrawBtn.style.display = 'block';
    } else {
        withdrawBtn.style.display = 'none';
    }

    const grid = document.getElementById('dailyRewardsGrid');
    grid.innerHTML = '';
    for (let i = 1; i <= 7; i++) {
        const usd = DAILY_REWARDS_USD[i - 1];
        const usdLabel = usd < 1 ? (usd * 100) + '¢' : '$' + usd.toFixed(2);
        let cls = 'day-box';
        let icon = '🎁';
        if (i <= streak) { cls += ' claimed'; icon = '✅'; }
        else if (i === streak + 1) { cls += ' current'; icon = '🎁'; }
        grid.innerHTML += `<div class="${cls}"><div class="day-num">Day ${i}</div><div class="day-xp">${usdLabel}</div><div class="day-icon">${icon}</div></div>`;
    }

    // Check if already claimed
    if (userData?.lastDailyClaim) {
        const last = new Date(userData.lastDailyClaim);
        const now = new Date();
        const hoursSince = (now - last) / (1000 * 60 * 60);
        if (hoursSince < 24) {
            const btn = document.getElementById('dailyClaimBtn');
            btn.disabled = true;
            btn.innerText = '⏳ Already claimed today!';
            const next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
            const bonusLine = bonusETH > 0 ? `<br>💰 Bonus Balance: <strong class="green">${bonusETH.toFixed(6)} ETH</strong> <span class="muted">(≈ $${(bonusETH * ethPrice).toFixed(2)})</span>` : '';
            document.getElementById('dailyStatus').innerHTML = 'Next reward: <strong>' + next.toLocaleString('en-US') + '</strong>' + bonusLine;
        }
    }
}

async function claimDaily() {
    const btn = document.getElementById('dailyClaimBtn');
    btn.disabled = true;
    btn.innerText = '⏳ Processing...';
    try {
        const r = await fetch(API + '/daily-bonus/claim', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress })
        });
        const d = await r.json();
        if (d.success) {
            const usdLabel = d.rewardUSD < 1 ? (d.rewardUSD * 100) + '¢' : '$' + d.rewardUSD.toFixed(2);
            document.getElementById('dailyStatus').innerHTML = `🎉 <span class="green">You won <strong>${usdLabel}</strong>! (${d.rewardETH.toFixed(6)} ETH)</span><br>💰 Total Bonus: <strong>${d.totalBonusETH.toFixed(6)} ETH</strong> | Streak: ${d.streak}/7 days`;
            btn.innerText = '✅ Claimed!';
            setTimeout(() => init(), 2000);
        } else if (d.error === 'already_claimed') {
            btn.innerText = '⏳ Already claimed today!';
            const next = new Date(d.nextClaim);
            document.getElementById('dailyStatus').innerHTML = 'Next reward: <strong>' + next.toLocaleString('en-US') + '</strong>';
        } else {
            document.getElementById('dailyStatus').innerHTML = '❌ ' + (d.error || 'Error');
            btn.disabled = false;
            btn.innerText = '🎁 Claim Daily Reward!';
        }
    } catch(e) {
        document.getElementById('dailyStatus').innerHTML = '❌ Server error';
        btn.disabled = false;
        btn.innerText = '🎁 Claim Daily Reward!';
    }
}

async function withdrawBonus() {
    const btn = document.getElementById('dailyWithdrawBtn');
    if (!confirm('Are you sure you want to withdraw your bonus balance to your wallet?')) return;
    
    btn.disabled = true;
    btn.innerText = '⏳ Transaction Sending...';
    try {
        const r = await fetch(API + '/daily-bonus/withdraw', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress })
        });
        const d = await r.json();
        if (d.success) {
            alert(`✅ Success! ${d.amount.toFixed(6)} ETH sent to your wallet.\nTX: ${d.txHash}`);
            init(); // Refresh data
        } else {
            alert('❌ Error: ' + (d.error || 'Unknown error'));
            btn.disabled = false;
            btn.innerText = '💸 Withdraw Bonus Balance to Wallet';
        }
    } catch(e) {
        alert('❌ Server error!');
        btn.disabled = false;
        btn.innerText = '💸 Withdraw Bonus Balance to Wallet';
    }
}

// ═══════════════════════════════════════════════════════════
// ─── REFERRAL SYSTEM ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

async function loadReferralStats() {
    try {
        const r = await fetch(API + '/referral/' + walletAddress + '/stats');
        const stats = await r.json();

        document.getElementById('affEarnings').innerText = (stats.totalEarnings || 0).toFixed(4) + ' ETH';
        document.getElementById('affCount').innerText = stats.referralCount || 0;

        // Update referral link
        const refCode = stats.referralCode || '';
        document.getElementById('reLink').value = 'https://littlefun.io/ref/' + refCode;

        // Referral list
        if (stats.referrals && stats.referrals.length > 0) {
            document.getElementById('refListCard').style.display = 'block';
            document.getElementById('refListBody').innerHTML = stats.referrals.map(r => {
                const d = new Date(r.joinedAt).toLocaleDateString('en-US');
                return `<tr><td>${r.displayName} <span class="muted">(${r.address})</span></td><td>${r.xp.toLocaleString()}</td><td class="muted">${d}</td></tr>`;
            }).join('');
        }
    } catch(e) { console.error('Referral stats error:', e); }
}

async function applyRef() {
    const code = document.getElementById('refCodeInput').value.trim();
    if (!code) { alert('Enter referral code!'); return; }
    try {
        const r = await fetch(API + '/referral/apply', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress, referralCode: code })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('refApplyStatus').innerHTML = '✅ <span class="green">' + d.message + '</span>';
            setTimeout(() => init(), 1500);
        } else {
            document.getElementById('refApplyStatus').innerHTML = '❌ <span class="red">' + (d.error || 'Error') + '</span>';
        }
    } catch(e) {
        document.getElementById('refApplyStatus').innerHTML = '❌ Server error';
    }
}

// ═══════════════════════════════════════════════════════════
// ─── PROVABLY FAIR ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

async function loadProvablyFair() {
    try {
        const r = await fetch(API + '/provably-fair/seed', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress })
        });
        const d = await r.json();
        document.getElementById('pfServerHash').value = d.serverSeedHash || '';
        document.getElementById('pfClientSeed').value = d.clientSeed || '';
        document.getElementById('pfNonce').value = d.nonce || 0;
    } catch(e) { console.error('Provably Fair error:', e); }
}

async function revealAndRotate() {
    try {
        const r = await fetch(API + '/provably-fair/reveal', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ address: walletAddress })
        });
        const d = await r.json();
        if (d.error) { alert(d.error); return; }

        // Show revealed seed
        document.getElementById('pfRevealedCard').style.display = 'block';
        document.getElementById('pfRevealedSeed').value = d.revealed.serverSeed;

        // Verify hash
        const encoder = new TextEncoder();
        const data = encoder.encode(d.revealed.serverSeed);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const matches = hashHex === d.revealed.serverSeedHash;
        document.getElementById('pfVerifyResult').innerHTML = matches
            ? '✅ <span style="color:#238636">Hash match verified! Game was fair.</span>'
            : '❌ <span style="color:#f85149">Hash mismatch!</span>';

        // Update current seed with new one
        document.getElementById('pfServerHash').value = d.newSeed.serverSeedHash;
        document.getElementById('pfClientSeed').value = d.newSeed.clientSeed;
        document.getElementById('pfNonce').value = 0;

    } catch(e) { console.error('Reveal error:', e); alert('Server error!'); }
}

window.onload = init;
