# alexander-andersson-cv

The CV of Alexander Andersson, IT support specialist in Stockholm, as a static
site. Plain HTML, CSS and JavaScript in `public/` — no framework, no build
step. Deployed to Cloudflare Workers static assets, where asset requests are
unmetered on the free plan.

**Live:** https://alexander-cv.1eriklinde.workers.dev

## Design

The site is a service-desk console, because Jira and ServiceNow are the tools
the work actually happens in. Paper background, ticket cards with IDs and
status chips, priority-style section rules, a serif for prose and a mono for
identifiers and dates. No terminal green, no uptime graphs: those belong to
whoever this page is not about.

The lead is a plain claim the CV supports — five years across two Stockholm
desks — not a metric invented for the page.

## Layout

```
public/
  index.html      the CV; content in the HTML, readable with JS off
  404.html        not-found page, served by not_found_handling: 404-page
  styles.css      all styling, including print
  app.js          optional behaviour: role filter, copy email, print
  _headers        CSP and security headers
  assets/         favicon
  fonts/          self-hosted IBM Plex (serif, sans, mono) — no third-party requests
test/page.test.mjs  jsdom tests: markup, assets, CSP, filter, clipboard
tools/promote.mjs   deploy the newest uploaded version to production
wrangler.jsonc      static asset routing; no Worker script, no `main`
```

## Behaviour

`app.js` is progressive enhancement only:

- filters work history by current/past role,
- copies the email address (clipboard API, with a `execCommand` fallback),
- reveals the print button.

With JavaScript off, every role, bullet and contact link is still in the page
and the CV prints.

## Local work

```bash
npm ci
npm test                 # 17 jsdom tests
npx wrangler dev         # http://localhost:8787
npx wrangler deploy      # production
```

## Deploy pipeline

`.github/workflows/deploy.yml`: `test` on every push and pull request;
`preview` uploads a version and prints its URL in the run summary; `promote`
waits for approval on the protected `production` environment, then deploys the
newest uploaded version.

The Cloudflare steps are skipped when the repository has no
`CLOUDFLARE_API_TOKEN`, so a fresh clone still gets a green test run. Set both
secrets to turn the deploy half on:

- `CLOUDFLARE_ACCOUNT_ID` — from `wrangler whoami`
- `CLOUDFLARE_API_TOKEN` — Edit Cloudflare Workers template at
  dash.cloudflare.com/profile/api-tokens

`gh secret set CLOUDFLARE_API_TOKEN` prompts without echoing the value; never
paste a token into a commit or a shell argument.

## Editing the CV

Edit `public/index.html` directly. Dates live in `.ticket-dates`, roles in
`data-period="current"` / `"past"`, so the filter keeps working. Adding a long
piece (a case study, a write-up) should mean `public/<slug>.html` and its URL
at `/<slug>`, not another section here.
