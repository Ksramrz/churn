## Roomvu Churn Insight System

Internal, test-environment tool for Roomvu operations teams to capture cancellation calls, surface descriptive churn insights, and export retention-ready reports.

### Project Structure
- `server/` — Node.js + Express API with SQLite storage, PDF + CSV exports, and a rules-based insight engine.
- `client/` — React (Vite) admin portal with intake form, filters, dashboard charts, and exports UI.

---

### Backend Setup (Node + SQLite)
1. `cd /Users/top/Desktop/churn/server`
2. Install dependencies once: `npm install`
3. Seed the local SQLite database with Roomvu sample data: `npm run seed`
4. Start the API (default port 4000): `npm run dev`
5. Key endpoints are documented inline in `server/src/index.js` (cancellations CRUD, stats, exports, insights, metadata).

**Configuring teammates (closers):** update `ROOMVU_CLOSERS` inside `server/src/config.js`, then restart the server. The change automatically flows to dropdowns, stats, and insights.

**Database location:** SQLite file lives at `server/data/roomvu.db`. Delete this file and rerun `npm run seed` to reset.

---

### Frontend Setup (Vite React)
1. `cd /Users/top/Desktop/churn/client`
2. Install dependencies: `npm install`
3. Start the local UI (default port 5173): `npm run dev`
4. The UI expects the backend on `http://localhost:4000`. Override with `VITE_API_BASE` in a `.env` file if needed.

---

### Using the Admin Portal
- **Cancellation Intake Form:** Autocomplete existing customers, log usage metrics, mark saves, and capture save notes. Submissions POST to `/cancellations` and immediately refresh dashboard data.
- **Filters:** Date range, closer, segment, reason, and saved/not saved filters drive all list + chart panels for precise drill-down.
- **Exports:** Three quick actions in the header hit `/exports/cancellations.csv`, `/exports/saved-cases.csv`, and `/exports/monthly-report.pdf`.

---

### Dashboard & Chart Interpretation
- **KPIs**
  - *Total cancellations* — raw volume over the selected window.
  - *Total saved cases* — count flagged as saved.
  - *Save rate* — saved / total to benchmark closer effectiveness.
  - *Avg days before cancel* — onboarding health indicator.
  - *Top 3 reasons* — automatically sorted list to focus enablement.
- **Pie: Cancellations by reason** — reveals mix of primary churn drivers.
- **Bar: Cancellations by month** — trend line for pacing reviews.
- **Stacked Bar: Reason by agent segment** — highlights which realtor segments struggle with which objections.
- **Bar: Closer performance (saves vs cancellations)** — quick glance at recovery leaders or coaching opportunities.
- **Tables**
  - *Cancellations list* — complete log with closer, reason, and days-on-platform (filters applied).
  - *Saved cases* — dedicated roster detailing who saved the account and why.
- **Insights Engine** — rules-only callouts (content misalignment, onboarding gaps, closer save-rate gaps, campaign risk).

---

### Reports & Exports
- **CSV — cancellations:** `id, customer, email, segment, closer, date, reason, saved flag`.
- **CSV — saved cases:** focus on retention wins (who saved, reason, notes).
- **PDF — Monthly churn report:** KPIs, reason breakdown, closer stats, and current insights rendered through PDFKit for easy sharing.

---

### Common Troubleshooting
- **Port already in use:** Adjust `PORT` env variable before starting the server, or stop existing service on 4000.
- **CORS errors in UI:** Ensure the backend is running locally; otherwise, set `VITE_API_BASE` to the reachable API URL.
- **Missing customers in autocomplete:** Rerun `npm run seed` or insert new customers via SQLite, then refresh the UI.
- **Charts look empty:** Filters may be overly restrictive. Use the “Clear” action in the filter card to reset.
- **PDF export hangs:** Confirm the `/exports/monthly-report.pdf` endpoint is reachable; server logs will note any PDFKit issues.

---

### Development Notes
- The system is intentionally descriptive—no predictive or ML models are included.
- Activity logs table is provisioned for future Roomvu engagement analytics.
- All code aims for clarity so Roomvu ops can maintain or extend quickly on a non-production environment.

