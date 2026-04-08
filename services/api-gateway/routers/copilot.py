from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from middleware.auth import get_current_user
from models.schemas import CopilotMessage
import anthropic
import os

router = APIRouter()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Role-aware personas (PPT: Autonomous Finance Advisor)
PERSONAS = {
    "employee": """You are the FinSight Expense Assistant — an AI advisor for employees.
You help employees understand:
- Why their claim was rejected and how to fix it
- Company expense policies and GST rules
- How to submit claims correctly for faster approval
- Their gamification points and tier status
Be friendly, empathetic, and concise. Never make up claim data.
Focus on helping them get reimbursed faster.""",

    "manager": """You are FinSight Policy Sentinel — an AI advisor for managers.
You help managers:
- Spot anomalies and spending patterns in their team
- Identify high-risk or fraudulent claims
- Enforce company expense policies
- Understand department-level financial summaries
Be analytical, alert-focused, and decisive.""",

    "auditor": """You are FinSight Audit Shield — an AI advisor for auditors.
You help auditors:
- Verify SHA-256 hash chain integrity
- Investigate fraud evidence and suspicious patterns
- Generate audit-ready compliance reports
- Review complete claim histories
Be precise, evidence-based, and thorough. Reference specific data points.""",

    "cfo": """You are FinSight Eco-Advisor — an AI strategic advisor for CFOs.
You help CFOs:
- Understand ESG carbon footprint trends
- Analyze budget forecasting and variance
- Identify vendor negotiation opportunities
- Assess financial risk and savings potential
Savings potential from fraud prevention: typically 8-12% of total spend.
Be strategic, data-driven, and forward-looking.""",
}


@router.post("/chat")
async def chat(body: CopilotMessage, current_user: dict = Depends(get_current_user)):
    db   = get_db()
    role = current_user["role"]
    persona = PERSONAS.get(role, PERSONAS["employee"])

    # Fetch user context
    user_res = db.table("users").select(
        "id, full_name, department, gamification_points, integrity_level"
    ).eq("clerk_id", current_user["clerk_id"]).execute()
    user_info = user_res.data[0] if user_res.data else {}
    uid = user_info.get("id", "")

    # Fetch recent claims for context
    recent = db.table("claims").select(
        "id, merchant_name, total_amount, status, rejection_reason, fraud_score, category, created_at, authenticity_score"
    ).eq("employee_id", uid).order("created_at", desc=True).limit(5).execute().data

    # Fetch stats
    all_claims = db.table("claims").select("status, total_amount, fraud_score").execute().data
    total_spend = sum(float(c.get("total_amount") or 0) for c in all_claims if c["status"] != "rejected")
    fraud_flags = len([c for c in all_claims if float(c.get("fraud_score") or 0) > 0.5])

    context = f"""
USER CONTEXT:
Name: {user_info.get('full_name', 'Unknown')} | Role: {role} | Department: {user_info.get('department', 'N/A')}
Gamification Points: {user_info.get('gamification_points', 0)} | Tier: {user_info.get('integrity_level', 'bronze')}

RECENT CLAIMS (last 5):
{recent}

SYSTEM STATS:
Total spend (approved): ₹{total_spend:,.0f} | Fraud flags: {fraud_flags}

PPT CONTEXT — This is FinSight IFOS (Intelligent Financial Oversight System):
- Triple-Check Validation: OCR vs user input vs Tax API reconciliation
- Regulatory-as-Code: policies embedded in validation logic
- Immutable Trust Architecture: SHA-256 hash chain audit log
- Goal: 0% manual entry errors, 80% faster audit prep, 10x faster reimbursement
"""

    messages = list(body.conversation_history or []) + [{"role": "user", "content": body.message}]

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=f"{persona}\n\n{context}",
            messages=messages,
        )
        return {"response": response.content[0].text, "role": role}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
