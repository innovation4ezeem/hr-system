# HR System - Complete Handover Documentation

This document provides a comprehensive overview of the HR System, explaining how the frontend, backend, and key processes work. It is designed to help a new person understand the system's architecture and daily operations.

---

## 1. System Overview

The HR System is a web-based application designed to manage employee leaves, approvals, user profiles, and department calendars. 

**Technology Stack:**
- **Frontend (User Interface):** React.js with Next.js (App Router)
- **Backend (Server Logic):** Node.js (via Next.js API Routes)
- **Database ORM:** Prisma
- **Database:** MySQL
- **Language:** TypeScript

---

## 2. Frontend Architecture (What the User Sees)

The frontend is divided into three main "Portals" based on the user's role. All pages are located inside the `src/app` directory.

### Portals
1. **Employee Portal (`src/app/employee-portal`)**
   - **Purpose:** Where standard employees log in.
   - **Key Features:** Apply for leave, view personal leave balances, check personal leave history, and view company holidays.
2. **Manager Dashboard (`src/app/manager-dashboard`)**
   - **Purpose:** For Head of Departments (HODs) and Directors.
   - **Key Features:** Approve/reject leave requests from their team (Approval Queue), view the Team Shared Calendar, and review the Team Leave Log.
3. **Admin Panel (`src/app/admin-panel`)**
   - **Purpose:** For HR and System Administrators.
   - **Key Features:** Manage user accounts, adjust leave quotas, configure system settings (e.g., company holidays), and view global leave reports.

### UI Components
Reusable interface elements (like Buttons, Modals, and Icons) are stored in `src/components/ui`. This ensures the design remains consistent across all portals.

---

## 3. Backend Architecture (Under the Hood)

The backend handles data processing, validations, and database updates. It is structured in three layers:

### 1. API Routes (`src/app/api`)
These are the entry points where the frontend talks to the backend. 
- Example: When an employee clicks "Submit Leave", the frontend sends a request to the `/api/leave-requests` route.
- The API checks if the user is authorized and then passes the data to the Controllers.

### 2. Controllers (`src/controllers`)
Controllers contain the **Business Logic**. They act as the brain of the operation.
- Example: `leaveRequestController.ts` handles the rules for applying leave. It checks if the start date is valid, if there is a clash with another leave, and triggers emails.

### 3. Models & Database (`src/models` & Prisma)
Models handle direct communication with the MySQL database.
- Example: `userModel.ts` gets user data, and `leaveManagementModel.ts` calculates how many leave days an employee has left.
- **Prisma** (`prisma/schema.prisma`) is the tool used to define the database tables and relationships.

---

## 4. Key Processes & How They Work

### A. The Leave Application Workflow
1. **Submission:** An employee fills out the leave form. The frontend sends this to the API.
2. **Validation:** The Backend Controller checks:
   - Does the employee have enough leave balance?
   - Does the date overlap with an existing leave?
   - Is it a working day?
3. **Database Entry:** The request is saved to the `leave_requests` table with a status of **"pending"**.
4. **Approval Routing:** The system looks up the employee's reporting manager and creates an approval step in the `leave_approvals` table.
5. **Notification:** An email/in-app notification is triggered to alert the manager.

### B. The Approval Workflow
1. **Manager Action:** The manager sees the request in their "Approval Queue" and clicks Approve or Reject.
2. **Deduction:** If approved, the system deducts the requested days from the employee's `leave_balances` table.
3. **Calendar Update:** The system creates a record in the `leave_calendar_entries` table so the leave appears on the Team Calendar.
4. **Notification:** The employee is notified of the decision.

### C. Year-End Archiving Process
To prevent the system from slowing down over the years, an automated process archives old data.
- **What it does:** It takes all completed leaves from past years and changes their status to `history-archived`. 
- **Cleanup:** It deletes old `leave_calendar_entries` for these archived records because they no longer need to be displayed on the current year's interactive calendar. (They can still be viewed in historical logs).

---

## 5. Key Database Tables to Know

If you ever need to look directly at the database, these are the most important tables:

- `users`: Stores all employee profiles, roles, and department info.
- `leave_balances`: Tracks how many days of each leave type (Annual Leave, Medical, etc.) an employee has for a specific year.
- `leave_requests`: The master record of every leave application and its current status.
- `leave_approvals`: Tracks the sign-off process (who needs to approve and their decision).
- `leave_calendar_entries`: A lightweight table specifically designed to make the Team Calendar load very fast.
- `employee_leave_entitlements`: Used by Admins to grant custom leave quotas (overrides) to specific employees.

---

## 6. Access & Deployment Information

### A. Deployment Website
The live HR System is hosted on Vercel use the AI account innovation4ezeem@gmail.com.
- **Website URL:** [https://hr-system-ezee.vercel.app/](https://hr-system-ezee.vercel.app/)

### B. Database Location
The system uses a live MySQL database cPanel phpMyAdmin under hotelsys account. Here are the connection details (usually stored in the `.env` file):
- **Host / IP:** `110.4.45.220` (Port: `3306`)
- **Database Name:** `hotelsys_hris`
- **Username:** `hotelsys_hrisuser`
- *(Note: Ensure the actual password remains secure in the `.env` file and is not shared publicly).*

### C. How to Login
1. Go to the deployment URL above. You will be greeted by the **EzeemOps Sign In** page.
2. Enter your assigned **Work Email** (e.g., `yourname@ezeetechnosys.com.my`).
3. Enter your **Password**. 
4. Click **Sign In**. 
5. The system will automatically route you to the correct portal (Employee, Manager Dashboard, or Admin Panel) based on your role in the database.

## Summary for the Handover Person

If you are taking over this system without a deep technical background, remember this flow:
- **Visual Changes:** Look in `src/app` (Frontend).
- **Rule Changes (e.g., leave policies):** Look in `src/controllers` (Backend Logic).
- **Data/Database Issues:** Look in `prisma/schema.prisma` and `src/models`.
