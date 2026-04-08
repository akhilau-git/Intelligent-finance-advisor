"""
FinSight Fraud Detection Engine
PPT Innovation: AI-powered anomaly detection
Implements 8 fraud signals, each contributing to a 0.0–1.0 score.
"""

from datetime import date, datetime
from typing import List


def calculate_fraud_score(claim: dict, existing: List[dict]) -> dict:
    """
    Score a claim 0.0 (clean) → 1.0 (likely fraud).
    Returns { fraud_score, fraud_flags, authenticity_score }
    """
    score  = 0.0
    flags  = []

    total    = float(claim.get("total_amount") or 0)
    emp_id   = claim.get("employee_id", "")
    merchant = (claim.get("merchant_name") or "").lower().strip()
    img_hash = claim.get("receipt_hash", "")
    date_str = claim.get("expense_date", "")
    claim_id = claim.get("id", "")

    # ── Signal 1: Duplicate receipt image ───────────────────────────────
    if img_hash:
        dupes = [c for c in existing if c.get("receipt_hash") == img_hash and c.get("id") != claim_id]
        if dupes:
            score += 0.70
            flags.append({
                "signal": "DUPLICATE_RECEIPT",
                "score":  0.70,
                "detail": f"Receipt image hash matches {len(dupes)} existing claim(s)",
            })

    # ── Signal 2: Same amount + same merchant in recent submissions ──────
    if total > 0 and merchant:
        similar = [
            c for c in existing
            if c.get("id") != claim_id
            and abs(float(c.get("total_amount") or 0) - total) < 1.0
            and (c.get("merchant_name") or "").lower().strip() == merchant
        ]
        if similar:
            score += 0.50
            flags.append({
                "signal": "SAME_AMOUNT_MERCHANT",
                "score":  0.50,
                "detail": "Identical amount + merchant found in recent submissions",
            })

    # ── Signal 3: Weekend / public holiday submission ────────────────────
    if date_str:
        try:
            exp = datetime.strptime(str(date_str), "%Y-%m-%d").date()
            if exp.weekday() == 6:  # Sunday
                score += 0.20
                flags.append({"signal": "WEEKEND_EXPENSE", "score": 0.20, "detail": "Expense date is a Sunday"})
        except Exception:
            pass

    # ── Signal 4: Perfect round number ───────────────────────────────────
    if total > 0 and total == int(total) and int(total) % 500 == 0:
        score += 0.15
        flags.append({
            "signal": "ROUND_NUMBER",
            "score":  0.15,
            "detail": f"Suspiciously round amount: ₹{int(total):,}",
        })

    # ── Signal 5: Receipt older than 30 days ─────────────────────────────
    if date_str:
        try:
            exp = datetime.strptime(str(date_str), "%Y-%m-%d").date()
            age = (date.today() - exp).days
            if age > 30:
                score += 0.10
                flags.append({"signal": "OLD_RECEIPT", "score": 0.10, "detail": f"Receipt is {age} days old"})
        except Exception:
            pass

    # ── Signal 6: Spending spike > 3× employee's average ─────────────────
    emp_claims = [c for c in existing if c.get("employee_id") == emp_id and c.get("id") != claim_id]
    if len(emp_claims) >= 3 and total > 0:
        avg = sum(float(c.get("total_amount") or 0) for c in emp_claims[-10:]) / min(len(emp_claims), 10)
        if avg > 0 and total > avg * 3:
            score += 0.30
            flags.append({
                "signal": "SPENDING_SPIKE",
                "score":  0.30,
                "detail": f"Amount is {total / avg:.1f}× the employee's recent average (₹{avg:,.0f})",
            })

    # ── Signal 7: Missing GST on taxable amount ───────────────────────────
    subtotal  = float(claim.get("subtotal") or 0)
    tax_amount = float(claim.get("tax_amount") or 0)
    if subtotal > 1000 and tax_amount == 0:
        score += 0.10
        flags.append({
            "signal": "MISSING_GST",
            "score":  0.10,
            "detail": f"No GST on ₹{subtotal:,.0f} taxable amount — GST registration suspected",
        })

    # ── Signal 8: Math mismatch (Triple-Check failure) ────────────────────
    if subtotal > 0 and tax_amount > 0 and total > 0:
        expected_total = subtotal + tax_amount
        if abs(expected_total - total) > 0.5:
            score += 0.25
            flags.append({
                "signal": "MATH_MISMATCH",
                "score":  0.25,
                "detail": f"Subtotal {subtotal:.2f} + Tax {tax_amount:.2f} = {expected_total:.2f} ≠ Total {total:.2f}",
            })

    # ── Cap and determine authenticity ────────────────────────────────────
    score = round(min(score, 1.0), 4)

    if score < 0.20:
        authenticity = "green"
    elif score < 0.50:
        authenticity = "yellow"
    else:
        authenticity = "red"

    return {
        "fraud_score":        score,
        "fraud_flags":        flags,
        "authenticity_score": authenticity,
    }
