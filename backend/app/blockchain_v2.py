
import os
from web3 import Web3

# Avalanche Fuji testnet
AVALANCHE_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc"
FUJI_CHAIN_ID = 43113

# Read the V2 contract address from Docker environment
CONTRACT_ADDRESS = os.getenv("LANDGUARD_REGISTRY_V2_ADDRESS")

# Minimal ABI: only the contractOwner function for now

LANDGUARD_V2_ABI = [
    {
        "inputs": [],
        "name": "contractOwner",
        "outputs": [{"type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "applicationId", "type": "bytes32"},
            {"name": "commitment", "type": "bytes32"},
        ],
        "name": "registerApplication",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "applicationId", "type": "bytes32"},
            {"name": "commitment", "type": "bytes32"},
        ],
        "name": "updateApplication",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]



def get_landguard_v2_contract():
    """Connect to the LandGuardRegistryV2 contract on Avalanche Fuji."""

    if not CONTRACT_ADDRESS:
        raise RuntimeError("LANDGUARD_REGISTRY_V2_ADDRESS is missing")

    w3 = Web3(Web3.HTTPProvider(AVALANCHE_FUJI_RPC))

    if not w3.is_connected():
        raise RuntimeError("Cannot connect to Avalanche Fuji")

    if w3.eth.chain_id != FUJI_CHAIN_ID:
        raise RuntimeError("Incorrect blockchain network")

    address = Web3.to_checksum_address(CONTRACT_ADDRESS)

    if not w3.eth.get_code(address):
        raise RuntimeError("No smart contract found at the V2 address")

    contract = w3.eth.contract(
        address=address,
        abi=LANDGUARD_V2_ABI,
    )

    return w3, contract


def get_contract_owner():
    """Read the owner wallet address from LandGuardRegistryV2."""

    _, contract = get_landguard_v2_contract()
    return contract.functions.contractOwner().call()
