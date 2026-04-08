from fastapi import Header, HTTPException
import json, base64, os


def _decode_jwt(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Bad JWT")
        pad = parts[1] + "=" * (-len(parts[1]) % 4)
        return json.loads(base64.urlsafe_b64decode(pad))
    except Exception as e:
        raise ValueError(f"JWT decode: {e}")


async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ")[1]
    try:
        payload = _decode_jwt(token)
        meta    = payload.get("public_metadata") or payload.get("metadata") or {}
        return {
            "clerk_id": payload.get("sub", ""),
            "email":    payload.get("email", ""),
            "role":     meta.get("role", "employee"),
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def require_roles(*roles: str):
    from fastapi import Depends
    async def check(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Required roles: {roles}")
        return current_user
    return check
