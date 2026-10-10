"""Regenerates messages/{en,ar}/index.ts from the namespace files in each folder."""
import os
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "messages")
names = sorted(f[:-3] for f in os.listdir(os.path.join(base, "en")) if f.endswith(".ts") and f != "index.ts")
missing = [n for n in names if not os.path.exists(os.path.join(base, "ar", n + ".ts"))]
if missing:
    raise SystemExit(f"Arabic namespace files missing: {missing}")
imports = "".join(f'import {{ {n} }} from "./{n}";\n' for n in names)
body = ", ".join(names)
open(os.path.join(base, "en", "index.ts"), "w").write(f"{imports}\nexport const en = {{ {body} }};\n")
open(os.path.join(base, "ar", "index.ts"), "w").write(
    f'import type {{ Shape }} from "../../core";\nimport type {{ en }} from "../en";\n{imports}\nexport const ar: Shape<typeof en> = {{ {body} }};\n'
)
print("namespaces:", body)
