# LandGuard Africa: Intelligent Chat Engine — Install Guide

This update REPLACES the scripted chatbot with a real language-model request. It keeps all existing application, officer, auditor and eligibility-checker functions. It does not overwrite `.env` or remove your database.

## Step 1. Open the correct project folder

Open PowerShell:

```powershell
cd "C:\Users\Dylan Choga\Desktop\LANDGUARD\LandGuard_Africa_Phase1\LandGuard_Africa_Phase1"
Test-Path .\docker-compose.yml
```

The last command must show `True`.

## Step 2. Back up the current application source

You can make a folder copy in File Explorer. The update changes only:

- `backend/app/smart_assistant.py` (new)
- `backend/app/main.py`
- `backend/requirements.txt`
- `backend/tests/test_api.py`
- `frontend/src/App.jsx`
- `frontend/src/styles.css`
- `docker-compose.yml`

Your `.env` and database are untouched.

## Step 3. Extract update

Download `LandGuard_Smart_AI_Update.zip` and save it to your Windows Downloads folder.

```powershell
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\LandGuard_Smart_AI_Update.zip" -DestinationPath (Get-Location).Path -Force
Test-Path .\backend\app\smart_assistant.py
```

You should see `True`.

## Step 4. Connect a REAL model (recommended: OpenAI)

Go to https://platform.openai.com/api-keys and create an API key with active API billing. ChatGPT Plus doesn't automatically supply API credits.

Open your existing configuration file:

```powershell
notepad .env
```

Set or CHANGE these values (only one copy of each key):

```ini
AI_PROVIDER=openai
OPENAI_MODEL=gpt-5.4-mini
OPENAI_API_KEY=YOUR_ACTUAL_OPENAI_API_KEY
```

Don't share your real key or commit your `.env` file to GitHub.

Keep all your existing JWT_SECRET, POSTGRES_PASSWORD and three account passwords as they were.

## Step 5. Rebuild and restart the updated containers

```powershell
docker compose -p landguard_africa_phase1 up -d --build --force-recreate
```

You do NOT need to delete containers or volumes. Never run `docker compose down -v` for this update.

## Step 6. Verify the AI is actually configured

```powershell
docker compose -p landguard_africa_phase1 exec api python -c "from app.smart_assistant import config_status; print(config_status())"
```

Expected (the model name might vary if you changed it):

```text
{'provider': 'openai', 'model': 'gpt-5.4-mini', 'configured': True}
```

This confirms the API key is present, not that live billing works. The next chat request confirms that.

## Step 7. Open the site and try these questions

Go to http://localhost:8080, log in as applicant and open Housing assistant. Hard-refresh (Ctrl+Shift+R).

- "What is the maximum combined household income for an RDP home?"
- "My household earns R4,000. What other housing help is available?"
- "Can you explain the difference, simply?" (tests memory)
- "What about the waiting list?"

A successful response shows `Powered by gpt-5.4-mini` below the answer. No keyword-routing fallback will silently pose as AI.

## Optional: Run offline with Ollama instead of OpenAI

Install Ollama for Windows from https://ollama.com/download/windows, then:

```powershell
ollama pull qwen2.5:3b
ollama run qwen2.5:3b
```

Exit the interactive chat with `/bye`, ensure Ollama remains running. Change `.env`:

```ini
AI_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

Then restart:

```powershell
docker compose -p landguard_africa_phase1 up -d --build --force-recreate api web
```

Offline models may be substantially less capable than the cloud option, and need enough computer RAM/CPU/GPU.

## Troubleshooting

If it still gives generic answers, run:

```powershell
docker compose -p landguard_africa_phase1 exec api python -c "from app.smart_assistant import config_status; print(config_status())"
docker compose -p landguard_africa_phase1 logs --tail=60 api
```

If `configured` is False, fix your .env API key and recreate API. If it says model not found, check the model name in .env and your API access. If you see older preset replies, the running containers still use old code: rebuild with `--no-cache` and inspect `docker ps` to see which web container is bound to port 8080.

The system only uses source excerpts pinned at the time this update was prepared. It does NOT automatically search the live web. It is not integrated with an official government housing database. Do not put real ID numbers, documents, addresses or bank details into the chat. Before real public launch, obtain a security and privacy review, update sources on a schedule, and assess POPIA obligations.
