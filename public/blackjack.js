const BJ_ABI = [
    'function placeBet() external payable',
    'function settle(address player, uint256 payout) external',
    'event BetPlaced(address indexed player, uint256 amount, uint256 seed)',
    'event GameSettled(address indexed player, uint256 betAmount, uint256 payout, bool playerWon)'
];

let provider, signer, contract, walletAddress = null;
let deck = [], playerCards = [], dealerCards = [], betETH = 0, originalBetETH = 0, gameActive = false;
let splitHandCards = null, currentHandIndex = 0, splitBetETH = 0;
let ppBetETH = 0, plus3BetETH = 0, sideBetPayoutETH = 0, sideBetDetails = null;
let sessionPlayed = 0, sessionWon = 0, sessionBet = 0, sessionWin = 0;
let hasInsurance = false, insuranceBet = 0;
let selectedChip = 0.001;
let customChipValue = 0.05;

function selectChip(val) {
    if (val === 'custom') {
        selectedChip = customChipValue;
        document.getElementById('customChipBox').style.display = 'block';
    } else {
        selectedChip = parseFloat(val);
        document.getElementById('customChipBox').style.display = 'none';
    }
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector(`.chip[data-val="${val}"]`).classList.add('active');
}

function updateCustomChip(val) {
    customChipValue = parseFloat(val) || 0.001;
    if (document.getElementById('customChip').classList.contains('active')) {
        selectedChip = customChipValue;
    }
}

function addChipToBet(inputId) {
    const input = document.getElementById(inputId);
    let currentVal = parseFloat(input.value) || 0;
    input.value = parseFloat((currentVal + selectedChip).toFixed(3));
    updateTableChips(inputId);
}

function clearBets() {
    document.getElementById('betAmount').value = '0.001';
    document.getElementById('ppBetAmount').value = '0';
    document.getElementById('plus3BetAmount').value = '0';
    updateTableChips('betAmount');
    updateTableChips('ppBetAmount');
    updateTableChips('plus3BetAmount');
}

function dragChip(ev, val) {
    const actualVal = (val === 'custom') ? customChipValue : val;
    selectChip(val);
    ev.dataTransfer.setData("text", actualVal.toString());
}

function allowDrop(ev) {
    ev.preventDefault();
}

function dropChip(ev, inputId) {
    ev.preventDefault();
    const valStr = ev.dataTransfer.getData("text");
    if (!valStr) return;
    const val = parseFloat(valStr);
    if (!isNaN(val)) {
        const input = document.getElementById(inputId);
        let currentVal = parseFloat(input.value) || 0;
        input.value = parseFloat((currentVal + val).toFixed(3));
        
        input.style.backgroundColor = 'rgba(16,185,129,0.5)';
        setTimeout(() => {
            input.style.backgroundColor = inputId === 'betAmount' ? '' : 'rgba(0,0,0,0.3)';
        }, 200);
        updateTableChips(inputId);
    }
}

function updateTableChips(inputId) {
    const spotId = inputId === 'betAmount' ? 'table-chips-main' : 
                   inputId === 'ppBetAmount' ? 'table-chips-pp' : 'table-chips-plus3';
    const container = document.getElementById(spotId);
    if (!container) return;
    
    const val = parseFloat(document.getElementById(inputId).value) || 0;
    container.innerHTML = '';
    
    if (val > 0) {
        const stackCount = Math.min(Math.ceil(val / 0.01), 6);
        for (let i = 0; i < stackCount; i++) {
            const chip = document.createElement('div');
            chip.className = 'table-chip';
            chip.style.bottom = `${i * 3}px`;
            chip.style.borderColor = getChipColorByVal(val);
            if (i === stackCount - 1) chip.innerText = val.toString();
            container.appendChild(chip);
        }
    }
}

function getChipColorByVal(val) {
    if (val >= 1) return '#eab308';
    if (val >= 0.1) return '#ec4899';
    if (val >= 0.01) return '#3b82f6';
    return '#94a3b8';
}

function addWinningChipsToTable(inputId, count) {
    const spotId = inputId === 'ppBetAmount' ? 'table-chips-pp' : 'table-chips-plus3';
    const container = document.getElementById(spotId);
    if (!container) return;

    for (let i = 0; i < Math.min(count, 15); i++) {
        setTimeout(() => {
            const chip = document.createElement('div');
            chip.className = 'table-chip';
            chip.style.bottom = `${(i + 6) * 3}px`; 
            chip.style.borderColor = '#10b981'; 
            chip.style.transform = 'translateY(-30px) scale(1.2)';
            chip.style.opacity = '0';
            chip.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            container.appendChild(chip);
            
            setTimeout(() => {
                chip.style.transform = 'translateY(0) scale(1)';
                chip.style.opacity = '1';
                dealSound.cloneNode(true).play();
            }, 50);
        }, i * 100);
    }
}

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
    if (splitHandCards) {
        const sh = document.getElementById('splitHand');
        syncHand(sh, splitHandCards);
        document.getElementById('splitScore').innerText = handScore(splitHandCards);
        
        // Highlight active hand
        if (currentHandIndex === 0) {
            document.getElementById('labelHand1').style.color = '#10b981';
            document.getElementById('labelHand2').style.color = '#a8b2c1';
        } else if (currentHandIndex === 1) {
            document.getElementById('labelHand1').style.color = '#a8b2c1';
            document.getElementById('labelHand2').style.color = '#10b981';
        }
    }

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
    if (!window.ethereum) return alert('MetaMask not found!');
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
        walletAddress = accs[0];
        signer = await provider.getSigner();
        
        const bjAddr = typeof BLACKJACK_ADDRESS !== 'undefined' ? BLACKJACK_ADDRESS : null;
        if (!bjAddr) { alert('Blackjack contract not found! Please run start.bat.'); return; }
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
        alert('Wallet connection error: ' + e.message);
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
    ppBetETH = parseFloat(document.getElementById('ppBetAmount').value) || 0;
    plus3BetETH = parseFloat(document.getElementById('plus3BetAmount').value) || 0;
    
    if (betETH < 0.001) return alert('Minimum main bet is 0.001 ETH!');
    
    const totalTxValue = betETH + ppBetETH + plus3BetETH;

    document.getElementById('dealBtn').disabled = true;
    document.getElementById('dealBtn').innerText = 'PLACING BET...';
    document.getElementById('gameMessage').className = 'game-message';
    document.getElementById('gameMessage').innerText = '';
    document.getElementById('gameMessage').classList.remove('show');
    
    // Reset hands for new deal
    playerCards = [];
    dealerCards = [];
    splitHandCards = null;
    currentHandIndex = 0;
    splitBetETH = 0;
    sideBetPayoutETH = 0;
    sideBetDetails = null;
    document.getElementById('splitHand').innerHTML = '';
    document.getElementById('splitHand').style.display = 'none';
    document.getElementById('labelHand2').style.display = 'none';
    document.getElementById('labelHand1').style.color = '';
    document.getElementById('playerScore').innerText = '';
    document.getElementById('splitScore').innerText = '';
    
    ph = document.getElementById('playerHand');
    dh = document.getElementById('dealerHand');
    ph.innerHTML = '';
    dh.innerHTML = '';
    document.getElementById('bettingTableSpots').style.opacity = '0.3';
    document.getElementById('bettingTableSpots').style.pointerEvents = 'none';
    renderHands(false, false);

    try {
        const tx = await contract.placeBet({ value: ethers.parseEther(totalTxValue.toString()), gasLimit: 200000 });
        await tx.wait();
        
        document.getElementById('dealBtn').innerText = 'DEALING...';
        
        gameActive = true;
        originalBetETH = betETH;
        sessionBet += totalTxValue;
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

        // Evaluate Side Bets after initial deal
        evaluateSideBets();

        // --- INSURANCE CHECK ---
        if (dealerCards[0].rank === 'A' && handScore(playerCards) !== 21) {
            document.getElementById('insuranceModal').style.display = 'block';
            document.getElementById('dealBtn').innerText = 'INSURANCE?';
            return; // Wait for insurance decision
        }

        continueGame();
    } catch(e) {
        console.error('Game start error:', e);
        alert('Could not start game: ' + (e.reason || e.message || 'Unknown error'));
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

function evaluateSideBets() {
    let ppPayout = 0;
    let p3Payout = 0;
    let msg = '';
    
    // Perfect Pairs
    if (ppBetETH > 0 && playerCards.length === 2) {
        const c1 = playerCards[0], c2 = playerCards[1];
        if (c1.rank === c2.rank) {
            const isRed1 = c1.suit === '♥' || c1.suit === '♦';
            const isRed2 = c2.suit === '♥' || c2.suit === '♦';
            
            if (c1.suit === c2.suit) {
                ppPayout = ppBetETH * 25; msg += `🃏 Perfect Pair! (+${ppPayout.toFixed(3)}) `;
                addWinningChipsToTable('ppBetAmount', 15);
            } else if (isRed1 === isRed2) {
                ppPayout = ppBetETH * 12; msg += `🃏 Colored Pair! (+${ppPayout.toFixed(3)}) `;
                addWinningChipsToTable('ppBetAmount', 10);
            } else {
                ppPayout = ppBetETH * 5; msg += `🃏 Mixed Pair! (+${ppPayout.toFixed(3)}) `;
                addWinningChipsToTable('ppBetAmount', 5);
            }
        }
    }

    // 21+3
    if (plus3BetETH > 0 && playerCards.length === 2 && dealerCards.length > 0) {
        const p1 = playerCards[0], p2 = playerCards[1], d1 = dealerCards[0];
        const suitsList = [p1.suit, p2.suit, d1.suit];
        const ranksList = [p1.rank, p2.rank, d1.rank];
        
        const isFlush = suitsList[0] === suitsList[1] && suitsList[1] === suitsList[2];
        const isThreeOfKind = ranksList[0] === ranksList[1] && ranksList[1] === ranksList[2];
        
        const rVals = ranksList.map(r => {
            if (r === 'A') return 14;
            if (r === 'K') return 13;
            if (r === 'Q') return 12;
            if (r === 'J') return 11;
            return parseInt(r);
        }).sort((a, b) => a - b);
        
        const isStr = (rVals[1] === rVals[0] + 1 && rVals[2] === rVals[1] + 1) || 
                       (rVals.includes(14) && rVals.includes(2) && rVals.includes(3));

        if (isFlush && isThreeOfKind) {
            p3Payout = plus3BetETH * 100; msg += `🔥 Suited Trips! (+${p3Payout.toFixed(3)})`;
            addWinningChipsToTable('plus3BetAmount', 25);
        } else if (isFlush && isStr) {
            p3Payout = plus3BetETH * 40; msg += `🔥 Straight Flush! (+${p3Payout.toFixed(3)})`;
            addWinningChipsToTable('plus3BetAmount', 20);
        } else if (isThreeOfKind) {
            p3Payout = plus3BetETH * 30; msg += `🔥 Three of a Kind! (+${p3Payout.toFixed(3)})`;
            addWinningChipsToTable('plus3BetAmount', 15);
        } else if (isStr) {
            p3Payout = plus3BetETH * 10; msg += `🔥 Straight! (+${p3Payout.toFixed(3)})`;
            addWinningChipsToTable('plus3BetAmount', 10);
        } else if (isFlush) {
            p3Payout = plus3BetETH * 5; msg += `🔥 Flush! (+${p3Payout.toFixed(3)})`;
            addWinningChipsToTable('plus3BetAmount', 5);
        }
    }

    sideBetPayoutETH = ppPayout + p3Payout;
    sideBetDetails = {
        perfectPairs: { bet: ppBetETH, payout: ppPayout },
        plus3: { bet: plus3BetETH, payout: p3Payout }
    };

    if (sideBetPayoutETH > 0) {
        const m = document.getElementById('gameMessage');
        m.innerText = msg;
        m.className = 'game-message win show';
        winSound.cloneNode(true).play();
        setTimeout(() => { m.classList.remove('show'); }, 3000);
    }
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
    
    const canSplit = playerCards.length === 2 && cardValue(playerCards[0]) === cardValue(playerCards[1]) && !splitHandCards;
    document.getElementById('splitBtn').style.display = canSplit ? 'block' : 'none';

    document.getElementById('dealBtn').innerText = 'IN GAME...';
    updateStats();
}

async function playerSplit() {
    if (!gameActive || playerCards.length !== 2) return;
    if (cardValue(playerCards[0]) !== cardValue(playerCards[1])) return;

    try {
        document.getElementById('actionBtns').style.display = 'none';
        const tx = await contract.placeBet({ value: ethers.parseEther(originalBetETH.toString()), gasLimit: 200000 });
        await tx.wait();
        splitBetETH = originalBetETH;
        sessionBet += splitBetETH;
    } catch(e) {
        console.error('Split bet failed:', e);
        document.getElementById('actionBtns').style.display = 'flex';
        return;
    }

    // 1. Move one card to split hand
    splitHandCards = [playerCards.pop()];
    currentHandIndex = 0;

    document.getElementById('splitHand').style.display = 'flex';
    document.getElementById('labelHand2').style.display = 'block';
    
    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    // Render the initial split (moving the card)
    renderHands(false, true);
    await delay(600);

    // 2. Deal new card to Hand 1
    playerCards.push(deck.pop());
    dealSound.cloneNode(true).play();
    renderHands(false, true);
    await delay(600);

    // 3. Deal new card to Hand 2
    splitHandCards.push(deck.pop());
    dealSound.cloneNode(true).play();
    renderHands(false, true);
    await delay(600);

    document.getElementById('actionBtns').style.display = 'flex';
    document.getElementById('splitBtn').style.display = 'none'; 
    document.getElementById('doubleBtn').style.display = 'block';

    if (handScore(playerCards) === 21) playerStand();
}

function getActiveHand() {
    return currentHandIndex === 0 ? playerCards : splitHandCards;
}

function playerHit() {
    if (!gameActive) return;
    const activeHand = getActiveHand();
    activeHand.push(deck.pop());
    dealSound.cloneNode(true).play();
    renderHands(false);
    
    document.getElementById('doubleBtn').style.display = 'none';
    document.getElementById('splitBtn').style.display = 'none';
    
    if (handScore(activeHand) > 21) {
        if (splitHandCards && currentHandIndex === 0) {
            currentHandIndex = 1;
            renderHands(false);
            document.getElementById('doubleBtn').style.display = 'block'; // Reset double for hand 2
            if (handScore(getActiveHand()) === 21) playerStand();
        } else {
            // Check if BOTH hands busted (if split exists) or if single hand busted
            const h1Bust = handScore(playerCards) > 21;
            const h2Bust = splitHandCards ? handScore(splitHandCards) > 21 : true;
            if (h1Bust && h2Bust) endGame('bust');
            else { renderHands(true); dealerPlay(); }
        }
    } else if (handScore(activeHand) === 21) {
        playerStand();
    }
}

function playerStand() {
    if (!gameActive) return;
    
    if (splitHandCards && currentHandIndex === 0) {
        currentHandIndex = 1;
        renderHands(false);
        document.getElementById('doubleBtn').style.display = 'block';
        document.getElementById('splitBtn').style.display = 'none';
        if (handScore(getActiveHand()) === 21) playerStand();
    } else {
        renderHands(true);
        dealerPlay();
    }
}

async function playerDouble() {
    if (!gameActive) return;
    const activeHand = getActiveHand();
    if (activeHand.length !== 2) return;
    
    try {
        document.getElementById('actionBtns').style.display = 'none';
        const extraBet = originalBetETH;
        const tx = await contract.placeBet({ value: ethers.parseEther(extraBet.toString()), gasLimit: 200000 });
        await tx.wait();
        if (currentHandIndex === 0) {
            betETH += originalBetETH;
        } else {
            splitBetETH += originalBetETH;
        }
        sessionBet += originalBetETH;
    } catch(e) {
        console.error('Double bet failed:', e);
        document.getElementById('actionBtns').style.display = 'flex';
        return;
    }
    
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    await delay(600);
    
    activeHand.push(deck.pop());
    dealSound.cloneNode(true).play();
    renderHands(false, true);
    await delay(600);
    
    if (handScore(activeHand) > 21) {
        if (splitHandCards && currentHandIndex === 0) {
            currentHandIndex = 1;
            document.getElementById('actionBtns').style.display = 'flex';
            renderHands(false);
            document.getElementById('doubleBtn').style.display = 'block';
            if (handScore(getActiveHand()) === 21) playerStand();
        } else {
            const h1Bust = handScore(playerCards) > 21;
            const h2Bust = splitHandCards ? handScore(splitHandCards) > 21 : true;
            if (h1Bust && h2Bust) endGame('bust');
            else { renderHands(true); dealerPlay(); }
        }
    } else { 
        document.getElementById('actionBtns').style.display = 'flex';
        playerStand(); 
    }
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
    endGame('evaluate');
}

async function endGame(reason) {
    gameActive = false;
    document.getElementById('actionBtns').style.display = 'none';
    document.getElementById('insuranceModal').style.display = 'none';
    renderHands(true);

    let totalPayoutETH = 0;
    let anyWin = false;
    let isBlackjack = false;
    const msg = document.getElementById('gameMessage');
    
    const dScore = handScore(dealerCards);
    const dealerBust = dScore > 21;
    const dealerHasBJ = dScore === 21 && dealerCards.length === 2;

    const evaluate = (cards, handBet) => {
        const pScore = handScore(cards);
        if (pScore > 21) return { s: 'BUST', p: 0 };
        if (pScore === 21 && cards.length === 2 && !splitHandCards && reason === 'blackjack') {
            return { s: 'BLACKJACK', p: handBet * 2.5 };
        }
        if (reason === 'bust') return { s: 'BUST', p: 0 }; 
        if (dealerBust) return { s: 'WIN', p: handBet * 2 };
        if (pScore > dScore) return { s: 'WIN', p: handBet * 2 };
        if (pScore === dScore) return { s: 'PUSH', p: handBet };
        return { s: 'LOSE', p: 0 };
    };

    if (splitHandCards) {
        const res1 = evaluate(playerCards, betETH);
        const res2 = evaluate(splitHandCards, splitBetETH);
        totalPayoutETH = res1.p + res2.p;
        anyWin = res1.p > 0 || res2.p > 0;
        
        msg.innerText = `H1: ${res1.s} | H2: ${res2.s}`;
        if (res1.s === 'WIN' || res2.s === 'WIN') msg.className = 'game-message win show';
        else if (res1.s === 'PUSH' && res2.s === 'PUSH') msg.className = 'game-message push show';
        else msg.className = 'game-message lose show';
        
        if (anyWin) winSound.cloneNode(true).play();
    } else {
        let res;
        if (reason === 'blackjack') { res = { s: '🃏 BLACKJACK!', p: betETH * 2.5 }; isBlackjack = true; }
        else if (reason === 'bust') res = { s: '💀 BUST!', p: 0 };
        else res = evaluate(playerCards, betETH);
        
        totalPayoutETH = res.p;
        anyWin = totalPayoutETH > 0 && res.s !== 'PUSH';
        
        if (res.s === 'WIN') { msg.innerText = 'WIN'; msg.className = 'game-message win show'; }
        else if (res.s === 'LOSE') { msg.innerText = dealerHasBJ ? '🃏 DEALER BJ!' : '😞 LOSE'; msg.className = 'game-message lose show'; }
        else if (res.s === 'PUSH') { msg.innerText = '🤝 PUSH'; msg.className = 'game-message push show'; }
        else { msg.innerText = res.s; msg.className = res.s.includes('WIN') || res.s.includes('BLACKJACK') ? 'game-message win show' : 'game-message lose show'; }
        
        if (anyWin || reason === 'blackjack') winSound.cloneNode(true).play();
    }

    // --- INSURANCE PAYOUT ---
    if (hasInsurance) {
        if (dealerHasBJ) {
            const insPayout = insuranceBet * 3; // 2:1 win + stake back
            totalPayoutETH += insPayout;
            msg.innerText += " 🛡️ Insurance Paid!";
        }
        hasInsurance = false;
        insuranceBet = 0;
    }

    // --- SIDE BETS PAYOUT ADDITION ---
    totalPayoutETH += sideBetPayoutETH;
    if (sideBetPayoutETH > 0) anyWin = true;

    sessionPlayed++;
    if (anyWin || isBlackjack) sessionWon++;
    sessionWin += totalPayoutETH;
    updateStats();

    // Settle via backend API
    try {
        const bjAddr = typeof BLACKJACK_ADDRESS !== 'undefined' ? BLACKJACK_ADDRESS : '';
        const totalWagered = originalBetETH + splitBetETH + ppBetETH + plus3BetETH;
        await fetch(`${API_URL}/api/blackjack/settle`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ 
                playerAddress: walletAddress, 
                betETH: totalWagered, 
                payoutETH: totalPayoutETH, 
                playerWon: anyWin, 
                isBlackjack, 
                contractAddress: bjAddr,
                sideBetDetails
            })
        });
    } catch(e) { console.log('Settle API error:', e); }

    let historyStatus = splitHandCards ? 'Split' : (reason === 'evaluate' ? (totalPayoutETH > 0 ? 'Win' : 'Lose') : reason);
    addToHistory(historyStatus, totalPayoutETH);
    updateBalance();

    document.getElementById('dealBtn').disabled = false;
    document.getElementById('dealBtn').innerText = '🃏 DEAL';
    document.getElementById('bettingTableSpots').style.opacity = '1';
    document.getElementById('bettingTableSpots').style.pointerEvents = 'all';
}

function updateStats() {
    document.getElementById('stPlayed').innerText = sessionPlayed;
    document.getElementById('stWon').innerText = sessionWon;
    document.getElementById('stBet').innerText = sessionBet.toFixed(3);
    document.getElementById('stWin').innerText = sessionWin.toFixed(3);
}

function addToHistory(result, payout) {
    const tbody = document.getElementById('historyBody');
    const totalBet = originalBetETH + splitBetETH + ppBetETH + plus3BetETH;
    const cls = payout > totalBet ? 'green' : payout === totalBet ? '' : 'red';
    const labels = { blackjack:'BLACKJACK 🃏', win:'WIN ✅', dealer_bust:'WIN ✅', push:'PUSH 🤝', bust:'BUST ❌', lose:'LOSE ❌' };
    
    let resText = labels[result] || labels[result.toLowerCase()] || result.toUpperCase();
    
    const row = tbody.insertRow(0);
    row.innerHTML = `<td>${new Date().toLocaleTimeString()}</td><td>${totalBet.toFixed(3)} ETH</td><td class="${cls}">${resText}</td><td class="${cls}">${payout.toFixed(3)} ETH</td>`;
    if (tbody.rows.length > 20) tbody.deleteRow(20);
}

// Auto-connect
window.addEventListener('load', () => { if (localStorage.getItem('isLoggedIn') === 'true') connectWallet(); });
