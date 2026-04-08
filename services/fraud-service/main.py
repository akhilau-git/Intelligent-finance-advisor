"""
FinSight Fraud Detection Service (Port 8001)
Analyzes claims for 8 fraud signals and updates Supabase.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from fraud_detector import calculate_fraud_score
from supabase import create_client
import os

load_dotenv()

app = FastAPI(title="FinSight Fraud Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

db = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
)


class ClaimData(BaseModel):
    id: Optional[str] = None
    employee_id: str
    merchant_name: Optional[str] = None
    merchant_id: Optional[str] = None
    total_amount: Optional[float] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    expense_date: Optional[str] = None
    receipt_hash: Optional[str] = None
    category: Optional[str] = None


@app.post("/analyze")
async def analyze(claim: ClaimData):
    """
    Run all 8 fraud signals on a claim.
    Updates fraud_score, fraud_flags, authenticity_score in Supabase.
    """
    existing = db.table("claims").select(
        "id, employee_id, merchant_name, total_amount, expense_date, receipt_hash, subtotal, tax_amount"
    ).eq("employee_id", claim.employee_id).execute().data

    result = calculate_fraud_score(claim.model_dump(), existing)

    if claim.id:
        db.table("claims").update({
            "fraud_score":        result["fraud_score"],
            "fraud_flags":        result["fraud_flags"],
            "authenticity_score": result["authenticity_score"],
            # Auto-set status to review if high risk
            **( {"status": "review"} if result["fraud_score"] > 0.5 else {} ),
        }).eq("id", claim.id).execute()

        # Write audit log entry
        db.table("audit_log").insert({
            "claim_id":     claim.id,
            "action":       "FRAUD_ANALYSIS_COMPLETE",
            "performed_by": None,
            "old_value":    {"score": 0},
            "new_value":    {"score": result["fraud_score"], "flags": len(result["fraud_flags"])},
        }).execute()

    return result


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "fraud"}
