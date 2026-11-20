import json
import os
import urllib.request

from .blockchain_proofs import generate_application_proof

# Avalanche Fuji C-Chain
RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc"
EXPECTED_CHAIN_ID = 43113

# Original LandGuardRegistry contract

# LandGuardRegistryV2 contract on Avalanche Fuji
CONTRACT_ADDRESS = os.environ["LANDGUARD_REGISTRY_V2_ADDRESS"]


# Ethereum function selector for:
# verifyApplication(bytes32,bytes32)
VERIFY_SELECTOR = "9477c02b"


def blockchain_rpc(method, params):
    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    }).encode("utf-8")

    request = urllib.request.Request(
        RPC_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=15) as response:
        data = json.load(response)

    if "error" in data:
        raise RuntimeError(
            "Avalanche RPC error: " + str(data["error"])
        )

    if "result" not in data:
        raise RuntimeError("Invalid Avalanche RPC response")

    return data["result"]


def check_application_integrity(application):
    """
    Recalculate a housing application proof and compare
    it with the proof registered on Avalanche Fuji.
    """

    proof = generate_application_proof(application)

    chain_id = int(blockchain_rpc("eth_chainId", []), 16)

    if chain_id != EXPECTED_CHAIN_ID:
        raise RuntimeError("Connected to the wrong blockchain")

    application_id = proof["application_id"][2:]
    commitment = proof["commitment"][2:]

    call_data = (
        "0x"
        + VERIFY_SELECTOR
        + application_id
        + commitment
    )

    result = blockchain_rpc(
        "eth_call",
        [
            {
                "to": CONTRACT_ADDRESS,
                "data": call_data,
            },
            "latest",
        ],
    )

    if not isinstance(result, str) or len(result) != 66:
        raise RuntimeError("Unexpected smart contract response")

    verified = int(result, 16) == 1

    return {
        "status": "VERIFIED" if verified else "NOT_VERIFIED",
        "verified": verified,
        "network": "Avalanche Fuji",
        "chain_id": chain_id,
    }


# Run a standalone integrity test.
if __name__ == "__main__":
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from .models import HousingApplication

    engine = create_engine(os.environ["DATABASE_URL"])

    with Session(engine) as session:
        application = session.scalar(
            select(HousingApplication)
            .order_by(HousingApplication.created_at.desc())
            .limit(1)
        )

        if application is None:
            print("NO_APPLICATIONS_FOUND")
        else:
            outcome = check_application_integrity(application)
            print("INTEGRITY_STATUS:", outcome["status"])
            print("NETWORK:", outcome["network"])
            print("CHAIN_ID:", outcome["chain_id"])
