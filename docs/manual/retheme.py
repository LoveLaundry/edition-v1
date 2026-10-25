"""Recolour the manual to red / black / white and rebuild the cover.

Idempotent: running it twice leaves the same colours in place.
"""
import base64
import io
import os
import re

D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, "lovelaundry-system-manual.html")
ART = os.path.join(
    os.path.dirname(os.path.dirname(D)),
    "media-output",
    "img-mvlyao1h-cd5f6c4a.png",
)

# navy -> black, ochre -> crimson, cream -> white, blue-greys -> neutral greys
MAP = {
    "#0f2740": "#0b0b0c",   # navy  -> black
    "#12212f": "#111113",   # ink
    "#b4692a": "#c1121f",   # ochre -> crimson
    "#fbf8f2": "#ffffff",   # paper
    "#f6f1e8": "#f4f4f5",   # wash
    "#d9d2c5": "#d6d6d9",   # rule
    "#6d6455": "#5c5c61",   # muted text
    "#33414f": "#2a2a2e",
    "#5b6b7c": "#6b6b72",
    "#8595a6": "#8a8a91",
    "#c3cedb": "#cfcfd4",
    "#c3d2e0": "#dcdce0",
    "#eff2f6": "#f6f6f7",
    "#e2e7ee": "#ececee",
    "#8fa3b8": "#9a9aa1",
    # cover-only warm tones
    "#e7ddc9": "#e8e8ea",
    "#cbb489": "#c1121f",
    "#efe7d8": "#ffffff",
    "#bda98b": "#b8b8bd",
    "#a98f66": "#8a8a91",
    "#f4ecdc": "#ffffff",
    "#cbb997": "#bfbfc4",
}

COVER_CSS = """
/* ——— cover: red / black / white, technical plate ——— */
.cover{position:relative;padding:0;height:297mm;overflow:hidden;background:#0b0b0c}
.cover .art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.cover .veil{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(0,0,0,.86) 0%,rgba(0,0,0,.42) 30%,
             rgba(0,0,0,.18) 52%,rgba(0,0,0,.72) 80%,rgba(0,0,0,.94) 100%)}
.cover .frame{position:absolute;inset:9mm;border:0.6pt solid rgba(193,18,31,.75);z-index:3}
.cover .frame:before,.cover .frame:after{content:"";position:absolute;width:14mm;height:14mm;border:1.4pt solid #c1121f}
.cover .frame:before{top:-0.7pt;left:-0.7pt;border-right:0;border-bottom:0}
.cover .frame:after{bottom:-0.7pt;right:-0.7pt;border-left:0;border-top:0}
.cover .stack{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;
  justify-content:space-between;align-items:center;text-align:center;padding:24mm 22mm 20mm}
.cover .press{font-size:6.6pt;font-variant:all-small-caps;letter-spacing:.5em;color:#c1121f;margin:0}
.cover .tickrow{display:flex;gap:2.2mm;align-items:center;justify-content:center;margin:4mm 0 0}
.cover .tickrow i{display:block;width:1.1mm;height:1.1mm;background:#c1121f}
.cover .tickrow i:nth-child(2){opacity:.55}
.cover .tickrow i:nth-child(3){opacity:.28}
.cover h1{margin:6mm 0 0;font-size:33pt;font-weight:300;line-height:1.08;letter-spacing:.015em;color:#ffffff}
.cover .rule{width:26mm;height:2pt;background:#c1121f;margin:6.5mm auto 5.5mm}
.cover .sub{font-size:9.6pt;font-style:italic;font-weight:300;color:#dcdce0;max-width:118mm;margin:0 auto}
.cover .plate{width:38mm;height:38mm;margin:0 auto 6mm;position:relative;
  border:0.6pt solid rgba(255,255,255,.55);background:rgba(193,18,31,.07);overflow:hidden}
.cover .plate img{width:100%;height:100%;object-fit:cover;display:block}
.cover .plate .mono{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:19pt;font-weight:600;letter-spacing:.14em;color:#ffffff}
.cover .plate .corner{position:absolute;width:5mm;height:5mm;border:1pt solid #c1121f}
.cover .plate .c1{top:-0.5pt;left:-0.5pt;border-right:0;border-bottom:0}
.cover .plate .c2{bottom:-0.5pt;right:-0.5pt;border-left:0;border-top:0}
.cover .author{font-size:11pt;letter-spacing:.01em;color:#ffffff;margin:0;font-weight:400}
.cover .author em{display:block;margin-top:3.5mm;font-size:8.2pt;font-style:italic;letter-spacing:.005em;
  text-transform:none;color:#bfbfc4;line-height:1.55;font-weight:300}
.cover .edition{margin-top:5mm;font-size:6.4pt;font-variant:all-small-caps;letter-spacing:.34em;color:#8a8a91}
.cover .tech{position:absolute;left:0;right:0;bottom:12mm;z-index:1;display:flex;justify-content:center;gap:6mm;
  font-size:5.6pt;font-variant:all-small-caps;letter-spacing:.3em;color:rgba(255,255,255,.38)}
"""


def cover_html(uri):
    return (
        '<section class="page cover" id="cover">'
        '<img class="art" src="' + uri + '" alt="Technical plate: hotel facade dissolving into circuit traces">'
        '<div class="veil"></div><div class="frame"></div>'
        '<div class="stack">'
        '<div><p class="press">Love Laundry</p>'
        '<div class="tickrow"><i></i><i></i><i></i></div>'
        '<h1>System Manual</h1><div class="rule"></div>'
        '<p class="sub">Laundry, Shop, Hotel and Linen Room Operations</p></div>'
        '<div class="bottom">'
        '<div class="plate"><span class="mono">RDS</span>'
        '<span class="corner c1"></span><span class="corner c2"></span></div>'
        '<p class="author">Rasindu Dulshan Siriwardhana'
        '<em>BSc. (Hons) Engineering (Computer Engineering) &#183; Second Class Upper Division'
        '<br>Faculty of Engineering, University of Ruhuna</em></p>'
        '<p class="edition">First Edition &#183; October 2026</p></div>'
        '</div>'
        '<div class="tech"><span>FastAPI</span><span>MongoDB</span><span>React 19</span>'
        '<span>TypeScript</span><span>JWT</span></div>'
        '</section>'
    )


src = io.open(P, encoding="utf-8").read()

# 1. recolour every literal (case-insensitive), longest first so prefixes cannot collide
for old in sorted(MAP, key=len, reverse=True):
    src = re.sub(old, MAP[old], src, flags=re.I)

# 2. append the cover CSS once
if "/* ——— cover: red / black / white" not in src:
    src = src.replace("</style>", COVER_CSS + "</style>", 1)

# 3. swap the cover section
uri = "data:image/png;base64," + base64.b64encode(open(ART, "rb").read()).decode("ascii")
new_cover = cover_html(uri)
src = re.sub(r'<section class="page cover" id="cover">.*?</section>', new_cover, src, count=1, flags=re.S)

io.open(P, "w", encoding="utf-8", newline="").write(src)
print("sections:", len(re.findall(r'<section class="page', src)))
print("ochre left:", len(re.findall(r'#b4692a', src, re.I)))
print("navy left:", len(re.findall(r'#0f2740', src, re.I)))
print("bytes:", len(src.encode()))
