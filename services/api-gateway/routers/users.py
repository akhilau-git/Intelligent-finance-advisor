from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from middleware.auth import get_current_user
from models.schemas import UserCreate, UserUpdate

router = APIRouter()


@router.post("/sync")
async def sync_user(user: UserCreate):
    db = get_db()
    existing = db.table("users").select("id").eq("clerk_id", user.clerk_id).execute()
    if existing.data:
        db.table("users").update({"email": user.email, "full_name": user.full_name}).eq("clerk_id", user.clerk_id).execute()
        return {"action": "updated", "user_id": existing.data[0]["id"]}
    result = db.table("users").insert({
        "clerk_id": user.clerk_id, "email": user.email, "full_name": user.full_name,
        "role": user.role, "department": user.department,
        "employee_id": user.employee_id or user.clerk_id[:8].upper(),
    }).execute()
    return {"action": "created", "user": result.data[0] if result.data else {}}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    db = get_db()
    res = db.table("users").select("*").eq("clerk_id", current_user["clerk_id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found — please reload")
    return res.data[0]


@router.get("/")
async def list_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "employee":
        raise HTTPException(status_code=403, detail="Employees cannot list all users")
    db = get_db()
    res = db.table("users").select("id, full_name, email, role, department, gamification_points, integrity_level").execute()
    return {"users": res.data}


@router.patch("/me")
async def update_me(update: UserUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in update.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("users").update(updates).eq("clerk_id", current_user["clerk_id"]).execute()
    return {"success": True, "user": res.data[0] if res.data else {}}
