// Promote the newest uploaded Worker version to production.
//
// `wrangler versions deploy --yes` accepts prompts but still needs a version
// id, so this reads the list, picks the most recent upload, and names it.
import { execFileSync } from "node:child_process";

function wrangler(args, opts = {}) {
  return execFileSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...opts,
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

let raw;
try {
  raw = wrangler(["versions", "list", "--json"]);
} catch (error) {
  fail(`Could not list versions: ${error.message}`);
}

// Wrangler may print log lines around the JSON payload; take the array.
const start = raw.indexOf("[");
const end = raw.lastIndexOf("]");
if (start === -1 || end === -1) fail(`Unexpected wrangler output:\n${raw}`);

const versions = JSON.parse(raw.slice(start, end + 1)).filter((v) => v && v.id);
if (!versions.length) fail("No uploaded versions found — run `wrangler versions upload` first.");

const created = (v) => Date.parse(v.metadata?.created_on ?? v.created_on ?? 0) || 0;
versions.sort((a, b) => created(b) - created(a));
const newest = versions[0];

console.log(`Promoting version ${newest.id} (uploaded ${newest.metadata?.created_on ?? "unknown"})`);

execFileSync("npx", ["wrangler", "versions", "deploy", newest.id, "--yes"], {
  stdio: "inherit",
});
