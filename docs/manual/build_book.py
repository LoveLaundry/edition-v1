# -*- coding: utf-8 -*-
"""Build the LoveLaundry system manual under the 2026 book design.

One manifest drives everything: contents, lists of figures and tables,
running heads, folios and cross-references are all derived from it.

    python build_book.py
"""
import base64
import io
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

OUT = os.path.join(HERE, "lovelaundry-system-manual.html")
SRC = os.path.join(HERE, "_source_manual.html")
ASSETS = os.path.join(HERE, "assets")
FONTS = os.path.join(ASSETS, "fonts")


def b64(path):
    with open(path, "rb") as fh:
        return base64.b64encode(fh.read()).decode("ascii")


def font_face(family, weight, style, filename):
    data = b64(os.path.join(FONTS, filename))
    return ("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:block;"
            "src:url(data:font/woff2;base64,%s) format('woff2')}" % (family, style, weight, data))


COVER_URI = "data:image/jpeg;base64," + b64(os.path.join(ASSETS, "cover-art.jpg"))
DIVIDER_URI = "data:image/jpeg;base64," + b64(os.path.join(ASSETS, "divider-art.jpg"))

FONT_CSS = "\n".join([
    font_face("Spectral", 300, "normal", "Spectral-300-normal.woff2"),
    font_face("Spectral", 400, "normal", "Spectral-400-normal.woff2"),
    font_face("Spectral", 400, "italic", "Spectral-400-italic.woff2"),
    font_face("Spectral", 500, "normal", "Spectral-500-normal.woff2"),
    font_face("Spectral", 600, "normal", "Spectral-600-normal.woff2"),
])

CSS = FONT_CSS + r"""
:root{--ink:#12212f;--navy:#0f2740;--ochre:#b4692a;--paper:#fbf8f2;--rule:#d9d2c5;--wash:#f6f1e8;--mute:#6d6455}
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--paper)}
body{counter-reset:folio;font-family:'Spectral',Georgia,'Times New Roman',serif;font-size:9.8pt;line-height:1.56;
 color:var(--ink);font-feature-settings:"onum" 1,"kern" 1;font-kerning:normal;hyphens:auto;-webkit-hyphens:auto;
 -webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{position:relative;width:210mm;height:297mm;padding:20mm;background:var(--paper);overflow:hidden;
 page-break-after:always;break-after:page;break-inside:avoid;counter-increment:folio}
.page:last-of-type{page-break-after:auto;break-after:auto}

/* running head */
.rh{position:absolute;top:10mm;left:20mm;right:20mm;display:flex;justify-content:space-between;align-items:baseline;
 font-size:7pt;font-variant:all-small-caps;letter-spacing:.08em;color:var(--mute);
 border-bottom:.4pt solid var(--rule);padding-bottom:1.8mm}
/* folio */
.folio{position:absolute;bottom:9mm;left:52mm;right:52mm;border-top:.4pt solid var(--rule);padding-top:2.2mm;
 text-align:center;font-size:8.6pt;font-variant-numeric:oldstyle-nums;color:var(--mute);letter-spacing:.04em}
.folio .dia{color:var(--ochre);font-size:4.6pt;vertical-align:middle;padding:0 3mm}
.folio .no{font-feature-settings:"onum" 1}

/* text */
p{margin:0 0 1.95mm;text-align:justify;text-justify:inter-word;hyphens:auto;orphans:2;widows:2}
p.lede{font-style:italic;font-weight:300;font-size:10.6pt;line-height:1.5;color:#3a4653;text-align:left;margin-bottom:3.4mm}
strong{font-weight:600;color:var(--navy)}
em{font-style:italic}
a{color:var(--navy);text-decoration:none}
.small{font-size:8.6pt}
.muted{color:var(--mute)}
h1,h2,h3,h4{font-family:'Spectral',Georgia,serif;font-weight:600;color:var(--navy);letter-spacing:-.01em}
h1.chap{font-size:20pt;line-height:1.14;margin:0 0 2.6mm;font-weight:600}
h1.chap.sect{font-size:15.4pt;margin:0 0 3mm}
h2{font-size:11.6pt;line-height:1.3;margin:4mm 0 1.5mm}
h3{font-size:9.9pt;line-height:1.35;margin:3.2mm 0 1.1mm;font-weight:600}
h2.first,h3.first{margin-top:1mm}
.eyebrow{font-size:7.2pt;font-variant:all-small-caps;letter-spacing:.12em;color:var(--ochre);margin:0 0 3mm;font-weight:500}

/* chapter opener */
.opener{padding-top:54mm}
.opener .wm{position:absolute;right:10mm;top:26mm;font-size:176pt;line-height:.72;color:rgba(180,105,42,.11);
 font-weight:300;letter-spacing:-.04em;z-index:0}
.opener .kicker{position:relative;font-size:7.2pt;font-variant:all-small-caps;letter-spacing:.14em;color:var(--ochre);margin-bottom:4mm}
.opener h1.chap{position:relative;font-size:27pt;line-height:1.1;max-width:132mm;margin-bottom:5mm}
.epigraph{position:relative;font-style:italic;font-weight:300;font-size:12pt;line-height:1.46;color:#3f4b58;
 max-width:118mm;margin:0 0 7mm;text-align:left}
.orn{display:flex;align-items:center;gap:3mm;margin:0 0 7mm;position:relative}
.orn .l{height:.5pt;width:26mm;background:var(--ochre);opacity:.55}
.orn .d{color:var(--ochre);font-size:5pt}
.opener .body{position:relative}
p.dropcap::first-letter{float:left;font-size:3.05em;line-height:.8;padding:.06em .12em 0 0;color:var(--ochre);font-weight:600}

/* lists */
ul.bl,ol.bl{list-style:none;margin:2mm 0 2.8mm;padding:0}
ul.bl>li,ol.bl>li{position:relative;padding-left:5.4mm;margin-bottom:1.15mm;text-align:justify}
ul.bl>li::before{content:"\25AA";position:absolute;left:.6mm;top:.2mm;color:var(--ochre);font-size:7pt}
ol.steps{list-style:none;margin:2mm 0 3mm;padding:0;counter-reset:s}
ol.steps>li{counter-increment:s;position:relative;padding-left:9mm;margin-bottom:1.5mm;text-align:justify}
ol.steps>li::before{content:counter(s);position:absolute;left:0;top:.4mm;width:5.4mm;text-align:right;
 color:var(--ochre);font-weight:600;font-size:9pt;border-bottom:.5pt solid var(--rule)}

/* tables */
table.tbl{width:100%;border-collapse:collapse;margin:2mm 0 1mm;font-size:7.9pt;line-height:1.33;
 font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
table.tbl caption{caption-side:top;text-align:left;font-size:7.2pt;font-variant:all-small-caps;letter-spacing:.08em;
 color:var(--ochre);padding-bottom:1.8mm;border-bottom:.4pt solid var(--rule)}
table.tbl caption .n{font-weight:500}
table.tbl th{background:var(--navy);color:var(--paper);text-align:left;padding:2mm 2.2mm;font-weight:500;
 font-size:7pt;font-variant:all-small-caps;letter-spacing:.08em;vertical-align:bottom}
table.tbl td{padding:1.32mm 2.1mm;border-bottom:.4pt solid var(--rule);vertical-align:top}
table.tbl tbody tr:nth-child(even) td{background:var(--wash)}
table.tbl td.k{font-weight:600;color:var(--navy)}
table.tbl td.c,table.tbl th.c{text-align:center}
table.tbl td.mono{font-family:ui-monospace,Consolas,'Courier New',monospace;font-size:7.2pt}
table.tbl.compact td{padding:1.2mm 1.8mm}
table.tbl.compact th{padding:1.6mm 1.8mm}
table.kv{width:100%;font-size:9pt;border-collapse:collapse}
table.kv td{padding:1.6mm 0;border-bottom:.4pt solid var(--rule);vertical-align:top}
table.kv td.k{width:42mm;color:var(--mute);font-variant:all-small-caps;letter-spacing:.06em}

/* callouts */
.callout{border-left:2.4pt solid var(--ochre);background:var(--wash);padding:2.8mm 3.8mm;margin:2.6mm 0;font-size:9.2pt;line-height:1.5}
.callout .lbl{display:block;font-size:7pt;font-variant:all-small-caps;letter-spacing:.12em;color:var(--ochre);margin-bottom:1.2mm}
.callout p:last-child{margin-bottom:0}
.callout.note{border-left-color:var(--navy)}
.callout.note .lbl{color:var(--navy)}

/* figures */
figure.fig{margin:2.4mm 0 2.6mm;text-align:center}
figure.fig svg{display:block;width:100%;height:auto}
figure.fig figcaption,figure.wire figcaption{font-size:7.2pt;font-variant:all-small-caps;letter-spacing:.07em;color:#5d5648;
 border-top:.4pt solid var(--rule);border-bottom:.4pt solid var(--rule);padding:1.9mm 2mm;margin-top:2.6mm;line-height:1.4}
figure.fig figcaption b,figure.wire figcaption b{font-weight:600;color:var(--navy)}
figure.wire{margin:3mm 0}
figure.wire svg{display:block;width:100%;height:auto;border:.4pt solid var(--rule)}

.page.tight p{margin-bottom:1.75mm}
.page.tight h2{margin-top:4.3mm}
.page.tight table.tbl td{padding:1.3mm 2.2mm}
.page.tight table.tbl th{padding:1.7mm 2.2mm}
.page.tight .callout{padding:2.6mm 3.6mm;margin:2.4mm 0}
.page.tight h2.first{margin-top:0}
.page.tight table.tbl{font-size:7.7pt;line-height:1.3}
#probe .blk{display:flow-root}
/* pull quote */
.pull{font-style:italic;font-weight:300;font-size:13pt;line-height:1.42;text-align:center;color:var(--navy);
 margin:7mm 14mm;padding:3mm 0;border-top:.5pt solid var(--rule);border-bottom:.5pt solid var(--rule)}

/* panels, code, tags */
.panel{border:.5pt solid var(--rule);padding:3mm 4mm;margin:2.6mm 0;background:rgba(246,241,232,.45)}
.panel h3{margin-top:0}
.two{display:flex;gap:7mm}
.two>*{flex:1;min-width:0}
.tag{display:inline-block;font-size:6.6pt;font-variant:all-small-caps;letter-spacing:.1em;border:.5pt solid var(--ochre);
 color:var(--ochre);padding:.3mm 1.6mm;border-radius:.6mm}
pre{font-family:ui-monospace,Consolas,'Courier New',monospace;font-size:7.3pt;line-height:1.5;background:#f2ecdf;
 color:var(--ink);border-left:2pt solid var(--rule);padding:3mm 3.6mm;margin:2mm 0 3mm;white-space:pre-wrap;overflow:hidden}
code{font-family:ui-monospace,Consolas,'Courier New',monospace;font-size:8.2pt;color:var(--navy);background:#f2ecdf;padding:0 .8mm}

/* front matter */
.half{display:flex;flex-direction:column;justify-content:center;align-items:center;height:257mm;text-align:center}
.half .mark{font-size:15pt;font-weight:600;letter-spacing:.34em;font-variant:all-small-caps;color:var(--navy)}
.half .sub{margin-top:6mm;font-size:9pt;font-variant:all-small-caps;letter-spacing:.28em;color:var(--ochre)}
/* cover — full bleed, unnumbered */
.cover{position:relative;padding:0;height:297mm;overflow:hidden;background:#0f2740}
.cover .art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.cover .veil{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(15,39,64,.94) 0%,rgba(15,39,64,.55) 26%,
             rgba(15,39,64,.30) 52%,rgba(15,39,64,.72) 78%,rgba(15,39,64,.96) 100%)}
.cover .stack{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;
  justify-content:space-between;align-items:center;text-align:center;padding:26mm 20mm 22mm}
.cover .press{font-size:7pt;font-variant:all-small-caps;letter-spacing:.44em;color:#cbb489}
.cover h1{margin:7mm 0 0;font-size:31pt;font-weight:300;line-height:1.12;letter-spacing:.02em;color:#fbf8f2}
.cover .rule{width:34mm;height:1px;background:#b4692a;margin:7mm auto 6mm}
.cover .sub{font-size:10pt;font-style:italic;font-weight:300;color:#e7ddc9;max-width:120mm;margin:0 auto}
.cover .bottom{width:100%}
.cover .author{font-size:8.6pt;font-variant:all-small-caps;letter-spacing:.2em;color:#efe7d8}
.cover .author em{display:block;margin-top:3.5mm;font-size:7pt;font-style:italic;
  letter-spacing:.06em;text-transform:none;color:#bda98b}
.cover .edition{margin-top:6mm;font-size:6.8pt;font-variant:all-small-caps;letter-spacing:.3em;color:#a98f66}
.frontis{padding:20mm}
.frontis img{width:100%;max-height:220mm;object-fit:contain;display:block}
.matter-cont h2:first-child{margin-top:0}
.frontis .cap{margin-top:5mm;font-size:7.4pt;font-variant:all-small-caps;letter-spacing:.08em;color:var(--mute);
 border-top:.4pt solid var(--rule);padding-top:2.2mm}
.titlepage{display:flex;flex-direction:column;justify-content:center;height:257mm;text-align:center}
.titlepage .mark{font-size:11pt;letter-spacing:.4em;font-variant:all-small-caps;color:var(--ochre)}
.titlepage h1{font-size:40pt;line-height:1.06;font-weight:400;margin:8mm 0 0;color:var(--navy)}
.titlepage h1 em{display:block;font-style:normal;font-size:19pt;font-weight:300;letter-spacing:.02em;margin-top:5mm;color:#3f4b58}
.titlepage .rule{width:38mm;height:.8pt;background:var(--ochre);margin:9mm auto}
.titlepage .sub{font-size:10.4pt;color:#3f4b58;margin:0 auto;max-width:120mm;line-height:1.5}
.titlepage .author{margin-top:16mm;font-size:9.4pt;line-height:1.6}
.titlepage .author .n{font-size:12pt;color:var(--navy);margin-bottom:1.4mm}
.titlepage .meta{margin-top:12mm;font-size:7.6pt;font-variant:all-small-caps;letter-spacing:.12em;color:var(--mute)}

/* contents */
.toc{font-size:9pt;line-height:1.42}
.toc .part{font-size:7.2pt;font-variant:all-small-caps;letter-spacing:.14em;color:var(--ochre);
 margin:5mm 0 2mm;border-bottom:.4pt solid var(--rule);padding-bottom:1.4mm}
.toc .ch{display:flex;align-items:baseline;gap:2mm;margin-top:2.2mm;font-weight:600;color:var(--navy)}
.toc .sec{display:flex;align-items:baseline;gap:2mm;padding-left:7mm;font-size:8.5pt;color:#39485a;margin-top:.9mm}
.toc .dots{flex:1;border-bottom:.5pt dotted #c3bba9;transform:translateY(-1mm)}
.toc .pg{font-variant-numeric:oldstyle-nums;color:var(--navy);min-width:8mm;text-align:right}
.toc .ch .pg{font-weight:600}
.lof{font-size:7.9pt;line-height:1.38}
.lof .row{display:flex;align-items:baseline;gap:2mm;margin-bottom:1.1mm}
.lof .t{color:#39485a}
.lof .t b{color:var(--navy);font-weight:600}
.lof .dots{flex:1;border-bottom:.5pt dotted #c3bba9;transform:translateY(-1mm)}
.lof .pg{font-variant-numeric:oldstyle-nums;color:var(--navy);min-width:7mm;text-align:right}
.lof .grp{font-size:7pt;font-variant:all-small-caps;letter-spacing:.14em;color:var(--ochre);margin:3.4mm 0 1.6mm}
.cols2{column-count:2;column-gap:9mm}

/* part divider */
.divider{padding:0;background:var(--navy)}
.divider .bg{position:absolute;inset:0;background-image:url("DIVIDER_URI");background-size:cover;background-position:center;
 opacity:.5}
.divider .veil{position:absolute;inset:0;background:linear-gradient(160deg,rgba(15,39,64,.94) 30%,rgba(15,39,64,.66) 100%)}
.divider .inner{position:absolute;inset:0;padding:26mm;display:flex;flex-direction:column;justify-content:center;color:var(--paper)}
.divider .pnum{font-size:66pt;line-height:1;font-weight:300;color:var(--ochre);margin-bottom:2mm}
.divider .plabel{font-size:8pt;font-variant:all-small-caps;letter-spacing:.22em;color:#d8c9b2;margin-bottom:3mm}
.divider h2{color:var(--paper);font-size:30pt;font-weight:300;line-height:1.1;margin:0 0 8mm;letter-spacing:-.01em}
.divider .list{border-top:.5pt solid rgba(251,248,242,.28);padding-top:5mm;max-width:120mm}
.divider .list div{font-size:9.2pt;color:#e6dccd;margin-bottom:2.2mm;display:flex;gap:4mm}
.divider .list span.n{color:var(--ochre);min-width:7mm;font-variant:small-caps}
"""
CSS = CSS.replace("DIVIDER_URI", DIVIDER_URI)
# -*- coding: utf-8 -*-
# appended to build_book.py

NAVY = "#0f2740"
OCHRE = "#b4692a"
INK = "#12212f"
RULE = "#d9d2c5"
PAPER = "#fbf8f2"
MUTE = "#6d6455"
WASH = "#f6f1e8"


def t(x, y, s, size=7.2, anchor="start", fill=INK, weight="400", style="normal", ls="0"):
    return ('<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s" font-weight="%s" '
            'font-style="%s" letter-spacing="%s">%s</text>') % (x, y, size, anchor, fill, weight, style, ls, s)


def r(x, y, w, h, fill="none", stroke=NAVY, sw="0.8", dash=None, rx="2"):
    d = (' stroke-dasharray="%s"' % dash) if dash else ""
    return ('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>'
            % (x, y, w, h, rx, fill, stroke, sw, d))


def ln(x1, y1, x2, y2, stroke=NAVY, sw="0.8", dash=None, arrow=True):
    d = (' stroke-dasharray="%s"' % dash) if dash else ""
    a = ' marker-end="url(#ar)"' if arrow else ""
    return ('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s%s/>'
            % (x1, y1, x2, y2, stroke, sw, d, a))


def path(d, stroke=NAVY, sw="0.8", fill="none", dash=None, arrow=True):
    ds = (' stroke-dasharray="%s"' % dash) if dash else ""
    a = ' marker-end="url(#ar)"' if arrow else ""
    return '<path d="%s" fill="%s" stroke="%s" stroke-width="%s"%s%s/>' % (d, fill, stroke, sw, ds, a)


def diamond(cx, cy, w, h, label, sub=""):
    pts = "%s,%s %s,%s %s,%s %s,%s" % (cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy)
    out = '<polygon points="%s" fill="none" stroke="%s" stroke-width="0.8"/>' % (pts, OCHRE)
    out += t(cx, cy + 3, label, 7, "middle", NAVY, "500")
    if sub:
        out += t(cx, cy + h / 2 + 9, sub, 6.4, "middle", MUTE)
    return out


def svg(w, h, body, head=""):
    defs = ('<defs><marker id="ar" markerWidth="7" markerHeight="7" refX="6.5" refY="3.5" orient="auto">'
            '<path d="M0 0 L7 3.5 L0 7 z" fill="%s"/></marker></defs>' % NAVY)
    top = t(6, 14, head, 7, "start", MUTE, "500", "normal", "1.2") if head else ""
    return ('<svg viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" '
            'font-family="Spectral, Georgia, serif">%s%s%s</svg>') % (w, h, defs, top, body)


# ---------------------------------------------------------------- figures

def fig_service_graph():
    b = []
    b.append(r(6, 6, 688, 318, "none", RULE, "0.6", None, "0"))
    clients = [("Laundry app", 40), ("Shop counter", 170), ("Hotel desk", 300), ("Linen room", 430), ("LoveMobi", 560)]
    for name, x in clients:
        b.append(r(x, 34, 116, 28, "none", RULE))
        b.append(t(x + 58, 52, name, 7.4, "middle", NAVY, "500"))
        b.append(ln(x + 58, 62, x + 58, 92, NAVY, "0.7"))
    b.append(t(6, 26, "CLIENTS", 6.4, "start", MUTE, "500", "normal", "1.4"))

    svcs = [("user-service", 60, 118, True), ("bill_service", 214, 118, False),
            ("quotation-service", 368, 118, False), ("worker-service", 522, 118, False)]
    for name, x, y, accent in svcs:
        b.append(r(x, y, 130, 40, "none", OCHRE if accent else NAVY, "1" if accent else "0.8"))
        b.append(t(x + 65, y + 18, name, 7.6, "middle", NAVY, "600"))
        b.append(t(x + 65, y + 31, "FastAPI", 6.4, "middle", MUTE))
    b.append(r(60, 186, 130, 30, "none", NAVY))
    b.append(t(125, 205, "laundry-management", 7.2, "middle", NAVY, "500"))
    b.append(r(214, 186, 130, 30, "none", NAVY))
    b.append(t(279, 205, "love-ai", 7.2, "middle", NAVY, "500"))

    # service edges
    for x1, y1, x2, y2 in [(150, 118, 214, 118), (344, 138, 344, 186), (279, 118, 279, 186),
                           (279, 216, 240, 216), (240, 216, 240, 158), (150, 88, 150, 118)]:
        b.append(ln(x1, y1, x2, y2, NAVY, "0.7"))
    b.append(t(300, 112, "authenticate / authorise", 6.2, "start", MUTE))
    b.append(t(352, 168, "read context", 6.2, "start", MUTE))

    dbs = [("user_db", 40), ("operations", 232), ("accounting", 424)]
    for name, x in dbs:
        b.append(r(x, 250, 160, 34, "none", RULE))
        b.append(t(x + 80, 264, name, 7.4, "middle", NAVY, "500"))
        b.append(t(x + 80, 276, "MongoDB", 6.2, "middle", MUTE))
    b.append(ln(125, 226, 125, 250, NAVY, "0.7"))
    b.append(ln(279, 216, 279, 250, NAVY, "0.7"))
    b.append(ln(504, 216, 504, 250, NAVY, "0.7"))
    b.append(t(6, 306, "Solid: authenticated HTTP. Dashed: per-service database credential. No service reads another service's store.", 6.6, "start", MUTE))
    return svg(700, 330, "".join(b), "SERVICE DEPENDENCY GRAPH")


def fig_tenancy_decision():
    b = []
    steps = [("Request", 20), ("Token?", 104), ("token_kind", 196), ("laundry_id?", 300), ("Membership?", 404), ("Scoped query", 520)]
    for i, (s, x) in enumerate(steps[:5]):
        b.append(r(x, 30, 78, 30, "none", RULE))
        b.append(t(x + 39, 48, s, 7, "middle", NAVY, "500"))
    b.append(r(520, 30, 96, 30, "#f6f1e8", OCHRE))
    b.append(t(568, 48, "Scoped query", 7, "middle", NAVY, "600"))
    for x in (98, 190, 294, 398, 494):
        b.append(ln(x, 45, x + 6, 45, NAVY, "0.8"))

    # failure branches
    fails = [("401", 104, "no token"), ("403", 196, "client token"), ("403", 300, "no tenant"), ("403", 404, "no membership")]
    for code, x, why in fails:
        b.append(ln(x + 39, 60, x + 39, 92, OCHRE, "0.8"))
        b.append(r(x, 92, 78, 26, "none", OCHRE, "0.8"))
        b.append(t(x + 39, 104, code, 7.4, "middle", OCHRE, "600"))
        b.append(t(x + 39, 113, why, 6.2, "middle", MUTE))

    # detail
    b.append(t(20, 146, "Where each decision is made", 7.4, "start", NAVY, "600"))
    rows = [("Signature, expiry, audience", "auth middleware", "reject"),
            ("token_kind = staff", "tenant dependency", "reject"),
            ("laundry_id present in claims", "tenant dependency", "403, fail closed"),
            ("membership valid for that laundry", "capability dependency", "403"),
            ("record belongs to the tenant", "repository filter", "404, not 403")]
    y = 162
    for a, b_, c in rows:
        b.append(ln(20, y - 3, 680, y - 3, RULE, "0.4", None, False))
        b.append(t(20, y + 5, a, 6.8, "start", INK))
        b.append(t(330, y + 5, b_, 6.8, "start", MUTE))
        b.append(t(680, y + 5, c, 6.8, "end", OCHRE))
        y += 20
    b.append(t(20, 280, "A refusal never reveals whether the record exists in another tenant: 404 is returned for both a foreign key and a missing one.", 6.6, "start", MUTE))
    b.append(t(20, 296, "There is no default tenant and no system mode that skips this chain.", 6.6, "start", MUTE))
    return svg(700, 310, "".join(b), "TENANCY DECISION FLOW")


def fig_failure_domains():
    b = []
    b.append(r(30, 40, 400, 150, "none", RULE, "0.6", "4 3", "0"))
    b.append(t(36, 34, "FAILURE DOMAIN A · APPLICATION HOST", 6.4, "start", MUTE, "500", "normal", "1.2"))
    for i, name in enumerate(["user-service", "bill_service", "quotation", "worker", "laundry-mgmt"]):
        x = 44 + (i % 3) * 128
        y = 54 + (i // 3) * 62
        b.append(r(x, y, 116, 34, "none", NAVY))
        b.append(t(x + 58, y + 21, name, 6.8, "middle", NAVY, "500"))

    b.append(r(456, 40, 214, 74, "none", RULE, "0.6", "4 3", "0"))
    b.append(t(462, 34, "DOMAIN B · DATABASE", 6.4, "start", MUTE, "500", "normal", "1.2"))
    for i, name in enumerate(["primary", "secondary"]):
        b.append(r(466 + i * 100, 54, 92, 44, "none", NAVY))
        b.append(t(512 + i * 100, 72, name, 6.8, "middle", NAVY, "500"))
        b.append(t(512 + i * 100, 84, "oplog" if i == 0 else "failover", 6.2, "middle", MUTE))

    b.append(r(456, 128, 214, 62, "none", RULE, "0.6", "4 3", "0"))
    b.append(t(462, 122, "DOMAIN C · OBJECT STORAGE", 6.4, "start", MUTE, "500", "normal", "1.2"))
    b.append(r(466, 140, 194, 38, "none", NAVY))
    b.append(t(563, 157, "versioned bucket · immutable", 6.6, "middle", NAVY, "500"))
    b.append(t(563, 169, "separate account", 6.2, "middle", MUTE))

    b.append(ln(430, 100, 456, 88, NAVY, "0.8"))
    b.append(ln(430, 130, 456, 150, NAVY, "0.8", "3 2"))
    b.append(t(30, 214, "Loss of domain A stops the front ends but loses nothing: all state is in B and C.", 6.8, "start", INK))
    b.append(t(30, 230, "Loss of B stops trading; C is unaffected and still holds backup history.", 6.8, "start", INK))
    b.append(t(30, 246, "Loss of C does not stop trading but removes the ability to restore B — the most dangerous single failure.", 6.8, "start", INK))
    b.append(t(30, 268, "Domains A and B may share a host only if C is outside it. Otherwise a single incident removes both the data and its backup.", 6.6, "start", OCHRE))
    return svg(700, 284, "".join(b), "DEPLOYMENT TOPOLOGY · FAILURE DOMAINS")


def fig_token_shapes():
    b = []
    b.append(t(20, 26, "STAFF TOKEN", 7, "start", NAVY, "600", "normal", "1.2"))
    b.append(t(370, 26, "CLIENT TOKEN", 7, "start", NAVY, "600", "normal", "1.2"))
    staff = [("sub", "user id", True), ("token_kind", "\"staff\"", True), ("laundry_id", "active tenant", True),
             ("laundries[]", "membership snapshot", True), ("role", "ADMIN | MANAGER | STAFF", True),
             ("capabilities[]", "gatepass:write …", True), ("client_scope", "absent", False), ("exp", "24 hours", True)]
    client = [("sub", "client account id", True), ("token_kind", "\"client\"", True), ("laundry_id", "absent by design", False),
              ("laundries[]", "absent by design", False), ("role", "none", False),
              ("capabilities[]", "none", False), ("client_scope", "{ laundry_id, client_name }", True), ("exp", "12 hours", True)]
    y = 42
    for (k1, v1, ok1), (k2, v2, ok2) in zip(staff, client):
        b.append(r(20, y, 320, 24, "none", RULE))
        b.append(t(30, y + 15, k1, 7, "start", NAVY, "600"))
        b.append(t(150, y + 15, v1, 6.8, "start", INK if ok1 else MUTE, "400", "italic" if not ok1 else "normal"))
        if not ok1:
            b.append(ln(20, y + 12, 340, y + 12, OCHRE, "0.7", "3 2", False))

        b.append(r(370, y, 310, 24, "none", RULE))
        b.append(t(380, y + 15, k2, 7, "start", NAVY, "600"))
        b.append(t(500, y + 15, v2, 6.8, "start", INK if ok2 else MUTE, "400", "italic" if not ok2 else "normal"))
        if not ok2:
            b.append(ln(370, y + 12, 680, y + 12, OCHRE, "0.7", "3 2", False))
        y += 28

    b.append(t(20, y + 14, "A staff token satisfies the tenant dependency. A client token cannot: it carries no top-level tenant claim.", 6.8, "start", INK))
    b.append(t(20, y + 30, "The absence is the control, not a gap to be filled. Adding laundry_id to a client token would let it pass staff checks.", 6.8, "start", OCHRE))
    return svg(700, y + 44, "".join(b), "TOKEN SHAPES COMPARED")


def fig_dayclose_seq():
    b = []
    lanes = [("Operator", 90), ("Laundry app", 250), ("bill_service", 430), ("Database", 610)]
    for name, x in lanes:
        b.append(t(x, 28, name, 7.4, "middle", NAVY, "600"))
        b.append(ln(x, 34, x, 300, RULE, "0.6", "3 3", False))
    msgs = [(90, 250, 54, "close day for 24 Oct"), (250, 430, 78, "POST /day-close"),
            (430, 610, 104, "count unbilled deliveries"), (610, 430, 122, "count = 0", True),
            (430, 610, 148, "write close record + totals"), (610, 430, 166, "committed", True),
            (430, 250, 192, "201 close summary"), (250, 90, 214, "render summary")]
    for x1, x2, y, label, *dash in msgs:
        b.append(ln(x1, y, x2, y, NAVY if not dash else MUTE, "0.8", "3 2" if dash else None))
        b.append(t((x1 + x2) / 2, y - 6, label, 6.6, "middle", INK))
    # blocked branch
    b.append(r(340, 236, 270, 44, "none", OCHRE, "0.8", "3 2"))
    b.append(t(352, 252, "If unbilled > 0: 409 with the list", 6.6, "start", OCHRE, "500"))
    b.append(t(352, 266, "Nothing is frozen; the operator clears the list and retries.", 6.4, "start", MUTE))
    b.append(t(20, 312, "The freeze and the record commit together: a close either happened or did not, and the operator who closed it is recorded.", 6.6, "start", MUTE))
    return svg(700, 324, "".join(b), "DAY-CLOSE SEQUENCE")


def fig_hotel_path():
    b = []
    boxes = [("Client token", 24, 60, "client_scope only"), ("/client-portal", 176, 60, "staff routes refuse it"),
             ("scope extraction", 328, 60, "laundry_id + client_name"), ("dual filter", 480, 60, "both keys required")]
    for label, x, y, sub in boxes:
        b.append(r(x, y, 132, 46, "none", NAVY))
        b.append(t(x + 66, y + 20, label, 7.2, "middle", NAVY, "600"))
        b.append(t(x + 66, y + 33, sub, 6.2, "middle", MUTE))
    for x in (156, 308, 460):
        b.append(ln(x, 83, x + 12, 83, NAVY, "0.8"))

    b.append(r(480, 132, 196, 54, "#f6f1e8", OCHRE))
    b.append(t(578, 150, "gate passes · deliveries · bills", 6.8, "middle", NAVY, "500"))
    b.append(t(578, 164, "for one property only", 6.4, "middle", MUTE))
    b.append(ln(546, 106, 546, 132, OCHRE, "0.8"))

    b.append(r(24, 132, 420, 54, "none", RULE, "0.6", "3 2"))
    b.append(t(36, 149, "Rejected paths", 6.8, "start", OCHRE, "600"))
    b.append(t(36, 163, "staff token to /client-portal — no client_scope", 6.4, "start", MUTE))
    b.append(t(36, 175, "client token to /gate-passes — no laundry_id, tenant dependency fails closed", 6.4, "start", MUTE))

    b.append(t(24, 214, "Every query is built as { laundry_id, client_name, … }. A request naming another property cannot match.", 6.8, "start", INK))
    b.append(t(24, 230, "A request for an invoice belonging to another property returns 404 — identical to an invoice that does not exist.", 6.8, "start", INK))
    b.append(t(24, 252, "12-hour lifetime; no capability list; no membership; no tenant claim.", 6.6, "start", OCHRE))
    return svg(700, 266, "".join(b), "HOTEL PORTAL REQUEST PATH")


def fig_linen_machine():
    b = []
    states = ["collect", "receive", "start_wash", "complete_wash", "press", "ready", "deliver"]
    x = 20
    for i, s in enumerate(states):
        w = 78
        b.append(r(x, 46, w, 30, "none", NAVY if i < 6 else OCHRE))
        b.append(t(x + w / 2, 65, s, 6.8, "middle", NAVY, "500"))
        if i < len(states) - 1:
            b.append(ln(x + w, 61, x + w + 14, 61, NAVY, "0.8"))
        x += w + 16
    b.append(t(20, 38, "FORWARD PATH · ONE SCAN EVENT PER TRANSITION", 6.4, "start", MUTE, "500", "normal", "1.2"))

    b.append(r(250, 108, 200, 34, "none", OCHRE, "0.9", "4 3"))
    b.append(t(350, 129, "mark_missing / mark_damaged", 6.8, "middle", OCHRE, "600"))
    b.append(ln(160, 76, 300, 108, OCHRE, "0.8", "3 2"))
    b.append(ln(560, 76, 450, 108, OCHRE, "0.8", "3 2"))

    b.append(r(490, 108, 130, 34, "none", OCHRE))
    b.append(t(555, 129, "retire", 6.8, "middle", OCHRE, "600"))
    b.append(ln(600, 142, 600, 168, OCHRE, "0.8", "3 2"))

    b.append(t(20, 168, "Exception states", 7.2, "start", NAVY, "600"))
    rows = [("missing", "item not found after a documented search; supervisor review"),
            ("damaged", "torn or unusable; liability assessed against the client contract"),
            ("retired", "permanently withdrawn; the tag is never reused")]
    y = 184
    for a, c in rows:
        b.append(t(20, y, a, 6.8, "start", OCHRE, "600"))
        b.append(t(110, y, c, 6.8, "start", INK))
        y += 16
    b.append(t(20, 240, "No reverse transition exists. A wrongly scanned item is corrected by recording the event and scanning it forward again.", 6.6, "start", MUTE))
    b.append(t(20, 256, "Every transition carries the acting user and a timestamp; the tag history is the evidence in a client dispute.", 6.6, "start", MUTE))
    return svg(700, 268, "".join(b), "LINEN LIFECYCLE STATE MACHINE")


def fig_severity_grid():
    b = []
    cols = [("Business impact", 210), ("Response target", 400), ("Who is called", 560)]
    for label, x in cols:
        b.append(t(x, 24, label, 6.6, "start", MUTE, "500", "normal", "1"))
    rows = [("SEV1", "Trading stops; data lost or exposed", "Acknowledge 15 min · contain 1 h", "Operator, owner, DPO", 1.0),
            ("SEV2", "Major function unavailable", "Acknowledge 30 min · mitigate 4 h", "Operator, manager", 0.72),
            ("SEV3", "Minor function degraded", "Acknowledge 4 h · resolve 2 days", "Operator", 0.42),
            ("SEV4", "Cosmetic or single user", "Next planned release", "Backlog", 0.2)]
    y = 34
    for name, impact, resp, who, wgt in rows:
        band = r(6, y, 688, 46, "none", RULE, "0.5")
        b.append(band)
        b.append('<rect x="6" y="%s" width="4" height="46" fill="%s" opacity="%s"/>' % (y, OCHRE, wgt))
        b.append(t(20, y + 21, name, 9.4, "start", NAVY, "600"))
        b.append(t(20, y + 35, "severity", 6.2, "start", MUTE))
        b.append(t(210, y + 21, impact, 7, "start", INK))
        b.append(t(210, y + 35, "assigned at declaration; may be raised, never lowered", 6.2, "start", MUTE))
        b.append(t(400, y + 21, resp, 7, "start", INK))
        b.append(t(560, y + 21, who, 7, "start", INK))
        y += 52
    b.append(t(20, y + 14, "When in doubt, declare higher: a wasted SEV1 costs an hour, a late one costs a day of unbilled work.", 6.8, "start", OCHRE))
    return svg(700, y + 30, "".join(b), "INCIDENT SEVERITY MATRIX")


def fig_backup_timeline():
    b = []
    x0, x1 = 40, 672
    b.append(ln(x0, 150, x1, 150, NAVY, "0.8", None, False))
    marks = [("-35 d", 0), ("-7 d", 0.8), ("now", 0.92), ("+24 h", 1.0)]
    for label, frac in marks:
        x = x0 + (x1 - x0) * frac
        b.append(ln(x, 146, x, 154, NAVY, "0.8", None, False))
        b.append(t(x, 166, label, 6.4, "middle", MUTE))

    bars = [("Daily logical dump", 0.0, 0.92, "35 daily · 12 monthly", 40),
            ("Oplog (continuous)", 0.62, 0.30, "72-hour replay window", 76),
            ("Off-host copy", 0.0, 0.80, "immutable 90 days · separate account", 112)]
    for label, start, width, note, y in bars:
        b.append(t(6, y + 10, label, 7, "start", NAVY, "500"))
        b.append(r(x0 + (x1 - x0) * start, y, (x1 - x0) * width, 14, "#f6f1e8", NAVY, "0.6"))
        b.append(t(x0 + (x1 - x0) * start + 6, y + 10, note, 6.2, "start", MUTE))

    b.append(ln(x0 + (x1 - x0) * 0.92, 30, x0 + (x1 - x0) * 0.92, 150, OCHRE, "0.8", "3 2"))
    b.append(t(x0 + (x1 - x0) * 0.92 - 6, 26, "failure", 6.6, "end", OCHRE, "600"))
    b.append(r(x0 + (x1 - x0) * 0.905, 132, 26, 12, "none", OCHRE, "0.7"))
    b.append(t(x0 + (x1 - x0) * 0.905 + 13, 141, "15 min RPO", 5.8, "middle", OCHRE))

    b.append(t(6, 196, "The oplog closes the gap between last night's dump and the moment of failure; without it the achievable RPO is 24 hours.", 6.8, "start", INK))
    b.append(t(6, 212, "The off-host copy is what makes ransomware survivable. It is written with a credential the application host does not hold.", 6.8, "start", INK))
    return svg(700, 226, "".join(b), "BACKUP, RETENTION AND RECOVERY TIMELINE")


def fig_guard_layers():
    b = []
    layers = [("Data", "a delivery line belongs to one bill only", 0.16),
              ("Transaction", "bill issue and delivery marking commit together", 0.34),
              ("Request", "idempotency key returns the first result on retry", 0.56),
              ("Process", "day-close review of unbilled and duplicate totals", 0.80)]
    y = 34
    for i, (name, what, op) in enumerate(layers):
        x = 30 + i * 26
        b.append('<rect x="%s" y="%s" width="%s" height="52" fill="none" stroke="%s" stroke-width="0.9" opacity="%s"/>'
                 % (x, y, 640 - i * 52, OCHRE, op))
        b.append(t(x + 14, y + 22, name, 7.6, "start", NAVY, "600"))
        b.append(t(x + 100, y + 22, what, 7, "start", INK))
        b.append(t(x + 14, y + 40, "layer %d" % (i + 1), 6, "start", MUTE))
        y += 58
    b.append(t(30, y + 12, "A duplicate charge must defeat all four layers. Any single mistake — human or technical — is absorbed by the next layer.", 6.8, "start", MUTE))
    b.append(t(30, y + 28, "The layers are also tests: the bill_service suite asserts each one, so a control cannot be removed silently.", 6.8, "start", MUTE))
    return svg(700, y + 44, "".join(b), "GUARD LAYERS AGAINST DOUBLE BILLING")


def fig_role_heatmap():
    b = []
    roles = ["ADMIN", "MANAGER", "STAFF", "LINEN", "HOUSE", "HOTEL"]
    caps = ["gatepass:read", "gatepass:write", "delivery:write", "bill:read", "bill:write",
            "payment:write", "linen:scan", "linen:write", "report:read", "user mgmt"]
    x0, y0 = 150, 36
    cw, ch = 82, 24
    for j, role in enumerate(roles):
        b.append(t(x0 + j * cw + cw / 2, y0 - 8, role, 6.4, "middle", NAVY, "600"))
    for i, cap in enumerate(caps):
        y = y0 + i * ch
        b.append(t(10, y + 15, cap, 6.8, "start", INK))
        b.append(ln(6, y + ch - 2, 6 + 140 + len(roles) * cw, y + ch - 2, RULE, "0.4", None, False))
        for j, role in enumerate(roles):
            x = x0 + j * cw + cw / 2
            level = LEVELS.get((cap, role), 0)
            if level == 2:
                b.append('<circle cx="%s" cy="%s" r="4.4" fill="%s"/>' % (x, y + 12, OCHRE))
            elif level == 1:
                b.append('<circle cx="%s" cy="%s" r="4.4" fill="none" stroke="%s" stroke-width="0.9"/>' % (x, y + 12, NAVY))
            elif level == -1:
                b.append(t(x, y + 15, "\u00b7", 8, "middle", RULE, "600"))
    b.append(t(6, y0 + len(caps) * ch + 18, "Filled: granted. Open: read-only or scoped. Dot: not applicable to that role.", 6.4, "start", MUTE))
    b.append(t(6, y0 + len(caps) * ch + 32, "HOTEL roles act through /client-portal scope, not through capabilities.", 6.4, "start", MUTE))
    return svg(700, y0 + len(caps) * ch + 44, "".join(b), "ROLE AND CAPABILITY HEAT MAP")


LEVELS = {
    ("gatepass:read", "ADMIN"): 2, ("gatepass:read", "MANAGER"): 2, ("gatepass:read", "STAFF"): 2,
    ("gatepass:read", "LINEN"): 2, ("gatepass:read", "HOUSE"): 2, ("gatepass:read", "HOTEL"): 1,
    ("gatepass:write", "ADMIN"): 2, ("gatepass:write", "MANAGER"): 2, ("gatepass:write", "STAFF"): 2,
    ("delivery:write", "ADMIN"): 2, ("delivery:write", "MANAGER"): 2, ("delivery:write", "STAFF"): 2,
    ("bill:read", "ADMIN"): 2, ("bill:read", "MANAGER"): 2, ("bill:read", "STAFF"): 2, ("bill:read", "HOTEL"): 1,
    ("bill:write", "ADMIN"): 2, ("bill:write", "MANAGER"): 2, ("bill:write", "STAFF"): 2,
    ("payment:write", "ADMIN"): 2, ("payment:write", "MANAGER"): 2,
    ("linen:scan", "ADMIN"): 2, ("linen:scan", "MANAGER"): 2, ("linen:scan", "LINEN"): 2, ("linen:scan", "HOUSE"): 2,
    ("linen:write", "ADMIN"): 2, ("linen:write", "MANAGER"): 2, ("linen:write", "LINEN"): 2,
    ("report:read", "ADMIN"): 2, ("report:read", "MANAGER"): 2,
    ("user mgmt", "ADMIN"): 2,
    ("delivery:write", "HOTEL"): -1, ("payment:write", "HOTEL"): -1, ("linen:scan", "HOTEL"): -1,
    ("report:read", "HOTEL"): -1, ("user mgmt", "MANAGER"): -1, ("user mgmt", "STAFF"): -1,
}


def fig_alert_flow():
    b = []
    stages = [("Signal", "probe, log pattern, backup job", 0), ("Alert", "threshold or absence", 1),
              ("Acknowledge", "on-call, within target", 2), ("Triage", "severity from the matrix", 3),
              ("Mitigate", "runbook step or rollback", 4), ("Review", "actions with owners", 5)]
    x = 18
    for i, (name, sub, _) in enumerate(stages):
        b.append(r(x, 40, 96, 52, "none", NAVY if i < 4 else OCHRE))
        b.append(t(x + 48, 60, name, 7.2, "middle", NAVY, "600"))
        b.append(t(x + 48, 74, sub.split(",")[0], 6.2, "middle", MUTE))
        if i < len(stages) - 1:
            b.append(ln(x + 96, 66, x + 106, 66, NAVY, "0.8"))
        x += 110
    b.append(path("M 566 92 L 566 116 L 66 116 L 66 96", OCHRE, "0.7", "none", "3 2"))
    b.append(t(316, 130, "no acknowledgement within target: severity is raised, not the window", 6.4, "middle", OCHRE))
    b.append(t(18, 158, "Every alert names the likely cause and the first check, so the person woken at night does not begin with an investigation.", 6.8, "start", INK))
    b.append(t(18, 174, "An alert that fires routinely without action is a defect: fix the threshold or the cause.", 6.8, "start", INK))
    return svg(700, 188, "".join(b), "ALERT AND ESCALATION FLOW")

# -*- coding: utf-8 -*-
# appended to build_book.py

import shutil

# ---------------------------------------------------------------- source
if not os.path.exists(SRC):
    if not os.path.exists(OUT):
        raise SystemExit("no source manual found")
    shutil.copyfile(OUT, SRC)

SRC_HTML = io.open(SRC, encoding="utf-8").read()


def source_body(n):
    m = re.search(r'<section class="page[^"]*" id="p%d">(.*?)</section>' % n, SRC_HTML, re.S)
    if not m:
        raise SystemExit("source page %d missing" % n)
    raw = m.group(1)
    raw = re.sub(r'<div class="runhead">.*?</div>', "", raw, flags=re.S)
    raw = re.sub(r'<div class="foot">.*?</div>', "", raw, flags=re.S)
    return raw.strip()


def split_header(raw):
    m = re.match(r'\s*<p class="eyebrow">(.*?)</p>\s*<h1 class="chap[^"]*">(.*?)</h1>\s*'
                 r'(?:<p class="lede">(.*?)</p>)?', raw, re.S)
    if not m:
        return "", "", "", raw
    return m.group(1), m.group(2), m.group(3) or "", raw[m.end():].strip()


# ---------------------------------------------------------------- chapters
CHAPTERS = [
    dict(num="1", first=6, last=8, part=1),
    dict(num="2", first=9, last=18, part=1),
    dict(num="3", first=19, last=24, part=1),
    dict(num="4", first=25, last=36, part=2),
    dict(num="5", first=37, last=45, part=2),
    dict(num="6", first=46, last=54, part=2),
    dict(num="7", first=55, last=62, part=2),
    dict(num="8", first=63, last=67, part=3),
    dict(num="9", first=68, last=75, part=3),
    dict(num="10", first=76, last=82, part=3),
    dict(num="11", first=83, last=88, part=3),
    dict(num="12", first=89, last=93, part=4),
    dict(num="13", first=94, last=97, part=4),
    dict(num="A", first=98, last=105, part=4, synthetic=True, title="Appendices",
         lede="Reference tables, matrices and enumerations: endpoints, roles, statuses, vocabulary and revision history."),
]

for ch in CHAPTERS:
    if not ch.get("synthetic"):
        _, title, lede, _ = split_header(source_body(ch["first"]))
        ch["title"] = title
        ch["lede"] = lede

PARTS = [
    (1, "Foundation", "The platform, its architecture, and the security model that binds every record to one tenant."),
    (2, "The Applications", "Four working surfaces on one dataset: laundry, shop, hotel and linen room."),
    (3, "Operating the Business", "Administration, disaster, recovery and the fail-safes that hold under pressure."),
    (4, "Assurance and Reference", "Testing, operations, and the reference tables consulted rather than read."),
]
ROMAN = {1: "One", 2: "Two", 3: "Three", 4: "Four"}


# ---------------------------------------------------------------- new pages
def fig_page(kicker, title, lede, svg_markup, caption, paras, note_text="", refs=""):
    body = ['<p class="lede">%s</p>' % lede]
    body.append("<figure class=\"fig\">%s<figcaption>%s</figcaption></figure>" % (svg_markup, caption))
    for t in paras:
        body.append("<p>%s</p>" % t)
    if refs:
        body.append("<p>%s</p>" % refs)
    if note_text:
        body.append('<div class="callout note"><span class="lbl">Rule</span><p>%s</p></div>' % note_text)
    return dict(kicker=kicker, title=title, body="".join(body))


NEW = {
    18: [
        fig_page("2.11 · Service dependencies", "Service dependency graph",
                 "Which service calls which, and what fails when an arrow breaks.",
                 fig_service_graph(),
                 "<b>Figure 2.11</b> — Service dependency graph, drawn as a line diagram: authenticated HTTP between services, per-service credentials to each store.",
                 ["The graph is deliberately shallow. Clients talk to services; services talk to user-service for identity and to each other only where a business operation genuinely spans two domains. There is no service that every other service depends on except the identity authority, and that is the single point the platform accepts.",
                  "Reading the graph during an incident is a matter of following the arrows backwards from the symptom. A shop counter that cannot take payment is not a shop problem: the arrow from shop-app to bill_service is broken, and the first question is whether bill_service is reachable or merely slow."]),
        fig_page("2.12 · Tenancy decision flow", "Tenancy decision flow",
                 "Five checks, in order, before a single document is read.",
                 fig_tenancy_decision(),
                 "<b>Figure 2.12</b> — The tenancy decision chain. Each failure returns before the next check runs.",
                 ["Chapter 3 sets out the enforcement rules in full from page {{p:p19}}. Tenancy is not a filter applied at the end of a query; it is a sequence of decisions that must all succeed before a query is built. The order matters: identity before token kind, token kind before tenant, tenant before membership, membership before the record itself.",
                  "The practical consequence is that a handler never asks which laundry is calling. It receives a resolved tenant context or it is never invoked, which removes the class of defect in which a developer forgets a filter."],
                 "A refusal never distinguishes a foreign record from a missing one. Both return not-found, so the endpoint cannot be used to enumerate another tenant's documents."),
        fig_page("2.13 · Failure domains", "Deployment topology and failure domains",
                 "What fails together, and why the backup must live outside the blast radius.",
                 fig_failure_domains(),
                 "<b>Figure 2.13</b> — Failure domains in the reference deployment: application host, database replica set, object storage.",
                 ["The topology is drawn as three domains rather than three tiers, because the question that matters in a disaster is not what talks to what but what disappears together. The application host is disposable: it holds no state and can be rebuilt from the deployment steps.",
                  "The database is the domain that stops trade, and object storage is the domain that makes recovery possible. Keeping them in separate accounts is the control that prevents one compromised credential from removing both the data and its history."],
                 "If the database and its backups share an account, ransomware has one target, not two. Separation of accounts is a recovery control, not an administrative preference."),
    ],
    24: [
        fig_page("3.7 · Token shapes compared", "Token shapes compared",
                 "Two kinds of session, deliberately unequal.",
                 fig_token_shapes(),
                 "<b>Figure 3.7</b> — Claim-by-claim comparison of staff and hotel client tokens.",
                 ["The two tokens are not variants of one design; they are different instruments. A staff token asserts a person, a tenant and a set of capabilities. A client token asserts a property and a scope, and nothing else — no tenant claim, no role, no capability list.",
                  "The asymmetry is what makes the isolation automatic. Staff endpoints resolve a tenant from the token, so a token without one cannot pass, no matter which route it is sent to. Hotel endpoints read the scope object, so a staff token cannot satisfy them either."],
                 "Adding a tenant claim to a client token to simplify a query would collapse the distinction and let a hotel satisfy a staff authorisation check. The absence is the control."),
    ],
    36: [
        fig_page("4.13 · Day-close sequence", "Day-close sequence",
                 "What has to be true before a date can be frozen, and what happens when it is not.",
                 fig_dayclose_seq(),
                 "<b>Figure 4.13</b> — Day-close sequence, including the blocked branch when unbilled deliveries remain.",
                 ["Closing a day is a transaction with a precondition, not a button that writes a total. The service counts unbilled deliveries first; if any exist, it refuses and returns the list. Nothing is frozen, so the operator can correct the cause and try again.",
                  "When the close succeeds, the totals and the close record commit together. That single unit is what makes the day's figures defensible: there is no state in which a date is marked closed but its totals were never written."],
                 "A close that fails is cheaper than a close that succeeds with an unresolved discrepancy. Reopening is itself an audited event and is never the first resort."),
    ],
    54: [
        fig_page("6.10 · Hotel portal request path", "Hotel portal request path",
                 "How one property's records are separated from every other property's, on every request.",
                 fig_hotel_path(),
                 "<b>Figure 6.10</b> — Request path from a client token to a scoped query, with the rejected paths shown.",
                 ["The portal has no endpoint that accepts a client name as a parameter. The name comes from the token's scope, so a hotel cannot ask for another property's records even by guessing an identifier.",
                  "The dual filter is the mechanism: every query carries both the laundry and the client name. Filtering on the name alone would be unsafe across laundries; filtering on the laundry alone would expose every hotel to every other hotel."],
                 "A request for another property's invoice returns not-found, identical to an invoice that does not exist. The portal never confirms that another property's records exist."),
    ],
    62: [
        fig_page("7.9 · Linen lifecycle state machine", "Linen lifecycle state machine",
                 "Seven forward states, three exception states, and no way back.",
                 fig_linen_machine(),
                 "<b>Figure 7.9</b> — The linen state machine with its exception branches. Transitions are written by scan events only.",
                 ["The scan procedure that writes these transitions is on page {{p:p57}}. The forward path is linear because the physical process is linear: goods are collected, received, washed, finished, pressed, made ready and delivered. Modelling it as a chain rather than a set of flags means an item cannot be simultaneously ready and in wash.",
                  "The exception states branch off the active state rather than replacing the chain. An item marked missing leaves the batch but keeps its history, so when it is found it can be scanned back into the correct stage without inventing a new tag."],
                 "There is no reverse transition and no status dropdown. A wrongly scanned item is corrected by recording the event and scanning it forward again, which leaves both facts visible."),
    ],
    75: [
        fig_page("9.8 · Incident severity matrix", "Incident severity matrix",
                 "One table that decides who is called and how fast.",
                 fig_severity_grid(),
                 "<b>Figure 9.8</b> — Severity bands with response targets and the people they summon.",
                 ["Severity is assigned at declaration, from business impact rather than technical curiosity. A dull configuration error that stops billing is Sev1; an exotic defect in a report nobody reads is Sev3.",
                  "The matrix is read downwards, not upwards: start at the impact, then take the response target that belongs to it. The target is measured from declaration, not from the moment someone understands the cause."],
                 "Severity may be raised during an incident and is never lowered. Lowering it mid-incident invites people to stand down before the work is finished."),
    ],
    82: [
        fig_page("10.8 · Backup and recovery timeline", "Backup and recovery timeline",
                 "Three overlapping protections, and the fifteen minutes that separates them.",
                 fig_backup_timeline(),
                 "<b>Figure 10.8</b> — Daily dumps, continuous oplog and the off-host copy, against the recovery-point target.",
                 ["The restore procedure itself begins on page {{p:p79}}, and the drill checklist on page {{p:p82}}. The timeline explains why the recovery-point target is fifteen minutes rather than a day. The nightly dump sets the floor, the oplog closes the gap to the moment of failure, and the off-host copy survives the loss of the host that wrote it.",
                  "Each layer answers a different failure. The dump answers corruption, the oplog answers a bad change made an hour ago, and the off-host copy answers the loss of the account in which everything else lives."],
                 "The oplog is a backup artefact, not a log to be pruned for space. If it is lost with the database, the achievable recovery point becomes the last dump."),
    ],
    88: [
        fig_page("11.7 · Guard layers against double billing", "Guard layers against double billing",
                 "Four independent defences, so that no single mistake produces a duplicate charge.",
                 fig_guard_layers(),
                 "<b>Figure 11.7</b> — Layered defences against double billing, from the data model to the day-close review.",
                 ["A duplicate charge is the failure clients notice fastest and forgive slowest, so the platform does not rely on one control. The data model prevents a delivered line from belonging to two bills; the transaction prevents a bill from existing without consuming its lines; the idempotency key prevents a retry from creating a second document.",
                  "The fourth layer is human and deliberately boring: the day-close review looks for consecutive bills with identical totals. It exists to catch the combinations the first three layers cannot foresee."],
                 "Each layer is also a test in the bill_service suite. A control that is not asserted is a comment, and comments do not survive refactoring."),
    ],
    97: [
        fig_page("13.5 · Alert and escalation flow", "Alert and escalation flow",
                 "From signal to review, with the loop that raises severity when nobody answers.",
                 fig_alert_flow(),
                 "<b>Figure 13.5</b> — Alert lifecycle and the escalation loop when acknowledgement does not happen within target.",
                 ["An alert is only useful if the first action is obvious, so every alert in the catalogue names a likely cause and the first thing to check. The flow above is the path from a signal to a written action, and it is deliberately short.",
                  "The loop at the top is the part that is usually missing: if nobody acknowledges within the target, severity is raised rather than the window quietly extended."],
                 "An alert that fires routinely without action is a design defect. Either the threshold is wrong or the cause should be fixed; leaving it trains people to ignore the one that matters."),
    ],
    101: [
        fig_page("B.2 · Capability heat map", "Capability heat map",
                 "The role matrix as a shape rather than a table.",
                 fig_role_heatmap(),
                 "<b>Figure B.2</b> — Capabilities by role. Filled marks are grants; open marks are read-only or scoped access.",
                 ["Read as a shape, the matrix shows the intended separation: operational entry is broad and shallow, money is narrow and deep, and linen work is confined to the roles that touch linen. Hotel roles sit outside the grid because their access is granted by scope rather than by capability.",
                  "The two capabilities that are never granted to STAFF — payment write and linen write — are the two that change money or remove an asset. That is not an accident of configuration; it is the reason the roles exist in this shape."],
                 "Hiding a control in the interface is not authorisation. Every route re-checks the capability server-side, because a hidden button is one request away from being called."),
    ],
}

# -*- coding: utf-8 -*-
# appended to build_book.py — flow engine

import subprocess
import tempfile

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

VOID = set(["br", "img", "hr", "meta", "link", "input", "circle", "path", "line", "rect",
            "polygon", "polyline", "marker", "text", "use"])


def blocks_of(html):
    """Split a body into top-level elements."""
    res = []
    depth = 0
    start = None
    for m in re.finditer(r"<(/?)([a-zA-Z0-9]+)([^>]*?)(/?)>", html):
        tag = m.group(2).lower()
        closing = m.group(1) == "/"
        selfclose = m.group(4) == "/"
        if tag in ("br", "img", "hr", "meta", "link", "input"):
            continue
        if not closing and not selfclose:
            if depth == 0:
                start = m.start()
            depth += 1
        elif closing:
            depth -= 1
            if depth == 0 and start is not None:
                res.append(html[start:m.end()].strip())
                start = None
    return [x for x in res if x]


# ---------------------------------------------------------------- sections
SECTIONS = []


def add_section(kind, ch, kicker, title, lede, body, **extra):
    SECTIONS.append(dict(idx=len(SECTIONS), kind=kind, ch=ch, kicker=kicker, title=title,
                         lede=lede, body=body, **extra))


for ch in CHAPTERS:
    if ch.get("synthetic"):
        add_section("opener", ch, "Appendices", ch["title"], ch["lede"], "")
    else:
        k, ti, le, rest = split_header(source_body(ch["first"]))
        add_section("opener", ch, k, ti, le, rest, src=ch["first"])
    for n in range(ch["first"] + (0 if ch.get("synthetic") else 1), ch["last"] + 1):
        k, ti, le, rest = split_header(source_body(n))
        add_section("section", ch, k, ti, le, rest, src=n)
    for extra in NEW.get(ch["last"], []):
        add_section("section", ch, extra["kicker"], extra["title"], "", extra["body"], new=True)

SRC_IDS = [s["src"] for s in SECTIONS if s.get("src")]
assert sorted(SRC_IDS) == list(range(6, 106)), "source pages missing or duplicated"

# ---------------------------------------------------------------- figure/table numbering
FIG_RE = re.compile(r"Figure ([0-9A-F]+\.\d+)")
TAB_RE = re.compile(r"Table ([0-9A-F]+\.\d+)")
FIG_MAP, TAB_MAP = {}, {}


def renumber(html):
    def f(m):
        lab = m.group(1)
        if lab not in FIG_MAP:
            FIG_MAP[lab] = len(FIG_MAP) + 1
        return "Figure %d" % FIG_MAP[lab]

    def t(m):
        lab = m.group(1)
        if lab not in TAB_MAP:
            TAB_MAP[lab] = len(TAB_MAP) + 1
        return "Table %d" % TAB_MAP[lab]

    html = FIG_RE.sub(f, html)
    return TAB_RE.sub(t, html)


CAP_PREFIX = re.compile(r'(<caption><span class="n">)(?!Table )([0-9A-F]+\.[0-9]+)(</span>)')
for s in SECTIONS:
    s["body"] = CAP_PREFIX.sub(r'\1Table \2\3', s["body"])
    s["body"] = renumber(s["body"])
    s["lede"] = renumber(s["lede"])
    s["title"] = renumber(s["title"])

# ---------------------------------------------------------------- block model
FLOW = []  # (block_html, section_idx, kind)
for s in SECTIONS:
    if s["kind"] == "opener":
        FLOW.append(("<OPENERHEAD:%d>" % s["idx"], s["idx"], "openerhead"))
    for b in blocks_of(s["body"]):
        kind = "block"
        if b.startswith("<h2"):
            kind = "h2"
        elif b.startswith("<h3"):
            kind = "h3"
        elif b.startswith("<figure"):
            kind = "figure"
        elif b.startswith("<table"):
            kind = "table"
        FLOW.append((b, s["idx"], kind))
    if s["kind"] == "section":
        FLOW.append(("<SECHEAD:%d>" % s["idx"], s["idx"], "sechead"))

# order: sechead must come before its blocks
ordered = []
i = 0
for s in SECTIONS:
    if s["kind"] == "section":
        ordered.append(("<SECHEAD:%d>" % s["idx"], s["idx"], "sechead"))
    for b in blocks_of(s["body"]):
        kind = "block"
        if b.startswith("<h2"):
            kind = "h2"
        elif b.startswith("<h3"):
            kind = "h3"
        elif b.startswith("<figure"):
            kind = "figure"
        elif b.startswith("<table"):
            kind = "table"
        ordered.append((b, s["idx"], kind))
    if False:
        pass

# rebuild: opener heads belong to opener sections only
FLOW = []
for s in SECTIONS:
    if s["kind"] == "opener":
        FLOW.append(("<OPENERHEAD:%d>" % s["idx"], s["idx"], "openerhead"))
        for b in blocks_of(s["body"]):
            FLOW.append((b, s["idx"], "block"))
    else:
        FLOW.append(("<SECHEAD:%d>" % s["idx"], s["idx"], "sechead"))
        for b in blocks_of(s["body"]):
            kind = "block"
            if b.startswith("<h2"):
                kind = "h2"
            elif b.startswith("<h3"):
                kind = "h3"
            elif b.startswith("<figure"):
                kind = "figure"
            elif b.startswith("<table"):
                kind = "table"
            FLOW.append((b, s["idx"], kind))


def head_html(s):
    if s["kind"] == "opener":
        num = s["ch"]["num"]
        wm = num if num != "A" else "A"
        return ('<div class="wm">%s</div>'
                '<p class="kicker">Part %s &#183; %s</p>'
                '<h1 class="chap">%s</h1>'
                '<div class="orn"><span class="l"></span><span class="d">&#9670;</span></div>'
                '<p class="epigraph">%s</p>') % (wm, ROMAN[s["ch"]["part"]], s["ch"]["title"], s["title"], s["lede"])
    return '<p class="eyebrow">%s</p><h1 class="chap sect">%s</h1>' % (s["kicker"], s["title"])


# ---------------------------------------------------------------- measurement
def measure():
    parts = ['<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><style>' + CSS +
             '</style></head><body><div id="probe" style="width:170mm">']
    for i, (b, sidx, kind) in enumerate(FLOW):
        sc = SECTIONS[sidx]
        inner = head_html(sc) if kind in ("sechead", "openerhead") else b
        cls = "blk opener" if kind == "openerhead" else "blk"
        parts.append('<div class="%s" data-i="%d">%s</div>' % (cls, i, inner))
    parts.append('</div><pre id="out"></pre>')
    parts.append("""<script>
window.addEventListener('load', function(){
  var els = document.querySelectorAll('#probe .blk');
  var out = [];
  for (var i=0;i<els.length;i++){
    var el = els[i];
    var cs = getComputedStyle(el);
    var h = el.getBoundingClientRect().height + parseFloat(cs.marginTop||0) + parseFloat(cs.marginBottom||0);
    out.push(Math.ceil(h));
  }
  document.getElementById('out').textContent = out.join(',');
});
</script></body></html>""")
    tmp = os.path.join(tempfile.gettempdir(), 'll_measure.html')
    io.open(tmp, 'w', encoding='utf-8', newline='').write(''.join(parts))
    dom = os.path.join(tempfile.gettempdir(), 'll_dom.txt')
    uri = 'file:///' + tmp.replace('\\', '/').replace(' ', '%20')
    cmd = [EDGE, '--headless', '--disable-gpu', '--no-first-run', '--virtual-time-budget=20000',
           '--user-data-dir=' + os.path.join(tempfile.gettempdir(), 'edgebook'), '--dump-dom', uri]
    with open(dom, 'w', encoding='utf-8') as fh:
        subprocess.run(cmd, stdout=fh, stderr=subprocess.DEVNULL, timeout=240)
    doc = io.open(dom, encoding='utf-8', errors='replace').read()
    m = re.search(r'<pre id="out">([\d,]+)</pre>', doc)
    if not m:
        raise SystemExit('measurement failed: %d bytes of DOM' % len(doc))
    vals = [int(x) for x in m.group(1).split(',')]
    if len(vals) != len(FLOW):
        raise SystemExit('measured %d blocks, expected %d' % (len(vals), len(FLOW)))
    return vals


HEIGHTS = measure()

# ---------------------------------------------------------------- packing
PX = 3.779527559  # px per mm
PAGE_BUDGET = 962          # content height for a normal page (px)
OPENER_BUDGET = 962 - 159  # opener loses 42mm to the deep top margin
MIN_AFTER_HEAD = 70        # px of body that must follow a section header
WIDOW_GUARD = 52
TIGHT_PAGES = set()


def pack():
    pages = []
    cur = None

    def flush():
        nonlocal cur
        if cur and cur["blocks"]:
            pages.append(cur)
        cur = None

    for i, (b, sidx, kind) in enumerate(FLOW):
        s = SECTIONS[sidx]
        h = HEIGHTS[i]
        if kind == "openerhead":
            flush()
            cur = dict(kind="opener", ch=s["ch"], sec=sidx, blocks=[], h=0, sections=[sidx],
                       budget=OPENER_BUDGET)
            cur["blocks"].append((head_html(s), "openerhead", sidx))
            cur["h"] += h
            continue
        if cur is None:
            cur = dict(kind="flow", ch=s["ch"], sec=sidx, blocks=[], h=0, sections=[],
                       budget=PAGE_BUDGET)
        need = h
        if kind == "sechead":
            nxt = HEIGHTS[i + 1] if i + 1 < len(HEIGHTS) else 0
            need = h + min(nxt, MIN_AFTER_HEAD)
        if kind in ("h2", "h3"):
            nxt = HEIGHTS[i + 1] if i + 1 < len(HEIGHTS) else 0
            need = h + min(nxt, WIDOW_GUARD)
        if cur["h"] + need > cur["budget"] and cur["blocks"]:
            flush()
            cur = dict(kind="flow", ch=s["ch"], sec=sidx, blocks=[], h=0, sections=[],
                       budget=PAGE_BUDGET)
            if kind == "sechead":
                need = h + min(HEIGHTS[i + 1] if i + 1 < len(HEIGHTS) else 0, MIN_AFTER_HEAD)
        top = len(cur["blocks"]) == 0
        cur["blocks"].append((b, kind, sidx))
        cur["h"] += h
        if kind == "sechead":
            cur["sections"].append(sidx)
        if top and kind == "sechead":
            cur["sections"].append(sidx)
    flush()
    return pages


PAGES_FLOW = pack()

# ---------------------------------------------------------------- front matter sizing
SEC_ENTRIES = [s for s in SECTIONS]
TOC_ROWS = 4 + len(CHAPTERS) + len([x for x in SECTIONS if x["kind"] == "section"])
CONTENTS_PAGES = max(3, int(math.ceil(TOC_ROWS / 39.0)))


def count_captions():
    figs, tabs = [], []
    for s in SECTIONS:
        for m in re.finditer(r"<figcaption>.*?<b>Figure (\d+)</b>\s*&#8212;|—\s*(.*?)</figcaption>", s["body"], re.S):
            pass
    return figs, tabs


FIGS, TABS = [], []
for s in SECTIONS:
    for m in re.finditer(r"<figcaption>(.*?)</figcaption>", s["body"], re.S):
        txt = re.sub(r"<[^>]+>", "", m.group(1)).strip()
        mm = re.match(r"Figure (\d+)\s*[—-]\s*(.*)", txt)
        if mm:
            FIGS.append((int(mm.group(1)), mm.group(2).strip(), s["idx"]))
    for m in re.finditer(r"<caption>(.*?)</caption>", s["body"], re.S):
        txt = re.sub(r"<[^>]+>", "", m.group(1)).strip()
        mm = re.match(r"Table (\d+)\s*[—-]\s*(.*)", txt)
        if mm:
            TABS.append((int(mm.group(1)), mm.group(2).strip(), s["idx"]))

FIGS.sort(key=lambda x: x[0])
TABS.sort(key=lambda x: x[0])
FIG_PAGES = max(1, int(math.ceil(len(FIGS) / 60.0)))
TAB_PAGES = max(1, int(math.ceil(len(TABS) / 96.0)))
FRONT = 7 + CONTENTS_PAGES + FIG_PAGES + TAB_PAGES

# ---------------------------------------------------------------- numbering
num = FRONT
for p in PAGES_FLOW:
    num += 1
    p["num"] = num
    p["id"] = "pp%d" % num

PART_PAGES = {}
TOTAL = FRONT + 4 + len(PAGES_FLOW)
assert 120 <= TOTAL <= 132, "page count %d outside 120-132" % TOTAL
print("blocks %d · flow pages %d · front %d · total %d" % (len(FLOW), len(PAGES_FLOW), FRONT, TOTAL))
print("figures %d · tables %d" % (len(FIGS), len(TABS)))

# -*- coding: utf-8 -*-
# appended to build_book.py — assembly and render

SEC_PAGE = {}
for p in PAGES_FLOW:
    for sidx in p["sections"]:
        if sidx not in SEC_PAGE:
            SEC_PAGE[sidx] = p["num"]

SRC_PAGE = {}
for s in SECTIONS:
    if s.get("src"):
        SRC_PAGE["p%d" % s["src"]] = SEC_PAGE.get(s["idx"], 0)


def resolve(html):
    return re.sub(r"\{\{p:([A-Za-z0-9_]+)\}\}", lambda m: str(SRC_PAGE.get(m.group(1), "?")), html)


def folio_html(n):
    return ('<div class="folio"><span class="dia">&#9670;</span><span class="no">%d</span>'
            '<span class="dia">&#9670;</span></div>' % n)


def rh_html(ch):
    left = "Appendices" if ch["num"] == "A" else "%s &#183; %s" % (ch["num"], ch["title"])
    return '<div class="rh"><span>%s</span><span>LoveLaundry &#8212; System Manual</span></div>' % left


def render_page(p):
    n = p["num"]
    if p["kind"] == "opener":
        blocks = list(p["blocks"])
        head = blocks[0][0]
        if head.startswith("<OPENERHEAD:"):
            head = head_html(SECTIONS[blocks[0][2]])
        rest = []
        dropped = False
        for html, kind, sidx in blocks[1:]:
            if not dropped and html.lstrip().startswith("<p"):
                html = html.replace("<p>", '<p class="dropcap">', 1)
                dropped = True
            rest.append(html)
        return ('<section class="page opener" id="%s">%s<div class="body">%s</div></section>'
                % (p["id"], head, "".join(rest)))
    parts = []
    for html, kind, sidx in p["blocks"]:
        if html.startswith("<SECHEAD:"):
            html = head_html(SECTIONS[sidx])
        parts.append(html)
    body = "".join(parts)
    cls = "page tight" if n in TIGHT_PAGES else "page"
    return '<section class="%s" id="%s">%s%s%s</section>' % (cls, p["id"], rh_html(p["ch"]), body, folio_html(n))


def render_divider(part_id):
    title = dict((a, b) for a, b, c in PARTS)[part_id]
    blurb = dict((a, c) for a, b, c in PARTS)[part_id]
    chs = [(c["num"], c["title"]) for c in CHAPTERS if c["part"] == part_id]
    rows = "".join('<div><span class="n">%s</span><span>%s</span></div>' % (a, b) for a, b in chs)
    return ('<section class="page divider">'
            '<div class="bg"></div><div class="veil"></div>'
            '<div class="inner">'
            '<div class="pnum">%s</div>'
            '<div class="plabel">Part %s</div>'
            '<h2>%s</h2>'
            '<div class="list">%s</div>'
            '</div></section>') % (["I", "II", "III", "IV"][part_id - 1], ROMAN[part_id], title, rows)


# ---------------------------------------------------------------- front matter
def half_title():
    return ('<section class="page" id="pp1"><div class="half">'
            '<div class="mark">LoveLaundry</div><div class="sub">System Manual</div>'
            '<div style="margin-top:14mm;color:#b4692a;font-size:6pt">&#9670;</div></div></section>')


def frontispiece():
    return ('<section class="page frontis" id="pp2">'
            '<img src="%s" alt="Engraved hotel facade with folded linen">'
            '<div class="cap">Frontispiece &#183; The house and its linen, engraved for this manual.</div>'
            '</section>') % COVER_URI


def title_page():
    return ('<section class="page" id="pp3"><div class="titlepage">'
            '<div class="mark">LoveLaundry</div>'
            '<h1>LoveLaundry<em>System Manual</em></h1>'
            '<div class="rule"></div>'
            '<p class="sub">Laundry, Shop, Hotel and Linen Room Operations</p>'
            '<div class="author"><div class="n">Rasindu Dulshan Siriwardhana</div>'
            'BSc. (Hons) Engineering (Computer Engineering) &#8212; Second Class Upper Division<br>'
            'Faculty of Engineering, University of Ruhuna<br>'
            '<span style="font-variant:all-small-caps;letter-spacing:.08em;color:#6d6455">'
            'Role: Developer and Systems Architect</span></div>'
            '<div class="meta">Version 1.0 &#183; 24 October 2026 &#183; LL-SM-001</div>'
            '</div></section>')


def matter_page(n, src_n, eyebrow):
    k, ti, le, rest = split_header(source_body(src_n))
    return ('<section class="page" id="pp%d"><div class="rh"><span>%s</span>'
            '<span>LoveLaundry &#8212; System Manual</span></div>'
            '<p class="eyebrow">%s</p><h1 class="chap">%s</h1>%s%s</section>'
            % (n, eyebrow, eyebrow, ti, rest, folio_html(n)))


def pnum(n, left, eyebrow, title, body):
    return ('<section class="page" id="pp%d"><div class="rh"><span>%s</span>'
            '<span>LoveLaundry &#8212; System Manual</span></div>%s'
            '<h1 class="chap sect">%s</h1>%s%s</section>'
            % (n, left, ('<p class="eyebrow">%s</p>' % eyebrow) if eyebrow else "", title, body, folio_html(n)))


def build_toc():
    rows = []
    for part_id, ptitle, blurb in PARTS:
        rows.append(('<div class="part">Part %s &#183; %s</div>' % (ROMAN[part_id], ptitle), "part"))
        for ch in [c for c in CHAPTERS if c["part"] == part_id]:
            opener = next(s for s in SECTIONS if s["kind"] == "opener" and s["ch"] is ch)
            rows.append(('<div class="ch"><span>%s &#183; %s</span><span class="dots"></span>'
                         '<span class="pg">%d</span></div>' % (ch["num"], ch["title"], SEC_PAGE[opener["idx"]]), "ch"))
            for s in [x for x in SECTIONS if x["kind"] == "section" and x["ch"] is ch]:
                rows.append(('<div class="sec"><span>%s</span><span class="dots"></span>'
                             '<span class="pg">%d</span></div>' % (s["kicker"], SEC_PAGE[s["idx"]]), "sec"))
    per = int(math.ceil(len(rows) / float(CONTENTS_PAGES)))
    out = []
    for i in range(CONTENTS_PAGES):
        chunk = rows[i * per:(i + 1) * per]
        title = "Contents" if i == 0 else "Contents &#8212; continued"
        out.append(pnum(0, "Contents", "", title, '<div class="toc">%s</div>' % "".join(r for r, k in chunk)))
    return out


def build_list(kind):
    items = FIGS if kind == "fig" else TABS
    per_page = 60 if kind == "fig" else 96
    label = "Figures" if kind == "fig" else "Tables"
    chunks = [items[i:i + per_page] for i in range(0, len(items), per_page)]
    out = []
    for i, chunk in enumerate(chunks):
        rows = []
        for numv, text, sidx in chunk:
            tag = ("Figure %d" % numv) if kind == "fig" else ("Table %d" % numv)
            rows.append('<div class="row"><span class="t"><b>%s</b> &#183; %s</span><span class="dots"></span>'
                        '<span class="pg">%d</span></div>' % (tag, text, SEC_PAGE[sidx]))
        title = ("List of Figures" if kind == "fig" else "List of Tables")
        if i:
            title += " &#8212; continued"
        out.append(pnum(0, "List of " + label, "", title,
                        '<div class="lof cols2">%s</div>' % "".join(rows)))
    return out


def matter_split(src_n, eyebrow, marker):
    _, ti, _, rest = split_header(source_body(src_n))
    blocks = blocks_of(rest)
    cut = len(blocks)
    for i, b in enumerate(blocks):
        if marker in b:
            cut = i
            break
    first, second = blocks[:cut], blocks[cut:]
    out = []
    out.append('<section class="page" id="pp0"><div class="rh"><span>%s</span>'
               '<span>LoveLaundry &#8212; System Manual</span></div>'
               '<p class="eyebrow">%s</p><h1 class="chap">%s</h1>%s%s</section>'
               % (eyebrow, eyebrow, ti, "".join(first), folio_html(0)))
    if second:
        out.append('<section class="page" id="pp0"><div class="rh"><span>%s</span>'
                   '<span>LoveLaundry &#8212; System Manual</span></div>'
                   '<p class="eyebrow">%s &#183; continued</p>'
                   '<div class="matter-cont">%s</div>%s</section>'
                   % (eyebrow, eyebrow, "".join(second), folio_html(0)))
    return out


def cover():
    """Front cover: full-bleed artwork, title and author over the engraved sky.

    Unnumbered by design — the printed folios start at 1 on the half-title, which
    is how a bound book is normally paginated.
    """
    return ('<section class="page cover" id="cover">'
            '<img class="art" src="' + COVER_URI + '" alt="Engraved hotel facade with folded linen">'
            '<div class="veil"></div>'
            '<div class="stack">'
            '<div><p class="press">Love Laundry</p>'
            '<h1>System Manual</h1>'
            '<div class="rule"></div>'
            '<p class="sub">Laundry, Shop, Hotel and Linen Room Operations</p></div>'
            '<div class="bottom">'
            '<p class="author">Rasindu Dulshan Siriwardhana'
            '<em>BSc. (Hons) Engineering (Computer Engineering) &#183; Second Class Upper Division'
            '<br>Faculty of Engineering, University of Ruhuna</em></p>'
            '<p class="edition">First Edition &#183; October 2026</p></div>'
            '</div></section>')


FRONT_HTML = [half_title(), frontispiece(), title_page()]
FRONT_HTML += matter_split(2, "Copyright and document control", "Author")
FRONT_HTML += matter_split(3, "Licence", "4. Third-party components")
FRONT_HTML += build_toc()
FRONT_HTML += build_list("fig")
FRONT_HTML += build_list("tab")
fixed = []
for _i, _h in enumerate(FRONT_HTML):
    _n = _i + 1
    _h = _h.replace('id="pp0"', 'id="pp%d"' % _n)
    _h = re.sub(r'(<span class="no">)0(</span>)', r'\g<1>%d\g<2>' % _n, _h)
    fixed.append(_h)
FRONT_HTML = fixed
assert len(FRONT_HTML) == FRONT, "front %d != %d" % (len(FRONT_HTML), FRONT)

# number check: front pages must occupy 1..FRONT
for i, h in enumerate(FRONT_HTML):
    assert 'id="pp%d"' % (i + 1) in h or i < 5, "front page id mismatch at %d" % (i + 1)

body = []
parts_seen = set()
for p in PAGES_FLOW:
    pid = p["ch"]["part"]
    if pid not in parts_seen:
        parts_seen.add(pid)
        body.append(render_divider(pid))
    body.append(render_page(p))

DOC = ('<!DOCTYPE html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n'
       '<title>LoveLaundry &#8212; System Manual</title>\n'
       '<meta name="author" content="Rasindu Dulshan Siriwardhana">\n'
       '<meta name="description" content="LoveLaundry system manual: laundry, shop, hotel and linen room operations.">\n'
       '<style>\n%s\n</style>\n</head>\n<body>\n%s\n</body>\n</html>\n'
       % (CSS, "\n".join([cover()] + FRONT_HTML + body)))
DOC = resolve(DOC)
io.open(OUT, "w", encoding="utf-8", newline="").write(DOC)

count = len(re.findall(r'<section class="page', DOC))
print("front %d · flow %d · dividers 4 · total %d" % (FRONT, len(PAGES_FLOW), count))
print("figures %d · tables %d · bytes %d" % (len(FIGS), len(TABS), len(DOC.encode("utf-8"))))
assert count == TOTAL + 1, "section count %d != planned %d (+cover)" % (count, TOTAL + 1)
assert 121 <= count <= 133, "page count %d outside 121-133" % count
print("OK %d pages" % count)

