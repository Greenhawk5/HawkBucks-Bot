import fitz

pairs = [
    ("usage-diagnostic.pdf", "usage-diagnostic.png"),
    ("active-reminders-diagnostic.pdf", "active-reminders-diagnostic.png"),
]

for pdf, out in pairs:
    doc = fitz.open(pdf)
    page = doc.load_page(0)
    mat = fitz.Matrix(150/72, 150/72)  # 150 DPI
    pix = page.get_pixmap(matrix=mat, alpha=False)
    pix.save(out)
    print(f"wrote {out} ({pix.width}x{pix.height})")
