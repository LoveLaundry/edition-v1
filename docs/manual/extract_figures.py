"""Pull every inline SVG figure out of the book and rasterise it to PNG.

Word and LaTeX cannot embed the SVG markup the HTML uses, so the same figures
are rendered once here and shared by both exports. Rendering through Edge keeps
the output identical to what the PDF shows.
"""
import io, os, re, subprocess, hashlib

D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, "lovelaundry-system-manual.html")
OUT = os.path.join(D, "assets", "figures")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
os.makedirs(OUT, exist_ok=True)

src = io.open(P, encoding="utf-8").read()

# <figure class="fig"> ... <svg ...>...</svg> ... <figcaption>…</figcaption> ... </figure>
# Two figure families exist: .fig (diagrams) and .wire (screen wireframes).
# Both are SVG and both need a raster for the Word and LaTeX editions.
figures = re.findall(r'<figure[^>]*>(.*?)</figure>', src, re.S)
figures = [f for f in figures if "<svg" in f]
print("figures found:", len(figures))

index = []
for i, body in enumerate(figures, start=1):
    svg = re.search(r'<svg.*?</svg>', body, re.S)
    cap = re.search(r'<figcaption[^>]*>(.*?)</figcaption>', body, re.S)
    if not svg:
        continue
    caption = re.sub(r'<[^>]+>', '', cap.group(1)).strip() if cap else ""

    vb = re.search(r'viewBox="([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+)"', svg.group(0))
    w = float(vb.group(3)) if vb else 800
    h = float(vb.group(4)) if vb else 500
    scale = 2.0
    px_w, px_h = int(w * scale), int(h * scale)

    name = "fig-%02d" % i
    svg_path = os.path.join(OUT, name + ".svg")
    io.open(svg_path, "w", encoding="utf-8", newline="").write(svg.group(0))

    wrapper = os.path.join(OUT, "_wrap.html")
    io.open(wrapper, "w", encoding="utf-8", newline="").write(
        "<!doctype html><meta charset='utf-8'>"
        "<style>html,body{margin:0;padding:0;background:#fff}"
        "svg{display:block;width:%dpx;height:%dpx}</style>%s" % (px_w, px_h, svg.group(0))
    )
    png = os.path.join(OUT, name + ".png")
    subprocess.run([EDGE, "--headless", "--disable-gpu", "--hide-scrollbars",
                    "--window-size=%d,%d" % (px_w, px_h),
                    "--screenshot=" + png,
                    "file:///" + wrapper.replace("\\", "/").replace(" ", "%20")],
                   capture_output=True)
    os.remove(wrapper)
    index.append({"n": i, "png": name + ".png", "caption": caption,
                  "w": px_w, "h": px_h, "ok": os.path.exists(png)})

ok = sum(1 for f in index if f["ok"])
print("rasterised:", ok, "of", len(index))
for f in index[:3]:
    print(" ", f["png"], f["w"], "x", f["h"], "|", f["caption"][:60])

import json
io.open(os.path.join(D, "assets", "figures", "index.json"), "w", encoding="utf-8").write(
    json.dumps(index, indent=1))
