# CMO MVP Dashboard - Full Stack Implementation Plan

## Overview
A full-stack CMO (Chief Marketing Officer) analytics dashboard with React frontend, Node.js/Express backend, and PostgreSQL database. Features role-based access, Excel/API data import, KPI calculations, and interactive charts.

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), Chart.js, Vanilla CSS |
| Backend | Node.js, Express.js, REST API |
| Database | PostgreSQL (with pg driver) |
| Utilities | XLSX parsing, Session Storage, Fetch API |

---

## Project Structure
```
123/
├── client/                    # React Frontend (Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Navbar/
│   │   │   ├── Sidebar/
│   │   │   ├── KPICard/
│   │   │   ├── ChartCard/
│   │   │   ├── ThemeToggle/
│   │   │   ├── ProfileDropdown/
│   │   │   └── InfoCenter/
│   │   ├── pages/
│   │   │   ├── Login/
│   │   │   ├── Dashboard/
│   │   │   ├── B2B/
│   │   │   ├── B2C/
│   │   │   ├── Users/
│   │   │   ├── Report/
│   │   │   ├── Settings/
│   │   │   ├── Account/
│   │   │   └── Info/
│   │   ├── services/          # API services
│   │   ├── context/           # Auth & Theme context
│   │   ├── hooks/             # Custom hooks
│   │   ├── utils/             # Formula calculations
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   └── package.json
├── server/                    # Express Backend
│   ├── config/
│   │   └── db.js              # PostgreSQL connection
│   ├── middleware/
│   │   └── auth.js            # JWT auth middleware
│   ├── routes/
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── b2b.js
│   │   ├── b2c.js
│   │   ├── users.js
│   │   ├── reports.js
│   │   ├── settings.js
│   │   └── upload.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── dashboardController.js
│   │   ├── b2bController.js
│   │   ├── b2cController.js
│   │   ├── userController.js
│   │   ├── reportController.js
│   │   ├── settingsController.js
│   │   └── uploadController.js
│   ├── models/                # DB models
│   ├── utils/
│   │   ├── formulas.js        # KPI formula engine
│   │   └── excelParser.js     # XLSX parser
│   ├── server.js
│   └── package.json
└── database/
    └── init.sql               # PostgreSQL schema
```

---

## Execution Phases

### Phase 1: Foundation (Database + Backend Core + Auth)
1. Initialize project structure (Vite React + Express)
2. PostgreSQL schema: users, datasets, mapped_data, sessions
3. Auth system: login, signup, JWT, role-based middleware
4. Backend server setup with CORS, body-parser

### Phase 2: Frontend Shell (Layout + Navigation + Theme)
1. App shell with responsive sidebar/navbar
2. Dark/Light theme toggle with persistence
3. Login/Signup pages
4. Profile dropdown (name, email, logout)
5. Role-based route guards (Super Admin / Admin / User)

### Phase 3: KPI Formula Engine + Dashboard Page
1. Backend formula engine (`formulas.js`) implementing ALL formulas
2. Dashboard API endpoints
3. Dashboard page: 5 KPIs + 4 Charts
4. KPIs: Revenue, Blended ROI, CAC, Total Leads, Conversion Rate, CPL
5. Charts: Revenue Trend, CAC vs LTV, Conversion Funnel, Channel ROI

### Phase 4: B2B Page
1. B2B API endpoints
2. 5 KPIs: Pipeline Value, MQL→SQL, Deal Velocity, Win Rate, Churn Rate
3. 2 Charts: CPL by Channel, Account Engagement Score Trend
4. Key Insights section

### Phase 5: B2C Page
1. B2C API endpoints
2. 5 KPIs: LTV, Repeat Purchase Rate, AOV, Cart Abandonment, Purchase Frequency
3. 2 Charts: Repeat Purchase Rate Trend, Cart Abandonment Rate
4. Key Insights section

### Phase 6: Settings (Data Import + Mapping)
1. API integration interface (multiple API endpoints)
2. Excel upload (drag-drop, multi-file)
3. Dataset management (view imported, manual remove)
4. Auto-mapper with status (auto/manual/missing)
5. System parameters column mapping
6. Validate → Download Mapped → Save & Proceed buttons

### Phase 7: Users, Reports, Account, Info
1. Users: list view with role badges
2. Reports: filter + download (B2B=dashboard+B2B, B2C=dashboard+B2C)
3. Account: Add User form, RBAC enforcement
4. Info Center: Parameters & Metrics accordion with descriptions

---

## KPI Formulas (Backend Engine)

### Dashboard
| KPI | Formula |
|-----|---------|
| Revenue | (Channel Revenue + PR/Media Revenue + Resource Revenue) - (Channel Cost + PR/Media Cost) |
| Blended ROI | (Revenue − Mktg Cost) / Mktg Cost |
| CAC | (Sales Cost + Mktg Cost) / Number of New Customers |
| Total Leads | Count of all leads |
| Conversion Rate | (New Customers / Leads) × 100 |
| CPL | Total Marketing Cost / Leads |

### B2B
| KPI | Formula |
|-----|---------|
| Pipeline Value | Σ(Deal Value × Probability) where Deal Value = Price per unit × Quantity |
| MQL→SQL Rate | (SQLs / MQLs) × 100 |
| Deal Velocity | Total Days to Close / No. of Deals |
| Win Rate | (Won Deals / Total Opportunities) × 100 |
| Churn Rate | (Customers Lost / Customers at Start) × 100 |

### B2C
| KPI | Formula |
|-----|---------|
| LTV | AOV × Purchase Frequency × Customer Lifespan × Gross Margin% |
| Repeat Rate | (Repeat Customers / Total Customers) × 100 |
| AOV | Revenue / Total Orders |
| Cart Abandonment | ((Carts Created − Purchases Completed) / Carts Created) × 100 |
| Purchase Frequency | Total Orders / Total Customers |
| Gross Margin | ((Revenue − COGS) / Revenue) × 100 |

> [!IMPORTANT]
> Calculation order: Deal Value → Pipeline Value; AOV → Purchase Frequency → Gross Margin → LTV

---

## Database Schema (PostgreSQL)

### Core Tables
- **users**: id, name, email, password_hash, phone, role, profile_pic, created_at
- **datasets**: id, user_id, source_type(api/excel), file_name, status, uploaded_at
- **dataset_rows**: id, dataset_id, row_data(JSONB)
- **column_mappings**: id, dataset_id, source_column, system_parameter, match_status
- **kpi_cache**: id, dataset_id, section, kpi_name, value, calculated_at
- **sessions**: id, user_id, token, expires_at

---

## Role-Based Access

| Feature | Super Admin | Admin | User |
|---------|:-----------:|:-----:|:----:|
| Dashboard | ✅ | ✅ | ✅ |
| B2B | ✅ | ✅ | ✅ |
| B2C | ✅ | ✅ | ✅ |
| Info | ✅ | ✅ | ✅ |
| Users | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ❌ |
| Settings | ✅ | ✅ | ❌ |
| Account | ✅ | ✅ | ❌ |

---

## Verification Plan

### Automated
- Backend: Test all KPI formula calculations with sample data
- Frontend: Verify all routes render correctly per role
- Auth: Test login/logout/session persistence

### Manual
- Upload Excel → verify mapping → validate → save → check KPI output
- Test responsive design across desktop/tablet/mobile
- Verify dark/light theme across all pages
- Test role restrictions (User cannot access Settings via URL)

---

## Open Questions

> [!IMPORTANT]
> 1. **PostgreSQL Connection**: Do you have PostgreSQL installed locally? If not, I'll include setup instructions and the app will work with a setup script.
> 2. **Sample Data**: Should I include a sample Excel file for testing, or will you provide your own dataset?
> 3. **Screenshots**: You mentioned sharing screenshots - would you like to share them before I begin, or should I proceed with a modern enterprise design?
