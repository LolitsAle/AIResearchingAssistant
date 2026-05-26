import re
import pdfplumber

from app.core.errors import AppError

SECTIONS = ['abstract', 'introduction', 'related work', 'background', 'method', 'methodology', 'experiments', 'results', 'discussion', 'conclusion', 'references']


def parse_pdf(file_path: str) -> dict:
    pages = []
    current_section = 'Unknown'
    any_text = False
    with pdfplumber.open(file_path) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            text = (page.extract_text() or '').strip()
            if text:
                any_text = True
            lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
            for ln in lines[:12]:
                low = re.sub(r'[^a-z ]', '', ln.lower())
                if low in SECTIONS:
                    current_section = ln.title()
                    break
            pages.append({'page': idx, 'section': current_section, 'text': text})
    if not any_text:
        raise AppError('PDF này có thể là file scan hoặc ảnh. OCR chưa được hỗ trợ.', 400)
    return {'page_count': len(pages), 'pages': pages}
