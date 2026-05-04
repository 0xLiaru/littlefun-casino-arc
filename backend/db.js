import { supabase } from './supabase.js';
import crypto from 'crypto';

// ─── TIER HELPERS ──────────────────────────────────────────
function calculateTier(xp) {
    if (xp >= 100000) return 'gold';
    if (xp >= 10000) return 'silver';
    return 'bronze';
}

function getTierInfo(xp) {
    const tier = calculateTier(xp);
    let tierMin, tierMax, tierName;
    if (tier === 'gold') {
        tierMin = 100000; tierMax = 1000000; tierName = 'Gold';
    } else if (tier === 'silver') {
        tierMin = 10000; tierMax = 100000; tierName = 'Silver';
    } else {
        tierMin = 0; tierMax = 10000; tierName = 'Bronze';
    }
    const progress = Math.min(((xp - tierMin) / (tierMax - tierMin)) * 100, 100);
    return { tier, tierName, tierMin, tierMax, progress, xp };
}

// ─── USER FUNCTIONS ─────────────────────────────────────────
export async function getUser(address) {
    const addr = address.toLowerCase();
    console.log(`[DB] Fetching user: ${addr}`);

    let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('address', addr)
        .single();

    if (error && error.code === 'PGRST116') {
        console.log(`[DB] User not found, creating new: ${addr}`);
        const refCode = addr.slice(2, 10) + Math.random().toString(36).slice(2, 6);
        const newUser = {
            address: addr,
            display_name: '',
            email: '',
            email_verified: false,
            phone: '',
            xp: 0,
            tier: 'bronze',
            total_wagered_eth: 0,
            total_won_eth: 0,
            total_games: 0,
            referral_code: refCode,
            referral_earnings_eth: 0,
            daily_streak: 0
        };
        const { data, error: insertError } = await supabase.from('users').insert([newUser]).select().single();
        if (insertError) {
            console.error(`[DB] ERROR creating user:`, insertError.message);
            throw insertError;
        }
        console.log(`[DB] New user created successfully!`);
        user = data;
    } else if (error) {
        console.error(`[DB] ERROR fetching user:`, error.message);
        throw error;
    }

    console.log(`[DB] User loaded: ${user.address}`);
    const mapped = {
        ...user,
        displayName: user.display_name,
        emailVerified: user.email_verified,
        totalWageredETH: parseFloat(user.total_wagered_eth || 0),
        totalWonETH: parseFloat(user.total_won_eth || 0),
        totalGames: user.total_games || 0,
        twoFactorSecret: user.two_factor_secret,
        twoFactorEnabled: user.two_factor_enabled,
        verificationCode: user.verification_code,
        verificationExpiry: user.verification_expiry ? new Date(user.verification_expiry).getTime() : null,
        tierInfo: getTierInfo(user.xp || 0),
        referralCode: user.referral_code,
        referredBy: user.referred_by,
        referralEarningsETH: parseFloat(user.referral_earnings_eth || 0),
        dailyStreak: user.daily_streak || 0,
        lastDailyClaim: user.last_daily_claim,
        bonusBalanceETH: parseFloat(user.bonus_balance_eth || 0)
    };
    return mapped;
}

export async function updateProfile(address, displayName) {
    const { error } = await supabase
        .from('users')
        .update({ display_name: displayName })
        .eq('address', address.toLowerCase());
    if (error) return { error: error.message };
    return { success: true };
}

export async function isNameTaken(name, excludeAddress = '') {
    const { data } = await supabase
        .from('users')
        .select('address')
        .ilike('display_name', name.trim())
        .neq('address', excludeAddress.toLowerCase());
    return data && data.length > 0;
}

export async function setVerificationCode(address, email, code) {
    const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error } = await supabase
        .from('users')
        .update({ email, verification_code: code, verification_expiry: expiry, email_verified: false })
        .eq('address', address.toLowerCase());
    if (error) return { error: error.message };
    return { success: true };
}

export async function verifyEmailCode(address, code) {
    const { data: user, error } = await supabase
        .from('users')
        .select('verification_code, verification_expiry, email')
        .eq('address', address.toLowerCase())
        .single();

    if (error || !user) return { error: 'User not found' };
    if (!user.verification_code) return { error: 'No verification pending' };
    if (new Date() > new Date(user.verification_expiry)) return { error: 'Code expired' };
    if (user.verification_code !== code) return { error: 'Invalid code' };

    await supabase
        .from('users')
        .update({ email_verified: true, verification_code: null, verification_expiry: null })
        .eq('address', address.toLowerCase());

    return { success: true, email: user.email };
}

// ─── GAME & TRANSACTION FUNCTIONS ───────────────────────────
export async function recordGameResult(address, gameData) {
    const addr = address.toLowerCase();
    const { gameName, betETH, payoutETH, multiplier, usdValue, sideBetDetails } = gameData;
    console.log(`[DB] Recording game: ${gameName} | Bet: ${betETH} | Payout: ${payoutETH}`);

    // 1. Insert into games table
    const { error: gameError } = await supabase.from('games').insert([{
        user_address: addr,
        game_type: gameName.toLowerCase(),
        bet_eth: betETH,
        payout_eth: payoutETH,
        result: payoutETH > betETH ? 'win' : (payoutETH === betETH ? 'push' : 'lose'),
        details: { multiplier, sideBetDetails }
    }]);
    if (gameError) console.error('[DB] Game insert error:', gameError.message);

    // 2. Update user stats
    const { data: user } = await supabase.from('users').select('xp, total_wagered_eth, total_won_eth, total_games, display_name, referred_by').eq('address', addr).single();
    if (!user) return await getUser(addr);

    const newXp = (user.xp || 0) + Math.floor(usdValue || 0);
    const { error: updateError } = await supabase.from('users').update({
        xp: newXp,
        tier: calculateTier(newXp),
        total_wagered_eth: (parseFloat(user.total_wagered_eth) || 0) + betETH,
        total_won_eth: (parseFloat(user.total_won_eth) || 0) + payoutETH,
        total_games: (user.total_games || 0) + 1
    }).eq('address', addr);
    if (updateError) console.error('[DB] User stats update error:', updateError.message);

    // 3. Record live win (only if player won something)
    if (payoutETH > 0) {
        await recordLiveWin(addr, user.display_name || 'Player', gameName, betETH, payoutETH, multiplier || (betETH > 0 ? payoutETH / betETH : 0));
    }

    // 4. Referral commission (5% of bet as XP to referrer)
    if (user.referred_by) {
        const referralXP = Math.floor((usdValue || 0) * 0.05);
        if (referralXP > 0) {
            const { data: referrer } = await supabase.from('users').select('xp, referral_earnings_eth').eq('address', user.referred_by).single();
            if (referrer) {
                await supabase.from('users').update({
                    xp: (referrer.xp || 0) + referralXP,
                    referral_earnings_eth: (parseFloat(referrer.referral_earnings_eth) || 0) + (betETH * 0.05)
                }).eq('address', user.referred_by);
            }
        }
    }

    return await getUser(addr);
}

// FIX: recordTransaction is now compatible with the fields sent by the frontend
export async function recordTransaction(address, txData) {
    const addr = address.toLowerCase();
    const { gameName, totalBetETH, totalPayoutETH, ballCount, txHash, difficulty } = txData;
    console.log(`[DB] Recording transaction: ${gameName} | Hash: ${txHash}`);

    const { error } = await supabase.from('transactions').insert([{
        user_address: addr,
        tx_type: gameName || 'GAME',
        amount_eth: totalBetETH || 0,
        tx_hash: txHash || 'local-' + Date.now(),
        status: 'completed'
    }]);
    if (error) console.error('[DB] Transaction insert error:', error.message);
    return { success: true };
}

export async function getTransactions(address) {
    const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_address', address.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(50);
    return data || [];
}

// ─── PHONE & 2FA ───────────────────────────────────────────
export async function updatePhone(address, phone) {
    await supabase.from('users').update({ phone }).eq('address', address.toLowerCase());
    return { success: true };
}

export async function set2FA(address, secret) {
    await supabase.from('users').update({ two_factor_secret: secret, two_factor_enabled: false }).eq('address', address.toLowerCase());
    return { success: true };
}

export async function enable2FA(address, enabled) {
    const update = { two_factor_enabled: enabled };
    if (!enabled) update.two_factor_secret = null;
    await supabase.from('users').update(update).eq('address', address.toLowerCase());
    return { success: true };
}

export async function get2FASecret(address) {
    const { data } = await supabase.from('users').select('two_factor_secret').eq('address', address.toLowerCase()).single();
    return data ? data.two_factor_secret : null;
}

// ═══════════════════════════════════════════════════════════
// ─── NEW FEATURES ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

// ─── 1. PROVABLY FAIR ──────────────────────────────────────
export async function createGameSeed(address) {
    const addr = address.toLowerCase();
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const clientSeed = crypto.randomBytes(16).toString('hex');

    const { data, error } = await supabase.from('game_seeds').insert([{
        user_address: addr,
        server_seed: serverSeed,
        server_seed_hash: serverSeedHash,
        client_seed: clientSeed,
        nonce: 0,
        revealed: false
    }]).select().single();

    if (error) { console.error('[DB] Seed create error:', error.message); throw error; }
    return { serverSeedHash: data.server_seed_hash, clientSeed: data.client_seed, seedId: data.id };
}

export async function getActiveSeed(address) {
    const { data } = await supabase
        .from('game_seeds')
        .select('id, server_seed_hash, client_seed, nonce, revealed')
        .eq('user_address', address.toLowerCase())
        .eq('revealed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    return data || null;
}

export async function revealSeed(address) {
    const addr = address.toLowerCase();
    const { data: seed } = await supabase
        .from('game_seeds')
        .select('*')
        .eq('user_address', addr)
        .eq('revealed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!seed) return { error: 'No active seed found' };

    // Mark as revealed
    await supabase.from('game_seeds').update({ revealed: true }).eq('id', seed.id);

    // Create a new seed automatically
    const newSeed = await createGameSeed(addr);

    return {
        revealed: {
            serverSeed: seed.server_seed,
            serverSeedHash: seed.server_seed_hash,
            clientSeed: seed.client_seed,
            nonce: seed.nonce
        },
        newSeed: {
            serverSeedHash: newSeed.serverSeedHash,
            clientSeed: newSeed.clientSeed
        }
    };
}

export async function incrementNonce(address) {
    const addr = address.toLowerCase();
    const { data: seed } = await supabase
        .from('game_seeds')
        .select('id, nonce')
        .eq('user_address', addr)
        .eq('revealed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (seed) {
        await supabase.from('game_seeds').update({ nonce: seed.nonce + 1 }).eq('id', seed.id);
    }
}

// ─── 2. LEADERBOARD ────────────────────────────────────────
export async function getLeaderboard(limit = 20) {
    const { data } = await supabase
        .from('users')
        .select('address, display_name, xp, tier, total_wagered_eth, total_won_eth, total_games')
        .order('xp', { ascending: false })
        .limit(limit);

    return (data || []).map((u, i) => ({
        rank: i + 1,
        address: u.address,
        displayName: u.display_name || ('Player_' + u.address.slice(2, 8)),
        xp: u.xp,
        tier: u.tier,
        totalWagered: parseFloat(u.total_wagered_eth || 0),
        totalWon: parseFloat(u.total_won_eth || 0),
        totalGames: u.total_games || 0
    }));
}

// ─── 3. DAILY BONUS ────────────────────────────────────────
// Rewards in USD: Day1=$0.01, Day2=$0.02, Day3=$0.05, Day4=$0.10, Day5=$0.20, Day6=$0.50, Day7=$1.00
const DAILY_REWARDS_USD = [0.01, 0.02, 0.05, 0.10, 0.20, 0.50, 1.00];

export async function claimDailyBonus(address, ethPriceUSD = 3500) {
    const addr = address.toLowerCase();
    const { data: user } = await supabase
        .from('users')
        .select('xp, last_daily_claim, daily_streak, bonus_balance_eth')
        .eq('address', addr)
        .single();

    if (!user) return { error: 'User not found' };

    const now = new Date();
    const lastClaim = user.last_daily_claim ? new Date(user.last_daily_claim) : null;

    // Check if already claimed today
    if (lastClaim) {
        const hoursSince = (now - lastClaim) / (1000 * 60 * 60);
        if (hoursSince < 24) {
            const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
            return { error: 'already_claimed', nextClaim: nextClaim.toISOString(), streak: user.daily_streak };
        }
    }

    // Calculate streak
    let streak = user.daily_streak || 0;
    if (lastClaim) {
        const hoursSince = (now - lastClaim) / (1000 * 60 * 60);
        if (hoursSince < 48) {
            streak += 1;
        } else {
            streak = 1; // Reset streak
        }
    } else {
        streak = 1;
    }

    // Get reward based on streak day (1-7, then resets)
    const dayIndex = Math.min(streak, 7) - 1;
    const rewardUSD = DAILY_REWARDS_USD[dayIndex];
    const rewardETH = rewardUSD / ethPriceUSD;

    // Credit bonus balance
    const newBonus = (parseFloat(user.bonus_balance_eth) || 0) + rewardETH;
    const bonusXP = Math.floor(rewardUSD * 100); // 1 cent = 1 XP

    const newXp = (user.xp || 0) + bonusXP;
    await supabase.from('users').update({
        xp: newXp,
        tier: calculateTier(newXp),
        last_daily_claim: now.toISOString(),
        daily_streak: streak > 7 ? 1 : streak, // Reset after 7 days
        bonus_balance_eth: newBonus
    }).eq('address', addr);

    return {
        success: true,
        rewardUSD,
        rewardETH: parseFloat(rewardETH.toFixed(8)),
        bonusXP,
        streak,
        totalBonusETH: parseFloat(newBonus.toFixed(8)),
        nextClaim: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    };
}


// ─── 4. REFERRAL SYSTEM ────────────────────────────────────
export async function applyReferral(address, referralCode) {
    const addr = address.toLowerCase();

    // Check if user already has a referrer
    const { data: user } = await supabase.from('users').select('referred_by').eq('address', addr).single();
    if (user && user.referred_by) return { error: 'You already have a referral code!' };

    // Find the referrer
    const { data: referrer, error: refErr } = await supabase.from('users').select('*').eq('referral_code', referralCode.toUpperCase()).single();
    if (refErr || !referrer) return { error: 'Invalid referral code!' };
    if (referrer.address.toLowerCase() === addr.toLowerCase()) return { error: 'You cannot use your own code!' };

    // Apply referral
    await supabase.from('users').update({ referred_by: referrer.address }).eq('address', addr);

    // Give both users bonus XP
    const { data: r } = await supabase.from('users').select('xp').eq('address', referrer.address).single();
    if (r) await supabase.from('users').update({ xp: (r.xp || 0) + 500 }).eq('address', referrer.address);

    const { data: u } = await supabase.from('users').select('xp').eq('address', addr).single();
    if (u) await supabase.from('users').update({ xp: (u.xp || 0) + 250 }).eq('address', addr);

    return { success: true, message: 'Referral applied! You earned +250 XP, and your friend earned +500 XP!' };
}

export async function getReferralStats(address) {
    const addr = address.toLowerCase();
    const { data: user } = await supabase.from('users').select('referral_code, referral_earnings_eth').eq('address', addr).single();

    // Count referrals
    const { data: refs } = await supabase.from('users').select('address, display_name, xp, created_at').eq('referred_by', addr);

    return {
        referralCode: user?.referral_code || '',
        totalEarnings: parseFloat(user?.referral_earnings_eth || 0),
        referralCount: refs?.length || 0,
        referrals: (refs || []).map(r => ({
            address: r.address.slice(0, 6) + '...' + r.address.slice(-4),
            displayName: r.display_name || 'Player',
            xp: r.xp,
            joinedAt: r.created_at
        }))
    };
}

// ─── 5. LIVE WINS FEED ─────────────────────────────────────
export async function recordLiveWin(address, displayName, gameType, betETH, payoutETH, multiplier) {
    const { error } = await supabase.from('live_wins').insert([{
        user_address: address.toLowerCase(),
        display_name: displayName || 'Player',
        game_type: gameType,
        bet_eth: betETH,
        payout_eth: payoutETH,
        multiplier: multiplier || 0
    }]);
    if (error) console.error('[DB] Live win insert error:', error.message);
}

export async function getLiveWins(limit = 20) {
    const { data } = await supabase
        .from('live_wins')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    return (data || []).map(w => ({
        displayName: w.display_name || 'Player',
        gameType: w.game_type,
        betETH: parseFloat(w.bet_eth),
        payoutETH: parseFloat(w.payout_eth),
        multiplier: parseFloat(w.multiplier),
        time: w.created_at
    }));
}

export async function withdrawBonusBalance(address) {
    const addr = address.toLowerCase();
    const { data: user } = await supabase.from('users').select('bonus_balance_eth').eq('address', addr).single();
    if (!user || !user.bonus_balance_eth || user.bonus_balance_eth <= 0.00000001) return { error: 'Insufficient balance!' };
    
    const amount = parseFloat(user.bonus_balance_eth);
    // Reset bonus balance
    await supabase.from('users').update({ bonus_balance_eth: 0 }).eq('address', addr);
    
    return { success: true, amount };
}
