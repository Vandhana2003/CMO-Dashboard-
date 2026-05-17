# CMO Command Centre Dashboard

## Full-Stack Enterprise Analytics Dashboard

### Tech Stack
- **Frontend**: React (Vite) + Chart.js + Vanilla CSS  
- **Backend**: Node.js + Express.js + REST API  
- **Database**: PostgreSQL  
- **Utilities**: XLSX parsing, Session Storage, Fetch API

---

## Prerequisites

1. **Node.js** v18+ — [Download](https://nodejs.org/)
2. **PostgreSQL** v14+ — [Download](https://www.postgresql.org/download/windows/)

---

## PostgreSQL Setup

### 1. Install PostgreSQL
- Download from https://www.postgresql.org/download/windows/
- During installation, set password for `postgres` user (default: `postgres`)
- Remember the port (default: `5432`)

### 2. Create the Database
Open **pgAdmin** or **psql** terminal and run:
```sql
CREATE DATABASE cmo_dashboard;
```

### 3. Run the Schema
Using psql:
```bash
psql -U postgres -d cmo_dashboard -f database/init.sql
```
Or paste the contents of `database/init.sql` into pgAdmin Query Tool.

### 4. Update Connection Settings
Edit `server/.env` if your PostgreSQL credentials differ:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cmo_dashboard
DB_USER=postgres
DB_PASSWORD=your_password_here
```

---

## Quick Start

### 1. Install Backend Dependencies
```bash
cd server
npm install
```

### 2. Install Frontend Dependencies
```bash
cd client
npm install
```

### 3. Start Backend Server
```bash
cd server
npm run dev
```
Server runs at http://localhost:5000

### 4. Start Frontend Dev Server
```bash
cd client
npm run dev
```
Frontend runs at http://localhost:5173

---

## Default Login

| Field | Value |
|-------|-------|
| Email | admin@cmo.com |
| Password | admin123 |
| Role | Super Admin |

---

## Project Structure
```
123/
├── client/          # React Frontend (Vite)
│   ├── src/
│   │   ├── components/   # Layout, InfoCenter
│   │   ├── context/      # Auth, Theme contexts
│   │   ├── pages/        # All page components
│   │   ├── services/     # API service layer
│   │   ├── App.jsx       # Router + Providers
│   │   └── index.css     # Design system
│   └── package.json
├── server/          # Express Backend
│   ├── config/      # DB connection
│   ├── controllers/ # Business logic
│   ├── middleware/   # Auth + RBAC
│   ├── routes/      # API routes
│   ├── utils/       # Formulas + Excel parser
│   └── server.js    # Entry point
└── database/
    └── init.sql     # PostgreSQL schema
```
