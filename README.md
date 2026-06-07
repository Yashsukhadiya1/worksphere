# EEMS — Enterprise Employee Management System

A full-stack employee management platform with three layers:

- **Backend** — FastAPI + PostgreSQL (async SQLAlchemy + Alembic)
- **Web** — React 18 + TypeScript + Vite + Tailwind CSS
- **Mobile** — Flutter (Dart) with Riverpod + Dio

---

## Features

### Web Dashboard (Admin / HR)
- Live dashboard with stat cards — total employees, departments, present today, pending leaves, approved/rejected leaves, unread notifications
- Employees by department bar chart and leave type breakdown
- Quick-add employee directly from the dashboard (opens modal, saves to Employees page)
- Quick action links to every section of the app
- Today's attendance panel and recent leave requests panel

### Employee Management
- Full CRUD — create, view, edit, deactivate, reactivate, permanently delete
- Fields: name, email, job title, department, hire date, base salary, role
- Filter and search employees
- Role assignment during creation (employee / hr_manager / dept_manager)

### Department Management
- Create, rename, delete departments
- View employee headcount per department

### Attendance
- Employee clock in / clock out from mobile app
- Admin view of all attendance records
- Per-employee attendance history with date filtering
- Total hours auto-calculated on checkout

### Leave Management
- Employees submit leave requests (annual, sick, unpaid, other) with date range and reason
- HR / manager approves or rejects requests
- Status tracking: pending → approved / rejected
- Leave history per employee

### Payroll
- Admin runs payroll for a date range — auto-calculates gross, deductions, net for all active employees
- Per-employee payslip generation
- Payslip history view on web and mobile
- CSV export per payroll run

### Performance Management
- Admin creates named review cycles with start and end dates
- Managers submit performance reviews (1–5 star rating + comments) per employee per cycle
- Cycle summary view with average ratings
- Employee goal tracking — title, description, due date, progress % (0–100)
- Goal status: not started / in progress / completed
- Employees can view their own reviews and update goal progress

### Notifications
- In-app notification system with unread badge on bell icon
- Notifications triggered by leave approvals, payroll runs, review submissions
- Admin can send manual notifications to specific employees or broadcast to all
- Mark as read / mark all read

### Audit Logs
- Full audit trail of all write operations (create, update, delete, activate, deactivate)
- Stores actor user ID, action, entity type, entity ID, timestamp
- Admin-only access via web dashboard
- Can be cleared via `python clear_audit_logs.py`

### Authentication & Security
- JWT access + refresh token pair
- Bcrypt password hashing
- Refresh token revocation on logout
- Auto token refresh on 401 in both web and mobile clients
- Role-based route guards (web + mobile)

---

## AI / ML Features

The AI layer combines a **rule-based ML engine** (pure Python, no external ML libraries) with **Google Gemini** for natural language Q&A. All features derive from live database data.

> **Note:** AI features require a Google Gemini API key. Get one free at [aistudio.google.com](https://aistudio.google.com/apikey). Add it to `backend/.env` as `GEMINI_API_KEY=your_key_here`. The rest of the system works fully without it.

### Admin AI Features

**Attrition Risk Scoring**
Scores every active employee 0–100 for attrition risk:
- Absence rate last 30 days — weight 40
- Leave request volume last 90 days — weight 30
- Latest performance rating (lower = higher risk) — weight 30

Risk levels: `Low` (0–34) · `Medium` (35–59) · `High` (60–100)

**Department Ranking**
Ranks all departments by a composite score:
- Average performance rating across employees (60%)
- Attendance rate last 30 days (40%)

**Org-Wide Dataset Export**
Builds a comprehensive per-employee CSV with 35+ columns covering attendance, leave, payroll, performance, and goals. Refreshed on demand, used as Gemini's grounding context.

**Gemini-Powered Q&A (Admin)**
Ask any workforce question in plain English — e.g. "Who are the top 5 highest-paid employees?" or "Which department has the worst attendance?" — Gemini answers using live data.

### Employee AI Features

**Productivity Score**
Personal daily score (0–100):
- Checked in today → +40 pts
- Worked ≥ 8 hours → +20 pts
- Has a goal in progress or completed → +20 pts
- Not on approved leave → +20 pts

Levels: `Low` · `Average` · `Good` · `Excellent`

**Burnout Warning**
Counts consecutive working days without any approved leave (last 30 days). Triggers a warning at ≥ 10 consecutive days.

**Personal Monthly Dataset**
Last 6 months of personal data per month — present days, average hours, approved leaves, performance rating, net salary.

**Gemini-Powered Q&A (Employee)**
Employees ask questions about their own data — e.g. "How has my attendance been this quarter?" or "Am I at risk of burnout?"

### Gemini Model Fallback
The backend automatically tries multiple Gemini models in order until one succeeds:
`gemini-2.5-flash-preview-05-20` → `gemini-2.0-flash` → `gemini-2.0-flash-lite` → `gemini-1.5-flash-latest` → `gemini-pro`

---

## Mobile App (Flutter)

- Login screen with JWT auth
- Attendance — clock in / clock out with live status
- Leave — submit requests, view history and status
- Payslips — browse and view payslip details
- Performance — view reviews, manage goals, update progress
- AI Assistant — productivity score, burnout warning, personal Q&A
- Profile — view personal info
- Blue top nav bar and bottom nav bar
- AI button as floating action button (above bottom bar)
- Notification badge on app bar

---

## Project Structure

```
eems/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── routers/          # Route handlers
│   │   ├── services/
│   │   │   ├── ml_service.py       # Rule-based ML scoring
│   │   │   ├── ai_service.py       # Gemini integration
│   │   │   └── dataset_service.py  # Dataset refresh
│   │   └── core/             # Security, permissions, exceptions
│   ├── alembic/              # DB migrations
│   ├── .env                  # Environment variables
│   └── requirements.txt
│
├── web/
│   ├── src/
│   │   ├── api/              # Axios client + endpoint functions
│   │   ├── store/            # Zustand auth store
│   │   ├── pages/            # Dashboard, Employees, Payroll, AI, …
│   │   ├── components/       # Layout, shared UI
│   │   └── types/            # TypeScript interfaces
│   └── package.json
│
└── mobile/
    ├── lib/
    │   ├── core/api/         # Dio HTTP client + token interceptors
    │   ├── features/         # Auth, attendance, leave, payslip, performance, AI, profile
    │   └── shared/           # Models, widgets (HomeShell, NotificationBadge)
    └── pubspec.yaml
```

---

## Architecture

```
┌─────────────────┐        HTTP/REST         ┌──────────────────────────┐
│   Web (React)   │  ──────────────────────▶ │                          │
│  localhost:5173  │  Bearer JWT in header    │   Backend (FastAPI)      │
└─────────────────┘                          │   localhost:8000          │
                                             │   /api/v1/...             │
┌─────────────────┐        HTTP/REST         │                          │
│ Mobile (Flutter)│  ──────────────────────▶ │                          │
│  device/emulator │  Bearer JWT in header   └──────────┬───────────────┘
└─────────────────┘                                     │ asyncpg
                                                        ▼
                                             ┌──────────────────────────┐
                                             │   PostgreSQL              │
                                             │   localhost:5432/eems     │
                                             └──────────────────────────┘
```

### Request lifecycle
```
Request → CORS middleware → Router → Dependency injection
  → get_db() opens AsyncSession
  → get_current_user() decodes JWT → User ORM object
  → Route handler → Service → SQLAlchemy async query
  → Pydantic serialization → JSON response
```

### JWT flow
1. POST `email + password` → `/api/v1/auth/login`
2. Backend verifies bcrypt hash → returns `access_token` + `refresh_token`
3. Tokens stored (web → localStorage, mobile → flutter_secure_storage)
4. Every request: `Authorization: Bearer <access_token>`
5. On 401 → auto-refresh via `/api/v1/auth/refresh` → retry original request
6. Logout → `/api/v1/auth/logout` revokes refresh token JTI

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| PostgreSQL | 14+ |
| Node.js | 18+ |
| Flutter | 3.22+ |
| Dart SDK | 3.3+ |

---

## First-Time Setup

### 1. PostgreSQL

```sql
CREATE DATABASE eems;
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:<your_password>@localhost:5432/eems
SECRET_KEY=any_random_secret_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# Optional — required only for AI features
# Get your free key at https://aistudio.google.com/apikey
# Add it here when ready, the rest of the system works without it
GEMINI_API_KEY=
```

Run migrations:

```bash
alembic upgrade head
```

Seed the admin user:

```bash
python seed_admin.py
```

### 3. Web

```bash
cd web
npm install
```

### 4. Mobile

```bash
cd mobile
flutter pub get
```

If you hit build issues, run `flutter clean` first then `flutter pub get` again.

---

## Running the Project

### Terminal 1 — Backend

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

### Terminal 2 — Web

```bash
cd web
npm run dev
```

Dashboard: `http://localhost:5173`

### Terminal 3 — Mobile

```bash
cd mobile
flutter run
```

> For a physical device, update `_baseUrl` in `mobile/lib/core/api/api_client.dart` to your PC's WiFi IP (e.g. `http://192.168.x.x:8000/api/v1`). For Android emulator use `http://10.0.2.2:8000/api/v1`.

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/login` | Login, returns JWT pair |
| `POST /api/v1/auth/refresh` | Refresh access token |
| `POST /api/v1/auth/logout` | Revoke refresh token |
| `GET  /api/v1/auth/me` | Current user profile |
| `/api/v1/employees` | CRUD for employees |
| `/api/v1/departments` | CRUD for departments |
| `/api/v1/attendance` | Check-in/out, history |
| `/api/v1/leave` | Leave requests + approvals |
| `/api/v1/payroll` | Run payroll, payslips |
| `/api/v1/performance` | Review cycles, goals, ratings |
| `/api/v1/notifications` | In-app notifications |
| `/api/v1/ai` | ML scores + Gemini Q&A |
| `/api/v1/audit-logs` | Admin audit trail |

Full interactive docs at `http://localhost:8000/docs`.

---

## Roles

| Role | Access |
|------|--------|
| `admin` | Full access — all features, all employees |
| `hr_manager` | Employees, payroll, leave approvals |
| `dept_manager` | Their department's employees and reviews |
| `employee` | Own profile, attendance, payslips, goals |

---

## Database Migrations

```bash
# New migration after model changes
alembic revision --autogenerate -m "describe change"

# Apply all pending
alembic upgrade head

# Roll back one step
alembic downgrade -1
```

---

## Utility Scripts

| Script | Purpose |
|--------|---------|
| `seed_admin.py` | Creates the initial admin user |
| `seed_employee.py` | Seeds sample employee data |
| `reset_password.py` | Resets a user's password by email |
| `update_admin.py` | Updates admin user details |
| `clear_data.py` | Wipes all employee data, keeps admin |
| `clear_audit_logs.py` | Clears only the audit_logs table |

### Start fresh (wipe all employee data)

```bash
cd backend
venv\Scripts\activate
python clear_data.py
```

Removes: employees, attendance, leave, payroll, performance, goals, notifications, audit logs. Keeps your admin account.

### Clear only audit logs

```bash
python clear_audit_logs.py
```

---

## Database Tables (pgAdmin)

```
public
  └── Tables
        ├── users
        ├── employees
        ├── departments
        ├── attendance_records
        ├── leave_requests
        ├── payroll_runs
        ├── payslips
        ├── review_cycles
        ├── performance_reviews
        ├── goals
        ├── notifications
        └── audit_logs
```

Right-click any table → View/Edit Data → All Rows to inspect records.
