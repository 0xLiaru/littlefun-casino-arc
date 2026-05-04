// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Plinko {
    address public owner;
    uint256 public constant MIN_BET = 0.01 ether;

    event GameResult(address indexed player, uint256 amountIn, uint256 amountOut, uint256 multiplierScaled, uint256 slotIndex, uint8 difficulty);

    constructor() payable { owner = msg.sender; }

    function playMultiple(uint256 count, uint8 difficulty) external payable {
        require(count > 0 && count <= 50, "Max 50 balls");
        uint256 amountPerBall = msg.value / count;
        require(amountPerBall >= MIN_BET, "Bet too low");
        for (uint256 i = 0; i < count; i++) { _executePlay(amountPerBall, difficulty, i); }
    }

    function _executePlay(uint256 betAmount, uint8 difficulty, uint256 salt) internal {
        // Ihtimalleri hassas ayarlamak icin araligi 1.000.000 yaptik
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, salt, gasleft()))) % 1000000;
        uint256 multiplierScaled;
        uint256 slotIndex;

        if (difficulty == 0) { // KOLAY MOD (Ayni Oranlar - 1000 kat buyutuldu)
            if (random < 600000) { multiplierScaled = 10; slotIndex = 6; }
            else if (random < 750000) { multiplierScaled = 20; slotIndex = 4; }
            else if (random < 850000) { multiplierScaled = 50; slotIndex = 3; }
            else if (random < 900000) { multiplierScaled = 100; slotIndex = 2; }
            else if (random < 950000) { multiplierScaled = 150; slotIndex = 1; }
            else { multiplierScaled = 200; slotIndex = 0; }
        } 
        else if (difficulty == 1) { // ORTA MOD (Ayni Oranlar - 1000 kat buyutuldu)
            if (random < 600000) { multiplierScaled = 20; slotIndex = 6; }
            else if (random < 750000) { multiplierScaled = 50; slotIndex = 5; }
            else if (random < 850000) { multiplierScaled = 100; slotIndex = 4; }
            else if (random < 900000) { multiplierScaled = 150; slotIndex = 3; }
            else if (random < 950000) { multiplierScaled = 200; slotIndex = 2; }
            else if (random < 990000) { multiplierScaled = 400; slotIndex = 1; }
            else { multiplierScaled = 800; slotIndex = 0; }
        }
        else { // ZOR MOD (YENI IHTIMALLER)
            if (random < 1) { multiplierScaled = 100000; slotIndex = 0; }        // 1000x (%0.0001 - Milyonda 1)
            else if (random < 1001) { multiplierScaled = 10000; slotIndex = 1; } // 100x (%0.1 - Binde 1)
            else if (random < 51001) { multiplierScaled = 500; slotIndex = 2; }  // 5x (%5)
            else if (random < 151001) { multiplierScaled = 100; slotIndex = 3; } // 1x (%10)
            else { multiplierScaled = 10; slotIndex = 6; }                      // 0.1x (%84.89)
        }

        uint256 payout = (betAmount * multiplierScaled) / 100;
        if (payout > 0 && address(this).balance >= payout) { payable(msg.sender).transfer(payout); }
        emit GameResult(msg.sender, betAmount, payout, multiplierScaled, slotIndex, difficulty);
    }

    function deposit() external payable {}
    function withdraw() external {
        require(msg.sender == owner);
        payable(owner).transfer(address(this).balance);
    }
    receive() external payable {}
}
