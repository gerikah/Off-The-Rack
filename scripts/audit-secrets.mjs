// Conservative pattern scan; reports locations and credential kinds, never values.
import { execFileSync } from "node:child_process";
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const history = git(
  "log",
  "--all",
  "-p",
  "--format=COMMIT:%H",
  "--",
  ".",
  " :(exclude)package-lock.json".trim(),
);
const tracked = git(
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
)
  .split("\0")
  .filter(Boolean);
const { readFileSync } = await import("node:fs");
const findings = [];
function inspect(text, location) {
  for (const [kind, regex] of [
    ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{15,}/g],
    ["Resend key", /re_[A-Za-z0-9_]{24,}/g],
    ["OpenAI key", /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g],
    ["GitHub token", /gh[pousr]_[A-Za-z0-9]{30,}/g],
    ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ])
    if (regex.test(text)) findings.push({ location, kind });
  for (const token of text.match(
    /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  ) || []) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString(),
      );
      if (payload.role === "service_role")
        findings.push({ location, kind: "Supabase service-role JWT" });
    } catch {
      /* Not a JWT. */
    }
  }
}
let revision = "",
  path = "";
for (const line of history.split("\n")) {
  if (line.startsWith("COMMIT:")) revision = line.slice(7);
  if (line.startsWith("+++ b/")) path = line.slice(6);
  if (line.startsWith("+") || line.startsWith("-"))
    inspect(line, revision + ":" + path);
}
for (const path of tracked) {
  try {
    inspect(readFileSync(path, "utf8"), "working tree:" + path);
  } catch {
    /* Deleted file. */
  }
}
const unique = [
  ...new Map(findings.map((f) => [f.location + f.kind, f])).values(),
];
console.log(
  JSON.stringify(
    {
      revisions: git("rev-list", "--all", "--count").trim(),
      scannedFiles: tracked.length,
      findings: unique,
      limitation:
        "Pattern scan cannot prove absence of every kind of secret; public/publishable keys are intentionally not findings.",
    },
    null,
    2,
  ),
);
if (unique.length) process.exitCode = 1;
