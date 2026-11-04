import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, "..", "public");
const html = readFileSync(resolve(pub, "index.html"), "utf8");
const app = readFileSync(resolve(pub, "app.js"), "utf8");

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`FAIL  ${name}\n      ${error.message}`);
  }
}

/** Build the page and run app.js against it, the way a browser would. */
function page(source = html, options = {}) {
  const dom = new JSDOM(source, {
    url: "https://alexander-cv.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;

  let clipboard = options.clipboard ?? null;
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    get: () => clipboard,
  });
  window.execCommand = options.execCommand ?? (() => false);
  window.print = options.print ?? (() => {});

  window.eval(app);
  return { dom, window, document: window.document };
}

console.log("\nmarkup");

test("the CV reads without JavaScript: every role and bullet is in the HTML", () => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll("[data-period]").length, 2);
  for (const card of doc.querySelectorAll("[data-period]")) {
    assert.ok(card.querySelectorAll(".log li").length >= 4, "each ticket keeps its detail");
  }
  assert.equal(doc.querySelector("h1").textContent.replace(/\s+/g, " ").trim(), "Alexander Andersson");
});

test("the top notice says it is a test build, and links the prompt and the source", () => {
  const dom = new JSDOM(html);
  const notice = dom.window.document.querySelector(".notice");
  assert.ok(notice, "the notice is present");
  assert.match(notice.textContent, /test build/i);
  const hrefs = [...notice.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.ok(hrefs.some((h) => h.endsWith("/guide.md")), "the prompt is linked");
  assert.ok(hrefs.some((h) => h.includes("github.com/1eriklinde/alexander-andersson-cv")), "the source is linked");
});

test("no phone number is published anywhere", () => {
  const dom = new JSDOM(html);
  const text = dom.window.document.body.textContent;
  assert.doesNotMatch(text, /\+46|123 45 67|tel:/);
  assert.equal(dom.window.document.querySelectorAll('a[href^="tel:"]').length, 0);
});

test("every local asset referenced by the page exists on disk", () => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const refs = [
    ...doc.querySelectorAll('link[href], script[src], img[src]'),
  ].map((el) => el.getAttribute("href") || el.getAttribute("src"));

  assert.ok(refs.length >= 3);
  for (const ref of refs) {
    if (/^https?:|^mailto:|^#/.test(ref)) continue;
    const path = resolve(pub, "." + ref);
    assert.ok(existsSync(path), `${ref} is referenced but missing`);
  }
});

test("no inline styles or event handlers (the CSP forbids them)", () => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll("[style]").length, 0);
  assert.equal([...doc.querySelectorAll("*")].filter((el) => [...el.attributes].some((a) => /^on/i.test(a.name))).length, 0);
  assert.equal(doc.querySelectorAll("script:not([src])").length, 0);
});

test("all in-page anchors point at an element that exists", () => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  for (const link of doc.querySelectorAll('a[href^="#"]')) {
    const id = link.getAttribute("href").slice(1);
    assert.ok(doc.getElementById(id), `#${id} is linked but missing`);
  }
});

test("security headers are strict and include no unsafe-inline", () => {
  const headers = readFileSync(resolve(pub, "_headers"), "utf8");
  const csp = headers.split("\n").find((line) => /Content-Security-Policy:/i.test(line));
  assert.ok(csp, "CSP line is present");
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
});

test("app.js never writes HTML", () => {
  assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
});

console.log("\nbehaviour");

test("all roles show first, and the count says so", () => {
  const { document } = page();
  const cards = [...document.querySelectorAll("[data-period]")];
  assert.equal(cards.filter((c) => !c.hidden).length, 2);
  assert.equal(document.querySelector("[data-count]").textContent, "2 of 2");
  assert.equal(document.querySelector('[data-filter="all"]').getAttribute("aria-pressed"), "true");
});

test("filtering to past hides the current role and updates the count", () => {
  const { document } = page();
  document.querySelector('[data-filter="past"]').click();

  const current = document.querySelector('[data-period="current"]');
  const past = document.querySelector('[data-period="past"]');
  assert.equal(current.hidden, true);
  assert.equal(past.hidden, false);
  assert.equal(document.querySelector("[data-count]").textContent, "1 of 2");
  assert.equal(document.querySelector('[data-filter="past"]').getAttribute("aria-pressed"), "true");
  assert.equal(document.querySelector('[data-filter="all"]').getAttribute("aria-pressed"), "false");
  assert.equal(document.querySelector("[data-empty]").hidden, true);
});

test("going back to all restores both roles", () => {
  const { document } = page();
  document.querySelector('[data-filter="past"]').click();
  document.querySelector('[data-filter="all"]').click();
  assert.equal([...document.querySelectorAll("[data-period]")].filter((c) => !c.hidden).length, 2);
  assert.equal(document.querySelector("[data-count]").textContent, "2 of 2");
});

test("copying the email writes the address and confirms it", async () => {
  const written = [];
  const { document } = page(html, {
    clipboard: { writeText: (value) => (written.push(value), Promise.resolve()) },
  });
  await document.querySelector("[data-copy]").click();
  await new Promise((r) => setTimeout(r, 0));

  assert.deepEqual(written, ["alexander.andersson@email.com"]);
  assert.equal(document.querySelector(".live").textContent, "Email address copied.");
});

test("copy falls back when the clipboard API is refused", async () => {
  const { document } = page(html, {
    clipboard: { writeText: () => Promise.reject(new Error("denied")) },
    execCommand: () => true,
  });
  await document.querySelector("[data-copy]").click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(document.querySelector(".live").textContent, "Email address copied.");
  assert.equal(document.querySelectorAll("textarea").length, 0, "the fallback field is cleaned up");
});

test("copy reports failure instead of pretending", async () => {
  const { document } = page(html, {
    clipboard: { writeText: () => Promise.reject(new Error("denied")) },
    execCommand: () => false,
  });
  await document.querySelector("[data-copy]").click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(document.querySelector(".live").textContent, "Could not copy — use the email link.");
});

test("the copy and print buttons stay hidden until the script reveals them", () => {
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelector("[data-copy]").hidden, true);
  assert.equal(dom.window.document.querySelector("[data-print]").hidden, true);

  const { document } = page();
  assert.equal(document.querySelector("[data-copy]").hidden, false);
  assert.equal(document.querySelector("[data-print]").hidden, false);
});

test("the print button asks the browser to print", () => {
  let printed = 0;
  const { document } = page(html, { print: () => { printed += 1; } });
  document.querySelector("[data-print]").click();
  assert.equal(printed, 1);
});

test("loading app.js into a page without its elements does not throw", () => {
  const bare = readFileSync(resolve(pub, "404.html"), "utf8");
  assert.doesNotThrow(() => page(bare));
});

test("a filter with no matching roles shows the empty state", () => {
  const noCurrent = html.replace('data-period="current"', 'data-period="past"');
  const { document } = page(noCurrent);
  document.querySelector('[data-filter="current"]').click();

  assert.equal([...document.querySelectorAll("[data-period]")].filter((c) => !c.hidden).length, 0);
  assert.equal(document.querySelector("[data-empty]").hidden, false);
  assert.equal(document.querySelector("[data-count]").textContent, "0 of 2");
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const { error } of failures) console.error(error);
  process.exit(1);
}
process.exit(0);
