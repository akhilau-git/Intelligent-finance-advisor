# FinSight IFOS — How to Run

**"The Autonomous Finance Advisor"**  
Intelligent Billing & Reimbursement Management System  
Problem Statement 11 | Balfour Beatty | U Akhila, ATME College of Engineering

---

## What This System Does (from PPT)

| Feature | Implementation |
|---|---|
| Triple-Check Validation | OCR vs user input vs Tax API — `analytics.py /triple-check/{id}` |
| Regulatory-as-Code | Policies in DB, enforced in `claims.py` auto-approve logic |
| Immutable Trust Architecture | SHA-256 hash chain in `audit_log` table |
| Asynchronous AI Processing | Background OCR via separate service on port 8002 |
| Auto-reads bills (PDF/JPG/PNG) | Google Cloud Vision API in OCR service |

---

## Step 1 — Run Database Migrations

Go to **supabase.com → Your Project → SQL Editor**

Run these files in order:
1. Paste `database/migrations/001_initial_schema.sql` → click Run
2. Paste `database/migrations/002_rls_policies.sql` → click Run

---

## Step 2 — Open VS Code

Open the `finsight_v3` folder in VS Code.  
Press `Ctrl + `` ` `` to open terminal.

---

## Step 3 — Run 3 Terminals Simultaneously

### Terminal 1 — Backend API (port 8000) [REQUIRED]
```bash
cd services\api-gateway
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
✅ Open: http://localhost:8000/docs

---

### Terminal 2 — OCR Service (port 8002) [REQUIRED for bill scanning]
```bash
cd services\ocr-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```
✅ Open: http://localhost:8002/docs

**This is the service that auto-reads your bills:**
- Upload any PDF, JPG, PNG, WEBP, TIFF
- Google Vision API extracts: merchant name, date, GST amount, total, tax
- Category auto-detected (travel/meals/hotel/etc)
- Carbon footprint auto-calculated

---

### Terminal 3 — Fraud Detection (port 8001) [REQUIRED for fraud scoring]
```bash
cd services\fraud-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```
✅ Open: http://localhost:8001/docs

---

### Terminal 4 — Frontend (port 3000) [REQUIRED]
```bash
cd apps\web
npm install
npm run dev
```
✅ Open: http://localhost:3000

---

## Step 4 — First Login

1. Go to http://localhost:3000
2. Sign up with your email
3. Dashboard loads automatically

### Set Your Role (for demo)
1. Go to clerk.com → Dashboard → Users → click your user
2. Click **Public Metadata** → Edit → paste:
   ```json
   {"role": "manager", "tier": "platinum"}
   ```
3. Sign out → sign back in → sidebar updates

---

## Step 5 — Load Demo Data (optional)

After signing up with 2-3 accounts:
1. Supabase → SQL Editor
2. Paste `database/seed.sql` → Run

---

## How Bill Auto-Reading Works

When you go to **Submit Claim** and upload any bill:

```
PDF/JPG/PNG/WEBP uploaded
        ↓
OCR Service (port 8002)
        ↓
Google Cloud Vision API reads text
        ↓
receipt_parser.py extracts:
  • Merchant name
  • Date
  • GST number
  • Subtotal / Tax / Total
  • Category (travel/meals/hotel...)
  • Carbon footprint
        ↓
Form auto-filled in browser
        ↓
Triple-Check Validation runs
        ↓
Fraud Detection scores the claim
        ↓
Auto-approved if clean + under ₹5,000
```

---

## All URLs

| URL | Purpose |
|---|---|
| http://localhost:3000 | FinSight app (login → dashboard) |
| http://localhost:3000/claims/new | Submit claim with bill upload |
| http://localhost:3000/manager | Approve/reject pending claims |
| http://localhost:3000/auditor | Blockchain audit log + verify |
| http://localhost:3000/cfo | Analytics, ESG, forecasting |
| http://localhost:3000/compliance | Compliance reports |
| http://localhost:8000/docs | Backend API documentation |
| http://localhost:8001/docs | Fraud service API docs |
| http://localhost:8002/docs | OCR service API docs |

---

## Common Errors

| Error | Fix |
|---|---|
| `venv\Scripts\activate` fails | Run in CMD not PowerShell. Or: `Set-ExecutionPolicy RemoteSigned` |
| Module not found | Make sure `(venv)` shows in terminal before pip install |
| CORS error | Check FRONTEND_URL in `services/api-gateway/.env` = `http://localhost:3000` |
| 401 Unauthorized | Sign out and back in. Token expired. |
| Table doesn't exist | Run SQL migrations in Supabase first |
| Port in use | `netstat -ano | findstr :8000` then `taskkill /PID <number> /F` |
| OCR returns empty | Check GOOGLE_CLOUD_VISION_KEY in `services/ocr-service/.env` |
| PDF not working | Install poppler: `winget install poppler` or use JPG instead |

---

## PPT Solution Checklist

- [x] **Inefficient Management** → Centralized dashboard, all claims in one place
- [x] **Manual Error Risks** → AI-OCR auto-fills all fields, 0% manual typing
- [x] **Compliance Gaps** → Regulatory-as-Code policies, auto-block non-compliant
- [x] **Opaque Workflows** → SHA-256 blockchain audit trail, full transparency
- [x] **Financial Leakage** → Triple-Check validation + fraud detection
- [x] **Audit Readiness** → Immutable audit log, exportable compliance reports
- [x] **Reimbursement Speed** → Auto-approve claims < ₹5,000 in seconds
- [x] **Strategic Insights** → CFO dashboard with ESG, forecasting, vendor analysis
