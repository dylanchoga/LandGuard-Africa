
import { Contract, JsonRpcProvider } from "ethers";

import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  RPC_URL,
} from "./blockchain";

// Connect to Avalanche Fuji through its public RPC.
const provider = new JsonRpcProvider(RPC_URL);

// Connect to our deployed LandGuard smart contract.
const contract = new Contract(
  CONTRACT_ADDRESS,
  Array.isArray(CONTRACT_ABI)
    ? CONTRACT_ABI
    : CONTRACT_ABI.abi,
  provider
);

// Validate a bytes32 hexadecimal value.
function validateBytes32(value) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("Expected a valid bytes32 value");
  }
}

// Ensure the RPC is connected to Fuji.
export async function checkBlockchainConnection() {
  const network = await provider.getNetwork();

  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error("Connected to the wrong network");
  }

  return {
    connected: true,
    chainId: Number(network.chainId),
    contractAddress: CONTRACT_ADDRESS,
  };
}

// Check whether an application commitment matches.
export async function verifyHousingApplication(
  applicationId,
  commitment
) {
  validateBytes32(applicationId);
  validateBytes32(commitment);

  await checkBlockchainConnection();

  return await contract.verifyApplication(
    applicationId,
    commitment
  );
}

// Retrieve the application proof from Avalanche.
export async function getApplicationProof(applicationId) {
  validateBytes32(applicationId);

  await checkBlockchainConnection();

  const [commitment, registeredAt, registeredBy] =
    await contract.getApplicationProof(applicationId);

  return {
    commitment,
    registeredAt: Number(registeredAt),
    registeredBy,
  };
}
