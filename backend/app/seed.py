import os
from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import User
from .security import hash_password

# Starter accounts are only provisioned when the local environment enables them.
# Existing accounts are renamed in-place to preserve the ownership of saved records.
PORTAL_ACCOUNTS = [
    ('thandi@landguard.local', 'thandi@demo.landguard.local', 'Thandi Mokoena', 'applicant', 'DEMO_APPLICANT_PASSWORD'),
    ('housing@landguard.local', 'officer@demo.landguard.local', 'Housing Officer', 'admin', 'DEMO_ADMIN_PASSWORD'),
    ('oversight@landguard.local', 'auditor@demo.landguard.local', 'Oversight Officer', 'auditor', 'DEMO_AUDITOR_PASSWORD'),
]

def seed_portal_users(db: Session):
    if os.getenv('DEMO_MODE', 'false').lower() != 'true':
        return
    for email, old_email, name, role, password_key in PORTAL_ACCOUNTS:
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            existing.display_name = name
            continue
        previous = db.scalar(select(User).where(User.email == old_email))
        if previous:
            previous.email = email
            previous.display_name = name
            continue
        password = os.getenv(password_key)
        if not password or len(password) < 12:
            raise RuntimeError(f'{password_key} needs a password of at least 12 characters')
        db.add(User(email=email, display_name=name, role=role, password_hash=hash_password(password)))
    db.commit()
