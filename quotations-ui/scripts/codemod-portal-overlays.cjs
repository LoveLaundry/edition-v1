/**
 * Wrap every `fixed inset-0` overlay in <Portal> so it mounts on <body>.
 *
 * `position: fixed` is only viewport-relative while no ancestor establishes a
 * containing block — and `transform`, `filter`, `perspective`, `contain` and
 * `will-change` all do. Page-level animation wrappers set those, so overlays
 * nested in the page tree centre on the panel instead of the screen.
 *
 * The script parses JSX properly (no regex tag matching) and only touches
 * outermost overlays. Container-relative `absolute inset-0` layers (video
 * previews, sidebar backdrops) are deliberately left alone.
 *
 *   node scripts/codemod-portal-overlays.cjs [--write]
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SRC = path.join(__dirname, '..', 'src');
const WRITE = process.argv.includes('--write');
const SKIP = new Set(['components/ui/dialog.tsx', 'components/ui/portal.tsx', 'components/layout/sidebar.tsx']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function classNameOf(node) {
  const attrs = node.attributes?.properties ?? [];
  for (const attr of attrs) {
    if (
      ts.isJsxAttribute(attr) &&
      attr.name.getText() === 'className' &&
      attr.initializer &&
      ts.isStringLiteral(attr.initializer)
    ) {
      return attr.initializer.text;
    }
  }
  return '';
}

const report = [];

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).replace(/\\/g, '/');
  if (SKIP.has(rel)) continue;

  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('inset-0')) continue;

  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const targets = [];

  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      // Already portalled — do not double-wrap.
      if (node.openingElement.tagName.getText() === 'Portal') return;
      const cls = classNameOf(node.openingElement);
      if (/\bfixed\b/.test(cls) && /\binset-0\b/.test(cls)) {
        targets.push(node); // outermost only: don't descend into it
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (!targets.length) continue;

  let next = text;
  for (const node of targets.sort((a, b) => b.getStart() - a.getStart())) {
    next = next.slice(0, node.getStart()) + '<Portal>' + next.slice(node.getStart());
    next = next.slice(0, node.getEnd() + '<Portal>'.length) + '</Portal>' + next.slice(node.getEnd() + '<Portal>'.length);
  }

  if (!next.includes("components/ui/portal'")) {
    const depth = rel.split('/').length - 1;
    const up = '../'.repeat(depth);
    const lines = next.split('\n');
    const lastImport = lines.reduce((acc, l, i) => (l.startsWith('import ') ? i : acc), 0);
    lines.splice(lastImport + 1, 0, `import { Portal } from '${up}components/ui/portal'`);
    next = lines.join('\n');
  }

  report.push({ file: rel, overlays: targets.length });
  if (WRITE) fs.writeFileSync(file, next, 'utf8');
}

console.log(JSON.stringify({ written: WRITE, files: report, total: report.reduce((n, r) => n + r.overlays, 0) }, null, 2));
