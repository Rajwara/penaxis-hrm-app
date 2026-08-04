# Penaxis HRM

A Human Resource Management web app: attendance tracking, leave management, and
employee administration.

- **Backend:** FastAPI + SQLite (Python)
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS

## Demo accounts
| Role       | Email                 | Password     |
|------------|------------------------|--------------|
| Admin / HR | admin@company.com      | admin123     |
| Employee   | employee@company.com   | employee123  |

## Running locally

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API docs available at `http://localhost:8000/docs`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000`. The frontend expects the API at `http://localhost:8000`
by default — override with `NEXT_PUBLIC_API_URL` in a `.env.local` file (see
`.env.local.example`).

## Deployment

This repo is set up for:
- **Backend → Render**, via `render.yaml` (root directory `backend`)
- **Frontend → Vercel**, root directory `frontend`, with `NEXT_PUBLIC_API_URL`
  pointed at the deployed Render backend URL

Once connected, every push to `main` triggers an automatic redeploy on both
platforms.

## Features
- Employee check-in / check-out with daily & monthly attendance history
- Leave requests (date range, type, reason) with a running leave-quota balance
- Admin/HR: add & remove employees, approve/reject leave, adjust leave quotas
- Per-employee profile page with personal details, attendance, and leave history
- Two roles: Admin/HR and Employee, enforced on both API and UI
