"""Cross-check the paths the apps call against the routes the services expose.

Static on purpose: it needs no database, so it can run in CI. A path that an app
calls but no service serves is the class of bug that only shows up as a 404 in
production, after a deploy.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APPS = ["shop-app", "hotel-app", "linen-room-app"]

USER_SRC = [
    os.path.join(ROOT, "user-service", "src", "user_service", "main.py"),
]
BILL_DIR = os.path.join(ROOT, "bill_service", "src", "bill_service", "routers")
BILL_SRC = [os.path.join(BILL_DIR, f) for f in os.listdir(BILL_DIR) if f.endswith(".py")]


def read(path):
    with open(path, encoding="utf-8", errors="replace") as handle:
        return handle.read()


def service_routes():
    """Map path -> service for every route the backends declare."""
    routes = {}
    for path in USER_SRC:
        src = read(path)
        for match in re.finditer(r'@app\.(get|post|put|patch|delete)\("([^"]+)"', src):
            routes[norm(match.group(2))] = "user-service"
    for path in BILL_SRC:
        src = read(path)
        prefix = re.search(r'APIRouter\([^)]*prefix="([^"]*)"', src)
        prefix = prefix.group(1) if prefix else ""
        for match in re.finditer(r'@router\.(get|post|put|patch|delete)\("([^"]*)"', src):
            routes[norm(prefix + match.group(2))] = "bill_service"
    return routes


def norm(path):
    # A TS template literal writes ${id}; a FastAPI route writes {bill_id}.
    # Both collapse to {} so the two can be compared.
    path = re.sub(r"\$\{[^}]*\}", "{}", path.strip())
    path = re.sub(r"\{[^}]*\}", "{}", path)
    path = re.sub(r"/+", "/", path)
    return path.rstrip("/").lower() or "/"


def app_calls(app):
    """(service, path) pairs the app calls, with the file they came from."""
    calls = []
    base = os.path.join(ROOT, app, "src")
    for folder, _, files in os.walk(base):
        for name in files:
            if not name.endswith((".ts", ".tsx")):
                continue
            full = os.path.join(folder, name)
            src = read(full)
            rel = os.path.relpath(full, os.path.join(ROOT, app))
            for match in re.finditer(
                r"""(authApi|dataApi)\s*\.\s*(?:get|post|put|patch|delete)\s*[<(][^)]*?['"`]([^'"`]+)['"`]""",
                src,
            ):
                service = "user-service" if match.group(1) == "authApi" else "bill_service"
                calls.append((service, norm(match.group(2)), rel))
            for match in re.finditer(r"""useQuery<[^>]*>\(\s*['"`]([^'"`]+)['"`]""", src):
                calls.append(("bill_service", norm(match.group(1)), rel))
            for match in re.finditer(r"""useQuery\(\s*['"`]([^'"`]+)['"`]""", src):
                calls.append(("bill_service", norm(match.group(1)), rel))
    # config-declared auth paths
    config = os.path.join(base, "config", "app.ts")
    if os.path.exists(config):
        src = read(config)
        for key in ("loginPath", "statusPath"):
            found = re.search(key + r""":\s*['"]([^'"]+)['"]""", src)
            if found:
                calls.append(("user-service", norm(found.group(1)), "src/config/app.ts"))
    return calls


def main():
    routes = service_routes()
    failures = 0
    for app in APPS:
        print("\n== %s ==" % app)
        seen = set()
        for service, path, where in app_calls(app):
            key = (service, path)
            if key in seen:
                continue
            seen.add(key)
            owner = routes.get(path)
            if owner == service:
                print("  ok    %-34s %s" % (path, service))
            elif owner:
                print("  WRONG %-34s called via %s, served by %s" % (path, service, owner))
                failures += 1
            else:
                print("  MISS  %-34s %s (%s)" % (path, service, where))
                failures += 1
    print("\nproblems: %d" % failures)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
