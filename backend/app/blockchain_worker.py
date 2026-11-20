
import time

from sqlalchemy.orm import Session

from .db import engine
from .blockchain_queue import process_one_pending_registration


def run_worker():
    print("LANDGUARD_BLOCKCHAIN_WORKER_STARTED", flush=True)

    while True:
        try:
            with Session(engine) as db:
                result = process_one_pending_registration(db)

            if result["status"] != "NO_PENDING_REGISTRATIONS":
                print("BLOCKCHAIN_JOB_RESULT:", result, flush=True)

            time.sleep(5)

        except Exception as exc:
            print(
                "BLOCKCHAIN_WORKER_ERROR:",
                type(exc).__name__,
                flush=True,
            )
            time.sleep(15)


if __name__ == "__main__":
    run_worker()
