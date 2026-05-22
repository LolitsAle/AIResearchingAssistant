import fitz
import re

HEADINGS = ['Abstract','Introduction','Related Work','Background','Method','Methodology','Experiments','Results','Discussion','Conclusion','References']


def extract_pdf(path: str):
    doc = fitz.open(path)
    pages = []
    current_section = 'Unknown'
    for i, page in enumerate(doc, start=1):
        text = page.get_text('text').strip()
        if not text:
            continue
        for h in HEADINGS:
            if re.search(rf'(^|\n)\s*{re.escape(h)}\s*($|\n)', text, flags=re.IGNORECASE):
                current_section = h
                break
        pages.append({'page': i, 'section': current_section, 'text': text})
    if not pages:
        raise ValueError('This PDF appears to be scanned or image-based. OCR is not supported yet.')
    return {'page_count': len(doc), 'pages': pages}
