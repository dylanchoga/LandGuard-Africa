
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import BlockchainOutbox
from .blockchain_writer import submit_application_proof


def process_one_pending_registration(db: Session):
    """
    Process one pending blockchain registration.

    Uncertain transaction outcomes are marked for
    manual review rather than automatically retried.
    """

    # 1. Select and lock one pending registration.
    job = db.scalar(
        select(BlockchainOutbox)
        .where(
            BlockchainOutbox.state == "PENDING",
            BlockchainOutbox.operation == "REGISTER",
        )
        .order_by(
            BlockchainOutbox.created_at,
            BlockchainOutbox.id,
        )
        .limit(1)
        .with_for_update(skip_locked=True)
    )

    if job is None:
        db.rollback()
        return {"status": "NO_PENDING_REGISTRATIONS"}

    job_id = job.id
    application_id = job.proof_application_id
    commitment = job.commitment

    # 2. Mark the job as processing before
    # contacting the blockchain.
    job.state = "PROCESSING"
    job.attempts = (job.attempts or 0) + 1
    db.commit()

    # 3. Submit the proof to Avalanche Fuji.
    try:
        tx_hash = submit_application_proof(
            application_id=application_id,
            commitment=commitment,
            is_update=False,
        )

    except Exception as exc:
        db.rollback()

        # A transaction may have reached Avalanche
        # even if Python reported an error.
        # Do not blindly retry it.
        job = db.get(BlockchainOutbox, job_id)
        job.state = "NEEDS_REVIEW"
        job.last_error = (
            f"{type(exc).__name__}: {exc}"
        )[:500]

        db.commit()

        return {
            "status": "NEEDS_REVIEW",
            "job_id": job_id,
        }

    # 4. Save the confirmed blockchain transaction.
    job = db.get(BlockchainOutbox, job_id)

    job.transaction_hash = tx_hash
    job.state = "CONFIRMED"
    job.last_error = None

    db.commit()

    return {
        "status": "CONFIRMED",
        "job_id": job_id,
        "transaction_hash": tx_hash,
    }
