import sys, pymupdf
from pathlib import Path
pdf, out = sys.argv[1], Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
d = pymupdf.open(pdf)
for i, p in enumerate(d, 1):
    p.get_pixmap(dpi=130).pil_save(out / f"p{i:03d}.webp", quality=80)
print(len(d), "pages")
