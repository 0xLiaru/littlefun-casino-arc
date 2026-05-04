import { supabase } from './supabase.js';

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
    let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('address', addr)
        .single();

    if (error && error.code === 'PGRST116') { // Not found
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
            total_games: 0
        };
        const { data, error: insertError } = await supabase.from('users').insert([newUser]).select().single();
        if (insertError) throw insertError;
        user = data;
    } else if (error) throw error;

    // Map to frontend-friendly keys
    const mapped = {
        ...user,
        displayName: user.display_name,
        emailVerified: user.email_verified,
        totalWageredETH: parseFloat(user.total_wagered_eth),
        totalWonETH: parseFloat(user.total_won_eth),
        totalGames: user.total_games,
        twoFactorSecret: user.two_factor_secret,
        twoFactorEnabled: user.two_factor_enabled,
        verificationCode: user.verification_code,
        verificationExpiry: user.verification_expiry ? new Date(user.verification_expiry).getTime() : null,
        tierInfo: getTierInfo(user.xp)
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
    const { data, error } = await supabase
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
        .update({ 
            email: email, 
            verification_code: code, 
            verification_expiry: expiry,
            email_verified: false 
        })
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
    const { gameName, betETH, payoutETH, multiplier, usdValue, details } = gameData;
    
    // 1. Insert into games table
    await supabase.from('games').insert([{
        user_address: addr,
        game_type: gameName.toLowerCase(),
        bet_eth: betETH,
        payout_eth: payoutETH,
        result: payoutETH > betETH ? 'win' : (payoutETH === betETH ? 'push' : 'lose'),
        details: details || {}
    }]);

    // 2. Update user stats
    const { data: user } = await supabase.from('users').select('xp, total_wagered_eth, total_won_eth, total_games').eq('address', addr).single();
    const newXp = (user.xp || 0) + Math.floor(usdValue);
    
    await supabase.from('users').update({
        xp: newXp,
        tier: calculateTier(newXp),
        total_wagered_eth: (parseFloat(user.total_wagered_eth) || 0) + betETH,
        total_won_eth: (parseFloat(user.total_won_eth) || 0) + payoutETH,
        total_games: (user.total_games || 0) + 1
    }).eq('address', addr);

    return await getUser(addr);
}

export async function recordTransaction(address, txData) {
    const { tx_type, amount_eth, tx_hash, status } = txData;
    await supabase.from('transactions').insert([{
        user_address: address.toLowerCase(),
        tx_type,
        amount_eth,
        tx_hash,
        status: status || 'completed'
    }]);
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
