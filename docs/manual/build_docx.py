"""Build a Word edition of the manual from the HTML book.

Fidelity note: Word cannot reproduce the fixed A4 page grid of the PDF, so this
edition reflows. Structure, wording, tables, callouts and figures are all
carried over; exact page breaks are not.
"""
import io, os, re, json
from html.parser import HTMLParser

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, "lovelaundry-system-manual.html")
FIGDIR = os.path.join(D, "assets", "figures")
OUT = os.path.join(D, "lovelaundry-system-manual.docx")

INK = RGBColor(0x11, 0x11, 0x13)
RED = RGBColor(0xC1, 0x12, 0x1F)
GREY = RGBColor(0x5C, 0x5C, 0x61)

VOID = {"br", "img", "hr", "meta", "link", "input"}


class Node:
    __slots__ = ("tag", "attrs", "children", "text")

    def __init__(self, tag, attrs=None):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.children = []
        self.text = ""

    def cls(self):
        return self.attrs.get("class", "")

    def find_all(self, tag=None):
        out = []
        for c in self.children:
            if isinstance(c, Node):
                if tag is None or c.tag == tag:
                    out.append(c)
                out.extend(c.find_all(tag))
        return out

    def flat_text(self):
        parts = [self.text]
        for c in self.children:
            parts.append(c.flat_text() if isinstance(c, Node) else "")
        return "".join(parts)


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1].text += data


def shade(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    el = OxmlElement("w:shd")
    el.set(qn("w:val"), "clear")
    el.set(qn("w:fill"), hex_color)
    tcPr.append(el)


def left_border(paragraph, color="C1121F", size=18):
    pPr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), str(size))
    left.set(qn("w:space"), "8")
    left.set(qn("w:color"), color)
    borders.append(left)
    pPr.append(borders)


def add_runs(paragraph, node, bold=False, italic=False, mono=False):
    """Copy inline markup into a paragraph, honouring <strong>/<em>/<code>."""
    if node.text:
        run = paragraph.add_run(node.text)
        run.bold = bold
        run.italic = italic
        if mono:
            run.font.name = "Consolas"
            run.font.size = Pt(9)
    for child in node.children:
        if not isinstance(child, Node):
            continue
        if child.tag == "strong" or child.tag == "b":
            add_runs(paragraph, child, True, italic, mono)
        elif child.tag == "em" or child.tag == "i":
            add_runs(paragraph, child, bold, True, mono)
        elif child.tag == "code":
            add_runs(paragraph, child, bold, italic, True)
        elif child.tag == "br":
            paragraph.add_run().add_break()
        else:
            add_runs(paragraph, child, bold, italic, mono)


def setup(doc):
    normal = doc.styles["Normal"]
    normal.font.name = "Spectral"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.35

    for name, size, color in (("Heading 1", 20, RED), ("Heading 2", 13, INK), ("Heading 3", 11, INK)):
        style = doc.styles[name]
        style.font.name = "Spectral"
        style.font.size = Pt(size)
        style.font.color.rgb = color
        style.font.bold = name != "Heading 1"
        style.paragraph_format.space_before = Pt(14)
        style.paragraph_format.space_after = Pt(6)

    section = doc.sections[0]
    section.page_height = Cm(29.7)
    section.page_width = Cm(21)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)


def footer_page_numbers(doc):
    paragraph = doc.sections[0].footer.paragraphs[0]
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run()
    for element, attrs, text in ((("w:fldChar",), {"w:fldCharType": "begin"}, None),
                                 (("w:instrText",), {"xml:space": "preserve"}, "PAGE"),
                                 (("w:fldChar",), {"w:fldCharType": "end"}, None)):
        el = OxmlElement(element[0])
        for k, v in attrs.items():
            el.set(qn(k) if ":" in k else k, v)
        if text:
            el.text = text
        run._r.append(el)
    run.font.size = Pt(9)
    run.font.color.rgb = GREY


def render_table(doc, table_node):
    rows = table_node.find_all("tr")
    if not rows:
        return
    width = max(len(r.find_all("td")) + len(r.find_all("th")) for r in rows) or 1
    table = doc.add_table(rows=0, cols=width)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row in rows:
        cells = row.find_all("td") + row.find_all("th")
        cells.sort(key=lambda c: -1)  # keep document order
        ordered = [c for c in row.children if isinstance(c, Node) and c.tag in ("td", "th")]
        values = [c for c in ordered]
        word_row = table.add_row().cells
        for i, cell_node in enumerate(values[:width]):
            para = word_row[i].paragraphs[0]
            text = re.sub(r"\s+", " ", cell_node.flat_text()).strip()
            run = para.add_run(text)
            run.font.size = Pt(9)
            if cell_node.tag == "th":
                run.bold = True
                shade(word_row[i], "F1F1F2")
    doc.add_paragraph()


def render_figure(doc, fig_node, index):
    svg = fig_node.find_all("svg")
    svg_id = None
    n = fig_node.attrs.get("data-fig")
    caption_node = fig_node.find_all("figcaption")
    caption = re.sub(r"\s+", " ", caption_node[0].flat_text()).strip() if caption_node else ""
    # figures are numbered in document order; match the rasterised file list
    png = os.path.join(FIGDIR, "fig-%02d.png" % index)
    if os.path.exists(png):
        doc.add_picture(png, width=Cm(15.8))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    if caption:
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = para.add_run(caption)
        run.italic = True
        run.font.size = Pt(8.5)
        run.font.color.rgb = GREY


def render_blocks(doc, container, fig_counter):
    for child in container.children:
        if not isinstance(child, Node):
            continue
        tag, cls = child.tag, child.cls()

        if tag in ("h1", "h2", "h3"):
            level = {"h1": 1, "h2": 2, "h3": 3}[tag]
            text = re.sub(r"\s+", " ", child.flat_text()).strip()
            if text:
                doc.add_heading(text, level=level)
        elif tag == "p":
            text = child.flat_text().strip()
            if not text:
                continue
            para = doc.add_paragraph()
            if "epigraph" in cls:
                para.alignment = WD_ALIGN_PARAGRAPH.LEFT
                add_runs(para, child, italic=True)
                for run in para.runs:
                    run.font.color.rgb = GREY
                    run.font.size = Pt(11)
            elif "kicker" in cls or "eyebrow" in cls:
                add_runs(para, child)
                for run in para.runs:
                    run.font.size = Pt(8)
                    run.font.color.rgb = RED
            else:
                para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                add_runs(para, child)
        elif tag in ("ul", "ol"):
            style = "List Bullet" if tag == "ul" else "List Number"
            for li in [c for c in child.children if isinstance(c, Node) and c.tag == "li"]:
                para = doc.add_paragraph(style=style)
                add_runs(para, li)
        elif tag == "table":
            render_table(doc, child)
        elif tag == "figure":
            fig_counter[0] += 1
            render_figure(doc, child, fig_counter[0])
        elif tag == "pre":
            para = doc.add_paragraph()
            run = para.add_run(child.flat_text().strip("\n"))
            run.font.name = "Consolas"
            run.font.size = Pt(8.5)
            shade_para(para, "F4F4F5")
        elif tag == "div" and "callout" in cls:
            text = re.sub(r"\s+", " ", child.flat_text()).strip()
            if not text:
                continue
            para = doc.add_paragraph()
            add_runs(para, child)
            left_border(para)
            for run in para.runs:
                run.font.size = Pt(9.5)
        elif tag == "div" and "body" in cls:
            render_blocks(doc, child, fig_counter)
        elif tag == "div" and ("row" in cls or "panel" in cls):
            text = re.sub(r"\s+", " ", child.flat_text()).strip()
            if text:
                doc.add_paragraph(text)


def shade_para(paragraph, hex_color):
    pPr = paragraph._p.get_or_add_pPr()
    el = OxmlElement("w:shd")
    el.set(qn("w:val"), "clear")
    el.set(qn("w:fill"), hex_color)
    pPr.append(el)


def main():
    src = io.open(SRC, encoding="utf-8").read()
    tree = Tree()
    tree.feed(src)

    sections = [n for n in tree.root.find_all("section") if "page" in n.cls()]
    doc = Document()
    setup(doc)
    footer_page_numbers(doc)

    # cover page
    cover_png = os.path.join(D, "..", "..", "media-output", "img-mvlyao1h-cd5f6c4a.png")
    if os.path.exists(cover_png):
        doc.add_picture(os.path.abspath(cover_png), width=Cm(9.6))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    for text, size, color, bold in (
        ("LOVE LAUNDRY", 9, RED, False),
        ("System Manual", 26, INK, False),
        ("Laundry, Shop, Hotel and Linen Room Operations", 11.5, GREY, False),
        ("", 10, INK, False),
        ("Rasindu Dulshan Siriwardhana", 12, INK, True),
        ("BSc. (Hons) Engineering (Computer Engineering) · Second Class Upper Division", 9.5, GREY, False),
        ("Faculty of Engineering, University of Ruhuna", 9.5, GREY, False),
        ("First Edition · October 2026", 9, GREY, False),
    ):
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = para.add_run(text)
        run.font.size = Pt(size)
        run.font.color.rgb = color
        run.bold = bold

    fig_counter = [0]
    first = True
    for section in sections:
        if "cover" in section.cls():
            continue
        if not first:
            doc.add_page_break()
        first = False
        render_blocks(doc, section, fig_counter)

    doc.save(OUT)
    print("figures placed:", fig_counter[0])
    print("saved:", OUT, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    main()
