import express from 'express';
import cors from 'cors';
import https from 'https';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { getUser, updateProfile, isNameTaken, setVerificationCode, verifyEmailCode, recordGameResult, updatePhone, set2FA, enable2FA, get2FASecret, recordTransaction, getTransactions } from './db.js';
import { generateCode, sendVerificationEmail } from './email.js';

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);
dotenv.config({ path: path.join(__dirname2, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── ETH PRICE (CoinGecko Proxy) ─────────────────────────
let cachedPrice = null;
let priceTimestamp = 0;

function fetchEthPrice() {
    return new Promise((resolve, reject) => {
        const url = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data).ethereum.usd); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

app.get('/api/eth-price', async (req, res) => {
    try {
        if (cachedPrice && Date.now() - priceTimestamp < 60000) return res.json({ usd: cachedPrice });
        const price = await fetchEthPrice();
        cachedPrice = price; priceTimestamp = Date.now();
        res.json({ usd: price });
    } catch (e) { res.json({ usd: cachedPrice || 3500, fallback: true }); }
});

// ─── USER ENDPOINTS ──────────────────────────────────────

app.get('/api/user/:address', async (req, res) => {
    try {
        const user = await getUser(req.params.address);
        const { verificationCode, verificationExpiry, twoFactorSecret, ...safeUser } = user;
        safeUser.twoFactorEnabled = user.twoFactorEnabled || false;
        res.json(safeUser);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/profile', async (req, res) => {
    try {
        const { address, displayName } = req.body;
        if (!address || !displayName) return res.status(400).json({ error: 'Missing fields' });
        if (await isNameTaken(displayName, address)) return res.status(409).json({ error: 'Bu isim zaten kullanılıyor!' });
        res.json(await updateProfile(address, displayName.trim()));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/check-name/:name', async (req, res) => {
    try {
        const name = decodeURIComponent(req.params.name);
        res.json({ available: !(await isNameTaken(name, req.query.address || '')) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/send-verification', async (req, res) => {
    try {
        const { address, email } = req.body;
        if (!address || !email) return res.status(400).json({ error: 'Missing fields' });
        const code = generateCode();
        await setVerificationCode(address, email, code);
        const result = await sendVerificationEmail(email, code);
        if (result.devMode) {
            res.json({ success: true, message: 'Doğrulama kodu gönderildi!', devMode: true, devCode: code });
        } else {
            res.json({ success: true, message: 'Doğrulama kodu email adresinize gönderildi!' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/verify-email', async (req, res) => {
    try {
        const { address, code } = req.body;
        if (!address || !code) return res.status(400).json({ error: 'Missing fields' });
        const result = await verifyEmailCode(address, code);
        if (result.error) return res.status(400).json(result);
        res.json({ success: true, message: 'Email başarıyla doğrulandı! ✅' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/game-result', async (req, res) => {
    try {
        const { address, gameName, betETH, payoutETH, multiplier, ethPriceUSD } = req.body;
        if (!address) return res.status(400).json({ error: 'Missing address' });
        const usdValue = betETH * (ethPriceUSD || 3500);
        const user = await recordGameResult(address, { gameName, betETH, payoutETH, multiplier, usdValue });
        const { verificationCode, verificationExpiry, twoFactorSecret, ...safeUser } = user;
        res.json(safeUser);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/phone', async (req, res) => {
    try {
        const { address, phone } = req.body;
        if (!address) return res.status(400).json({ error: 'Missing address' });
        res.json(await updatePhone(address, phone));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Record a blockchain transaction (one per play() call)
app.post('/api/user/transaction', async (req, res) => {
    try {
        const { address, gameName, totalBetETH, totalPayoutETH, ballCount, txHash, difficulty } = req.body;
        if (!address) return res.status(400).json({ error: 'Missing address' });
        const result = await recordTransaction(address, { gameName, totalBetETH, totalPayoutETH, ballCount, txHash, difficulty });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get transactions for a user
app.get('/api/user/:address/transactions', async (req, res) => {
    try {
        const txs = await getTransactions(req.params.address);
        res.json(txs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BLACKJACK SETTLE ──────────────────────────────

const BLACKJACK_ABI = [
    'function settle(address player, uint256 payout) external',
    'function cancelBet(address player) external'
];
const HARDHAT_OWNER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

app.post('/api/blackjack/settle', async (req, res) => {
    try {
        const { playerAddress, betETH, payoutETH, playerWon, isBlackjack, contractAddress } = req.body;
        if (!playerAddress || !contractAddress) return res.status(400).json({ error: 'Missing fields' });

        // Call contract settle
        const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        const wallet = new ethers.Wallet(HARDHAT_OWNER_KEY, provider);
        const contract = new ethers.Contract(contractAddress, BLACKJACK_ABI, wallet);

        const payoutWei = ethers.parseEther(payoutETH.toString());
        const tx = await contract.settle(playerAddress, payoutWei);
        const receipt = await tx.wait();

        // Fetch ETH price for XP
        let ethPriceUSD = cachedPrice || 3500;
        try {
            if (!cachedPrice || Date.now() - priceTimestamp > 60000) {
                ethPriceUSD = await fetchEthPrice();
                cachedPrice = ethPriceUSD;
                priceTimestamp = Date.now();
            }
        } catch(e) {}

        // Record game result (for XP/stats)
        const usdValue = betETH * ethPriceUSD;
        await recordGameResult(playerAddress, {
            gameName: 'BLACKJACK',
            betETH: betETH,
            payoutETH: payoutETH,
            multiplier: betETH > 0 ? (payoutETH / betETH).toFixed(2) : 0,
            usdValue
        });

        // Record transaction
        await recordTransaction(playerAddress, {
            gameName: 'BLACKJACK',
            totalBetETH: betETH,
            totalPayoutETH: payoutETH,
            ballCount: 1,
            txHash: receipt.hash,
            difficulty: isBlackjack ? 'Blackjack' : (playerWon ? 'Win' : 'Loss')
        });

        res.json({ success: true, txHash: receipt.hash });
    } catch (e) {
        console.error('Blackjack settle error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── 2FA ENDPOINTS ──────────────────────────────────────

// Generate 2FA secret + QR code
app.post('/api/user/2fa/setup', async (req, res) => {
    try {
        const { address } = req.body;
        if (!address) return res.status(400).json({ error: 'Missing address' });
        
        const user = await getUser(address);
        const displayName = user.displayName || address.slice(0, 8);
        
        const secret = speakeasy.generateSecret({
            name: `LITTLEFUN:${displayName}`,
            issuer: 'LITTLEFUN'
        });
        
        // Store secret (not yet enabled)
        await set2FA(address, secret.base32);
        
        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
        
        res.json({
            success: true,
            secret: secret.base32,
            qrCode: qrDataUrl
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Verify and enable 2FA
app.post('/api/user/2fa/verify', async (req, res) => {
    try {
        const { address, token } = req.body;
        if (!address || !token) return res.status(400).json({ error: 'Missing fields' });
        
        const secret = await get2FASecret(address);
        if (!secret) return res.status(400).json({ error: 'Setup 2FA first' });
        
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 2
        });
        
        if (verified) {
            await enable2FA(address, true);
            res.json({ success: true, message: '2FA başarıyla etkinleştirildi! ✅' });
        } else {
            res.json({ success: false, error: 'Geçersiz kod. Google Authenticator\'dan doğru kodu girin.' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Disable 2FA
app.post('/api/user/2fa/disable', async (req, res) => {
    try {
        const { address, token } = req.body;
        if (!address || !token) return res.status(400).json({ error: 'Missing fields' });
        
        const secret = await get2FASecret(address);
        const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 2 });
        
        if (verified) {
            await enable2FA(address, false);
            res.json({ success: true, message: '2FA devre dışı bırakıldı.' });
        } else {
            res.json({ success: false, error: 'Geçersiz kod.' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── START ───────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log('  🚀 LITTLEFUN Backend API');
    console.log(`  📡 http://localhost:${PORT}`);
    console.log(`  📧 Email: ${process.env.EMAIL_USER ? '✅ Configured' : '❌ Not set'}`);
    console.log('══════════════════════════════════════════════════');
    console.log('');
});
