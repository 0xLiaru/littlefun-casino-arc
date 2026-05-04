import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  
  console.log("📝 Deploy eden hesap:", wallet.address);

  // ─── PLINKO ────────────────────────────────
  console.log("\n🚀 Plinko kontratı deploy ediliyor...");
  const plinkoArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Plinko.sol/Plinko.json"), "utf8"));
  const plinkoFactory = new ethers.ContractFactory(plinkoArtifact.abi, plinkoArtifact.bytecode, wallet);
  const plinko = await plinkoFactory.deploy();
  await plinko.waitForDeployment();
  const plinkoAddr = await plinko.getAddress();
  console.log("✅ Plinko:", plinkoAddr);

  // Small delay to let nonce sync
  await new Promise(r => setTimeout(r, 1000));

  // ─── BLACKJACK ─────────────────────────────
  console.log("\n🃏 Blackjack kontratı deploy ediliyor...");
  const bjArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Blackjack.sol/Blackjack.json"), "utf8"));
  const bjFactory = new ethers.ContractFactory(bjArtifact.abi, bjArtifact.bytecode, wallet);
  const blackjack = await bjFactory.deploy();
  await blackjack.waitForDeployment();
  const bjAddr = await blackjack.getAddress();
  console.log("✅ Blackjack:", bjAddr);

  await new Promise(r => setTimeout(r, 1000));

  // Fund contracts one at a time
  console.log("\n💰 Kontratlar fonlanıyor (5 ETH)...");
  const tx1 = await wallet.sendTransaction({ to: plinkoAddr, value: ethers.parseEther("5") });
  await tx1.wait();
  console.log("   Plinko funded ✅");

  await new Promise(r => setTimeout(r, 500));

  const tx2 = await wallet.sendTransaction({ to: bjAddr, value: ethers.parseEther("5") });
  await tx2.wait();
  console.log("   Blackjack funded ✅");

  // Write config
  const configPath = path.join(__dirname, "../frontend/contract-config.js");
  fs.writeFileSync(configPath, `var CONTRACT_ADDRESS = "${plinkoAddr}";\nvar BLACKJACK_ADDRESS = "${bjAddr}";\n`);
  
  console.log("\n═══════════════════════════════════════");
  console.log("✅ Plinko    :", plinkoAddr);
  console.log("✅ Blackjack :", bjAddr);
  console.log("📄 contract-config.js güncellendi.");
  console.log("═══════════════════════════════════════");
}

main().catch((error) => {
  console.error("\n❌ Hata:", error.message);
  process.exit(1);
});
