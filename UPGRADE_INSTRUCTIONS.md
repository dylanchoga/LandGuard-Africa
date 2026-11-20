# LandGuard Africa — Portal UI Update

This update replaces the visible application design and preserves the existing application workflow.

## What's new
- Professional branded sign-in screen with editable email and password fields.
- Responsive navigation and role-specific workspace.
- Overview cards with real counts from your existing application database.
- Searchable, filterable application list.
- Clean application form with blank inputs instead of preset names.
- Activity timelines and an officer-only status-update form.
- Housing information page.
- Cleaner starter-account names and addresses.

## Install on Windows

1. Start Docker Desktop.
2. Find the directory **containing your existing `docker-compose.yml` file**. It is often:

   `C:\Users\Dylan Choga\Desktop\LANDGUARD\LandGuard_Africa_Phase1`

3. Back up your current project files first, especially any changes you have made.
4. Extract `LandGuard_Portal_UI_Update.zip` into that project directory, allowing Windows to replace matching files and merge the `frontend` and `backend` folders.
5. Your existing `.env` file is not included in the update; **keep it as it is**.
6. Open PowerShell in that project directory and run:

   ```powershell
   docker compose up -d --build
   docker compose ps
   ```

7. Open <http://localhost:8080> and refresh the browser with Ctrl+F5.

## Sign-in accounts

The account addresses in the updated local environment are:

| Account | Email address |
| --- | --- |
| Applicant | `thandi@landguard.local` |
| Housing officer | `housing@landguard.local` |
| Oversight officer | `oversight@landguard.local` |

Use the **same passwords already set in your `.env` file** (`DEMO_APPLICANT_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `DEMO_AUDITOR_PASSWORD`).

The backend migrates existing starter account email addresses in place on startup. The user's database record IDs and their application ownership are preserved. You might need to sign in again because the refreshed portal uses a new session-storage key.

## Troubleshooting

If the page looks unchanged:
- Ensure you extracted the files into the directory with `docker-compose.yml`, not a directory above it.
- Run `docker compose up -d --build` again.
- Refresh with `Ctrl+F5` or open a private browsing window.

If the login fails:
- Verify the email address against the table above.
- Use the password configured in `.env`.
- Check `docker compose logs --tail=80 api`.

If containers fail to start:
- Run `docker compose ps`.
- Run `docker compose logs --tail=80 api` and `docker compose logs --tail=80 web`.

## Important operational boundary

This update is a frontend and account presentation refresh, not production security certification. The application currently stores information in its own database and is not integrated with government application or decision systems. Do not collect real applicants' sensitive personal records until the required authorisation, privacy controls, and security reviews are in place.
