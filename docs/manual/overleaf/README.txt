LoveLaundry System Manual — Overleaf project

HOW TO COMPILE
1. Upload lovelaundry-manual-overleaf.zip at overleaf.com -> New Project -> Upload Project.
2. In Menu -> Compiler choose XeLaTeX (needed for fontspec; LuaLaTeX also works).
   PDFLaTeX will fail, because fontspec requires XeTeX or LuaTeX.
3. Compile twice so the table of contents and page references settle.

FONTS
Spectral is used when it is installed. Overleaf ships it in most TeX Live
images; if it is missing the document falls back to TeX Gyre Pagella and still
compiles. To force Spectral, add Spectral .otf files to the project and set
\setmainfont{Spectral.otf} in main.tex.

FILES
  main.tex          the whole book: 4 parts, 14 chapters, 24 figures, 93 tables
  images/           figures 1-24 (PNG, 2x) and the cover artwork

FIDELITY
This is a re-typeset edition, not a copy of the PDF. LaTeX reflows the text, so
page breaks differ from the 133-page PDF; wording, structure, tables, callouts
and figures are all preserved.
