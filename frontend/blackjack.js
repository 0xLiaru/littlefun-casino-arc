const BJ_ABI = [
    'function placeBet() external payable',
    'function settle(address player, uint256 payout) external',
    'event BetPlaced(address indexed player, uint256 amount, uint256 seed)',
    'event GameSettled(address indexed player, uint256 betAmount, uint256 payout, bool playerWon)'
];

let provider, signer, contract, walletAddress = null;
let deck = [], playerCards = [], dealerCards = [], betETH = 0, originalBetETH = 0, gameActive = false;
let sessionPlayed = 0, sessionWon = 0, sessionBet = 0, sessionWin = 0;
let hasInsurance = false, insuranceBet = 0;

const suits = ['♠','♥','♦','♣'];
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const dealSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
const winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3');
dealSound.volume = 0.3; winSound.volume = 0.4;

function createDeck() {
    deck = [];
    for (const s of suits) for (const r of ranks) deck.push({ rank: r, suit: s });
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function cardValue(card) {
    if (['J','Q','K'].includes(card.rank)) return 10;
    if (card.rank === 'A') return 11;
    return parseInt(card.rank);
}

function handScore(cards) {
    let total = 0, aces = 0;
    for (const c of cards) {
        total += cardValue(c);
        if (c.rank === 'A') aces++;
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
}

function isRedSuit(suit) { return suit === '♥' || suit === '♦'; }

function renderCard(card, faceDown = false) {
    if (faceDown) return '<div class="card face-down"></div>';
    const cls = isRedSuit(card.suit) ? 'card red-suit' : 'card';
    return `<div class="${cls}">
        <div class="corner">${card.rank}<br><span class="suit-small">${card.suit}</span></div>
        <div class="center-suit">${card.suit}</div>
        <div class="corner-bottom">${card.rank}<br><span class="suit-small">${card.suit}</span></div>
    </div>`;
}

function renderHands(revealDealer = false, animate = true) {
    const ph = document.getElementById('playerHand');
    const dh = document.getElementById('dealerHand');
    
    // Helper to sync hand DOM
    const syncHand = (container, cards, isDealer = false) => {
        // Handle dealer face-down logic
        let cardHTMLs = [];
        if (isDealer && !revealDealer && cards.length > 0) {
            cardHTMLs.push(renderCard(cards[0]));
            if (cards.length > 1) cardHTMLs.push(renderCard(cards[1], true));
        } else {
            cardHTMLs = cards.map(c => renderCard(c));
        }

        const currentNodes = container.querySelectorAll('.card');
        cardHTMLs.forEach((html, i) => {
            if (i < currentNodes.length) {
                // Already exists, check if content changed (e.g., reveal)
                const temp = document.createElement('div');
                temp.innerHTML = html;
                const newCard = temp.firstElementChild;
                if (currentNodes[i].innerHTML !== newCard.innerHTML) {
                    currentNodes[i].innerHTML = newCard.innerHTML;
                    currentNodes[i].className = newCard.className + (currentNodes[i].classList.contains('dealt') ? ' dealt' : '');
                }
            } else {
                // Add new card
                container.insertAdjacentHTML('beforeend', html);
            }
        });
    };

    syncHand(ph, playerCards);
    syncHand(dh, dealerCards, true);

    // Update Scores
    if (revealDealer) {
        document.getElementById('dealerScore').innerText = handScore(dealerCards);
    } else if (dealerCards.length > 0) {
        document.getElementById('dealerScore').innerText = cardValue(dealerCards[0]);
    }
    if (playerCards.length > 0) document.getElementById('playerScore').innerText = handScore(playerCards);
    
    // Trigger deal animation for newly added cards
    if (animate) {
        requestAnimationFrame(() => {
            document.querySelectorAll('.card:not(.dealt)').forEach(c => {
                c.offsetHeight; // force reflow
                c.classList.add('dealt');
            });
        });
    }
}

// Connect wallet - simple, no signature required
async function connectWallet() {
    if (!window.ethereum) return alert('MetaMask bulunamadı!');
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        walletAddress = accs[0];
        signer = await provider.getSigner();
        
        const bjAddr = typeof BLACKJACK_ADDRESS !== 'undefined' ? BLACKJACK_ADDRESS : null;
        if (!bjAddr) { alert('Blackjack kontratı bulunamadı! start.bat çalıştırın.'); return; }
        contract = new ethers.Contract(bjAddr, BJ_ABI, signer);
        
        document.getElementById('mainBtn').innerText = walletAddress.slice(0,6) + '...' + walletAddress.slice(-4);
        document.getElementById('dealBtn').innerText = '🃏 DEAL';
        document.getElementById('dealBtn').disabled = false;
        document.getElementById('balanceBadge').style.display = 'block';
        
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('walletAddress', walletAddress);
        updateBalance();
        console.log('Connected:', walletAddress, '| Contract:', bjAddr);
    } catch(e) {
        console.error('Wallet connection error:', e);
        alert('Wallet bağlantı hatası: ' + e.message);
    }
}

async function updateBalance() {
    if (!provider || !walletAddress) return;
    try {
        const b = await provider.getBalance(walletAddress);
        document.getElementById('balanceBadge').innerText = parseFloat(ethers.formatEther(b)).toFixed(4) + ' ETH';
    } catch(e) {}
}

// Start game - place bet on contract
async function startGame() {
    if (gameActive || !contract) return;
    betETH = parseFloat(document.getElementById('betAmount').value);
    if (betETH < 0.01) return alert('Minimum 0.01 ETH!');

    document.getElementById('dealBtn').disabled = true;
    document.getElementById('dealBtn').innerText = 'PLACING BET...';
    document.getElementById('gameMessage').className = 'game-message';
    document.getElementById('gameMessage').innerText = '';
    document.getElementById('gameMessage').classList.remove('show');
    
    // Reset hands for new deal
    playerCards = [];
    dealerCards = [];
    ph = document.getElementById('playerHand');
    dh = document.getElementById('dealerHand');
    ph.innerHTML = '';
    dh.innerHTML = '';
    renderHands(false, false);

    try {
        const tx = await contract.placeBet({ value: ethers.parseEther(betETH.toString()), gasLimit: 200000 });
        await tx.wait();
        
        document.getElementById('dealBtn').innerText = 'DEALING...';
        
        gameActive = true;
        originalBetETH = betETH;
        sessionBet += betETH;
        createDeck();

        const delay = (ms) => new Promise(res => setTimeout(res, ms));

        // Wait a bit after transaction before dealing (more realistic)
        await delay(1200);

        // Sequential Dealing: Player -> Dealer -> Player -> Dealer
        // 1. Player Card 1
        playerCards.push(deck.pop());
        dealSound.cloneNode(true).play();
        renderHands(false, true);
        await delay(600);

        // 2. Dealer Card 1 (Up)
        dealerCards.push(deck.pop());
        dealSound.cloneNode(true).play();
        renderHands(false, true);
        await delay(800);

        // 3. Player Card 2
        playerCards.push(deck.pop());
        dealSound.cloneNode(true).play();
        renderHands(false, true);
        await delay(800);

        // 4. Dealer Card 2 (Down)
        dealerCards.push(deck.pop());
        dealSound.cloneNode(true).play();
        renderHands(false, true);
        await delay(500);

        // --- INSURANCE CHECK ---
        if (dealerCards[0].rank === 'A' && handScore(playerCards) !== 21) {
            document.getElementById('insuranceModal').style.display = 'block';
            document.getElementById('dealBtn').innerText = 'INSURANCE?';
            return; // Wait for insurance decision
        }

        continueGame();
    } catch(e) {
        console.error('Game start error:', e);
        alert('Oyun başlatılamadı: ' + (e.reason || e.message || 'Bilinmeyen hata'));
        document.getElementById('dealBtn').disabled = false;
        document.getElementById('dealBtn').innerText = '🃏 DEAL';
    }
}

async function takeInsurance(decision) {
    document.getElementById('insuranceModal').style.display = 'none';
    if (decision) {
        insuranceBet = originalBetETH * 0.5;
        try {
            const tx = await contract.placeBet({ value: ethers.parseEther(insuranceBet.toString()), gasLimit: 200000 });
            await tx.wait();
            hasInsurance = true;
            sessionBet += insuranceBet;
            updateStats();
        } catch(e) {
            console.error('Insurance bet failed:', e);
            hasInsurance = false;
        }
    } else {
        hasInsurance = false;
    }
    continueGame();
}

async function continueGame() {
    // Reveal dealer peak if they have Ace (for insurance check)
    if (dealerCards[0].rank === 'A' || cardValue(dealerCards[0]) === 10) {
        const dealerBJ = handScore(dealerCards) === 21;
        if (dealerBJ) {
            await endGame('lose'); // Dealer has Blackjack
            return;
        }
    }

    // Check natural blackjack
    if (handScore(playerCards) === 21) {
        await endGame('blackjack');
        return;
    }

    document.getElementById('actionBtns').style.display = 'flex';
    document.getElementById('doubleBtn').style.display = playerCards.length === 2 ? 'block' : 'none';
    document.getElementById('dealBtn').innerText = 'IN GAME...';
    updateStats();
}

function playerHit() {
    if (!gameActive) return;
    playerCards.push(deck.pop());
    dealSound.cloneNode(true).play();
    renderHands(false);
    document.getElementById('doubleBtn').style.display = 'none';
    if (handScore(playerCards) > 21) endGame('bust');
    else if (handScore(playerCards) === 21) playerStand();
}

function playerStand() {
    if (!gameActive) return;
    // Dealer plays
    renderHands(true);
    dealerPlay();
}

    async function playerDouble() {
        if (!gameActive || playerCards.length !== 2) return;
        // Send additional bet to contract
        try {
            document.getElementById('actionBtns').style.display = 'none';
            const extraBet = originalBetETH;
            const tx = await contract.placeBet({ value: ethers.parseEther(extraBet.toString()), gasLimit: 200000 });
            await tx.wait();
            betETH = originalBetETH * 2;
            sessionBet += originalBetETH;
        } catch(e) {
            console.error('Double bet failed:', e);
            document.getElementById('actionBtns').style.display = 'flex';
            return;
        }
        playerCards.push(deck.pop());
        dealSound.cloneNode(true).play();
        renderHands(false);
        if (handScore(playerCards) > 21) endGame('bust');
        else { renderHands(true); dealerPlay(); }
    }

function dealerPlay() {
    document.getElementById('actionBtns').style.display = 'none';
    
    function dealerDraw() {
        if (handScore(dealerCards) < 17) {
            setTimeout(() => {
                dealerCards.push(deck.pop());
                dealSound.cloneNode(true).play();
                renderHands(true);
                dealerDraw();
            }, 900);
        } else {
            setTimeout(() => determineWinner(), 400);
        }
    }
    dealerDraw();
}

function determineWinner() {
    const ps = handScore(playerCards), ds = handScore(dealerCards);
    if (ds > 21) endGame('dealer_bust');
    else if (ps > ds) endGame('win');
    else if (ps < ds) endGame('lose');
    else endGame('push');
}

async function endGame(result) {
    gameActive = false;
    document.getElementById('actionBtns').style.display = 'none';
    document.getElementById('insuranceModal').style.display = 'none';
    renderHands(true);

    let payoutETH = 0, playerWon = false, isBlackjack = false;
    const msg = document.getElementById('gameMessage');
    
    // Standard BJ Payouts
    switch(result) {
        case 'blackjack':
            payoutETH = betETH * 2.5; playerWon = true; isBlackjack = true;
            msg.innerText = '🃏 BLACKJACK!'; msg.className = 'game-message win show';
            winSound.cloneNode(true).play(); break;
        case 'win': case 'dealer_bust':
            payoutETH = betETH * 2; playerWon = true;
            msg.innerText = 'WIN';
            msg.className = 'game-message win show';
            winSound.cloneNode(true).play(); break;
        case 'push':
            payoutETH = betETH; playerWon = false;
            msg.innerText = '🤝 PUSH'; msg.className = 'game-message push show'; break;
        case 'bust':
            msg.innerText = '💀 BUST!'; msg.className = 'game-message lose show'; break;
        case 'lose':
            const dealerBJ = handScore(dealerCards) === 21 && dealerCards.length === 2;
            msg.innerText = dealerBJ ? '🃏 DEALER BJ!' : '😞 LOSE'; 
            msg.className = 'game-message lose show'; break;
    }

    // --- INSURANCE PAYOUT ---
    if (hasInsurance) {
        const dealerHasBJ = handScore(dealerCards) === 21 && dealerCards.length === 2;
        if (dealerHasBJ) {
            const insPayout = insuranceBet * 3; // 2:1 win + stake back
            payoutETH += insPayout;
            msg.innerText += " 🛡️ Insurance Paid!";
        }
        hasInsurance = false;
        insuranceBet = 0;
    }

    sessionPlayed++;
    if (playerWon) sessionWon++;
    sessionWin += payoutETH;
    updateStats();

    // Settle via backend API
    try {
        const bjAddr = typeof BLACKJACK_ADDRESS !== 'undefined' ? BLACKJACK_ADDRESS : '';
        await fetch('http://localhost:3001/api/blackjack/settle', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ playerAddress: walletAddress, betETH: originalBetETH, payoutETH, playerWon, isBlackjack, contractAddress: bjAddr })
        });
    } catch(e) { console.log('Settle API error:', e); }

    addToHistory(result, payoutETH);
    updateBalance();

    document.getElementById('dealBtn').disabled = false;
    document.getElementById('dealBtn').innerText = '🃏 DEAL';
}

function updateStats() {
    document.getElementById('stPlayed').innerText = sessionPlayed;
    document.getElementById('stWon').innerText = sessionWon;
    document.getElementById('stBet').innerText = sessionBet.toFixed(3);
    document.getElementById('stWin').innerText = sessionWin.toFixed(3);
}

function addToHistory(result, payout) {
    const tbody = document.getElementById('historyBody');
    const cls = payout > betETH ? 'green' : payout === betETH ? '' : 'red';
    const labels = { blackjack:'BLACKJACK 🃏', win:'WIN ✅', dealer_bust:'WIN ✅', push:'PUSH 🤝', bust:'BUST ❌', lose:'LOSE ❌' };
    const row = tbody.insertRow(0);
    row.innerHTML = `<td>${new Date().toLocaleTimeString()}</td><td>${betETH.toFixed(3)} ETH</td><td class="${cls}">${labels[result]}</td><td class="${cls}">${payout.toFixed(3)} ETH</td>`;
    if (tbody.rows.length > 20) tbody.deleteRow(20);
}

// Auto-connect
window.addEventListener('load', () => { if (localStorage.getItem('isLoggedIn') === 'true') connectWallet(); });
