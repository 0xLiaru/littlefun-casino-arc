import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1"
import { ethers } from "https://esm.sh/ethers@6.11.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    // ─── BLACKJACK SETTLE ────────────────────────────────────
    if (path === 'settle' && req.method === 'POST') {
      const { playerAddress, betETH, payoutETH, playerWon, isBlackjack, contractAddress, sideBetDetails } = await req.json()
      
      const rpcUrl = Deno.env.get('RPC_URL') || 'http://127.0.0.1:8545'
      const privateKey = Deno.env.get('PRIVATE_KEY') || ''
      
      if (!privateKey) throw new Error('PRIVATE_KEY not set in Supabase Secrets')

      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const wallet = new ethers.Wallet(privateKey, provider)
      const BLACKJACK_ABI = [
        'function settle(address player, uint256 payout) external',
        'function cancelBet(address player) external'
      ]
      const contract = new ethers.Contract(contractAddress, BLACKJACK_ABI, wallet)

      const payoutWei = ethers.parseUnits(payoutETH.toString(), 'ether')
      const tx = await contract.settle(playerAddress, payoutWei)
      const receipt = await tx.wait()

      // Update DB (record result)
      // Note: You can call your internal DB logic here or just do a manual update
      // For simplicity, we'll assume the frontend still sends game-result separately or we do it here.
      
      return new Response(JSON.stringify({ success: true, txHash: receipt.hash }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ─── DAILY BONUS CLAIM ───────────────────────────────────
    if (path === 'claim' && req.method === 'POST') {
        const { address } = await req.json()
        // Implement claimDailyBonus logic here...
        // For now, returning a mock or calling a DB function
        return new Response(JSON.stringify({ success: false, error: 'Migration in progress' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // Add other endpoints as needed...

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
