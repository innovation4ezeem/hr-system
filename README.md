# 🏢 EzeemOps HRIS

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Security](https://img.shields.io/badge/Vulnerabilities-0-green?style=for-the-badge)](https://github.com/advisories)

A premium, state-of-the-art Human Resource Information System (HRIS) designed for modern enterprises. Built with **Next.js 15**, **React 19**, and **Prisma**, EzeemOps provides a robust platform for performance tracking, leave management, and organizational transparency.

---

## 🌟 Key Features

### 📊 Performance Management
- **Interactive Heatmaps**: Visualize team performance across departments and categories.
- **KPI Tracking**: Real-time monitoring of key performance indicators.
- **Masterboard**: Centralized dashboard for HODs and Admins to manage performance scores.
- **Dynamic Scoring**: Customizable performance weightings (60/25/15) and thresholds.

### 📅 Leave & Attendance
- **Automated Workflows**: Multi-level approval cycles for leave requests.
- **Balance Tracking**: Real-time leave balance deduction and accrual.
- **Annual Lifecycle**: Automated Year-End Freezes (Dec 31) and Leave Cleansing (March 1).
- **Calendar Integration**: Team-wide leave visibility for better resource planning.

### 👤 Employee & Organization
- **Role-Based Access Control (RBAC)**: Distinct portals for Admin, Manager, HOD, and Employee.
- **Structural Automation**: Bi-directional HOD synchronization between User Management and Department Management.
- **Reporting Hierarchy**: Automated "Report To" assignments for staff whenever an HOD change is processed.
- **Privacy Hardening**: Obfuscated User IDs in URLs using Base64 masking to protect internal data identifiers.
- **Workforce Analytics**: Real-time headcount monitoring (excluding administrators) directly in dashboard headers.
- **Profile Management**: Comprehensive employee records with document attachments and security settings.

### 📄 Reporting & Analytics
- **Exports**: Generate professional PDF reports and Excel (XLSX) data sheets.
- **Archiving**: Permanent storage of historical performance and leave data.
- **Audit Logging**: Full traceability for sensitive HR operations and policy changes via `SystemAuditService`.

---

## 🎨 Design Aesthetics & UI
- **Premium Dark Mode**: High-contrast, accessibility-focused dark theme with standardized color palettes.
- **Dynamic Feedback**: Skeleton loaders and transition progress bars for a smooth, single-page application feel.
- **Cross-Browser Stability**: Hardened input and dropdown styles to prevent browser-native rendering glitches.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Next.js 15 (App Router), Tailwind CSS |sidebar
| **Backend** | Next.js API Routes, MVC Controllers |
| **Database** | MySQL, Prisma 7 ORM (Supabase for Auth/Storage) |
| **Visuals** | Recharts (Charts), Sonner (Toasts), HeroIcons |
| **Utilities** | PDFKit (PDFs), SheetJS (Excel), Zod (Validation) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- MySQL Server (v8.0+)
### Installation

1. **Clone and Install**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   Create a `.env` file in the root directory:
   ```env
   # Database Connection (MySQL)
   DATABASE_URL="mysql://root:<password>@localhost:3306/hris_db"

3. **Database Initialization**:
   ```bash
   npx prisma generate
   # Run migrations or apply schema
   npm run db:schema
   # Run database UI (for data management directly in browser)
   npx prisma studio
   ```

4. **Start Development**:
   ```bash
   npm run dev
   ```
   Access the app at [http://localhost:4028](http://localhost:4028)

---

## 📁 Project Structure

```text
src/
├── app/              # Next.js App Router (Views & Routes)
├── components/       # Reusable UI Components
│   ├── ui/           # Atomic UI elements (buttons, inputs)
│   └── dashboard/    # Module-specific complex components
├── controllers/      # Business logic & Database interaction (MVC)
├── context/          # Global state management (AppContext)
├── models/           # Data definitions and types
├── styles/           # Global CSS and Tailwind config
└── lib/              # Shared utility functions (Supabase client, etc.)
```

---

## 🛡️ Security & Compliance

EzeemOps is built with security in mind. We actively maintain our dependency tree to ensure zero known vulnerabilities.

- **Dependency Hardening**: Using NPM overrides to force secure versions of transitive dependencies (PostCSS, Hono).
- **SheetJS Security**: Utilizing the latest non-vulnerable builds from the official SheetJS CDN.
- **Zod Validation**: Strict schema validation for all API inputs to prevent injection attacks.
- **Audit Trails**: Every critical action is logged with `SystemAuditService`.

---

## 📄 License

This project is private and proprietary. All rights reserved.
