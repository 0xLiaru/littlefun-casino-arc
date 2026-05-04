// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Blackjack {
    address public owner;
    uint256 public constant MIN_BET = 0.01 ether;

    struct ActiveBet {
        uint256 amount;
        bool active;
    }

    mapping(address => ActiveBet) public bets;

    event BetPlaced(address indexed player, uint256 amount, uint256 seed);
    event GameSettled(address indexed player, uint256 betAmount, uint256 payout, bool playerWon);

    constructor() payable { owner = msg.sender; }

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    // Player places a bet - ETH is locked in contract
    // Can be called again for Double Down (adds to existing bet)
    function placeBet() external payable {
        require(msg.value >= MIN_BET, "Bet too low");
        
        if (bets[msg.sender].active) {
            // Double Down: add to existing bet
            bets[msg.sender].amount += msg.value;
        } else {
            bets[msg.sender] = ActiveBet(msg.value, true);
        }
        
        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp, block.prevrandao, msg.sender, gasleft()
        )));
        
        emit BetPlaced(msg.sender, msg.value, seed);
    }

    // Owner settles the bet after game completes
    function settle(address player, uint256 payout) external onlyOwner {
        require(bets[player].active, "No active bet");
        
        uint256 betAmount = bets[player].amount;
        bets[player].active = false;
        bets[player].amount = 0;

        bool playerWon = payout > 0;

        if (playerWon && address(this).balance >= payout) {
            payable(player).transfer(payout);
        }

        emit GameSettled(player, betAmount, payout, playerWon);
    }

    // Cancel bet (return to player) - emergency
    function cancelBet(address player) external onlyOwner {
        require(bets[player].active, "No active bet");
        uint256 amount = bets[player].amount;
        bets[player].active = false;
        bets[player].amount = 0;
        payable(player).transfer(amount);
    }

    function deposit() external payable {}
    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    receive() external payable {}
}
