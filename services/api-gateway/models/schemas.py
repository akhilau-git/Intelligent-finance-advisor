from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date


class UserCreate(BaseModel):
    clerk_id: str
    email: EmailStr
    full_name: str
    role: str = "employee"
    department: Optional[str] = None
    employee_id: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    manager_id: Optional[str] = None


class ClaimCreate(BaseModel):
    merchant_name: Optional[str] = None
    merchant_id: Optional[str] = None
    expense_date: Optional[date] = None
    category: str = "other"
    subtotal: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    currency: str = "INR"
    notes: Optional[str] = None
    status: str = "draft"


class ClaimStatusUpdate(BaseModel):
    status: str
    rejection_reason: Optional[str] = None


class CopilotMessage(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = []
