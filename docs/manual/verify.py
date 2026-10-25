"""Measure page overflow in Edge and report the worst offender."""
import io, os, re, subprocess, json, sys

D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, "lovelaundry-system-manual.html")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

html = io.open(P, encoding="utf-8").read()
probe = os.path.join(D, "_probe.html")
script = ("<script>window.addEventListener('load',function(){var r=[];"
          "document.querySelectorAll('section.page').forEach(function(s){r.push(s.scrollHeight-s.clientHeight)});"
          "var p=document.createElement('pre');p.id='OVF';p.textContent=JSON.stringify(r);"
          "document.body.appendChild(p)});</script>")
io.open(probe, "w", encoding="utf-8", newline="").write(html.replace("</body>", script + "</body>"))
out = subprocess.run([EDGE, "--headless", "--disable-gpu", "--dump-dom",
                      "file:///" + probe.replace("\\", "/").replace(" ", "%20")],
                     capture_output=True, text=True, encoding="utf-8", errors="replace")
m = re.search(r'<pre id="OVF">(.*?)</pre>', out.stdout, re.S)
os.remove(probe)
if not m:
    print("probe failed"); sys.exit(1)
values = json.loads(m.group(1).replace("&quot;", '"'))
bad = [(i + 1, v) for i, v in enumerate(values) if v > 0]
print("pages:", len(values), "| overflowing:", len(bad), "| worst:", max(values))
if bad:
    print("detail:", bad[:8])
