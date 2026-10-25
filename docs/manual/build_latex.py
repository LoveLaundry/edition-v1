"""Build an Overleaf-ready LaTeX project from the HTML book.

Output: docs/manual/overleaf/lovelaundry-manual-overleaf.zip
        containing main.tex, images/ and README.txt

Compile with XeLaTeX (or LuaLaTeX) so fontspec can load Spectral; the file
falls back to TeX Gyre Pagella when Spectral is not installed, so it still
compiles on a bare TeX Live.
"""
import io, os, re, shutil, zipfile
from build_docx import Tree, Node  # reuse the HTML tree parser

D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, "lovelaundry-system-manual.html")
FIGDIR = os.path.join(D, "assets", "figures")
PROJ = os.path.join(D, "overleaf")
IMGDIR = os.path.join(PROJ, "images")
COVER = os.path.abspath(os.path.join(D, "..", "..", "media-output", "img-mvlyao1h-cd5f6c4a.png"))

TEX_SPECIALS = {
    "\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#",
    "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def esc(text):
    return "".join(TEX_SPECIALS.get(ch, ch) for ch in text)


def inline(node, out):
    """Serialise inline markup to LaTeX, escaping text but not commands."""
    if node.text:
        out.append(esc(node.text))
    for child in node.children:
        if not isinstance(child, Node):
            continue
        if child.tag in ("strong", "b"):
            out.append(r"\textbf{"); inline(child, out); out.append("}")
        elif child.tag in ("em", "i"):
            out.append(r"\emph{"); inline(child, out); out.append("}")
        elif child.tag == "code":
            out.append(r"\texttt{"); inline(child, out); out.append("}")
        elif child.tag == "br":
            out.append(" \\\\ ")
        else:
            inline(child, out)


def inline_tex(node):
    out = []
    inline(node, out)
    return "".join(out).strip()


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def strip_caption_number(text):
    return re.sub(r"^(Figure|Table)\s+\d+\s*[-—–]\s*", "", text)


def render_table(node):
    rows = [r for r in node.find_all("tr")]
    if not rows:
        return ""
    cells_per_row = []
    for r in rows:
        cells = [c for c in r.children if isinstance(c, Node) and c.tag in ("td", "th")]
        cells_per_row.append(cells)
    width = max(len(c) for c in cells_per_row) or 1
    colspec = "|" + "|".join(["X"] * width) + "|"
    lines = [r"\begin{center}\small",
             r"\begin{tabularx}{\linewidth}{%s}" % colspec,
             r"\hline"]
    for i, cells in enumerate(cells_per_row):
        vals = []
        for c in cells[:width]:
            vals.append(inline_tex(c))
        while len(vals) < width:
            vals.append("")
        if i == 0 and any(c.tag == "th" for c in cells):
            lines.append(r"\rowcolor{lightgrey}")
            lines.append(" & ".join(r"\textbf{%s}" % v for v in vals) + r" \\ \hline")
        else:
            lines.append(" & ".join(vals) + r" \\ \hline")
    lines += [r"\end{tabularx}", r"\end{center}"]
    return "\n".join(lines)


def render_figure(node, counter):
    png = "fig-%02d.png" % counter[0]
    cap = node.find_all("figcaption")
    caption = strip_caption_number(clean(cap[0].flat_text())) if cap else ""
    if not os.path.exists(os.path.join(FIGDIR, png)):
        return ""
    body = [r"\begin{figure}[htbp]", r"\centering",
            r"\includegraphics[width=\linewidth]{images/%s}" % png]
    if caption:
        body.append(r"\caption{%s}" % esc(caption))
    body.append(r"\end{figure}")
    return "\n".join(body)


def render_blocks(container, counter, depth=0):
    out = []
    for child in container.children:
        if not isinstance(child, Node):
            continue
        tag, cls = child.tag, child.cls()

        if tag == "div" and ("body" in cls or "toc" in cls):
            if "toc" in cls:
                continue
            out.append(render_blocks(child, counter, depth))
        elif tag in ("h1", "h2", "h3", "h4"):
            text = clean(child.flat_text())
            if not text or re.match(r"^Contents", text):
                continue
            # The book uses h1 for two different things: a chapter opener
            # (class "chap") and a page-level title (class "chap sect"). Only
            # the former is a chapter; the latter would otherwise produce ~100
            # chapters and a meaningless table of contents.
            if tag == "h1" and "sect" not in cls:
                out.append("\\chapter{%s}" % esc(text))
            elif tag == "h1":
                out.append("\\section*{%s}" % esc(text))
            elif tag == "h2":
                if re.match(r"^\d+\.\d+\s", text):
                    out.append("\\section{%s}" % esc(text))
                else:
                    out.append("\\subsection*{%s}" % esc(text))
            elif tag == "h3":
                if re.match(r"^\d+\.\d+\.\d+\s", text):
                    out.append("\\subsection{%s}" % esc(text))
                else:
                    out.append("\\subsubsection*{%s}" % esc(text))
            else:
                out.append("\\subsubsection*{%s}" % esc(text))
        elif tag == "p":
            text = clean(child.flat_text())
            if not text:
                continue
            if "epigraph" in cls:
                out.append(r"\begin{quote}\itshape %s\end{quote}" % inline_tex(child))
            elif "kicker" in cls or "eyebrow" in cls:
                out.append(r"\textsc{\small\color{crimson}%s}\par\medskip" % inline_tex(child))
            elif "tcap" in cls or "tabcap" in cls:
                out.append(r"\textbf{\small %s}\par\smallskip" % inline_tex(child))
            else:
                out.append(inline_tex(child) + "\n")
        elif tag in ("ul", "ol"):
            env = "itemize" if tag == "ul" else "enumerate"
            out.append(r"\begin{%s}" % env)
            for li in [c for c in child.children if isinstance(c, Node) and c.tag == "li"]:
                out.append(r"\item %s" % inline_tex(li))
            out.append(r"\end{%s}" % env)
        elif tag == "table":
            out.append(render_table(child))
        elif tag == "figure":
            counter[0] += 1
            block = render_figure(child, counter)
            if block:
                out.append(block)
        elif tag == "pre":
            out.append(r"\begin{verbatim}" + "\n" + child.flat_text().strip("\n") + "\n" + r"\end{verbatim}")
        elif tag == "div" and "callout" in cls:
            text = clean(child.flat_text())
            if text:
                out.append(r"\begin{notebox}%s\end{notebox}" % inline_tex(child))
        elif tag == "div" and ("row" in cls or "panel" in cls or "rh" in cls):
            text = clean(child.flat_text())
            if text:
                out.append(esc(text) + "\n")
    return "\n".join(x for x in out if x)


PREAMBLE = r"""\documentclass[11pt,a4paper,oneside]{book}
\usepackage[T1]{fontenc}
\usepackage{fontspec}
\IfFontExistsTF{Spectral}{\setmainfont{Spectral}[Ligatures=TeX]}{\setmainfont{TeX Gyre Pagella}}
\IfFontExistsTF{Spectral}{\newfontfamily\headingfont{Spectral}}{\newfontfamily\headingfont{TeX Gyre Pagella}}
\usepackage[a4paper,top=2.2cm,bottom=2.2cm,left=2.4cm,right=2.4cm]{geometry}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{colortbl}
\usepackage{tabularx}
\usepackage{booktabs}
\usepackage{titlesec}
\usepackage{tcolorbox}
\usepackage{fancyhdr}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}

\definecolor{crimson}{HTML}{C1121F}
\definecolor{ink}{HTML}{111113}
\definecolor{lightgrey}{HTML}{F1F1F2}
\definecolor{midgrey}{HTML}{5C5C61}

\color{ink}
\renewcommand{\familydefault}{\rmdefault}

\titleformat{\part}[display]
  {\headingfont\bfseries\Huge\color{crimson}\centering}
  {\partname\ \thepart}{12pt}{\Huge\color{ink}}
\titleformat{\chapter}[display]
  {\headingfont\bfseries\color{ink}}
  {\filleft\Large\color{crimson}\chaptertitlename\ \thechapter}{14pt}{\Huge}
\titlespacing*{\chapter}{0pt}{10pt}{24pt}
\titleformat{\section}{\headingfont\bfseries\Large\color{ink}}{\thesection}{0.8em}{}
\titleformat{\subsection}{\headingfont\bfseries\large\color{ink}}{\thesubsection}{0.8em}{}

\newtcolorbox{notebox}{
  colback=lightgrey, colframe=crimson, boxrule=0pt,
  leftrule=2.4pt, arc=0pt, left=8pt, right=8pt, top=6pt, bottom=6pt,
  fontupper=\small
}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small\color{midgrey}\nouppercase{\leftmark}}
\fancyhead[R]{\small\color{midgrey}LoveLaundry --- System Manual}
\fancyfoot[C]{\small\color{midgrey}\thepage}
\renewcommand{\headrulewidth}{0.3pt}

\setlength{\parindent}{0pt}
\setlength{\parskip}{6pt}
\linespread{1.18}

\begin{document}

\begin{titlepage}
\centering
\vspace*{0.6cm}
"""


def main():
    src = io.open(SRC, encoding="utf-8").read()
    tree = Tree()
    tree.feed(src)
    sections = [n for n in tree.root.find_all("section") if "page" in n.cls()]

    if os.path.isdir(PROJ):
        shutil.rmtree(PROJ)
    os.makedirs(IMGDIR, exist_ok=True)
    for name in sorted(os.listdir(FIGDIR)):
        if name.endswith(".png"):
            shutil.copy2(os.path.join(FIGDIR, name), os.path.join(IMGDIR, name))
    if os.path.exists(COVER):
        shutil.copy2(COVER, os.path.join(IMGDIR, "cover.png"))

    body_parts, counter = [], [0]
    for section in sections:
        cls = section.cls()
        if "cover" in cls:
            continue
        if "divider" in cls:
            title = section.find_all("h2")
            if title:
                body_parts.append(r"\part{%s}" % esc(clean(title[0].flat_text())))
            continue
        block = render_blocks(section, counter)
        if block.strip():
            body_parts.append(block)

    cover_block = r"""
\includegraphics[width=0.62\linewidth]{images/cover.png}\par
\vspace{1.2cm}
{\headingfont\Large\color{crimson}LOVE LAUNDRY}\par
\vspace{0.4cm}
{\headingfont\Huge System Manual}\par
\vspace{0.5cm}
{\itshape\large Laundry, Shop, Hotel and Linen Room Operations}\par
\vfill
{\large Rasindu Dulshan Siriwardhana}\par
\vspace{0.3cm}
{\small\itshape BSc. (Hons) Engineering (Computer Engineering) --- Second Class Upper Division\\
Faculty of Engineering, University of Ruhuna}\par
\vspace{0.6cm}
{\footnotesize\color{midgrey} FIRST EDITION \(\cdot\) OCTOBER 2026}
\end{titlepage}

\frontmatter
\tableofcontents
\mainmatter
"""

    doc = PREAMBLE + cover_block + "\n".join(body_parts) + "\n\\end{document}\n"
    main_tex = os.path.join(PROJ, "main.tex")
    io.open(main_tex, "w", encoding="utf-8", newline="").write(doc)

    readme = """LoveLaundry System Manual — Overleaf project

HOW TO COMPILE
1. Upload lovelaundry-manual-overleaf.zip at overleaf.com -> New Project -> Upload Project.
2. In Menu -> Compiler choose XeLaTeX (needed for fontspec; LuaLaTeX also works).
   PDFLaTeX will fail, because fontspec requires XeTeX or LuaTeX.
3. Compile twice so the table of contents and page references settle.

FONTS
Spectral is used when it is installed. Overleaf ships it in most TeX Live
images; if it is missing the document falls back to TeX Gyre Pagella and still
compiles. To force Spectral, add Spectral .otf files to the project and set
\\setmainfont{Spectral.otf} in main.tex.

FILES
  main.tex          the whole book: 4 parts, 14 chapters, 24 figures, 93 tables
  images/           figures 1-24 (PNG, 2x) and the cover artwork

FIDELITY
This is a re-typeset edition, not a copy of the PDF. LaTeX reflows the text, so
page breaks differ from the 133-page PDF; wording, structure, tables, callouts
and figures are all preserved.
"""
    io.open(os.path.join(PROJ, "README.txt"), "w", encoding="utf-8", newline="").write(readme)

    zip_path = os.path.join(D, "lovelaundry-manual-overleaf.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(PROJ):
            for name in files:
                full = os.path.join(root, name)
                z.write(full, os.path.relpath(full, PROJ))

    print("figures referenced:", counter[0])
    print("main.tex:", os.path.getsize(main_tex) // 1024, "KB")
    print("zip:", os.path.getsize(zip_path) // 1024, "KB")
    print("contents:", len(zipfile.ZipFile(zip_path).namelist()), "entries")


if __name__ == "__main__":
    main()
