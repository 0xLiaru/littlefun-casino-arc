import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PlinkoModule", (m) => {
  const plinko = m.contract("Plinko");

  return { plinko };
});
