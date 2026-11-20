
const { Contract, JsonRpcProvider } = require("ethers");

const abi = require("./src/contracts/LandGuardRegistry.json");

const RPC_URL =
  "https://api.avax-test.network/ext/bc/C/rpc";

const CONTRACT_ADDRESS =
  "0x4a1fCcC8137E82a2216b32b7AAb2123867C58324";

const applicationId = "0x" + "1".repeat(64);
const correctCommitment = "0x" + "a".repeat(64);
const wrongCommitment = "0x" + "b".repeat(64);

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork();

  console.log("Connected chain ID:", network.chainId.toString());

  if (Number(network.chainId) !== 43113) {
    throw new Error("Wrong blockchain network");
  }

  const contract = new Contract(
    CONTRACT_ADDRESS,
    Array.isArray(abi) ? abi : abi.abi,
    provider
  );

  const correct = await contract.verifyApplication(
    applicationId,
    correctCommitment
  );

  const incorrect = await contract.verifyApplication(
    applicationId,
    wrongCommitment
  );

  const proof = await contract.getApplicationProof(
    applicationId
  );

  console.log("Correct commitment:", correct);
  console.log("Incorrect commitment:", incorrect);
  console.log("Registered commitment:", proof[0]);
  console.log("Registered at:", proof[1].toString());
  console.log("Registered by:", proof[2]);
}

main().catch((error) => {
  console.error("Blockchain check failed:", error.message);
  process.exitCode = 1;
});

