"""
Receipt Parser — extracts structured data from raw OCR text.
Supports: restaurant bills, hotel invoices, airline tickets,
          fuel receipts, medical bills, online payment receipts, etc.
"""

import re
from typing import Optional
from datetime import datetime


def _normalize_lines(text: str) -> list[str]:
    return [re.sub(r"\s+", " ", line.strip()) for line in text.split("\n") if line.strip()]


def _is_contact_or_id_line(line: str) -> bool:
    lowered = line.lower()
    if any(k in lowered for k in ["ph:", "ph.", "phone", "mobile", "tel:", "tel.", "cell", "fax", "helpline"]):
        return True
    if re.search(r"\bph\b", lowered):
        return True
    if re.search(r"\b\d{5,6}[-\s]\d{4,6}\b", line):
        return True
    if re.search(r"\b(?:bill|invoice|order|ref|reference)\s*(?:no|number|#)?\s*[:\-]?\s*[a-z0-9\-/]{4,}\b", lowered):
        return True
    if re.fullmatch(r"[\d\-\s/]{8,}", line.strip()):
        return True
    return False


def _to_money(raw: str) -> Optional[float]:
    token = raw.replace(",", "").strip()
    if not token:
        return None
    try:
        if "." in token:
            return float(token)
        if not token.isdigit():
            return None
        # OCR often drops decimal points in long currency strings (e.g., 5519200 -> 55192.00)
        if len(token) >= 6:
            return round(float(token) / 100, 2)
        return float(token)
    except ValueError:
        return None


def _line_amounts(line: str) -> list[float]:
    lowered = line.lower()
    money_context = any(k in lowered for k in ["total", "amount", "tax", "gst", "cgst", "sgst", "igst", "vat", "subtotal", "rs", "inr", "₹"]) 

    # Skip lines that are clearly phone numbers or contact info
    if _is_contact_or_id_line(line):
        # Keep only lines that clearly represent payable amounts.
        if not any(k in lowered for k in ["total", "amount payable", "grand total", "net payable", "tax", "gst", "subtotal"]):
            return []

    values: list[float] = []
    for raw in re.findall(r"(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d{1,2})?)(?!\s*%)", line, re.IGNORECASE):
        parsed = _to_money(raw)
        if parsed is not None and parsed > 0:
            # Filter out likely phone numbers (e.g. 10 digits or 5-6 digit STD codes without currency prefix)
            raw_clean = re.sub(r"[^\d]", "", raw)
            if len(raw_clean) >= 9: # Mobile numbers
                continue
            if len(raw_clean) == 5 and raw.startswith('0'): # STD codes like 06856
                continue
            if len(raw_clean) >= 5 and "." not in raw and not money_context:
                # Avoid treating standalone long IDs as money values.
                continue
            values.append(parsed)
    return values


def _find_line_amount(lines: list[str], keywords: list[str]) -> Optional[float]:
    for line in lines:
        lowered = line.lower()
        if any(keyword in lowered for keyword in keywords):
            amounts = _line_amounts(line)
            if amounts:
                return amounts[-1]
    return None


def _find_percentage(line: str) -> Optional[float]:
    match = re.search(r"(\d+(?:\.\d+)?)\s*%", line)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _extract_vat_summary(lines: list[str]) -> tuple[Optional[float], Optional[float], Optional[float]]:
    """
    Parse rows under headers like: AMOUNT | VAT% | VAT AMOUNT.
    Returns (subtotal, tax_amount, tax_rate).
    """
    best_subtotal: Optional[float] = None
    best_tax: Optional[float] = None
    best_rate: Optional[float] = None

    for idx, line in enumerate(lines):
        lowered = line.lower()
        if not (("vat" in lowered and "amount" in lowered) or ("gst" in lowered and "amount" in lowered)):
            continue

        for row in lines[idx + 1: idx + 7]:
            vals = _line_amounts(row)
            if len(vals) < 3:
                continue
            subtotal_guess, rate_guess, tax_guess = vals[0], vals[1], vals[2]
            if not (subtotal_guess > 0 and tax_guess > 0 and subtotal_guess > tax_guess):
                continue
            if not (0 <= rate_guess <= 35):
                continue
            if best_subtotal is None or subtotal_guess > best_subtotal:
                best_subtotal = subtotal_guess
                best_tax = tax_guess
                best_rate = rate_guess / 100

    return best_subtotal, best_tax, best_rate


def _humanize_charge_label(label: str) -> str:
    return label.replace("_", " ").strip().title()


def _extract_charge_breakdown(lines: list[str]) -> tuple[dict[str, float], float, Optional[float], list[dict[str, str | float]]]:
    """Extract extra charge lines, label reasons, and optional due/net payable amount."""
    charge_keywords = {
        "service_charge": ["service charge", "svc charge", "service fee"],
        "insurance_charge": ["insurance", "ins."],
        "installation_charge": ["installation", "install charge", "fitting charge"],
        "ngt_charge": ["ngt"],
        "handling_charge": ["handling", "handling charge"],
        "delivery_charge": ["delivery", "transport charge", "freight"],
        "packing_charge": ["packing", "packaging"],
        "cess_charge": ["cess"],
        "round_off": ["round off", "roundoff"],
    }
    due_keywords = ["due amount", "balance due", "amount payable", "net payable", "payable amount", "grand total", "total fare", "fare amount"]
    charges: dict[str, float] = {}
    due_amount: Optional[float] = None
    charge_details: list[dict[str, str | float]] = []

    for line in lines:
        lowered = line.lower()
        amounts = _line_amounts(line)
        if not amounts:
            continue
        value = amounts[-1]

        is_summary_total_line = any(
            keyword in lowered
            for keyword in ["grand total", "total amount", "net payable", "amount due", "total due", "total payable", "total install"]
        )

        for label, keywords in charge_keywords.items():
            if is_summary_total_line:
                continue
            if any(keyword in lowered for keyword in keywords):
                # If a charge and a total appear on the same OCR line, prefer the first numeric token.
                if "total" in lowered and len(amounts) > 1:
                    continue
                charge_value = amounts[0] if len(amounts) > 1 else value
                charges[label] = round(charges.get(label, 0.0) + charge_value, 2)
                charge_details.append({
                    "code": label,
                    "label": _humanize_charge_label(label),
                    "amount": charge_value,
                    "source_line": line,
                })

        if due_amount is None and any(keyword in lowered for keyword in due_keywords):
            due_amount = value

    return charges, round(sum(charges.values()), 2), due_amount, charge_details


# ── Amount extraction ────────────────────────────────────────────────────────

def extract_amounts(text: str) -> dict:
    """
    Find all currency-like numbers and determine subtotal / tax / total.
    Supports Governance: tracks which lines were used for audit transparency.
    """
    lines = _normalize_lines(text)
    
    # 1. Candidate extraction with Line-Awareness (The Phone Shield)
    candidates: list[tuple[float, str]] = []
    for line in lines:
        line_vals = _line_amounts(line)
        for val in line_vals:
            candidates.append((val, line))

    # All unique values for math cross-validation
    amounts = sorted(set([c[0] for c in candidates]))
    
    result: dict[str, any] = {
        "subtotal": None, "tax_amount": None, "total": None, "tax_rate": None,
        "discount_amount": None, "discount_rate": None, "cgst_amount": None,
        "sgst_amount": None, "igst_amount": None, "vat_amount": None,
        "extra_charges_total": None, "due_amount": None,
        "extra_charge_details": [],
        "rationale": {} # Audit trail: field -> source line
    }

    def _mark(field: str, val: float, line: str):
        if result[field] is None:
            result[field] = val
            result["rationale"][field] = line

    extra_charges, extra_charges_total, due_amount, charge_details = _extract_charge_breakdown(lines)
    if extra_charges_total > 0:
        result["extra_charges_total"] = extra_charges_total
        result["extra_charge_details"] = charge_details
    if due_amount is not None:
        result["due_amount"] = due_amount

    # 2. Priority Keyword Search (Hierarchy: Total -> Subtotal -> Tax)
    total_keywords = [
        "grand total", "net payable", "total amount", "amount due", "total due", "total payable",
        "total fare", "fare amount", "current charges", "amount payable", "total amount after tax",
        "total after tax", "amount after tax", "balance amount", "refund/balance amount"
    ]
    for line in lines:
        lowered = line.lower()
        if any(k in lowered for k in total_keywords):
            line_vals = _line_amounts(line)
            if line_vals:
                _mark("total", line_vals[-1], line)
    
    # Fallback to general patterns for total
    if not result["total"]:
        total_patterns = [
            r"(?:grand\s+total|total\s+amount|net\s+payable|amount\s+due|total\s+due|total\s+payable)[:\s]*(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d{1,2})?)",
            r"(?:total\s+amount\s+after\s+tax|total\s+after\s+tax|amount\s+after\s+tax|total\s+fare|fare\s+amount)[:\s]*(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d{1,2})?)",
            r"(?:total)[:\s]*(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d{1,2})?)",
        ]
        for pat in total_patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                parsed = _to_money(m.group(1))
                if parsed is not None:
                    # Find which line it came from
                    src = next((line for line in lines if m.group(1) in line), "Pattern Match")
                    _mark("total", parsed, src)
                    break

    # Subtotal
    sub_keywords = ["subtotal", "sub total", "taxable amount", "basic amount", "amount before tax", "net amount", "current bill charges", "energy charges"]
    for line in lines:
        if any(k in line.lower() for k in sub_keywords):
            line_vals = _line_amounts(line)
            if line_vals:
                _mark("subtotal", line_vals[-1], line)
    if not result["subtotal"]:
        sub_m = re.search(
            r"(?:subtotal|sub\s+total|taxable\s+amount|basic\s+amount|amount\s+before\s+tax|net\s+amount)[:\s]*(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d{1,2})?)",
            text, re.IGNORECASE,
        )
        if sub_m:
            parsed = _to_money(sub_m.group(1))
            if parsed is not None:
                result["subtotal"] = parsed

    # Discount and tax breakdown (GST, VAT, IGST, CGST, SGST)
    for line in lines:
        lowered = line.lower()
        if any(keyword in lowered for keyword in ["discount", "less discount", "rebate", "saving", "savings", "promo", "promotion", "coupon"]):
            amounts_in_line = _line_amounts(line)
            if amounts_in_line and result["discount_amount"] is None:
                result["discount_amount"] = amounts_in_line[-1]
            if result["discount_rate"] is None:
                result["discount_rate"] = _find_percentage(line)

        if any(keyword in lowered for keyword in ["cgst", "sgst", "igst", "vat", "tax amount", "service tax", "gst"]):
            if "discount" in lowered:
                continue
            amounts_in_line = _line_amounts(line)
            if not amounts_in_line:
                continue
            last_amount = amounts_in_line[-1]
            if "cgst" in lowered and result["cgst_amount"] is None:
                result["cgst_amount"] = last_amount
            if "sgst" in lowered and result["sgst_amount"] is None:
                result["sgst_amount"] = last_amount
            if "igst" in lowered and result["igst_amount"] is None:
                result["igst_amount"] = last_amount
            if "vat" in lowered and result["vat_amount"] is None:
                result["vat_amount"] = last_amount
            if "gst" in lowered and result["tax_amount"] is None and "cgst" not in lowered and "sgst" not in lowered and "igst" not in lowered:
                line_vals = _line_amounts(line)
                if line_vals:
                    _mark("tax_amount", line_vals[-1], line)

    # Transport/Ticket/Utility specific ID extraction
    meta_info = []
    patterns = [
        (r"pnr[:\s]+([a-z0-9]+)", "PNR"),
        (r"flight\s*(?:no|num)?[:\s]+([a-z0-9]+)", "Flight"),
        (r"train\s*(?:no|num)?[:\s]+([a-z0-9]+)", "Train"),
        (r"seat\s*(?:no)?[:\s]+([a-z0-9,]+)", "Seat"),
        (r"booking\s*(?:id|ref)[:\s]+([a-z0-9]+)", "Booking ID"),
        (r"(?:consumer|meter|cust)\s*(?:no|id)?[:\s]+([a-z0-9-]+)", "Service ID"),
        (r"(?:units|consumed)[:\s]+([\d\.]+)", "Units Consumed"),
    ]
    for pattern, label in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            meta_info.append(f"{label}: {m.group(1).upper()}")
            result["rationale"][label.lower()] = next((l for l in lines if m.group(1) in l), "Pattern")
    if meta_info:
        result["ticket_details"] = " | ".join(meta_info)

    if result["cgst_amount"] is not None or result["sgst_amount"] is not None:
        result["tax_amount"] = round((result["cgst_amount"] or 0) + (result["sgst_amount"] or 0), 2)
    elif result["igst_amount"] is not None:
        result["tax_amount"] = result["igst_amount"]
    elif result["vat_amount"] is not None:
        result["tax_amount"] = result["vat_amount"]

    # VAT/GST summary table fallback/preference: AMOUNT | VAT% | VAT AMOUNT
    vat_sub, vat_tax, vat_rate = _extract_vat_summary(lines)
    if not result["subtotal"] and vat_sub is not None:
        result["subtotal"] = vat_sub
    if vat_tax is not None:
        if result["tax_amount"] is None:
            result["tax_amount"] = vat_tax
        elif result["subtotal"] and result["total"]:
            current_gap = abs((result["subtotal"] + result["tax_amount"]) - result["total"])
            vat_gap = abs((result["subtotal"] + vat_tax) - result["total"])
            if vat_gap + 1.0 < current_gap:
                result["tax_amount"] = vat_tax
    if not result["tax_rate"] and vat_rate is not None:
        result["tax_rate"] = vat_rate

    # Fallback: use the largest reliable amount as total.
    # Keep discount / percentage lines from polluting the amount inference.
    if not result["total"] and len(amounts) >= 1:
        result["total"] = amounts[-1]

    if not result["total"] and result["due_amount"]:
        result["total"] = result["due_amount"]

    if result["total"] and result["tax_amount"] is not None and not result["subtotal"]:
        derived_subtotal = round(result["total"] - result["tax_amount"] + (result["discount_amount"] or 0), 2)
        if derived_subtotal > 0:
            result["subtotal"] = derived_subtotal

    # If receipt only has total and no clear GST/discount, treat as tax-inclusive total.
    if result["total"] and not result["subtotal"] and not result["tax_amount"]:
        result["subtotal"] = result["total"]
        result["tax_amount"] = 0.0

    # Derive missing values with cross-validation
    if result["subtotal"] and result["total"] and not result["tax_amount"] and "subtotal" in result["rationale"]:
        result["tax_amount"] = round(result["total"] - result["subtotal"] + (result["discount_amount"] or 0), 2)
    
    # Universal Math Correction: If we have multiple candidates, find the one that fits: Sub + Tax - Disc = Total
    # This is critical for complex receipts like the Rajendra Traders one.
    if result["total"] and result["subtotal"] and result["tax_amount"]:
        sub_val = result["subtotal"]
        tax_val = result["tax_amount"]
        disc_val = result["discount_amount"] or 0
        tot_val = result["total"]
        
        # If mismatch is significant, look for other candidate amounts in the text
        if abs(sub_val + tax_val - disc_val - tot_val) > 1.0:
            for amt in amounts:
                # Try replacing subtotal with this amount to see if it fixes the math
                if abs(amt + tax_val - disc_val - tot_val) < 0.5:
                    result["subtotal"] = amt
                    break
                # Try replacing total
                if abs(sub_val + tax_val - disc_val - amt) < 0.5:
                    result["total"] = amt
                    break
    
    if result["subtotal"] and result["tax_amount"] and not result["total"]:
        result["total"] = round(result["subtotal"] + result["tax_amount"] - (result["discount_amount"] or 0), 2)

    # Guardrail: if implicit tax is unrealistically high, prefer tax-inclusive interpretation.
    explicit_tax_evidence = (
        result.get("cgst_amount") is not None
        or result.get("sgst_amount") is not None
        or result.get("igst_amount") is not None
        or result.get("vat_amount") is not None
        or "tax_amount" in result["rationale"]
    )
    if result["subtotal"] and result["tax_amount"] and result["total"] and not explicit_tax_evidence:
        if result["tax_amount"] > (result["subtotal"] * 0.45):
            result["subtotal"] = result["total"]
            result["tax_amount"] = 0.0
            result["tax_rate"] = 0.0
    if result["subtotal"] and result["subtotal"] > 0 and result["tax_amount"]:
        result["tax_rate"] = round(result["tax_amount"] / result["subtotal"], 4)

    # Correct common OCR scaling errors where total loses decimal placement.
    if result["subtotal"] and result["tax_amount"]:
        expected_total = round(result["subtotal"] + result["tax_amount"], 2)
        if result["total"]:
            if result["total"] > expected_total * 5:
                scaled = round(result["total"] / 100, 2)
                if abs(scaled - expected_total) <= max(20.0, expected_total * 0.25):
                    result["total"] = scaled
                elif abs(result["total"] - expected_total) > max(50.0, expected_total * 0.5):
                    result["total"] = expected_total
        else:
            result["total"] = expected_total

    return result


# ── Merchant name ────────────────────────────────────────────────────────────

def extract_merchant(text: str) -> Optional[str]:
    """Find the merchant/vendor name, prioritizing business identifiers and cleaning noise."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    skip_merchant_line_keywords = ["total", "subtotal", "tax", "gst", "amount payable", "net payable", "grand total", "invoice total", "cash bill", "tax invoice", "invoice", "receipt", "bill", "memo"]
    
    # Priority 1: Lines containing business keywords
    business_keywords = ["hotel", "restaurant", "store", "traders", "mart", "hospital", "clinic", "pharmacy", "medical", "bill", "pvt", "ltd"]
    for line in lines[:8]:
        lowered = line.lower()
        if _is_contact_or_id_line(line):
            continue
        if any(k in lowered for k in skip_merchant_line_keywords):
            continue
        if any(kw in lowered for kw in business_keywords):
            # Clean the line: remove phone numbers, emails, random symbols
            cleaned = re.sub(r"\d{5,12}", "", line) # remove long numbers
            cleaned = re.sub(r"Ph:?|Mobile:?|Tel:?|Email:?|INR|₹|Rs\.?", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"[^a-zA-Z0-9\s\.-]", "", cleaned)
            cleaned = re.sub(r"\s+", " ", cleaned).strip()
            if len(cleaned) > 3:
                return cleaned[:100]

    # Priority 2: First meaningful line that isn't just symbols or numbers
    for line in lines[:5]:
        lowered = line.lower()
        if _is_contact_or_id_line(line):
            continue
        if any(k in lowered for k in skip_merchant_line_keywords):
            continue
        if len(line) > 3 and not re.match(r"^[\d\s\-/|#\.:]+$", line):
            cleaned = re.sub(r"\s+", " ", line).strip()
            if cleaned.lower() in skip_merchant_line_keywords:
                continue
            return cleaned[:100]
            
    return None


# ── Date extraction ──────────────────────────────────────────────────────────

def extract_date(text: str) -> Optional[str]:
    """Extract date, return in YYYY-MM-DD format."""
    patterns = [
        # DD/MM/YYYY or DD-MM-YYYY
        (r"(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})", "dmy"),
        # YYYY-MM-DD or YYYY/MM/DD
        (r"(\d{4})[/\-\.](\d{1,2})[/\-\.](\d{1,2})", "ymd"),
        # DD Month YYYY  e.g. 15 Jan 2025
        (r"(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+(\d{4})", "dmy_text"),
        # Month DD, YYYY  e.g. January 15, 2025
        (r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})[,\s]+(\d{4})", "mdy_text"),
    ]
    MONTHS = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,"jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}

    for pattern, fmt in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if not m:
            continue
        g = m.groups()
        try:
            if fmt == "dmy":
                d, mo, y = int(g[0]), int(g[1]), int(g[2])
            elif fmt == "ymd":
                y, mo, d = int(g[0]), int(g[1]), int(g[2])
            elif fmt == "dmy_text":
                d, mo, y = int(g[0]), MONTHS.get(g[1].lower()[:3], 1), int(g[2])
            else:  # mdy_text
                mo, d, y = MONTHS.get(g[0].lower()[:3], 1), int(g[1]), int(g[2])

            if 2000 <= y <= 2099 and 1 <= mo <= 12 and 1 <= d <= 31:
                return f"{y:04d}-{mo:02d}-{d:02d}"
        except (ValueError, IndexError):
            continue
    return None


# ── GST number ───────────────────────────────────────────────────────────────

def extract_gst(text: str) -> Optional[str]:
    """Extract 15-character Indian GST number."""
    m = re.search(r"\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b", text.upper())
    return m.group() if m else None


def detect_document_type(text: str) -> str:
    lowered = text.lower()
    scores = {
        "bus_ticket": sum(1 for k in ["bus ticket", "boarding point", "dropping point", "ticket pnr", "reporting time", "departure time"] if k in lowered),
        "train_ticket": sum(1 for k in ["irctc", "train", "coach", "berth", "seat no", "pnr", "boarding station"] if k in lowered),
        "flight_ticket": sum(1 for k in ["flight", "airline", "boarding pass", "departure", "arrival", "pnr", "terminal"] if k in lowered),
        "utility_bill": sum(1 for k in ["electricity", "current charges", "energy charges", "units consumed", "consumer no", "meter", "eb bill"] if k in lowered),
        "hotel_bill": sum(1 for k in ["hotel", "lodging", "room no", "rent per day", "check in", "check out"] if k in lowered),
        "retail_invoice": sum(1 for k in ["invoice", "gstin", "hsn", "qty", "rate", "amount", "cash bill"] if k in lowered),
    }
    best_type, best_score = max(scores.items(), key=lambda x: x[1])
    return best_type if best_score > 0 else "general_receipt"


def _extract_ticket_metadata(lines: list[str], text: str) -> dict:
    def _find(pattern: str) -> Optional[str]:
        m = re.search(pattern, text, re.IGNORECASE)
        return m.group(1).strip() if m else None

    ticket_total = _find_line_amount(lines, ["total fare", "fare amount", "amount payable", "total amount", "total after tax", "grand total"])

    return {
        "from": _find(r"\bfrom\s*[:\-]?\s*([a-z0-9 .,&-]{2,})"),
        "to": _find(r"\bto\s*[:\-]?\s*([a-z0-9 .,&-]{2,})"),
        "ticket_pnr": _find(r"(?:ticket\s*pnr|pnr)\s*[:\-]?\s*([a-z0-9-]{4,})"),
        "booking_id": _find(r"(?:booking\s*(?:id|ref)|reference\s*no)\s*[:\-]?\s*([a-z0-9-]{4,})"),
        "seat": _find(r"(?:seat\s*(?:no)?|berth)\s*[:\-]?\s*([a-z0-9,/ -]{1,20})"),
        "ticket_total": ticket_total,
    }


def _extract_utility_metadata(lines: list[str], text: str) -> dict:
    def _find(pattern: str) -> Optional[str]:
        m = re.search(pattern, text, re.IGNORECASE)
        return m.group(1).strip() if m else None

    units = _find(r"(?:units\s*consumed|units)\s*[:\-]?\s*([\d.]+)")
    current_charges = _find_line_amount(lines, ["current charges", "energy charges", "bill charges"])
    payable = _find_line_amount(lines, ["net payable", "amount payable", "total amount", "grand total", "balance amount", "refund/balance amount"])

    return {
        "service_id": _find(r"(?:consumer|meter|customer|account)\s*(?:no|id)?\s*[:\-]?\s*([a-z0-9-]{4,})"),
        "units_consumed": float(units) if units and re.match(r"^\d+(?:\.\d+)?$", units) else None,
        "current_charges": current_charges,
        "payable_amount": payable,
    }


# ── Category detection ───────────────────────────────────────────────────────

CATEGORY_KEYWORDS = {
    "travel": ["airline", "airways", "flight", "indigo", "air india", "spicejet", "vistara",
               "train", "irctc", "railway", "bus", "taxi", "uber", "ola", "cab", "fuel",
               "petrol", "diesel", "toll", "pnr", "ticket", "fare", "passenger", "boarding", "boarding pass"],
    "accommodation": ["hotel", "inn", "lodge", "resort", "airbnb", "oyo", "taj", "marriott",
                      "hyatt", "oberoi", "guest house", "hostel"],
    "meals": ["restaurant", "cafe", "coffee", "food", "zomato", "swiggy", "dining",
              "kitchen", "dhaba", "biryani", "pizza", "burger", "canteen"],
    "medical": ["pharmacy", "hospital", "clinic", "medical", "medicine", "diagnostic",
                "apollo", "fortis", "max hospital", "chemist"],
    "tech": ["amazon web", "google cloud", "microsoft", "adobe", "software", "subscription",
             "saas", "app store", "play store"],
    "supplies": ["stationery", "office", "printing", "supplies", "amazon", "flipkart",
                 "reliance smart", "dmart"],
    "utilities": ["electricity", "internet", "airtel", "jio", "bsnl", "broadband",
                  "mobile recharge", "water", "mseb", "gas", "water bill", "utility", "eb bill", "electricity charges"],
}

def detect_category(text: str, merchant: Optional[str] = None) -> str:
    combined = (text + " " + (merchant or "")).lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in combined for kw in keywords):
            return cat
    return "other"


# ── ESG carbon calculation ───────────────────────────────────────────────────

CARBON_RATES = {
    "travel":        0.255,   # kg CO2 per ₹100 (flight proxy)
    "accommodation": 0.0315,  # kg CO2 per ₹100 (hotel)
    "meals":         0.0025,  # kg CO2 per ₹100 (restaurant)
    "tech":          0.0,
    "supplies":      0.0005,
    "medical":       0.0002,
    "utilities":     0.001,
    "other":         0.0003,
}

def calculate_carbon(category: str, total_amount: float) -> float:
    rate = CARBON_RATES.get(category, 0.0003)
    return round(rate * (total_amount / 100), 4)


# ── Main parse function ──────────────────────────────────────────────────────

def _clamp(val: float, min_v: float = 0.0, max_v: float = 0.99) -> float:
    return max(min_v, min(max_v, val))


def _compute_field_confidence(amounts: dict, merchant: Optional[str], expense_date: Optional[str], ocr_confidence: float, document_type: str = "general_receipt") -> tuple[dict[str, float], list[str]]:
    rationale = amounts.get("rationale") or {}
    subtotal = amounts.get("subtotal")
    tax_amount = amounts.get("tax_amount") 
    total = amounts.get("total")
    discount = amounts.get("discount_amount") or 0.0

    math_consistent = False
    if subtotal is not None and total is not None and tax_amount is not None:
        expected = round((subtotal or 0.0) + (tax_amount or 0.0) - discount, 2)
        math_consistent = abs(expected - (total or 0.0)) <= max(2.0, expected * 0.03)

    extra_charges_total = amounts.get("extra_charges_total")

    field_confidence = {
        "merchant_name": _clamp((ocr_confidence * 0.82) + (0.18 if merchant else -0.18) + (0.07 if merchant and len(merchant) >= 4 else 0.0), 0.12),
        "expense_date": _clamp((ocr_confidence * 0.82) + (0.22 if expense_date else -0.1), 0.12),
        "subtotal": _clamp((ocr_confidence * 0.85) + (0.16 if subtotal is not None else -0.1) + (0.1 if "subtotal" in rationale else 0.0), 0.12),
        "tax_amount": _clamp((ocr_confidence * 0.85) + (0.16 if tax_amount is not None else -0.1) + (0.08 if "tax_amount" in rationale else 0.0), 0.12),
        "total": _clamp((ocr_confidence * 0.92) + (0.2 if total is not None else -0.1) + (0.12 if "total" in rationale else 0.0), 0.12),
        "extra_charges_total": 0.95 if not extra_charges_total else _clamp((ocr_confidence * 0.75) + 0.2, 0.25),
    }

    if math_consistent:
        field_confidence["subtotal"] = _clamp(field_confidence["subtotal"] + 0.08)
        field_confidence["tax_amount"] = _clamp(field_confidence["tax_amount"] + 0.08)
        field_confidence["total"] = _clamp(field_confidence["total"] + 0.12)
    else:
        field_confidence["total"] = _clamp(field_confidence["total"] - 0.12)

    critical_fields_map = {
        "bus_ticket": {"merchant_name", "expense_date", "total"},
        "train_ticket": {"merchant_name", "expense_date", "total"},
        "flight_ticket": {"merchant_name", "expense_date", "total"},
        "utility_bill": {"merchant_name", "total"},
        "hotel_bill": {"merchant_name", "total"},
        "retail_invoice": {"merchant_name", "total"},
        "general_receipt": {"merchant_name", "total"},
    }
    critical_fields = critical_fields_map.get(document_type, critical_fields_map["general_receipt"])
    low_confidence_fields = [field for field, score in field_confidence.items() if field in critical_fields and score < 0.7]

    return field_confidence, low_confidence_fields


def parse_receipt(raw_text: str, confidence: float = 0.97) -> dict:
    """Full parse: returns all structured fields from raw OCR text."""
    amounts  = extract_amounts(raw_text)
    lines = _normalize_lines(raw_text)
    document_type = detect_document_type(raw_text) 
    charge_breakdown, _, _, charge_details = _extract_charge_breakdown(lines)
    merchant = extract_merchant(raw_text)
    category = detect_category(raw_text, merchant)
    expense_date = extract_date(raw_text)

    ticket_meta = _extract_ticket_metadata(lines, raw_text) if document_type in ("bus_ticket", "train_ticket", "flight_ticket") else {}
    utility_meta = _extract_utility_metadata(lines, raw_text) if document_type == "utility_bill" else {}

    # Context-specific total correction for transport tickets and utility bills.
    if ticket_meta.get("ticket_total") is not None:
        ticket_total = float(ticket_meta["ticket_total"])
        if amounts.get("total") is None or abs(float(amounts.get("total") or 0) - ticket_total) > max(10.0, ticket_total * 0.2): 
            amounts["total"] = ticket_total
            if amounts.get("subtotal") is None:
                amounts["subtotal"] = ticket_total
            if amounts.get("tax_amount") is None:
                amounts["tax_amount"] = 0.0

    if utility_meta.get("payable_amount") is not None and amounts.get("total") is None:
        amounts["total"] = float(utility_meta["payable_amount"])
    if utility_meta.get("current_charges") is not None and amounts.get("subtotal") is None:
        amounts["subtotal"] = float(utility_meta["current_charges"])

    if document_type in ("bus_ticket", "train_ticket", "flight_ticket"):
        category = "travel"
    elif document_type == "utility_bill":
        category = "utilities"

    total = amounts.get("total") or 0
    field_confidence, low_confidence_fields = _compute_field_confidence(amounts, merchant, expense_date, confidence, document_type)

    return {
        "document_type": document_type,
        "merchant_name":  merchant,
        "merchant_id":    extract_gst(raw_text),
        "expense_date":   expense_date,
        "subtotal":       amounts.get("subtotal"),
        "tax_amount":     amounts.get("tax_amount"),
        "total":          total,
        "tax_rate":       amounts.get("tax_rate"),
        "discount_amount": amounts.get("discount_amount"),
        "discount_rate":   amounts.get("discount_rate"),
        "cgst_amount":     amounts.get("cgst_amount"),
        "sgst_amount":     amounts.get("sgst_amount"),
        "igst_amount":     amounts.get("igst_amount"),
        "extra_charges_total": amounts.get("extra_charges_total"),
        "extra_charge_details": charge_details or amounts.get("extra_charge_details") or [],
        "due_amount":      amounts.get("due_amount"),
        "charge_breakdown": charge_breakdown,
        "category":       category,
        "ticket_details":  amounts.get("ticket_details"),
        "transport_metadata": ticket_meta,
        "utility_metadata": utility_meta,
        "carbon_kg":      calculate_carbon(category, total),
        "field_confidence": field_confidence,
        "low_confidence_fields": low_confidence_fields,
        "confidence":     confidence,
        "raw_text_snippet": raw_text[:300],
    }
