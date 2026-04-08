from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from middleware.auth import get_current_user

router = APIRouter()


@router.get("/policies")
async def get_policies(current_user: dict = Depends(get_current_user)):
    db = get_db()
    res = db.table("policies").select("*").eq("is_active", True).execute()
    return {"policies": res.data}


@router.get("/users")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    db = get_db()
    res = db.table("users").select("*").execute()
    return {"users": res.data}


@router.get("/audit-log")
async def get_audit_log(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("auditor", "admin", "cfo"):
        raise HTTPException(status_code=403, detail="Auditors only")
    db = get_db()
    res = db.table("audit_log").select(
        "*, users!performed_by(full_name)"
    ).order("created_at", desc=True).limit(500).execute()
    return {"logs": res.data}


@router.patch("/policies/{policy_id}")
async def update_policy(
    policy_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("admin", "cfo"):
        raise HTTPException(status_code=403, detail="Admin/CFO only")
    db = get_db()
    allowed = {"max_amount", "requires_approval_above", "is_active", "weekend_claims_allowed"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields")
    res = db.table("policies").update(updates).eq("id", policy_id).execute()
    return {"success": True, "policy": res.data[0] if res.data else {}}
