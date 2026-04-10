"""
FinSight IFOS — OCR Service (Port 8002)
Accepts: PDF, JPG, JPEG, PNG, WEBP, TIFF, BMP, GIF — any bill format
Uses: Google Cloud Vision API for text extraction
Returns: Structured receipt data auto-filled into claim form
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from receipt_parser import parse_receipt
import os, hashlib, base64, io, re, asyncio, httpx, json
from copy import deepcopy
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import pytesseract  # type: ignore[import-not-found]
from pypdf import PdfReader
import fitz
import pdfplumber
import google.generativeai as genai
import numpy as np

try:
    from rapidocr_onnxruntime import RapidOCR  # type: ignore[import-not-found]
except Exception:
    RapidOCR = None

load_dotenv()

app = FastAPI(title="FinSight OCR Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

GOOGLE_KEY = os.getenv("GOOGLE_CLOUD_VISION_KEY", "")
AZURE_DOCINT_ENDPOINT = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "").rstrip("/")
AZURE_DOCINT_KEY = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY", "")
AZURE_DOCINT_MODEL = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_MODEL", "prebuilt-receipt")
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
OCR_MODE = os.getenv("OCR_MODE", "fast").strip().lower()  # fast | accurate

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)

SUPPORTED_FORMATS = {
    "image/jpeg":    True,
    "image/jpg":     True,
    "image/png":     True,
    "image/webp":    True,
    "image/tiff":    True,
    "image/bmp":     True,
    "image/gif":     True,
    "application/pdf": True,
}

MAX_FILE_BYTES = 15 * 1024 * 1024  # 15 MB
_rapid_ocr_engine = RapidOCR() if RapidOCR else None
OCR_CACHE_MAX = int(os.getenv("OCR_CACHE_MAX", "200"))
_ocr_result_cache: dict[str, dict] = {}
MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "0"))
FRAUD_SERVICE_URL = os.getenv("FRAUD_SERVICE_URL", "http://fraud-service:8001").rstrip("/")
COMPLIANCE_LOG_PATH = os.getenv("COMPLIANCE_LOG_PATH", "/tmp/ocr_audit_log.jsonl")


def _cache_get(cache_key: str) -> dict | None:
    cached = _ocr_result_cache.get(cache_key)
    return deepcopy(cached) if cached else None


def _cache_set(cache_key: str, payload: dict) -> None:
    if len(_ocr_result_cache) >= OCR_CACHE_MAX:
        oldest_key = next(iter(_ocr_result_cache.keys()))
        _ocr_result_cache.pop(oldest_key, None)
    _ocr_result_cache[cache_key] = deepcopy(payload)


def _append_compliance_log(event: dict) -> None:
    """Append parse events to a JSONL audit trail for compliance investigations."""
    try:
        line = json.dumps(event, ensure_ascii=True)
        log_dir = os.path.dirname(COMPLIANCE_LOG_PATH)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
        with open(COMPLIANCE_LOG_PATH, "a", encoding="utf-8") as fp:
            fp.write(line + "\n")
    except Exception:
        # Never break parsing due to audit write failures.
        pass


def _is_strong_candidate(parsed: dict, confidence: float) -> bool:
    """Decide if we can stop early for speed."""
    has_total = parsed.get("total") is not None and float(parsed.get("total") or 0) > 0
    has_vendor = isinstance(parsed.get("merchant_name"), str) and bool(parsed.get("merchant_name", "").strip())
    low_fields = parsed.get("low_confidence_fields") or []
    critical_low = [f for f in low_fields if f in {"merchant_name", "expense_date", "subtotal", "tax_amount", "total"}]
    return has_total and (has_vendor or confidence >= 0.8) and len(critical_low) == 0


def extract_text_pdf_native(pdf_bytes: bytes) -> tuple[str, float]:
    """Extract text from all PDF pages using pdfplumber/pypdf fallback."""
    page_limit = None if MAX_PDF_PAGES <= 0 else MAX_PDF_PAGES
    try:
        text_parts = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages = pdf.pages if page_limit is None else pdf.pages[:page_limit]
            for page in pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        text = "\n\n".join(text_parts).strip()
        if len(text) >= 40:
            return text, 0.99
    except Exception:
        # Fallback to pypdf if pdfplumber fails
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            pages = reader.pages if page_limit is None else reader.pages[:page_limit]
            text_parts = [p.extract_text() or "" for p in pages]
            text = "\n".join(p for p in text_parts if p).strip()
            if len(text) >= 40:
                return text, 0.95
        except Exception:
            pass
    return "", 0.0


async def parse_with_ai(text: str, image_list: list[bytes], confidence: float) -> dict | None:
    """Use Gemini Multimodal Vision to parse multiple images and text into structured JSON."""
    if not GEMINI_KEY:
        return None

    prompt = f"""
    You are an AI Document Specialist. Analyze these document images (could be multiple pages) and the provided text.
    
    GOAL: Extract structured financial data with 100% accuracy.
    
    FIELDS TO EXTRACT:
    - merchant_name: Business name. Look at logos/headers on page 1.
    - merchant_id: GST/Tax ID.
    - expense_date: Format YYYY-MM-DD.
    - subtotal: Base amount.
    - tax_amount: Total tax.
    - discount_amount: Total discount.
    - total: FINAL PAYABLE AMOUNT.
    - currency: 3-letter code.
    - document_type: retail_invoice, bus_ticket, train_ticket, flight_ticket, utility_bill, hotel_bill, general_receipt.
    - rationale: Briefly describe where critical values were found.

    OCR CONTEXT:
    {text[:4000]}
    
    RULES:
    1. If missing, use null.
    2. Numbers must be floats.
    3. Return ONLY a valid JSON object.
    4. BE SMART: If the OCR text is messy but the IMAGE is clear (like a dot-matrix ticket), TRUST YOUR EYES on the image.
    """

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Prepare multimodal parts for all pages
        parts = []
        for img_bytes in image_list[:5]: # Limit to 5 pages for speed
            parts.append({"mime_type": "image/jpeg", "data": img_bytes})
        parts.append(prompt)
        
        response = await asyncio.to_thread(model.generate_content, parts)
        res_text = response.text
        json_match = re.search(r"\{.*\}", res_text, re.DOTALL)
        if json_match:
            import json
            parsed = json.loads(json_match.group(0))
            parsed["ai_parsed"] = True
            parsed["confidence"] = confidence
            parsed["method"] = f"Gemini-Vision ({len(image_list)} pgs)"
            return parsed
    except Exception as e:
        print(f"Vision AI parsing error: {str(e)}")
    return None


async def pdf_to_images_fitz(pdf_bytes: bytes, max_pages: int = 0) -> list[bytes]:
    """Convert every PDF page to images for OCR unless an explicit page cap is configured."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        images = []
        page_limit = len(doc) if max_pages <= 0 else min(len(doc), max_pages)
        for i in range(page_limit):
            page = doc.load_page(i)
            # Render page to a high-res image (300 DPI)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img_data = pix.tobytes("jpeg")
            images.append(img_data)
        doc.close()
        return images
    except Exception as e:
        print(f"Fitz conversion error: {str(e)}")
        return []


def _parsed_quality(parsed: dict, confidence: float) -> float:
    score = confidence * 2.0
    if parsed.get("merchant_name"):
        score += 1.0
    if parsed.get("expense_date"):
        score += 1.0
    if parsed.get("total"):
        score += 2.0
    if parsed.get("subtotal") is not None:
        score += 0.8
    if parsed.get("tax_amount") is not None:
        score += 0.8
    return score


def _merge_page_parsed(page_results: list[tuple[int, str, float, dict]]) -> tuple[str, float, dict]:
    ranked = sorted(page_results, key=lambda r: _parsed_quality(r[3], r[2]), reverse=True)
    best_page, best_text, _, best_parsed = ranked[0]
    merged = dict(best_parsed)

    for _, _, _, parsed in ranked[1:]:
        for key in (
            "merchant_name", "merchant_id", "expense_date", "subtotal", "tax_amount", "total",
            "tax_rate", "category", "ticket_details", "document_type"
        ):
            if merged.get(key) in (None, "", 0, 0.0) and parsed.get(key) not in (None, "", 0, 0.0):
                merged[key] = parsed.get(key)

    merged["page_count_processed"] = len(page_results)
    merged["selected_page"] = best_page
    combined_text = "\n\n".join([r[1] for r in ranked[:3] if r[1].strip()]).strip() or best_text
    combined_confidence = round(sum(r[2] for r in ranked) / len(ranked), 4)
    return combined_text, combined_confidence, merged


def _image_to_png_bytes(image: Image.Image) -> bytes:
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def build_image_variants(image_bytes: bytes) -> list[tuple[str, bytes]]:
    """Generate multiple enhanced variants to improve OCR on scanned and low-quality receipts."""
    variants: list[tuple[str, bytes]] = [("original", image_bytes)]
    try:
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        # Variant 1: grayscale + auto-contrast for faded thermal receipts.
        gray = ImageOps.grayscale(image)
        gray_auto = ImageOps.autocontrast(gray, cutoff=2)
        variants.append(("gray_autocontrast", _image_to_png_bytes(gray_auto)))

        # Variant 2: sharpened text edges for blurry scans.
        sharp = gray_auto.filter(ImageFilter.SHARPEN)
        sharp = ImageEnhance.Contrast(sharp).enhance(1.35)
        variants.append(("sharpened", _image_to_png_bytes(sharp)))

        # Variant 3: strong binarization for noisy backgrounds.
        bw = gray_auto.point(lambda px: 255 if px > 160 else 0)
        variants.append(("binary", _image_to_png_bytes(bw)))

        # Variant 4: upscaled image for tiny fonts and compressed digital receipts.
        upscaled = image.resize((int(image.width * 1.5), int(image.height * 1.5)), Image.Resampling.LANCZOS)
        variants.append(("upscaled", _image_to_png_bytes(upscaled)))
    except Exception:
        return variants

    return variants


async def extract_text_google_vision(image_bytes: bytes) -> tuple[str, float]:
    """
    Call Google Cloud Vision API to extract text from image bytes.
    Returns: (raw_text, confidence)
    """
    if not GOOGLE_KEY:
        raise HTTPException(status_code=503, detail="Google Vision API key not configured")

    encoded = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "requests": [{
            "image": {"content": encoded},
            "features": [
                {"type": "DOCUMENT_TEXT_DETECTION"},  # Best for receipts/invoices
                {"type": "TEXT_DETECTION"},
            ],
        }]
    }
    url = f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_KEY}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    responses = data.get("responses", [{}])
    if not responses:
        return "", 0.0

    r = responses[0]

    # Get full text from DOCUMENT_TEXT_DETECTION (better for structured docs)
    full_text_annotation = r.get("fullTextAnnotation", {})
    raw_text = full_text_annotation.get("text", "")

    # Fallback to TEXT_DETECTION
    if not raw_text:
        annotations = r.get("textAnnotations", [])
        raw_text = annotations[0].get("description", "") if annotations else ""

    # Calculate confidence from page confidence scores
    pages = full_text_annotation.get("pages", [])
    if pages:
        confidences = [
            word.get("confidence", 0.95)
            for page in pages
            for block in page.get("blocks", [])
            for para in block.get("paragraphs", [])
            for word in para.get("words", [])
        ]
        confidence = sum(confidences) / len(confidences) if confidences else 0.97
    else:
        confidence = 0.97

    return raw_text, round(confidence, 4)


def _to_float_safe(value) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_azure_structured_fields(analyze_result: dict) -> dict:
    """Extract model-native key fields from Azure prebuilt-receipt output."""
    docs = analyze_result.get("documents", [])
    if not docs:
        return {}

    fields = docs[0].get("fields", {}) or {}

    def field_content(name: str) -> str:
        f = fields.get(name) or {}
        return (f.get("valueString") or f.get("content") or "").strip()

    def field_money(name: str) -> float | None:
        f = fields.get(name) or {}
        if isinstance(f.get("valueCurrency"), dict):
            return _to_float_safe(f["valueCurrency"].get("amount"))
        return _to_float_safe(f.get("valueNumber") or f.get("content"))

    def field_date(name: str) -> str | None:
        f = fields.get(name) or {}
        date_val = f.get("valueDate") or f.get("content")
        if not date_val:
            return None
        raw = str(date_val)
        # Azure usually returns YYYY-MM-DD for valueDate.
        if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
            return raw
        return None

    structured = {
        "merchant_name": field_content("MerchantName") or None,
        "expense_date": field_date("TransactionDate"),
        "subtotal": field_money("SubTotal"),
        "tax_amount": field_money("TotalTax"),
        "total": field_money("Total"),
    }

    # Remove empty values.
    return {k: v for k, v in structured.items() if v is not None and v != ""}


def _merge_structured_fields(parsed: dict, structured: dict) -> dict:
    """Merge model-native structured fields with text-parsed fields, preferring structured when available."""
    if not structured:
        return parsed

    merged = dict(parsed)
    for key in ("merchant_name", "expense_date", "subtotal", "tax_amount", "total"):
        if structured.get(key) is not None:
            merged[key] = structured[key]

    # Keep totals mathematically consistent when structured fields are partially present.
    subtotal = merged.get("subtotal")
    tax_amount = merged.get("tax_amount")
    total = merged.get("total")
    if subtotal is not None and total is not None and tax_amount is None:
        inferred = round(float(total) - float(subtotal), 2)
        if inferred >= 0:
            merged["tax_amount"] = inferred

    merged["structured_fields_used"] = list(structured.keys())
    return merged


async def extract_text_azure_document_intelligence(image_bytes: bytes) -> tuple[str, float, dict]:
    """Optional second OCR provider using Azure Document Intelligence."""
    if not AZURE_DOCINT_ENDPOINT or not AZURE_DOCINT_KEY:
        raise HTTPException(status_code=503, detail="Azure Document Intelligence is not configured")

    submit_url = (
        f"{AZURE_DOCINT_ENDPOINT}/formrecognizer/documentModels/"
        f"{AZURE_DOCINT_MODEL}:analyze?api-version=2023-07-31"
    )
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_DOCINT_KEY,
        "Content-Type": "application/octet-stream",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        submit_resp = await client.post(submit_url, headers=headers, content=image_bytes)
        submit_resp.raise_for_status()
        operation_url = submit_resp.headers.get("operation-location")
        if not operation_url:
            raise HTTPException(status_code=502, detail="Azure OCR response missing operation location")

        poll_headers = {"Ocp-Apim-Subscription-Key": AZURE_DOCINT_KEY}
        for _ in range(20):
            poll_resp = await client.get(operation_url, headers=poll_headers)
            poll_resp.raise_for_status()
            payload = poll_resp.json()
            status = (payload.get("status") or "").lower()
            if status == "succeeded":
                result = payload.get("analyzeResult", {})
                raw_text = result.get("content", "")
                words = [
                    word.get("confidence", 0.9)
                    for page in result.get("pages", [])
                    for word in page.get("words", [])
                    if isinstance(word.get("confidence", 0.9), (float, int))
                ]
                confidence = round(sum(words) / len(words), 4) if words else 0.9
                structured_fields = _extract_azure_structured_fields(result)
                return raw_text, confidence, structured_fields
            if status in ("failed", "canceled"):
                break
            await asyncio.sleep(0.5)

    return "", 0.0, {}


def extract_text_local(image_bytes: bytes) -> tuple[str, float]:
    """Fallback OCR using local Tesseract when Google Vision is unavailable."""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode not in ("RGB", "L"):
          image = image.convert("RGB")
        raw_text = pytesseract.image_to_string(image)
        confidence = 0.82 if raw_text.strip() else 0.0
        return raw_text, confidence
    except Exception:
        return "", 0.0


def extract_text_rapidocr(image_bytes: bytes) -> tuple[str, float]:
    """Local ML OCR fallback using RapidOCR (does not require Tesseract binary)."""
    if _rapid_ocr_engine is None:
        return "", 0.0
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)
        result, _ = _rapid_ocr_engine(image_np)
        if not result:
            return "", 0.0

        lines: list[str] = []
        confidences: list[float] = []
        for item in result:
            # item shape: [box, text, score]
            if len(item) < 3:
                continue
            text = str(item[1]).strip()
            score = float(item[2]) if item[2] is not None else 0.0
            if text:
                lines.append(text)
                confidences.append(score)

        raw_text = "\n".join(lines).strip()
        if not raw_text:
            return "", 0.0
        conf = round(sum(confidences) / len(confidences), 4) if confidences else 0.78
        return raw_text, conf
    except Exception:
        return "", 0.0


def _score_parsed_candidate(raw_text: str, confidence: float, structured_fields: dict | None = None) -> tuple[float, dict]:
    """Score OCR candidates using parsed-field completeness and arithmetic consistency."""
    parsed = parse_receipt(raw_text, confidence)
    if structured_fields:
        parsed = _merge_structured_fields(parsed, structured_fields)

    score = confidence * 2.0
    if parsed.get("merchant_name"):
        score += 1.0
    if parsed.get("expense_date"):
        score += 1.0
    if parsed.get("merchant_id"):
        score += 0.5
    if parsed.get("subtotal") is not None:
        score += 1.0
    if parsed.get("tax_amount") is not None:
        score += 1.0
    if parsed.get("total") is not None:
        score += 2.0

    subtotal = parsed.get("subtotal") or 0.0
    tax_amount = parsed.get("tax_amount") or 0.0
    discount = parsed.get("discount_amount") or 0.0
    total = parsed.get("total") or 0.0
    if subtotal > 0 and total > 0:
        expected = round(subtotal + tax_amount - discount, 2)
        tolerance = max(2.0, expected * 0.03)
        if abs(expected - total) <= tolerance:
            score += 2.0

    if len(raw_text.strip()) >= 100:
        score += 0.5

    if structured_fields:
        score += min(2.0, 0.4 * len(structured_fields))
        if all(k in structured_fields for k in ("subtotal", "tax_amount", "total")):
            score += 0.8

    return score, parsed


def _choose_weighted_categorical(candidates: list[tuple[float, str]]) -> str | None:
    if not candidates:
        return None
    bucket: dict[str, float] = {}
    for weight, value in candidates:
        if not value:
            continue
        bucket[value] = bucket.get(value, 0.0) + max(0.01, weight)
    if not bucket:
        return None
    return max(bucket.items(), key=lambda item: item[1])[0]


def _choose_weighted_numeric(candidates: list[tuple[float, float]], tolerance: float) -> float | None:
    if not candidates:
        return None
    # Cluster nearby numeric values so OCR variants that differ slightly can still agree.
    clusters: list[dict] = []
    for weight, value in sorted(candidates, key=lambda x: x[1]):
        placed = False
        for cluster in clusters:
            if abs(cluster["center"] - value) <= tolerance:
                cluster["values"].append((weight, value))
                total_w = sum(w for w, _ in cluster["values"])
                cluster["center"] = sum(w * v for w, v in cluster["values"]) / total_w
                placed = True
                break
        if not placed:
            clusters.append({"center": value, "values": [(weight, value)]})

    best_cluster = max(clusters, key=lambda c: sum(w for w, _ in c["values"]))
    total_w = sum(w for w, _ in best_cluster["values"])
    weighted_value = sum(w * v for w, v in best_cluster["values"]) / total_w
    return round(weighted_value, 2)


def _ensemble_fields(candidates: list[tuple[float, str, float, dict]]) -> dict:
    """Compute per-field consensus from OCR candidates using weighted voting."""
    if not candidates:
        return {}

    # Use top-N candidates to reduce outlier impact while still leveraging diversity.
    top = sorted(candidates, key=lambda c: c[0], reverse=True)[:6]

    merchant_votes: list[tuple[float, str]] = []
    date_votes: list[tuple[float, str]] = []
    subtotal_votes: list[tuple[float, float]] = []
    tax_votes: list[tuple[float, float]] = []
    total_votes: list[tuple[float, float]] = []

    for score, _, _, parsed in top:
        merchant = parsed.get("merchant_name")
        if isinstance(merchant, str) and merchant.strip():
            merchant_votes.append((score, merchant.strip()))

        expense_date = parsed.get("expense_date")
        if isinstance(expense_date, str) and expense_date.strip():
            date_votes.append((score, expense_date.strip()))

        for field, collector in (
            ("subtotal", subtotal_votes),
            ("tax_amount", tax_votes),
            ("total", total_votes),
        ):
            val = parsed.get(field)
            try:
                if val is not None:
                    collector.append((score, float(val)))
            except (TypeError, ValueError):
                continue

    consensus = {
        "merchant_name": _choose_weighted_categorical(merchant_votes),
        "expense_date": _choose_weighted_categorical(date_votes),
        "subtotal": _choose_weighted_numeric(subtotal_votes, tolerance=2.0),
        "tax_amount": _choose_weighted_numeric(tax_votes, tolerance=1.0),
        "total": _choose_weighted_numeric(total_votes, tolerance=2.0),
    }

    # Keep amount fields internally consistent when one field is missing.
    if consensus.get("subtotal") is not None and consensus.get("total") is not None and consensus.get("tax_amount") is None:
        inferred_tax = round(float(consensus["total"]) - float(consensus["subtotal"]), 2)
        if inferred_tax >= 0:
            consensus["tax_amount"] = inferred_tax

    consensus["ensemble_candidates_used"] = len(top)
    return {k: v for k, v in consensus.items() if v is not None}


def _calc_math_mismatch(subtotal: float | None, tax_amount: float | None, total: float | None, discount_amount: float | None = None) -> bool:
    if subtotal is None or tax_amount is None or total is None:
        return False
    discount = float(discount_amount or 0)
    expected = round(float(subtotal) + float(tax_amount) - discount, 2)
    return abs(expected - float(total)) > max(1.0, expected * 0.02)


async def _fraud_precheck(image_hash: str, parsed: dict) -> dict:
    payload = {
        "employee_id": "ocr-ingest",
        "merchant_name": parsed.get("merchant_name") or parsed.get("merchant") or "",
        "merchant_id": parsed.get("merchant_id") or None,
        "total_amount": float(parsed.get("total") or 0),
        "subtotal": float(parsed.get("subtotal") or 0),
        "tax_amount": float(parsed.get("tax_amount") or parsed.get("tax") or 0),
        "expense_date": parsed.get("expense_date") or parsed.get("date") or None,
        "receipt_hash": image_hash,
        "category": parsed.get("category") or "other",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(f"{FRAUD_SERVICE_URL}/analyze", json=payload)
            if res.status_code < 400:
                data = res.json()
                return {
                    "fraud_score": float(data.get("fraud_score") or 0),
                    "fraud_reason": data.get("fraud_reason") or data.get("reason") or None,
                }
    except Exception:
        pass
    return {"fraud_score": 0.0, "fraud_reason": None}


def _normalize_parse_response(parsed: dict, raw_text: str, confidence: float, image_hash: str, page_count: int) -> dict:
    merchant = parsed.get("merchant") or parsed.get("merchant_name")
    date = parsed.get("date") or parsed.get("expense_date")
    subtotal = parsed.get("subtotal")
    tax = parsed.get("tax") if parsed.get("tax") is not None else parsed.get("tax_amount")
    discount_amount = parsed.get("discount_amount")
    total = parsed.get("total")

    normalized = {
        "merchant": merchant,
        "date": date,
        "subtotal": subtotal,
        "tax": tax,
        "discount_amount": discount_amount,
        "total": total,
        # Compatibility keys used by existing UI/state shape.
        "merchant_name": merchant,
        "expense_date": date,
        "tax_amount": tax,
        "math_mismatch": _calc_math_mismatch(subtotal, tax, total, discount_amount),
        "raw_text": raw_text,
        "confidence": confidence,
        "image_hash": image_hash,
        "page_count_processed": page_count,
        "rationale": parsed.get("rationale") or {},
        "category": parsed.get("category") or "other",
    }
    return normalized


async def _parse_document(contents: bytes, content_type: str, filename: str, image_hash: str) -> dict:
    filename_lower = (filename or "").lower()
    is_pdf = content_type == "application/pdf" or filename_lower.endswith(".pdf")

    raw_text = ""
    confidence = 0.0
    page_images: list[bytes]
    page_count = 1
    parsed: dict = {}

    if is_pdf:
        page_images = await pdf_to_images_fitz(contents, max_pages=MAX_PDF_PAGES)
        if not page_images:
            raise HTTPException(status_code=422, detail="PDF could not be rendered. Please upload a readable document.")

        page_count = len(page_images)
        native_text, native_conf = extract_text_pdf_native(contents)
        raw_text, confidence = native_text, native_conf

        # OCR each page asynchronously and merge strongest fields.
        tasks = [extract_best_text(img) for img in page_images]
        page_ocr_results = await asyncio.gather(*tasks, return_exceptions=True)
        page_results: list[tuple[int, str, float, dict]] = []
        for idx, item in enumerate(page_ocr_results):
            if isinstance(item, Exception):
                continue
            text_i, conf_i, parsed_i = item
            if text_i or parsed_i:
                page_results.append((idx + 1, text_i, conf_i, parsed_i or {}))

        if page_results:
            merged_text, merged_conf, merged_parsed = _merge_page_parsed(page_results)
            raw_text = "\n\n".join(p for p in [raw_text, merged_text] if p).strip()
            confidence = max(confidence, merged_conf)
            parsed = merged_parsed

        ai_parsed = await parse_with_ai(raw_text, page_images, confidence)
        if ai_parsed:
            for key in ["merchant_name", "expense_date", "subtotal", "tax_amount", "total", "category", "document_type", "discount_amount"]:
                if ai_parsed.get(key) is not None:
                    parsed[key] = ai_parsed[key]
            parsed["ai_parsed"] = True
            parsed["method"] = ai_parsed.get("method", "Gemini-Vision")
    else:
        page_images = [contents]
        page_count = 1
        raw_text, confidence, parsed = await extract_best_text(contents)
        if not parsed:
            parsed = parse_receipt(raw_text, confidence)

    if not parsed:
        parsed = parse_receipt(raw_text, confidence)
    return _normalize_parse_response(parsed, raw_text, confidence, image_hash, page_count)


async def extract_best_text(image_bytes: bytes) -> tuple[str, float, dict]:
    """Run hybrid OCR over enhanced variants and pick the most reliable parse result."""
    variants = build_image_variants(image_bytes)
    fast_variants = [variants[0], variants[-1]] if len(variants) > 1 else variants
    google_enabled = bool(GOOGLE_KEY)
    azure_enabled = bool(AZURE_DOCINT_ENDPOINT and AZURE_DOCINT_KEY)
    candidates: list[tuple[float, str, float, dict]] = []
    seen_text: set[str] = set()

    # Fast path first: local ML OCR, early-exit on strong parse.
    for variant_name, variant_bytes in fast_variants:
        text, confidence = extract_text_rapidocr(variant_bytes)
        normalized = re.sub(r"\s+", " ", text).strip().lower() if text else ""
        if not normalized or normalized in seen_text:
            continue
        seen_text.add(normalized)
        score, parsed = _score_parsed_candidate(text, confidence)
        parsed["ocr_variant"] = variant_name
        parsed["ocr_engine"] = "rapidocr"
        candidates.append((score, text, confidence, parsed))
        if OCR_MODE == "fast" and _is_strong_candidate(parsed, confidence):
            return text, confidence, parsed

    # Cloud OCR escalation only when needed.
    if google_enabled:
        google_variants = fast_variants if OCR_MODE == "fast" else variants
        for variant_name, variant_bytes in google_variants:
            try:
                text, confidence = await extract_text_google_vision(variant_bytes)
            except Exception:
                continue
            normalized = re.sub(r"\s+", " ", text).strip().lower() if text else ""
            if not normalized or normalized in seen_text:
                continue
            seen_text.add(normalized)
            score, parsed = _score_parsed_candidate(text, confidence)
            parsed["ocr_variant"] = variant_name
            parsed["ocr_engine"] = "google_vision"
            candidates.append((score, text, confidence, parsed))
            if OCR_MODE == "fast" and _is_strong_candidate(parsed, confidence):
                return text, confidence, parsed

    # Optional secondary provider: Azure Document Intelligence.
    if azure_enabled:
        azure_variants = [v for v in fast_variants if v[0] in ("original", "upscaled")] or fast_variants[:1]
        if OCR_MODE != "fast":
            azure_variants = [v for v in variants if v[0] in ("original", "upscaled")] or variants[:1]
        if not azure_variants:
            azure_variants = variants[:1]
        for variant_name, variant_bytes in azure_variants:
            try:
                text, confidence, structured_fields = await extract_text_azure_document_intelligence(variant_bytes)
            except Exception:
                continue
            normalized = re.sub(r"\s+", " ", text).strip().lower() if text else ""
            if not normalized or normalized in seen_text:
                continue
            seen_text.add(normalized)
            score, parsed = _score_parsed_candidate(text, confidence, structured_fields)
            parsed["ocr_variant"] = variant_name
            parsed["ocr_engine"] = "azure_document_intelligence"
            candidates.append((score, text, confidence, parsed))
            if OCR_MODE == "fast" and _is_strong_candidate(parsed, confidence):
                return text, confidence, parsed

    # Final local expansion only in accurate mode.
    remaining_variants = [v for v in variants if v not in fast_variants]
    if OCR_MODE != "fast":
        for variant_name, variant_bytes in remaining_variants:
            text, confidence = extract_text_rapidocr(variant_bytes)
            normalized = re.sub(r"\s+", " ", text).strip().lower() if text else ""
            if not normalized or normalized in seen_text:
                continue
            seen_text.add(normalized)
            score, parsed = _score_parsed_candidate(text, confidence)
            parsed["ocr_variant"] = variant_name
            parsed["ocr_engine"] = "rapidocr"
            candidates.append((score, text, confidence, parsed))

    # Fallback OCR: local ML OCR on a short fast path only.
    if len(candidates) < 2:
        for variant_name, variant_bytes in fast_variants:
            text, confidence = extract_text_rapidocr(variant_bytes)
            normalized = re.sub(r"\s+", " ", text).strip().lower() if text else ""
            if not normalized or normalized in seen_text:
                continue
            seen_text.add(normalized)
            score, parsed = _score_parsed_candidate(text, confidence)
            parsed["ocr_variant"] = variant_name
            parsed["ocr_engine"] = "rapidocr"
            candidates.append((score, text, confidence, parsed))

    # Final fallback OCR: only if RapidOCR is unavailable.
    if len(candidates) < 2 and _rapid_ocr_engine is None:
        for variant_name, variant_bytes in variants[:2]:
            text, confidence = extract_text_local(variant_bytes)
            normalized = re.sub(r"\s+", " ", text).strip().lower() if text else ""
            if not normalized or normalized in seen_text:
                continue
            seen_text.add(normalized)
            score, parsed = _score_parsed_candidate(text, confidence)
            parsed["ocr_variant"] = variant_name
            parsed["ocr_engine"] = "tesseract"
            candidates.append((score, text, confidence, parsed))

    if not candidates:
        return "", 0.0, {}

    best = max(candidates, key=lambda item: item[0])

    ensemble = _ensemble_fields(candidates)
    final_parsed = dict(best[3])
    for key in ("merchant_name", "expense_date", "subtotal", "tax_amount", "total"):
        if key in ensemble:
            final_parsed[key] = ensemble[key]

    final_parsed["ocr_engine"] = "ensemble"
    final_parsed["ensemble_meta"] = {
        "candidates": len(candidates),
        "top_score": round(best[0], 4),
        "fields_used": [k for k in ("merchant_name", "expense_date", "subtotal", "tax_amount", "total") if k in ensemble],
    }
    if "ensemble_candidates_used" in ensemble:
        final_parsed["ensemble_meta"]["candidates_used"] = ensemble["ensemble_candidates_used"]

    weighted_confidence = round(
        sum(max(0.01, score) * conf for score, _, conf, _ in candidates)
        / sum(max(0.01, score) for score, _, _, _ in candidates),
        4,
    )
    return best[1], weighted_confidence, final_parsed


@app.post("/parse-receipt")
async def parse_receipt_endpoint(file: UploadFile = File(...)):
    """
    Auto-reads any bill format (PDF/JPG/PNG/etc) and extracts:
    - Merchant name
    - Date
    - Subtotal, Tax (GST), Total
    - GST number
    - Category (travel/meals/accommodation/etc)
    - Carbon footprint estimate
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    await file.seek(0)
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty. Please re-export or re-download the PDF and upload again.")
    if len(contents) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Please upload a file under 15 MB.")

    # MD5 hash for duplicate detection
    image_hash = hashlib.md5(contents).hexdigest()

    cached_payload = _cache_get(image_hash)
    if cached_payload:
        cached_payload["cached"] = True
        return cached_payload

    content_type = file.content_type or ""
    normalized = await _parse_document(contents, content_type, file.filename or "", image_hash)
    if not normalized.get("total") and not normalized.get("raw_text"):
        raise HTTPException(status_code=422, detail="Document AI could not read this file. Please ensure it is a clear scan.")

    fraud = await _fraud_precheck(image_hash, normalized)
    needs_review = bool(normalized.get("math_mismatch")) or float(normalized.get("confidence") or 0) < 0.65 or float(fraud.get("fraud_score") or 0) >= 0.35
    normalized["fraud_score"] = fraud.get("fraud_score")
    normalized["fraud_reason"] = fraud.get("fraud_reason")
    if needs_review:
        normalized["review_flag"] = "Manual review recommended"

    response_payload = {
        "success": True,
        "data": normalized,
        "image_hash": image_hash,
        "needs_review": needs_review,
        "file_type": content_type or "unknown",
        "cached": False,
        "method": "Hybrid OCR",
    }

    _cache_set(image_hash, response_payload)
    _append_compliance_log({
        "event": "parse_receipt",
        "image_hash": image_hash,
        "file_type": response_payload["file_type"],
        "needs_review": needs_review,
        "math_mismatch": bool(normalized.get("math_mismatch")),
        "fraud_score": normalized.get("fraud_score"),
        "merchant": normalized.get("merchant"),
        "date": normalized.get("date"),
        "total": normalized.get("total"),
        "page_count_processed": normalized.get("page_count_processed"),
    })
    return response_payload


@app.post("/extract")
async def extract_receipt(file: UploadFile = File(...)):
    """Backward-compatible alias for legacy clients."""
    return await parse_receipt_endpoint(file)


@app.get("/health")
async def health():
    return {
        "status":      "healthy",
        "service":     "ocr",
        "google_key":  "configured" if GOOGLE_KEY else "MISSING",
        "azure_docint": "configured" if (AZURE_DOCINT_ENDPOINT and AZURE_DOCINT_KEY) else "not_configured",
        "rapidocr": "configured" if _rapid_ocr_engine is not None else "not_installed",
        "ocr_mode": OCR_MODE,
        "cache_size": len(_ocr_result_cache),
        "max_pdf_pages": MAX_PDF_PAGES,
        "compliance_log_path": COMPLIANCE_LOG_PATH,
        "formats":     list(SUPPORTED_FORMATS.keys()),
    }


@app.get("/")
async def root():
    return {
        "service":      "FinSight OCR Service",
        "version":      "1.0.0",
        "port":         8002,
        "supported_formats": ["PDF", "JPG", "JPEG", "PNG", "WEBP", "TIFF", "BMP"],
        "docs":         "/docs",
    }
