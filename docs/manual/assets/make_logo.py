"""Cut the BEYO.ND mark out of the brand kit and key its dark ground to alpha.

The kit is a photographed mockup: the lockup sits on near-black card. Pasting a
rectangle of that onto the cover would show as a box, so the background is
removed by luminance. The mark's blue glow is preserved because alpha is taken
from the brightest channel, not from a single flat threshold.
"""
import os

from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, "brand-kit.png")
MARK = os.path.join(D, "beyond-mark.png")

im = Image.open(SRC).convert("RGB")

# The primary lockup is the left-hand column of the kit.
crop = im.crop((90, 180, 700, 570))
crop.save(os.path.join(D, "beyond-lockup-crop.png"))

px = crop.load()
w, h = crop.size
out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
dst = out.load()

LOW, HIGH = 16, 232
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        brightest = max(r, g, b)
        if brightest <= LOW:
            continue
        a = int(min(255, max(0, (brightest - LOW) * 255 // (HIGH - LOW))))
        # Normalise the colour so the mark reads as white-on-dark rather than
        # as a dim grey; the glow keeps its blue because its ratio survives.
        scale = 255.0 / brightest
        nr = min(255, int(r * scale))
        ng = min(255, int(g * scale))
        nb = min(255, int(b * scale))
        dst[x, y] = (nr, ng, nb, a)

bbox = out.getbbox()
out = out.crop(bbox)
out.save(MARK)
print("mark:", out.size, "->", MARK)
