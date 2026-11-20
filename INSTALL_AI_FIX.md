# LandGuard AI — Faster Answers + Offline Model (Windows)

## What changes
- Your existing portal and accounts remain unchanged.
- The RDP income question now immediately returns the verified threshold, without calling a model.
- Separate question types: income limits, fees, procedures, eligibility, documents, status.
- Optional Ollama model using LangChain (`ChatOllama`) for open-ended housing questions.
- Existing LangGraph workflow is retained. LangSmith remains disabled by default to keep local conversations private.

## Install the patch into your actual inner project folder

1. Make a source backup if you modified these five files. Do not delete your database or .env.
2. Open Windows PowerShell and enter:

```powershell
cd "C:\Users\Dylan Choga\Desktop\LANDGUARD\LandGuard_Africa_Phase1\LandGuard_Africa_Phase1"
Test-Path .\docker-compose.yml
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\LandGuard_AI_Fast_Offline_Update.zip" -DestinationPath (Get-Location).Path -Force
```

Confirm the test returns `True`. The ZIP replaces **only** `backend/app/housing_assistant.py`, `backend/requirements.txt`, `backend/tests/test_api.py`, `docker-compose.yml`, and `frontend/src/App.jsx`.

## A. For fast verified answers (no Ollama needed)

```powershell
docker compose -p landguard_africa_phase1 up -d --build --force-recreate
docker compose -p landguard_africa_phase1 ps
```

Open http://localhost:8080 and refresh with Ctrl+Shift+R. Ask:

> What is the cap on the amount of money to apply for RDP?

Expected: **R3,500 combined household income per month** plus explanation of other requirements.

## B. To run a model offline

1. Install Ollama on Windows: https://ollama.com/download/windows
2. Start Ollama and in **Windows PowerShell** download the model once:

```powershell
ollama pull qwen2.5:3b
ollama run qwen2.5:3b
```

Type `Hello` to test. Exit its chat with `/bye`. A 3B model is more practical for laptops with limited RAM, but generation speed depends heavily on CPU/GPU/RAM. Download is ~1.9 GB, with additional memory needed to run it.

3. Test the Ollama server from Windows PowerShell:

```powershell
Invoke-RestMethod http://localhost:11434/api/tags
```

4. Open your existing LandGuard `.env`:

```powershell
notepad .env
```

Add these settings at the bottom. Avoid duplicate definitions of the same keys:

```ini
AI_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_BASE_URL=http://host.docker.internal:11434
LANGSMITH_TRACING=false
```

5. Re-create the **API** with the new environment (build after initial install above):

```powershell
docker compose -p landguard_africa_phase1 up -d --build --force-recreate api web
```

6. Test host-to-container connectivity. This prints status 200 if the backend can reach Ollama:

```powershell
docker compose -p landguard_africa_phase1 exec api python -c "import urllib.request; r=urllib.request.urlopen('http://host.docker.internal:11434/api/tags', timeout=5); print(r.status)"
```

If this times out, Ollama may be listening only on Windows loopback. See https://docs.ollama.com/faq (Windows OLLAMA_HOST configuration). Binding to 0.0.0.0 can make the model accessible on your LAN, so restrict access through Windows Firewall and never expose port 11434 to the internet. 

7. Test the assistant with a broader question: `What should I do if my housing application documents are incomplete?` Some requests follow the direct document path; ask `Explain how a housing programme differs from buying a house with a mortgage` to test LLM generation.

Once downloaded and installed, local Ollama inference can work without internet. Internet is still needed for first-time model/package downloads, official source links, and future cloud deployment. Ollama is not an offline replacement for *official* housing application verification.

## Performance notes
- Verified FAQ questions do not use a language model and should be fast.
- The local model's first response may be slower while loading into RAM; `keep_alive=15m` helps subsequent replies.
- On low-end laptops, a 3B model on CPU can be slower than a cloud model. If local generation is slow, consider a smaller model such as `qwen2.5:1.5b` (pull it first, then update OLLAMA_MODEL).
- We do not log or export conversations to LangSmith by default; consent and privacy design are essential before enabling tracing for real applicant data.

## Day 2 course alignment
- LangGraph now routes verified facts, eligibility, status and generative model questions.
- LangChain integrates Ollama and optionally OpenAI.
- Pydantic validates incoming input and structured eligibility results.
- A full multi-agent system with document tools, LangSmith observability and human-in-the-loop decisions is **not yet built**. We must implement those in subsequent steps, not pretend they are already finished.

## Troubleshooting

```powershell
docker compose -p landguard_africa_phase1 logs --tail=100 api
```

No changes are made to `.env` by the ZIP, and the existing PostgreSQL volume is preserved when you rebuild containers. Never use `docker compose down -v` during this update.
