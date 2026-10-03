"""Rebuild synthetic PDF test data; runtime and tests use the committed PDFs."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / 'test' / 'fixtures'
root.mkdir(parents=True, exist_ok=True)

def scan(lines, font_path):
    image = Image.new('RGB', (1200, 500), 'white')
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(font_path, 44)
    for i, line in enumerate(lines):
        draw.text((65, 100 + i * 100), line, fill='black', font=font)
    return ImageReader(image)

pdf = canvas.Canvas(str(root / 'mixed-pages.pdf'), pagesize=(612, 792), invariant=1)
pdf.setFont('Helvetica', 14)
pdf.drawString(40, 710, 'PAGE ONE: This document contains three pages of evidence.')
pdf.drawString(40, 680, 'The second page is a scan. The third contains the launch city.')
pdf.showPage()
pdf.drawImage(scan(['SCANNED PAGE TWO', 'The recovery code is NEBULA-42.'], 'C:/Windows/Fonts/arial.ttf'), 20, 400, width=570, height=237.5)
pdf.showPage()
pdf.setFont('Helvetica', 14)
pdf.drawString(40, 710, 'PAGE THREE: The launch city is Hangzhou. Citation must be page 3.')
pdf.save()

pdf = canvas.Canvas(str(root / 'chinese-scan.pdf'), pagesize=(612, 792), invariant=1)
pdf.drawImage(scan(['现金流报告', '现金流充裕，应收账款减少。'], 'C:/Windows/Fonts/msyh.ttc'), 20, 400, width=570, height=237.5)
pdf.save()
print('Synthetic English and Chinese PDF fixtures written.')
