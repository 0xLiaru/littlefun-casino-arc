# 🚀 LITTLEFUN - Premium Web3 Casino Platform

A high-end, realistic Web3 gaming platform featuring Blackjack and Plinko with real-time blockchain interactions and a premium casino aesthetic.

## ✨ Features
- **Real-time Blackjack:** Sequential card dealing, professional animations, and insurance options.
- **Plinko:** Multi-ball support with varying difficulties and realistic physics.
- **Web3 Integration:** Direct wallet connection and smart contract-based betting.
- **Supabase Backend:** Scalable cloud database for user stats, XP, and transaction history.
- **Premium UI:** Soft casino green felt, linen-textured cards, and smooth micro-animations.
- **Security:** 2FA support and email verification system.

## 🛠️ Technology Stack
- **Frontend:** Vanilla HTML, CSS, Javascript (with Ethers.js)
- **Backend:** Node.js, Express, Supabase
- **Blockchain:** Solidity, Hardhat, Ethers.js
- **Services:** Nodemailer (Email), Speakeasy (2FA)

## 🚦 Quick Start

### 1. Prerequisites
- Node.js installed
- Supabase account (for database)
- MetaMask wallet

### 2. Setup Database
1. Create a new Supabase project.
2. Run the SQL schema found in `backend/supabase_schema.sql` in your Supabase SQL Editor.
3. Update `backend/.env` with your `SUPABASE_URL` and `SUPABASE_KEY`.

### 3. Install Dependencies
```bash
# In root
npm install

# In backend
cd backend
npm install
```

### 4. Run Locally
Execute the `start.bat` file in the root directory. This will:
- Clean up old processes.
- Start a local Hardhat node.
- Deploy smart contracts.
- Start the Backend API (Port 3001).
- Launch the Frontend (Port 8080).

## 📄 License
MIT License - Developed for the Littlefun community.
