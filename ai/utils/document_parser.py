import os
import shutil
import logging
from typing import Dict, Any, List
from PIL import Image
import pytesseract
import pdfplumber

logger = logging.getLogger(__name__)

# Base path resolving to the project root / uploads
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_BASE_DIR = os.path.join(PROJECT_ROOT, "uploads")

# Configure Tesseract path (Windows verified path vs Linux/Azure)
def _configure_tesseract():
    system_bin = shutil.which("tesseract")
    if system_bin:
        pytesseract.pytesseract.tesseract_cmd = system_bin
        return

    # Verified path on your machine
    verified_windows_path = r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
    if os.path.exists(verified_windows_path):
        pytesseract.pytesseract.tesseract_cmd = verified_windows_path

_configure_tesseract()


def ocr_image(image_input) -> str:
    """Runs local Tesseract OCR on an image file path or PIL Image object."""
    try:
        if isinstance(image_input, str):
            with Image.open(image_input) as img:
                return pytesseract.image_to_string(img)
        return pytesseract.image_to_string(image_input)
    except Exception as exc:
        logger.error(f"Tesseract OCR extraction failed: {exc}")
        return ""


def extract_content_from_pdf(file_path: str) -> str:
    """
    Parses digital PDF bank statements using pdfplumber table extraction.
    Falls back to Tesseract OCR if a page contains flat scans or photos.
    """
    extracted_sections: List[str] = []

    try:
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                page_text_blocks = []

                # 1. Extract tabular data directly (for bank statement ledgers)
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        for row in table:
                            clean_row = [str(cell).strip().replace("\n", " ") if cell else "-" for cell in row]
                            page_text_blocks.append(" | ".join(clean_row))

                # 2. Extract selectable text
                regular_text = page.extract_text()
                if regular_text:
                    page_text_blocks.append(regular_text.strip())

                combined_page_text = "\n".join(page_text_blocks).strip()

                # 3. Fallback to OCR if page has minimal/no text (image scan)
                if len(combined_page_text) < 40:
                    try:
                        pil_img = page.to_image(resolution=200).original
                        scanned_text = ocr_image(pil_img)
                        if scanned_text:
                            combined_page_text = f"[OCR Extracted Page {page_num}]:\n{scanned_text.strip()}"
                    except Exception as err:
                        logger.warning(f"Failed to OCR PDF page {page_num}: {err}")

                if combined_page_text:
                    extracted_sections.append(f"--- Page {page_num} ---\n{combined_page_text}")

    except Exception as exc:
        logger.error(f"Failed to parse PDF {file_path}: {exc}")

    return "\n\n".join(extracted_sections).strip()


def extract_content_from_image_file(file_path: str) -> str:
    """Runs local OCR on standalone image files (.jpg, .png, .jpeg, .webp)."""
    return ocr_image(file_path)


def get_application_documents_text(application_id: str) -> Dict[str, str]:
    """
    Scans uploads/<application_id>/, extracts text from PDFs and images,
    and returns a mapping of filename -> extracted text.
    """
    app_folder = os.path.join(UPLOAD_BASE_DIR, application_id)
    if not os.path.exists(app_folder):
        return {}

    parsed_docs: Dict[str, str] = {}
    for filename in os.listdir(app_folder):
        file_path = os.path.join(app_folder, filename)
        if not os.path.isfile(file_path):
            continue

        lower_name = filename.lower()
        if lower_name.endswith(".pdf"):
            content = extract_content_from_pdf(file_path)
            if content:
                parsed_docs[filename] = content
        elif lower_name.endswith((".jpg", ".jpeg", ".png", ".webp")):
            content = extract_content_from_image_file(file_path)
            if content:
                parsed_docs[filename] = content
        elif lower_name.endswith((".csv", ".txt")):
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    parsed_docs[filename] = f.read()
            except Exception as exc:
                logger.error(f"Failed to read file {file_path}: {exc}")

    return parsed_docs