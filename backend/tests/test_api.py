import os
from pathlib import Path
from tempfile import TemporaryDirectory

TEMP = TemporaryDirectory()
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(TEMP.name) / 'test.db')
os.environ['JWT_SECRET'] = 'test-secret-32-characters-long-for-local-tests-only'
os.environ['DEMO_MODE'] = 'true'
os.environ['DEMO_APPLICANT_PASSWORD'] = 'ApplicantDemo2026!'
os.environ['DEMO_ADMIN_PASSWORD'] = 'AdminDemo2026!'
os.environ['DEMO_AUDITOR_PASSWORD'] = 'AuditorDemo2026!'
os.environ['AI_PROVIDER'] = 'openai'
os.environ['OPENAI_MODEL'] = 'gpt-5.4-mini'
os.environ['OPENAI_API_KEY'] = 'not-a-real-key-for-tests'

from fastapi.testclient import TestClient
from app.main import app
import app.smart_assistant as smart


def get_token(client, email, password):
    response = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert response.status_code == 200, response.text
    return {'Authorization': 'Bearer ' + response.json()['access_token']}


def test_roles_and_application_workflow():
    with TestClient(app) as client:
        applicant = get_token(client, 'thandi@landguard.local', 'ApplicantDemo2026!')
        officer = get_token(client, 'housing@landguard.local', 'AdminDemo2026!')
        auditor = get_token(client, 'oversight@landguard.local', 'AuditorDemo2026!')
        record = {'full_name':'Thandi Mokoena','monthly_income':2800,'household_members':3,'province':'Gauteng','notes':''}
        created = client.post('/api/applications', headers=applicant, json=record)
        assert created.status_code == 201
        app_id = created.json()['id']
        assert client.get('/api/applications', headers=auditor).json()[0].get('full_name') is None
        assert client.patch(f'/api/applications/{app_id}/status', headers=applicant,
                            json={'status':'UNDER_REVIEW','reason':'Only officers'}).status_code == 403
        assert client.patch(f'/api/applications/{app_id}/status', headers=officer,
                            json={'status':'UNDER_REVIEW','reason':'Review started'}).status_code == 200


def test_chat_calls_real_provider_and_uses_history(monkeypatch):
    seen = {}
    def fake_model(messages, instructions):
        seen['messages'] = messages
        seen['instructions'] = instructions
        return 'The published combined household income limit is R3,500 per month.'
    monkeypatch.setattr(smart, '_call_openai', fake_model)
    with TestClient(app) as client:
        applicant = get_token(client, 'thandi@landguard.local', 'ApplicantDemo2026!')
        officer = get_token(client, 'housing@landguard.local', 'AdminDemo2026!')
        assert client.post('/api/assistant/chat',json={'message':'What is the RDP income limit?'}).status_code == 401
        assert client.post('/api/assistant/chat',headers=officer,json={'message':'What is the RDP income limit?'}).status_code == 403
        response = client.post('/api/assistant/chat', headers=applicant, json={
            'message':'And what if my household earns R4,000?',
            'history': [{'role':'user','text':'What is the RDP income limit?'},
                        {'role':'assistant','text':'The maximum is R3,500 per month.'}],
        })
        assert response.status_code == 200, response.text
        assert response.json()['mode'] == 'real-model'
        assert response.json()['model'] == 'gpt-5.4-mini'
        assert 'R3,500' in response.json()['answer']
        assert len(seen['messages']) == 3
        assert seen['messages'][0]['role'] == 'user'
        assert seen['messages'][-1]['content'].startswith('And what if')
        assert 'R3,500' in seen['instructions']
        assert client.get('/api/assistant/status',headers=applicant).json()['configured'] is True
        assert client.get('/api/assistant/status',headers=officer).status_code == 403


def test_never_silently_return_fake_ai_when_key_missing(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    with TestClient(app) as client:
        applicant = get_token(client, 'thandi@landguard.local', 'ApplicantDemo2026!')
        response = client.post('/api/assistant/chat', headers=applicant, json={'message':'What is the income limit?'})
        assert response.status_code == 503
        assert 'not connected' in response.json()['detail']
        assert client.get('/api/assistant/status', headers=applicant).json()['configured'] is False
        assert client.post('/api/assistant/eligibility', headers=applicant, json={'monthly_income':2800}).status_code == 200


def test_redaction():
    text = 'email abc@example.com and ID 9901011234088'
    assert smart.redact_pii(text) == 'email [EMAIL REMOVED] and ID [ID NUMBER REMOVED]'
