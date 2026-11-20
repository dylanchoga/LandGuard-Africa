
import os

from eth_account import Account
from web3 import Web3

from .blockchain_v2 import get_landguard_v2_contract


EXPECTED_WRITER = "0xE39df675bb195F33589af230560b840B24a7FF69"


def validate_proof(value, name):
    """Convert a blockchain proof into 32 bytes."""

    if not isinstance(value, str) or len(value) != 66:
        raise ValueError(f"{name} must be a 0x-prefixed bytes32 hex string")

    if not value.startswith("0x"):
        raise ValueError(f"{name} must start with 0x")

    try:
        result = bytes.fromhex(value[2:])
    except ValueError:
        raise ValueError(f"{name} contains invalid hexadecimal characters")

    if result == bytes(32):
        raise ValueError(f"{name} cannot be zero")

    return result


def submit_application_proof(
    application_id,
    commitment,
    is_update=False,
):
    """
    Submit an application proof to Avalanche Fuji.

    is_update=False: Register a new application.
    is_update=True: Record a new application version.
    """

    private_key = os.getenv("LANDGUARD_BACKEND_PRIVATE_KEY")

    if not private_key:
        raise RuntimeError("Backend wallet private key is missing")

    wallet = Account.from_key(private_key)

    if wallet.address.lower() != EXPECTED_WRITER.lower():
        raise RuntimeError("Incorrect backend wallet configured")

    w3, contract = get_landguard_v2_contract()

    app_id_bytes = validate_proof(application_id, "Application ID")
    commitment_bytes = validate_proof(commitment, "Commitment")

    if is_update:
        contract_function = contract.functions.updateApplication(
            app_id_bytes,
            commitment_bytes,
        )
    else:
        contract_function = contract.functions.registerApplication(
            app_id_bytes,
            commitment_bytes,
        )

    transaction = contract_function.build_transaction({
        "from": wallet.address,
        "chainId": 43113,
        "nonce": w3.eth.get_transaction_count(
            wallet.address, "pending"
        ),
        "gasPrice": w3.eth.gas_price,
    })

    signed_transaction = wallet.sign_transaction(transaction)


    # Submit the signed transaction to Avalanche
    transaction_hash = w3.eth.send_raw_transaction(
        signed_transaction.raw_transaction
    )

    tx_hash = transaction_hash.to_0x_hex()

    # Wait for Avalanche to confirm the transaction
    receipt = w3.eth.wait_for_transaction_receipt(
        transaction_hash,
        timeout=120,
        poll_latency=2,
    )

    # Confirm that the transaction succeeded
    if receipt["status"] != 1:
        raise RuntimeError(
            f"Blockchain transaction failed: {tx_hash}"
        )

    print("BLOCKCHAIN TRANSACTION CONFIRMED")
    print("TRANSACTION HASH:", tx_hash)
    print("BLOCK NUMBER:", receipt["blockNumber"])

    return tx_hash
