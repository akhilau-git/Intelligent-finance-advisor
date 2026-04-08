from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from database import get_db
from middleware.auth import get_current_user
from models.schemas import ClaimCreate, ClaimStatusUpdate
from datetime import datetime
import hashlib, os

router = APIRouter()
AUTO_APPROVE_LIMIT = float(os.getenv("AUTO_APPROVE_LIMIT", "5000"))


def _uid(db, clerk_id: str) -> str:
    res = db.table("users").select("id").eq("clerk_id", clerk_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found. Reload the page.")
    return res.data[0]["id"]


def _audit(db, claim_id: str, action: str, by: Optional[str], old, new):
    prev = db.table("audit_log").select("hash").eq("claim_id", claim_id)\
        .order("created_at", desc=True).limit(1).execute()
    prev_hash = prev.data[0]["hash"] if prev.data else "0" * 16
    content   = f"{prev_hash}{claim_id}{action}{by}{old}{new}{datetime.utcnow().isoformat()}"
    new_hash  = hashlib.sha256(content.encode()).hexdigest()
    db.table("audit_log").insert({
        "claim_id": claim_id, "action": action, "performed_by": by,
        "old_value": {"v": str(old)}, "new_value": {"v": str(new)},
        "hash": new_hash, "previous_hash": prev_hash,
    }).execute()


@router.post("/")
async def create_claim(claim: ClaimCreate, current_user: dict = Depends(get_current_user)):
    db  = get_db()
    uid = _uid(db, current_user["clerk_id"])
    data = {
        "employee_id":   uid,
        "merchant_name": claim.merchant_name,
        "merchant_id":   claim.merchant_id,
        "expense_date":  str(claim.expense_date) if claim.expense_date else None,
        "category":      claim.category,
        "subtotal":      claim.subtotal,
        "tax_rate":      claim.tax_rate,
        "tax_amount":    claim.tax_amount,
        "total_amount":  claim.total_amount,
        "currency":      claim.currency,
        "notes":         claim.notes,
        "status":        claim.status or "draft",
    }
    result    = db.table("claims").insert(data).execute()
    new_claim = result.data[0]

    # Auto-approve small clean claims
    tot = claim.total_amount or 0
    if claim.status == "submitted" and 0 < tot <= AUTO_APPROVE_LIMIT:
        db.table("claims").update({
            "status": "validated",
            "authenticity_score": "green",
            "fraud_score": 0.0,
        }).eq("id", new_claim["id"]).execute()
        _audit(db, new_claim["id"], "CLAIM_CREATED",    uid, "none", "submitted")
        _audit(db, new_claim["id"], "AUTO_APPROVED",    uid, "submitted", "validated")
        new_claim["status"] = "validated"
    else:
        _audit(db, new_claim["id"], "CLAIM_CREATED", uid, "none", claim.status)

    return {"success": True, "claim": new_claim}


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    db  = get_db()
    uid = _uid(db, current_user["clerk_id"])
    all_c = db.table("claims").select("employee_id, status, total_amount, fraud_score").execute().data
    if current_user["role"] == "employee":
        all_c = [c for c in all_c if c.get("employee_id") == uid]
    return {
        "total":        len(all_c),
        "pending":      len([c for c in all_c if c["status"] in ("submitted","validated","review")]),
        "approved":     len([c for c in all_c if c["status"] == "approved"]),
        "rejected":     len([c for c in all_c if c["status"] == "rejected"]),
        "total_amount": sum(float(c.get("total_amount") or 0) for c in all_c),
        "fraud_flags":  len([c for c in all_c if float(c.get("fraud_score") or 0) > 0.5]),
        "verified":     len([c for c in all_c if c["status"] in ("approved","validated")]),
    }


@router.get("/")
async def list_claims(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    db   = get_db()
    uid  = _uid(db, current_user["clerk_id"])
    role = current_user["role"]
    q    = db.table("claims").select("*, users!employee_id(full_name, email, department)")
    if role == "employee":
        q = q.eq("employee_id", uid)
    elif role == "manager":
        team = db.table("users").select("id").eq("manager_id", uid).execute()
        ids  = [t["id"] for t in team.data] + [uid]
        q    = q.in_("employee_id", ids)
    if status:
        q = q.eq("status", status)
    res = q.order("created_at", desc=True).execute()
    return {"claims": res.data}


@router.get("/{claim_id}")
async def get_claim(claim_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    c  = db.table("claims").select("*, users!employee_id(full_name, email, department)").eq("id", claim_id).execute()
    if not c.data:
        raise HTTPException(status_code=404, detail="Claim not found")
    a = db.table("audit_log").select("*, users!performed_by(full_name)").eq("claim_id", claim_id).order("created_at").execute()
    return {"claim": c.data[0], "audit_log": a.data}


@router.patch("/{claim_id}/status")
async def update_status(claim_id: str, update: ClaimStatusUpdate, current_user: dict = Depends(get_current_user)):
    db   = get_db()
    role = current_user["role"]
    ALLOWED = {
        "employee": ["submitted"],
        "manager":  ["approved","rejected","review"],
        "auditor":  ["approved","rejected"],
        "cfo":      ["approved","rejected"],
        "admin":    ["draft","submitted","validated","review","approved","rejected","paid"],
    }
    if update.status not in ALLOWED.get(role, []):
        raise HTTPException(status_code=403, detail=f"Role '{role}' cannot set status to '{update.status}'")
    c = db.table("claims").select("*").eq("id", claim_id).execute()
    if not c.data:
        raise HTTPException(status_code=404, detail="Claim not found")
    old = c.data[0]["status"]
    uid = _uid(db, current_user["clerk_id"])
    upd: dict = {"status": update.status, "updated_at": datetime.utcnow().isoformat()}
    if update.rejection_reason:
        upd["rejection_reason"] = update.rejection_reason
    if update.status == "approved":
        upd["approved_by"] = uid
        upd["approved_at"] = datetime.utcnow().isoformat()
    db.table("claims").update(upd).eq("id", claim_id).execute()
    _audit(db, claim_id, "STATUS_CHANGED", uid, old, update.status)
    return {"success": True, "new_status": update.status}
