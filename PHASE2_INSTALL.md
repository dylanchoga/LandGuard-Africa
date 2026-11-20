# LandGuard Africa — Phase 2: Housing Assistant

This upgrade adds a Housing Assistant workspace to the existing applicant portal. It retains the previous login/role selector, housing application management, officer permissions, audit history and PostgreSQL data.

## New capabilities

- Housing assistant conversations (LangGraph router + LangChain/OpenAI for free-form questions when an API key is configured)
- Document requirement guidance with links to official sources
- Preliminary eligibility screening with deterministic, documented rules (not an automatic approval)
- Application progress explanations retrieved only for the signed-in applicant
- No identity document upload in this update; document scanning/OCR is planned later

## Install on Windows PowerShell

**1. Start in the inner application folder**

```powershell
cd "C:\Users\Dylan Choga\Desktop\LANDGUARD\LandGuard_Africa_Phase1\LandGuard_Africa_Phase1"
Test-Path .\docker-compose.yml
```

The second command must output `True`. If it does not, locate the directory with `docker-compose.yml` before doing anything else.

**2. Save a source-code backup (optional, recommended)**

In File Explorer, copy the inner `LandGuard_Africa_Phase1` project folder to a backup location. The update ZIP does not include `.env` or database files.

**3. Extract the ZIP *into that inner folder***

```powershell
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\LandGuard_Africa_Phase2_Update.zip" -DestinationPath (Get-Location).Path -Force
```

**4. Confirm the new files exist**

```powershell
Test-Path .\backend\app\housing_assistant.py
Select-String -Path .\frontend\src\App.jsx -Pattern 'Housing assistant'
```

The first result must be `True` and the second should display matches.

**5. Add an OpenAI API key if you want generative AI responses**

```powershell
notepad .env
```

At the end of your existing `.env`, add:

```ini
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

For model-generated responses, place your API key directly after `OPENAI_API_KEY=` on your own computer. **Never share or commit that key.** OpenAI API access is billed separately from a ChatGPT plan. Without a key, LandGuard's scoped status, document checklist and eligibility guidance still run using explicit rules; free-form questions use bounded fallback text.

The model can be changed through `OPENAI_MODEL` if necessary.

**6. Rebuild Docker without deleting your data**

```powershell
docker compose -p landguard_africa_phase1 up -d --build --force-recreate
docker compose -p landguard_africa_phase1 ps
```

Keep the same `-p landguard_africa_phase1` project identifier you used for Phase 1 to reuse the same PostgreSQL volume. Never use `down -v` during the upgrade.

**7. Open the website**

Visit `http://localhost:8080` and press `Ctrl + Shift + R` if necessary. Sign in as the applicant using your existing credentials. The navigation contains **Housing assistant**.

**8. Try these tests**

1. Ask **What documents do I need?** — the assistant should give a checklist and links to the Department of Human Settlements.
2. Ask **I earn R2800 per month. Am I eligible?** — it should explain that an income-band match does not establish eligibility.
3. Ask **Track my application** — it should return only statuses from your account, not invent government data.
4. Complete **Check eligibility** (R2800, 28 years old, citizen, no previous subsidy, no prior property, has dependants). It should show the published income band and additional checks.
5. Sign in as Housing Officer or Auditor. The applicant-only assistant should not appear, and its API endpoints should reject those roles.

## Troubleshooting

See the API logs:

```powershell
docker compose -p landguard_africa_phase1 logs --tail=100 api
```

See the frontend build logs:

```powershell
docker compose -p landguard_africa_phase1 logs --tail=100 web
```

If Docker errors on dependency installation, check that Docker Desktop has network access and re-run the build. If the assistant returns fallback guidance when you expected a model-generated answer, check that `.env` contains a valid API key and that API access/billing is active, then rebuild/recreate the containers.

## File changes

- `frontend/src/App.jsx` — Assistant page, chat UI, eligibility form, navigation
- `frontend/src/styles.css` — Assistant styling
- `backend/app/housing_assistant.py` — LangGraph workflow, eligibility rules, source links and optional LangChain model
- `backend/app/main.py` — Applicant-only API endpoints
- `backend/requirements.txt` — LangGraph and LangChain/OpenAI dependencies
- `docker-compose.yml` — Passes the optional API configuration to the server
- `backend/tests/test_api.py` — API tests for new functionality

## Design and deployment notes

- This update is for local development and controlled testing. The current application's identity and permissions system is not ready for exposure to real applicant data.
- Applicants should not paste identity numbers or financial account details into chat. The backend masks common patterns before optional model calls, but regex masking is not guaranteed to detect all sensitive data.
- Formal screening, beneficiary approval and government status access require authorised integrations. The assistant cannot make those decisions or query the government database.
- Housing programme requirements vary by municipality and can change. Published sources linked in answers need ongoing maintenance.
- Future work: actual document upload and analysis with private storage, anomaly detection, Avalanche record commitments and audit verification.

**Official sources used**
- https://www.dhs.gov.za/FAQ
- https://www.dhs.gov.za/Programmes
- https://www.capetown.gov.za/city-connect/register/housing-and-property/register-on-the-housing-needs-register/
