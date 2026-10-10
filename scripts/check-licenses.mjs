#!/usr/bin/env node
// License gate (ADR-002): ZFunnel is a proprietary SaaS, so production dependencies
// must be permissively licensed. Anything else needs a reviewed, documented exception.
import { execFileSync } from "node:child_process";

const ALLOWED = new Set([
  "MIT",
  "MIT-0",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "BlueOak-1.0.0",
  "Python-2.0",
  "Unlicense",
  "CC0-1.0",
]);

/** Reviewed exceptions: package name → why it is acceptable. */
const EXCEPTIONS = {
  "@img/sharp-libvips-linux-x64":
    "LGPL-3.0, dynamically linked prebuilt binary used unmodified by Next.js image optimization.",
  "@img/sharp-libvips-linuxmusl-x64": "LGPL-3.0, same as above (Alpine builds).",
  "@img/sharp-libvips-linux-arm64": "LGPL-3.0, same as above (ARM builds).",
  "@img/sharp-libvips-darwin-arm64": "LGPL-3.0, same as above (macOS dev machines).",
  "@img/sharp-libvips-darwin-x64": "LGPL-3.0, same as above (macOS dev machines).",
  lightningcss: "MPL-2.0 (file-level copyleft), used unmodified by Tailwind CSS at build time.",
  "caniuse-lite": "CC-BY-4.0 browser-support data, attribution only.",
};
const exceptionPattern = /^(lightningcss-|@img\/sharp-libvips-)/;

const out = execFileSync("pnpm", ["licenses", "list", "--json", "--prod", "--recursive"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const byLicense = JSON.parse(out);

const violations = [];
let count = 0;
for (const [license, pkgs] of Object.entries(byLicense)) {
  for (const pkg of pkgs) {
    count++;
    const ok =
      license.split(/\s+OR\s+|[()]/).some((l) => ALLOWED.has(l.trim())) ||
      pkg.name in EXCEPTIONS ||
      exceptionPattern.test(pkg.name);
    if (!ok) violations.push(`${pkg.name}@${pkg.versions.join(",")} — ${license}`);
  }
}

if (violations.length) {
  console.error(
    `✖ ${violations.length} production dependenc${violations.length === 1 ? "y has" : "ies have"} a disallowed license:\n`,
  );
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    "\nSee docs/REPO_RESEARCH.md. Replace the package, or add a reviewed exception in scripts/check-licenses.mjs.",
  );
  process.exit(1);
}
console.log(`✓ ${count} production packages checked, all licenses allowed.`);
