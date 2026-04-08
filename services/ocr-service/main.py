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
import os, hashlib, base64, io, httpx

load_dotenv()

app = FastAPI(title="FinSight OCR Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

GOOGLE_KEY = os.getenv("GOOGLE_CLOUD_VISION_KEY", "")

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


async def pdf_to_image_bytes(pdf_bytes: bytes) -> bytes:
    """Convert first page of PDF to PNG bytes using pdf2image."""
    try:
        from pdf2image import convert_from_bytes
        pages = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, dpi=200)
        if pages:
            buf = io.BytesIO()
            pages[0].save(buf, format="PNG")
            return buf.getvalue()
    except Exception:
        pass
    return pdf_bytes  # fallback: send raw bytes


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


@app.post("/extract")
async def extract_receipt(file: UploadFile = File(...)):
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

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    # MD5 hash for duplicate detection
    image_hash = hashlib.md5(contents).hexdigest()

    # Convert PDF to image if needed
    content_type = file.content_type or ""
    filename_lower = (file.filename or "").lower()

    if content_type == "application/pdf" or filename_lower.endswith(".pdf"):
        try:
            contents = await pdf_to_image_bytes(contents)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"PDF conversion failed: {str(e)}")

    # Extract text via Google Vision
    try:
        raw_text, confidence = await extract_text_google_vision(contents)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Google Vision API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

    if not raw_text.strip():
        return {
            "success":    False,
            "error":      "No text detected in the uploaded file. Please ensure the image is clear.",
            "image_hash": image_hash,
            "data":       {},
        }

    # Parse structured data from raw text
    parsed = parse_receipt(raw_text, confidence)
    parsed["image_hash"] = image_hash

    # Flag for manual review if confidence is low
    needs_review = confidence < 0.95
    if needs_review:
        parsed["review_flag"] = f"OCR confidence {confidence * 100:.1f}% — below 95% threshold, please verify extracted values"

    return {
        "success":      True,
        "data":         parsed,
        "image_hash":   image_hash,
        "needs_review": needs_review,
        "file_type":    content_type or "unknown",
    }


@app.get("/health")
async def health():
    return {
        "status":      "healthy",
        "service":     "ocr",
        "google_key":  "configured" if GOOGLE_KEY else "MISSING",
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
