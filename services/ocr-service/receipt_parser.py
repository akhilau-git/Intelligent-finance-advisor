"""
Receipt Parser — extracts structured data from raw OCR text.
Supports: restaurant bills, hotel invoices, airline tickets,
          fuel receipts, medical bills, online payment receipts, etc.
"""

import re
from typing import Optional
from datetime import datetime


# ── Amount extraction ────────────────────────────────────────────────────────

def extract_amounts(text: str) -> dict:
    """
    Find all currency-like numbers and determine subtotal / tax / total.
    Handles ₹, Rs., INR, USD, EUR formats.
    """
    # Match: ₹1,234.56  Rs. 500  1234.00  INR 5000
    raw = re.findall(
        r"(?:₹|Rs\.?\s*|INR\s*|USD\s*|EUR\s*)?\s*([\d,]+(?:\.\d{1,2})?)",
        text,
        re.IGNORECASE,
    )
    amounts = []
    for a in raw:
        try:
            val = float(a.replace(",", ""))
            if val > 0:
                amounts.append(val)
        except ValueError:
            pass

    amounts = sorted(set(amounts))
    result  = {"subtotal": None, "tax_amount": None, "total": None, "tax_rate": None}

    # Try to find total via keywords first
    total_patterns = [
        r"(?:grand\s+total|total\s+amount|net\s+payable|amount\s+due|total\s+due|total\s+payable)[:\s]*(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d{1,2})?)",
        r"(?:total)[:\s]*(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d{1,2})?)",
    ]
    for pat in total_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            try:
                result["total"] = float(m.group(1).replace(",", ""))
                break
            except ValueError:
                pass

    # Subtotal
    sub_m = re.search(
        r"(?:subtotal|sub\s+total|taxable\s+amount|basic\s+amount)[:\s]*(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d{1,2})?)",
        text, re.IGNORECASE,
    )
    if sub_m:
        try:
            result["subtotal"] = float(sub_m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Tax (GST, VAT, IGST, CGST, SGST)
    tax_m = re.search(
        r"(?:gst|igst|cgst\s*\+\s*sgst|vat|tax\s+amount|service\s+tax)[:\s]*(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d{1,2})?)",
        text, re.IGNORECASE,
    )
    if tax_m:
        try:
            result["tax_amount"] = float(tax_m.group(1).replace(",", ""))
        except ValueError:
            pass

    # Fallback: use largest as total, second-largest as subtotal
    if not result["total"] and len(amounts) >= 2:
        result["total"]    = amounts[-1]
        result["subtotal"] = amounts[-2]
    elif not result["total"] and len(amounts) == 1:
        result["total"] = amounts[0]

    # Derive missing values
    if result["subtotal"] and result["total"] and not result["tax_amount"]:
        result["tax_amount"] = round(result["total"] - result["subtotal"], 2)
    if result["subtotal"] and result["tax_amount"] and not result["total"]:
        result["total"] = round(result["subtotal"] + result["tax_amount"], 2)
    if result["subtotal"] and result["subtotal"] > 0 and result["tax_amount"]:
        result["tax_rate"] = round(result["tax_amount"] / result["subtotal"], 4)

    return result


# ── Merchant name ────────────────────────────────────────────────────────────

def extract_merchant(text: str) -> Optional[str]:
    """First meaningful line is usually the merchant/vendor name."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    # Skip very short or clearly non-name lines
    for line in lines[:5]:
        if len(line) > 3 and not re.match(r"^[\d\s\-/|#]+$", line):
            return line[:100]
    return lines[0][:100] if lines else None


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


# ── Category detection ───────────────────────────────────────────────────────

CATEGORY_KEYWORDS = {
    "travel": ["airline", "airways", "flight", "indigo", "air india", "spicejet", "vistara",
               "train", "irctc", "railway", "bus", "taxi", "uber", "ola", "cab", "fuel",
               "petrol", "diesel", "toll"],
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
                  "mobile recharge", "water"],
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

def parse_receipt(raw_text: str, confidence: float = 0.97) -> dict:
    """Full parse: returns all structured fields from raw OCR text."""
    amounts  = extract_amounts(raw_text)
    merchant = extract_merchant(raw_text)
    category = detect_category(raw_text, merchant)
    total    = amounts.get("total") or 0

    return {
        "merchant_name":  merchant,
        "merchant_id":    extract_gst(raw_text),
        "expense_date":   extract_date(raw_text),
        "subtotal":       amounts.get("subtotal"),
        "tax_amount":     amounts.get("tax_amount"),
        "total":          total,
        "tax_rate":       amounts.get("tax_rate"),
        "category":       category,
        "carbon_kg":      calculate_carbon(category, total),
        "confidence":     confidence,
        "raw_text_snippet": raw_text[:300],
    }
