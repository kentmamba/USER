# Barangay Residents Portal — Smart Profiling & Complaint Management System

A full-stack app recreating the Barangay Residents Portal screens: Sign In, Register Household,
Dashboard, Services (Barangay Justice), File Complaint, Track Request, and Resident Profile.

## Stack
- **Frontend:** React 18 + React Router, built with Vite
- **Backend:** Node.js + Express (REST API) + PostgreSQL (Neon), via the `pg` driver

## ⚠️ This app now shares a backend with the Admin Dashboard

This portal's `backend/` folder is a copy of the **admin-poblacion** backend, not a
separate one. Residents who register or file a complaint here are written straight into
the same `residents` / `complaints` tables the barangay office sees in their admin
dashboard — so a new registration or complaint shows up there immediately, and any
status update an officer makes there flows back into this app's Dashboard / Track pages.

Only **one** of these backends needs to run at a time (they're the same code, pointed at
the same database). If you're also running the admin dashboard, you can skip step 1 below
entirely and just point `frontend/.env`'s `VITE_API_BASE` at that backend's URL instead.

If you edit backend routes in one copy, mirror the change in the other — see the note in
`admin-poblacion/README.md`.

## Structure
```
barangay-portal/
├── backend/     Node.js + Express REST API (shared with the admin dashboard)
└── frontend/    React (Vite) single-page app
```

## 1. Run the backend

```bash
cd backend
npm install
cp .env.example .env
# then edit .env and paste your Neon connection string into DATABASE_URL, plus a JWT_SECRET
npm run migrate   # creates tables (if needed) + seeds demo admin, residents, and sample data
npm start
```

The API runs at `http://localhost:4000`. `npm run migrate` seeds a demo resident-portal
login you can use right away:

- **Email:** `elena.santos@example.com`
- **Password:** `password123`

(There's also a separate demo **admin** login — `CL-8848-00X` / `admin123` — for the admin
dashboard app; it won't work here, since this portal logs in by email, not admin ID.)

### API endpoints this portal uses
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/resident-auth/register | — | Register a household / resident account |
| POST | /api/resident-auth/login | — | Log in with email + password |
| GET  | /api/resident-auth/me | ✓ | Get the logged-in resident's profile |
| PUT  | /api/resident-auth/preferences | ✓ | Toggle 2FA / push / email, set language |
| POST | /api/resident/complaints | ✓ | File a complaint (multipart — supports an evidence file) |
| GET  | /api/resident/complaints | ✓ | List the logged-in resident's complaints |
| GET  | /api/resident/complaints/:id | ✓ | Look up one of your own complaints by its case ID |
| GET  | /api/announcements | — | List announcements (public) |

The backend also exposes the full **admin** API (`/api/auth`, `/api/residents`,
`/api/complaints`, `/api/meetings`, `/api/escalations`, `/api/dashboard`) — this portal's
frontend just doesn't call those routes. See `admin-poblacion/README.md` for the full list.

## 2. Run the frontend (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open the printed URL (default `http://localhost:5500`). The app calls the backend at
the URL in `VITE_API_BASE` (defaults to `http://localhost:4000/api`) — edit `frontend/.env`
if your backend runs elsewhere.

### Frontend structure
```
frontend/src/
├── api.js                  fetch helper + localStorage session (JWT) + shape adapters
│                            for the shared admin backend (see comments in the file)
├── App.jsx                 route definitions
├── main.jsx                app entry point
├── styles.css              shared stylesheet (matches original design)
├── components/
│   ├── Navbar.jsx
│   └── ProtectedRoute.jsx  redirects to /login if not authenticated
└── pages/
    ├── Login.jsx
    ├── Register.jsx
    ├── Dashboard.jsx
    ├── Services.jsx
    ├── FileComplaint.jsx
    ├── SubmissionSuccess.jsx
    ├── Track.jsx
    └── Profile.jsx
```

`api.js` is the one file that knows about the mismatch between this portal's original
field names (`user.purok`, `complaint.nature`, `complaint.caseRef`, …) and the shared
backend's shapes (`resident.zone`, `complaint.description`, `complaint.id`, …). It exports
adapter functions (`login`, `register`, `getProfile`, `updateSecurity`,
`updatePreferences`, `fileComplaint`, `getMyComplaints`, `trackComplaint`,
`getAnnouncements`) that every page calls instead of hitting the API directly, so the
pages themselves didn't need to change field names throughout.

## Database (Neon Postgres)
`backend/.env` holds `DATABASE_URL` — a pooled Neon connection string
(`...-pooler.<region>.aws.neon.tech/<db>?sslmode=require`). Get it from your Neon
project dashboard under **Connection Details**. `backend/db/schema.sql` defines the
shared tables (`residents`, `complaints`, `announcements`, plus the admin-only `admins`,
`access_requests`, `meetings`, `escalations`); `npm run migrate` applies it and seeds
demo data if the tables are empty. It's safe to re-run.

`.env` is git-ignored — don't commit it. If a connection string is ever shared or
committed by mistake, rotate the database password from the Neon dashboard.

## Notes
- Passwords are hashed; sessions use a JWT stored in `localStorage`. Resident tokens are
  scoped (`scope: 'resident'`) so they can't be used to reach the admin-only API routes,
  and vice versa.
- ID-document upload (Register) and complaint-evidence upload (File Complaint) are both
  real uploads now — handled by `multer` on the backend and stored under
  `backend/uploads/`.
- A filed complaint's `id` (e.g. `BC-2026-00123`, `IN-2026-0045`) doubles as both the
  case reference and the tracking ID shown in this UI.
- Looking up a request on the Track page is scoped to your own account — you can't look
  up another resident's case by guessing their reference ID.
- Build for production with `npm run build` in `frontend/` (outputs to `frontend/dist`),
  then serve `dist/` with any static host.
