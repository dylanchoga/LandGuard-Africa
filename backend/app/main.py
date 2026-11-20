import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session
from .db import Base, engine, SessionLocal, get_db
from .models import User, HousingApplication, AuditEvent
from .schemas import LoginInput, ApplicationInput, StatusInput
from .security import current_user, create_token, verify_password, require_roles
from .seed import seed_portal_users
from .housing_assistant import EligibilityInput, assess_eligibility
from .smart_assistant import ChatInput, chat as housing_chat, config_status

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Phase 1 only; replace create_all with migrations in a deployed version.
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_portal_users(db)
    yield

app = FastAPI(title="LandGuard Africa API", version="0.1.0", lifespan=lifespan)

@app.get("/api/health")
def health():
    return {"status": "ok", "product": "LandGuard Africa", "service": "application-api"}

@app.post("/api/auth/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.strip().lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": create_token(user), "token_type": "bearer", "user": who(user)}

def who(user):
    return {"id": user.id, "display_name": user.display_name, "email": user.email, "role": user.role}

@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return who(user)

def serialize_app(record: HousingApplication, role: str):
    base = {"id": record.id, "status": record.status, "created_at": record.created_at.isoformat(), "updated_at": record.updated_at.isoformat()}
    if role == "auditor":
        # Do not expose names, financial data, or free-text notes to auditors in the demo list.
        return base
    return {**base, "full_name": record.full_name, "monthly_income": record.monthly_income,
            "household_members": record.household_members, "province": record.province,
            "notes": record.notes}



 
@app.post("/api/applications", status_code=201)
def submit_application(
    data: ApplicationInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("applicant")),
):
    from .blockchain_proofs import generate_application_proof
    from .models import BlockchainOutbox

    if os.getenv("DEMO_MODE", "false").lower() != "true":
        raise HTTPException(
            503,
            "Application creation is currently unavailable"
        )

    # 1. Create the housing application.
    record = HousingApplication(
        applicant_user_id=user.id,
        **data.model_dump()
    )

    db.add(record)

    # Assign the application ID and database timestamps.
    db.flush()

    # 2. Generate the cryptographic blockchain proof.
    proof = generate_application_proof(record)

    # 3. Add the proof to our blockchain queue.
    blockchain_job = BlockchainOutbox(
        application_id=record.id,
        proof_application_id=proof["application_id"],
        commitment=proof["commitment"],
        operation="REGISTER",
        state="PENDING",
    )

    db.add(blockchain_job)

    # 4. Record the application submission.
    db.add(
        AuditEvent(
            application_id=record.id,
            actor_user_id=user.id,
            action="APPLICATION_CREATED",
            details={"status": "SUBMITTED"},
        )
    )

    # 5. Save the application, audit event,
    # and blockchain job in one database transaction.
    db.commit()
    db.refresh(record)

    print(
        "LANDGUARD_BLOCKCHAIN_JOB_QUEUED:",
        record.id,
    )

    # 6. Return the application to the website.
    return serialize_app(record, user.role)
   

@app.get("/api/applications")
def list_applications(db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.role not in {"applicant", "admin", "auditor"}:
        raise HTTPException(403, "Role not authorised")
    query = select(HousingApplication).order_by(HousingApplication.created_at.desc())
    if user.role == "applicant":
        query = query.where(HousingApplication.applicant_user_id == user.id)
    return [serialize_app(a, user.role) for a in db.scalars(query).all()]

def permitted_application(application_id: str, db: Session, user: User):
    if user.role not in {"applicant", "admin", "auditor"}:
        raise HTTPException(403, "Role not authorised")
    record = db.get(HousingApplication, application_id)
    if not record:
        raise HTTPException(404, "Application not found")
    if user.role == "applicant" and record.applicant_user_id != user.id:
        raise HTTPException(404, "Application not found")
    return record


@app.get("/api/applications/{application_id}")
def view_application(
    application_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    from .models import BlockchainOutbox

    record = permitted_application(application_id, db, user)
    result = serialize_app(record, user.role)

    job = db.scalar(
        select(BlockchainOutbox)
        .where(
            BlockchainOutbox.application_id == record.id,
            BlockchainOutbox.operation == "REGISTER",
        )
        .order_by(BlockchainOutbox.created_at.desc())
        .limit(1)
    )

    confirmed = bool(
        job
        and job.state == "CONFIRMED"
        and job.transaction_hash
    )

    result["blockchain"] = {
        "status": job.state if job else "NOT_QUEUED",
        "network": "Avalanche Fuji",
        "transaction_hash": (
            job.transaction_hash if confirmed else None
        ),
        "explorer_url": (
            f"https://testnet.snowtrace.io/tx/{job.transaction_hash}"
            if confirmed else None
        ),
    }

    return result


@app.get("/api/applications/{application_id}/history")
def history(application_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    permitted_application(application_id, db, user)
    events = db.scalars(select(AuditEvent).where(AuditEvent.application_id == application_id).order_by(AuditEvent.created_at)).all()
    return [{"action": e.action,
             "details": (e.details if user.role != "auditor" else {k: v for k, v in e.details.items() if k in {"before", "after", "status"}}),
             "created_at": e.created_at.isoformat()} for e in events]

ALLOWED = {
    "SUBMITTED": {"UNDER_REVIEW", "NEEDS_DOCUMENTS"},
    "UNDER_REVIEW": {"NEEDS_DOCUMENTS", "REVIEW_COMPLETE"},
    "NEEDS_DOCUMENTS": {"UNDER_REVIEW"},
    "REVIEW_COMPLETE": set(),
}

@app.patch("/api/applications/{application_id}/status")
def update_status(application_id: str, data: StatusInput, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    record = permitted_application(application_id, db, user)
    if data.status not in ALLOWED.get(record.status, set()):
        raise HTTPException(400, f"Transition {record.status} -> {data.status} is not allowed")
    before = record.status
    record.status = data.status
    db.add(AuditEvent(application_id=record.id, actor_user_id=user.id,
                      action="STATUS_CHANGED", details={"before": before, "after": data.status, "reason": data.reason}))
    db.commit()
    db.refresh(record)
    return serialize_app(record, user.role)


@app.post("/api/assistant/chat")
def assistant_chat(data: ChatInput, db: Session = Depends(get_db), user: User = Depends(require_roles("applicant"))):
    # Only this applicant's minimally necessary status data goes to the tool;
    # the language model is never given private application records.
    records = db.scalars(select(HousingApplication)
                         .where(HousingApplication.applicant_user_id == user.id)
                         .order_by(HousingApplication.created_at.desc())).all()
    summaries = [{"reference": r.id[:8].upper(), "status": r.status} for r in records]
    return housing_chat(data, summaries)

@app.post("/api/assistant/eligibility")
def assistant_eligibility(data: EligibilityInput, user: User = Depends(require_roles("applicant"))):
    return assess_eligibility(data)


@app.get("/api/assistant/status")
def assistant_status(user: User = Depends(require_roles("applicant"))):
    # Never return the API key. Allows frontend troubleshooting.
    return config_status()


@app.get("/api/applications/{application_id}/integrity")
def verify_application_integrity(
    application_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    from .blockchain_integrity import check_application_integrity

    # Only authorised oversight personnel may verify records.
    if user.role not in ("admin", "auditor"):
        raise HTTPException(
            status_code=403,
            detail="Not authorised to verify blockchain records",
        )

    # Retrieve the application from PostgreSQL.
    application = db.scalar(
        select(HousingApplication).where(
            HousingApplication.id == application_id
        )
    )

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    # Recalculate the proof and compare it with Avalanche.
    try:
        result = check_application_integrity(application)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Blockchain verification temporarily unavailable",
        )

    return {
        "application_id": application.id,
        "integrity_status": result["status"],
        "verified": result["verified"],
        "network": result["network"],
        "chain_id": result["chain_id"],
    }


from pydantic import BaseModel
from eth_account import Account
from eth_account.messages import encode_defunct


class BinanceAuditInput(BaseModel):
    address: str
    signature: str


@app.post("/api/applications/{application_id}/binance-audit")
def record_binance_audit(
    application_id: str,
    data: BinanceAuditInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("auditor")),
):
    from .models import BlockchainOutbox
    from .blockchain_integrity import check_application_integrity

    record = permitted_application(application_id, db, user)

    job = db.scalar(
        select(BlockchainOutbox)
        .where(
            BlockchainOutbox.application_id == record.id,
            BlockchainOutbox.operation == "REGISTER",
            BlockchainOutbox.state == "CONFIRMED",
        )
        .order_by(BlockchainOutbox.created_at.desc())
    )

    if not job or not job.transaction_hash:
        raise HTTPException(409, "No confirmed blockchain proof")

    try:
        integrity = check_application_integrity(record)
    except Exception:
        raise HTTPException(503, "Blockchain check unavailable")

    if not integrity["verified"]:
        raise HTTPException(409, "Blockchain integrity not verified")

    message = (
        "LandGuard Africa Audit Verification\n"
        f"Application ID: {record.id}\n"
        f"Transaction: {job.transaction_hash}\n"
        "Network: Avalanche Fuji (43113)\n"
        "Statement: I verified that the application matches "
        "its registered blockchain commitment."
    )

    try:
        recovered = Account.recover_message(
            encode_defunct(text=message),
            signature=data.signature,
        )
    except Exception:
        raise HTTPException(400, "Invalid wallet signature")

    if recovered.lower() != data.address.lower():
        raise HTTPException(400, "Signature does not match wallet")

    db.add(AuditEvent(
        application_id=record.id,
        actor_user_id=user.id,
        action="BINANCE_AUDIT_SIGNED",
        details={
            "wallet": recovered,
            "signature": data.signature,
            "message": message,
            "transaction_hash": job.transaction_hash,
        },
    ))

    db.commit()

    return {
        "status": "SIGNED",
        "wallet": recovered,
        "transaction_hash": job.transaction_hash,
    }
