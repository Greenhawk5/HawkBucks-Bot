import fitz

pairs = [
    ("usage-diagnostic.pdf", "usage-final-300dpi.png"),
    ("active-reminders-diagnostic.pdf", "active-reminders-final-300dpi.png"),
]

for pdf, out in pairs:
    doc = fitz.open(pdf)
    page = doc.load_page(0)
    mat = fitz.Matrix(300/72, 300/72)  # 300 DPI
    pix = page.get_pixmap(matrix=mat, alpha=False)
    pix.save(out)
    print(f"wrote {out} ({pix.width}x{pix.height})")
