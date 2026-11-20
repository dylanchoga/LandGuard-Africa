
import hashlib
import hmac
import json
import os

from datetime import datetime, timezone

from .models import HousingApplication


def get_proof_secret():
    """
    Load the private cryptographic key from
    the backend's environment variables.
    """

    secret_hex = os.environ.get(
        "LANDGUARD_PROOF_SECRET", ""
    ).strip()

    if not secret_hex:
        raise RuntimeError(
            "LANDGUARD_PROOF_SECRET is not configured"
        )

    try:
        secret = bytes.fromhex(secret_hex)
    except ValueError as exc:
        raise RuntimeError(
            "Invalid proof secret format"
        ) from exc

    if len(secret) != 32:
        raise RuntimeError(
            "Proof secret must be 32 bytes"
        )

    return secret


def format_timestamp(value):
    """
    Convert database timestamps to a consistent
    UTC representation.
    """

    if not isinstance(value, datetime):
        raise ValueError("Invalid application timestamp")

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc).isoformat(
        timespec="microseconds"
    )


def application_record_data(application):
    """
    Select the fields whose integrity we want
    to verify.
    """

    return {
        "id": application.id,
        "applicant_user_id": application.applicant_user_id,
        "full_name": application.full_name,
        "monthly_income": application.monthly_income,
        "household_members": application.household_members,
        "province": application.province,
        "notes": application.notes,
        "status": application.status,
        "created_at": format_timestamp(
            application.created_at
        ),
        "updated_at": format_timestamp(
            application.updated_at
        ),
    }


def generate_application_proof(application):
    """
    Generate privacy-preserving bytes32 values
    for the LandGuardRegistry smart contract.
    """

    if not isinstance(application, HousingApplication):
        raise TypeError(
            "Expected a HousingApplication record"
        )

    secret = get_proof_secret()

    record = application_record_data(application)

    canonical_json = json.dumps(
        record,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")

    # Create a pseudonymous blockchain identifier.
    application_id_digest = hmac.new(
        secret,
        b"landguard:application-id:v1:" +
        application.id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    # Create a commitment to this record version.
    commitment_digest = hmac.new(
        secret,
        b"landguard:application-record:v1:" +
        canonical_json,
        hashlib.sha256,
    ).hexdigest()

    return {
        "application_id": "0x" + application_id_digest,
        "commitment": "0x" + commitment_digest,
    }
