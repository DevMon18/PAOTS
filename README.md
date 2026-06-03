# PAOTS — Process Automation and Order Tracking System

A web-based internal order tracking system for digital printing shops.

**Stack:** React + Vite · Node.js + Express · Supabase (PostgreSQL + Storage + Auth)

---

## Project Structure

```
Trisha2/
├── frontend/        ← React app (Vite)
├── backend/         ← Express API (business logic)
└── supabase/
    └── migrations/  ← SQL files to run in Supabase dashboard
```

---

## Setup Instructions

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. In **SQL Editor**, run the migration files **in order**:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
   - `supabase/migrations/003_realtime.sql`
3. In **Storage**, create a bucket called `order-files` (set to **Private**)
4. Copy your **Project URL**, **anon key**, and **service_role key** from Settings → API

### 2. Configure Environment Variables

**Frontend** (`frontend/.env`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3001
```

**Backend** (`backend/.env`):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### 3. Install Dependencies

```bash
cd frontend
npm install

cd ../backend
npm install
```

### 4. Create First User (Manager)
In Supabase → Authentication → Users → Add user manually,  
then run this SQL to give them the manager role:
```sql
INSERT INTO users (id, username, role, is_active)
VALUES ('paste-auth-user-id-here', 'admin', 'manager', true);
```

### 5. Run Locally

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open: **http://localhost:5173**

---

## User Roles

| Role | Access |
|------|--------|
| **Staff** | New Order, Search, Payment, Collect, Claim Stub |
| **Designer** | Design Queue, Status Updates, Download Files |
| **Manager** | Everything above + Reports, Inventory, User Management |

## Status Workflow

```
Received → Designing → Printing → Ready → Collected
```
- Designer advances: Received → Designing → Printing → Ready
- Staff marks: → Collected (at pickup)

## Pricing

Default rates are in `pricing_rules` table (set in `001_schema.sql`).  
Manager can modify these via direct Supabase table editing or a future admin UI.

## Key Features

- ✅ Auto-generated Tracking ID (format: `20260603-AB1CD`)
- ✅ Real-time order updates across all connected devices
- ✅ File upload (.pdf .psd .jpg .png, max 200MB) with SHA-256 checksum
- ✅ Automatic pricing calculation from specs
- ✅ Payment tracking (Cash & E-wallet with reference number)
- ✅ Printable claim stub
- ✅ Manager reports with PDF + Excel export
- ✅ Inventory stock alerts
- ✅ Full audit log of all critical events
- ✅ Role-based access at frontend + API + database (RLS) levels

---

*PAOTS v1.0 — EVSU Software Engineering*
