# LANDGUARD AFRICA — PHASE 1: START HERE (WINDOWS)

**What this is:** A working educational starter app: React website + Python/FastAPI backend + PostgreSQL database, joined by Docker Compose. It supports three *fictional* user roles: applicant, housing officer, auditor. It is **not connected to South African government systems**.

**Not yet included:** AI model, OCR, Avalanche transaction, smart contracts, official eligibility, real document uploads, external hosting. Those belong to later phases.

## 0. Install prerequisites

1. **Visual Studio Code**: https://code.visualstudio.com/
2. **Docker Desktop for Windows**: https://www.docker.com/products/docker-desktop/ ; enable the WSL 2 engine if prompted. Launch Docker Desktop and wait until the engine says it is running.
3. **Git for Windows** (optional for the first run; required for GitHub later): https://git-scm.com/download/win
4. **Python 3** (optional, only used here to generate a JWT secret): https://www.python.org/downloads/windows/

You **do not** need to install Node.js or PostgreSQL separately if using Docker Compose: they run inside the containers.

## 1. Extract project

1. Download the ZIP from the ChatGPT response.
2. Right-click the ZIP in Windows File Explorer and choose **Extract All**.
3. Open VS Code > **File > Open Folder** > select the extracted `LandGuard_Africa_Phase1` folder.
4. In VS Code select **Terminal > New Terminal**. Ensure the terminal says PowerShell (or use PowerShell directly).
5. The terminal path should end in `LandGuard_Africa_Phase1` and include `docker-compose.yml`.

## 2. Create local environment variables (one time)

In VS Code Terminal (PowerShell), run:

```powershell
Copy-Item .env.example .env
```

Open the new `.env` file in VS Code. Replace the line beginning `JWT_SECRET=` with a newly generated secret. If Python is installed, generate it by running:

```powershell
py -c "import secrets; print(secrets.token_hex(32))"
```

Paste the generated 64-character string **after** `JWT_SECRET=`. Do not include quotation marks. You can adjust the fictional user passwords in `.env` if you wish. Do **not** share `.env`, add it to GitHub, or put real personal information into the demo.

Sample `.env` content (your JWT secret must be different):

```
JWT_SECRET=YOUR_OWN_LONG_RANDOM_64_HEX_CHARACTER_SECRET
POSTGRES_PASSWORD=landguard_local_only_change_me
DEMO_APPLICANT_PASSWORD=ApplicantDemo2026!
DEMO_ADMIN_PASSWORD=AdminDemo2026!
DEMO_AUDITOR_PASSWORD=AuditorDemo2026!
```

**Why?** `.env` stores local settings and secrets, while `.env.example` shows the variable names and can be safely included in the repository. In this educational build, demo passwords are intentionally visible to the developer; do not use these for real people.

## 3. Start Docker

Open Docker Desktop, ensure the engine is ready. In PowerShell, confirm:

```powershell
docker --version
docker compose version
```

From the project root folder, run:

```powershell
docker compose up --build -d
```

The first run downloads base images and installs software inside the containers. This requires an internet connection.

Check status:

```powershell
docker compose ps
```

You should see three services: `db`, `api`, and `web`. All should be running (db should also show healthy).

If there is an error, inspect it with:

```powershell
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```

## 4. Open the website

In your browser go to:

**http://localhost:8080**

You should see LandGuard Africa's sign-in screen and the label **SIMULATION ONLY — NOT A GOVERNMENT SERVICE**.

The three demo accounts are:

| Role | Email | Password from the example `.env` |
|---|---|---|
| Applicant | `thandi@demo.landguard.local` | `ApplicantDemo2026!` |
| Housing officer | `officer@demo.landguard.local` | `AdminDemo2026!` |
| Auditor | `auditor@demo.landguard.local` | `AuditorDemo2026!` |

If you changed passwords in `.env`, use your changed values instead.

## 5. Follow the first complete user journey

**Applicant (Thandi):**

1. Select **Applicant**, enter the applicant password and sign in.
2. Open **New application** in the left navigation.
3. Keep the default fictional name or enter another invented name, choose Gauteng, enter income R2,800 and 3 household members.
4. Click **Save fictional application**.
5. Open **Applications** and click the newly created record.
6. It should show `Submitted (demo)` and a history event `APPLICATION CREATED`.
7. Sign out.

**Administrator:**

8. Select **Housing officer** and sign in using its password.
9. Open **Applications**. You should find the fictional application.
10. Click the application. Choose `Under review` and enter a meaningful reason such as `Reviewing the fictional application documentation`.
11. Click **Record change**.
12. The status should change and a `STATUS CHANGED` history event should appear.
13. Sign out.

**Auditor:**

14. Select **Auditor**, sign in and open **Applications**.
15. Select the application. You should see a pseudonymous reference, status, and history, but not the applicant's full name or household income.
16. This demonstrates the first phase of oversight visibility and role-based access.

**What this proves:** the frontend can send real requests to FastAPI, FastAPI checks who the user is, it reads/writes to PostgreSQL, and an audit history is created.

**What this does NOT prove yet:** government eligibility, government application filing, AI analysis, Avalanche proofs, or protection against a privileged database administrator silently editing the audit log. That is why we have Phase 2 and Phase 3.

## 6. Verify the API (optional but useful)

With the containers running, open:

**http://localhost:8080/api/health**

Expected JSON:

```json
{"status":"ok","product":"LandGuard Africa","mode":"fictional-demo"}
```

This confirms the web server can reach your backend.

## 7. Stop and restart

When you're done:

```powershell
docker compose down
```

To start later without rebuilding:

```powershell
docker compose up -d
```

The PostgreSQL named volume preserves demo records after `docker compose down`.

**Never run `docker compose down -v` unless you intentionally want to erase the local PostgreSQL data.**

## 8. Common problems

- **`docker is not recognized`**: Docker Desktop is not installed, or the terminal needs restarting.
- **`Cannot connect to Docker daemon`**: start Docker Desktop and wait for the engine to be ready; check the WSL 2 setup.
- **`JWT_SECRET must contain at least 32 characters`**: the `.env` secret was not replaced correctly.
- **Website doesn't open**: run `docker compose ps` then `docker compose logs --tail=100 web`.
- **Database refuses connection**: run `docker compose logs --tail=100 db`, check `.env`, and make sure Docker is running. If you change the Postgres password *after the database was first created*, the old database volume still uses its original password: use the original value or intentionally reset the demo volume after making a backup.
- **`Port 8080 already in use`**: edit `docker-compose.yml`, change `127.0.0.1:8080:80` to `127.0.0.1:8081:80` and open `http://localhost:8081`.
- **Wrong demo password**: check your `.env` file. Seeded accounts are created once, so password changes after first start will not automatically change their stored password hashes.
- **Vite/build downloads fail**: Docker needs access to the internet to download the Node/npm dependencies and base images. Retry with a working connection.

## 9. Next phase

Once the exact steps above work, Phase 2 adds:
- AI housing information assistant (LangChain + LangGraph), **grounded in verified rules**.
- Deterministic preliminary screening; never an official approval.
- A document completeness checker using **fictional sample documents**.

Phase 3 adds:
- Avalanche Fuji C-Chain and Solidity contract.
- Privacy-preserving cryptographic commitments of record versions.
- Authorised review and multi-signoff workflows.
- The big demo: altered database record fails blockchain integrity verification.

Read `README.md` for full file-by-file explanations and security limits.
