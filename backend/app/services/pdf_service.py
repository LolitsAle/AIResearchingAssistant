import re
import fitz

from app.core.errors import AppError

SECTIONS = ['abstract','introduction','related work','background','method','methodology','experiments','results','discussion','conclusion','references']


def parse_pdf(file_path: str) -> dict:
    doc = fitz.open(file_path)
    pages = []
    current_section = 'Unknown'
    any_text = False
    for idx, page in enumerate(doc, start=1):
        text = page.get_text('text').strip()
        if text:
            any_text = True
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        for ln in lines[:12]:
            low = re.sub(r'[^a-z ]', '', ln.lower())
            if low in SECTIONS:
                current_section = ln.title()
                break
        pages.append({'page': idx, 'section': current_section or f'Page {idx}', 'text': text})
    doc.close()
    if not any_text:
        raise AppError('This PDF appears to be scanned or image-based. OCR is not supported yet.', 400)
    return {'page_count': len(pages), 'pages': pages}
