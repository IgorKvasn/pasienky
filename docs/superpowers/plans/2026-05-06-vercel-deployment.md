# Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Pasienky app (Angular frontend + Express API) to Vercel as a single project — static frontend served from `client/dist/client/browser`, API routes handled by a single serverless function at `api/index.ts`.

**Architecture:** Angular builds to static files. The Express app runs as a Vercel serverless function via `api/index.ts`, which imports server code directly. Playwright is replaced with `playwright-core` + `@sparticuz/chromium` for the SharePoint download (serverless-compatible headless browser). All routing goes through `vercel.json` rewrites: `/api/*` → serverless function, everything else → `index.html` (Angular SPA).

**Tech Stack:** Angular 21, Express 5, TypeScript, playwright-core, @sparticuz/chromium, pg, Vercel serverless functions

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add all server production deps so Vercel can resolve them from root |
| `server/package.json` | Modify | Replace `playwright` with `playwright-core` + `@sparticuz/chromium` |
| `server/src/source/sharepointDownload.ts` | Modify | Use `playwright-core` + `@sparticuz/chromium` instead of `playwright` |
| `api/index.ts` | Modify | Remove `dotenv/config` import (Vercel injects env vars natively) |
| `vercel.json` | Modify | Add memory (1024MB), maxDuration (60s), node version |

---

### Task 1: Replace Playwright with playwright-core + @sparticuz/chromium

The `sharepointDownload.ts` file currently imports `chromium` from the full `playwright` package. Vercel serverless functions have a 50MB compressed size limit — the full Playwright + Chromium bundle exceeds 280MB. The solution from the ZenRows article: use `playwright-core` (no bundled browser) + `@sparticuz/chromium` (a pre-compressed Chromium binary that decompresses to `/tmp` at runtime, fits within serverless limits).

**Files:**
- Modify: `server/package.json` — swap `playwright` for `playwright-core` + `@sparticuz/chromium`
- Modify: `server/src/source/sharepointDownload.ts` — use `playwright-core` launch with `@sparticuz/chromium` args and executablePath

- [ ] **Step 1: Update server/package.json dependencies**

Replace `playwright` with `playwright-core` and `@sparticuz/chromium` in `server/package.json`. Both must be production dependencies (not dev), because the serverless function needs them at runtime.

In `server/package.json`, change the dependencies section:

```json
"dependencies": {
    "cheerio": "^1.2.0",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "pg": "^8.20.0",
    "playwright-core": "^1.52.0",
    "@sparticuz/chromium": "^133.0.0",
    "xlsx": "^0.18.5"
}
```

Remove `playwright`, add `playwright-core` and `@sparticuz/chromium`.

- [ ] **Step 2: Rewrite sharepointDownload.ts for serverless**

Replace the contents of `server/src/source/sharepointDownload.ts` with:

```typescript
import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium } from 'playwright-core';

export async function downloadSharePointWorkbook(shareUrl: string): Promise<Buffer> {
  chromium.setGraphicsMode = false;

  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true
  });

  try {
    const page = await browser.newPage();
    await page.goto(shareUrl, { waitUntil: 'networkidle', timeout: 60000 });

    const excelFrame = page.frames().find(f => f.url().includes('officeapps.live.com'));
    if (!excelFrame) {
      throw new Error('Excel Online viewer frame not found — the share link may be invalid or expired');
    }

    await excelFrame.locator('text=Súbor').first().click();
    await page.waitForTimeout(1000);
    await excelFrame.locator('text=Vytvoriť kópiu').first().click();
    await page.waitForTimeout(1000);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      excelFrame.locator('text=Stiahnuť kópiu').first().click()
    ]);

    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error('Download failed — no file received');
    }

    const { readFileSync } = await import('node:fs');
    return readFileSync(downloadPath);
  } finally {
    await browser.close();
  }
}
```

Key changes from the original:
- Import `chromium` from `@sparticuz/chromium` (provides the serverless-compatible binary)
- Import `chromium` as `playwrightChromium` from `playwright-core` (no bundled browser)
- `chromium.setGraphicsMode = false` — disables GPU (not available in serverless)
- `chromium.args` — passes optimized args for serverless (--no-sandbox, --disable-gpu, etc.)
- `await chromium.executablePath()` — resolves to the `@sparticuz/chromium` binary (decompressed to `/tmp` on first run)

- [ ] **Step 3: Install the new dependencies**

Run from `/data/projects/pasienky/server`:
```bash
npm install
```

Expected: `package-lock.json` updates. `playwright` removed, `playwright-core` and `@sparticuz/chromium` added.

- [ ] **Step 4: Run existing tests to make sure nothing broke**

Run: `npm test --prefix server`

Expected: All tests pass. The import/download tests mock the browser, so the playwright swap shouldn't affect them.

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/package-lock.json server/src/source/sharepointDownload.ts
git commit -m "feat: replace playwright with playwright-core + @sparticuz/chromium for serverless"
```

---

### Task 2: Hoist server dependencies to root package.json

Vercel's `@vercel/node` builder traces imports from `api/index.ts` and resolves packages from the **root** `node_modules`. Currently, `express`, `pg`, `cheerio`, `xlsx`, `playwright-core`, and `@sparticuz/chromium` only exist in `server/node_modules` — the serverless function won't find them.

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add server production dependencies to root package.json**

Update the root `package.json` to include all production dependencies that `api/index.ts` transitively needs:

```json
{
  "name": "pasienky-pool-timetable",
  "private": true,
  "scripts": {
    "install:all": "npm install --prefix server && npm install --prefix client",
    "test": "npm run test --prefix server && npm run test --prefix client -- --watch=false",
    "build": "npm run build --prefix server && npm run build --prefix client",
    "dev:server": "npm run dev --prefix server",
    "dev:client": "npm start --prefix client"
  },
  "engines": {
    "node": ">=22.12.0"
  },
  "volta": {
    "node": "22.12.0",
    "npm": "11.7.0"
  },
  "dependencies": {
    "@sparticuz/chromium": "^133.0.0",
    "cheerio": "^1.2.0",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "pg": "^8.20.0",
    "playwright-core": "^1.52.0",
    "xlsx": "^0.18.5"
  }
}
```

- [ ] **Step 2: Install root dependencies**

Run from `/data/projects/pasienky`:
```bash
npm install
```

Expected: `node_modules/` in root now contains all the server deps. A root `package-lock.json` is created/updated.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: hoist server deps to root for Vercel serverless resolution"
```

---

### Task 3: Fix api/index.ts for Vercel

The current `api/index.ts` imports `dotenv/config` at the top. On Vercel, env vars are injected by the platform — `dotenv` isn't needed and would fail looking for a `.env` file. Also need to make sure the import paths work correctly with Vercel's esbuild-based bundler.

**Files:**
- Modify: `api/index.ts`

- [ ] **Step 1: Update api/index.ts**

Remove the `dotenv/config` import. Vercel injects environment variables natively — no `.env` file exists in the serverless runtime.

```typescript
import { loadConfig } from '../server/src/config.js';
import { createPool } from '../server/src/database/pool.js';
import { TimetableRepository } from '../server/src/database/timetableRepository.js';
import { importTimetable } from '../server/src/import/importTimetable.js';
import { createApp } from '../server/src/http/app.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const repository = new TimetableRepository(pool);

export default createApp({
  parseTriggerToken: config.parseTriggerToken,
  repository,
  importTimetable: () =>
    importTimetable({
      pageUrl: config.bratislavaPageUrl,
      repository
    })
});
```

- [ ] **Step 2: Commit**

```bash
git add api/index.ts
git commit -m "fix: remove dotenv import from Vercel entry point"
```

---

### Task 4: Configure vercel.json for serverless Playwright

The current `vercel.json` doesn't specify memory or node version. Playwright + Chromium needs at least 1024MB of RAM. The free (Hobby) plan allows up to 1024MB memory and 60s maxDuration.

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Update vercel.json**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "npm run install:all",
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist/client/browser",
  "functions": {
    "api/index.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/index"
    },
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ]
}
```

Changes from current:
- Added `"memory": 1024` — allocates 1GB RAM for the serverless function (needed for Chromium)
- Kept `"maxDuration": 60` — maximum for Hobby plan, needed for SharePoint download which involves browser automation

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: configure Vercel function memory and duration for Playwright"
```

---

### Task 5: Add .gitignore entry and verify build pipeline

Make sure the full build pipeline works end-to-end before deploying: server TypeScript compiles, Angular builds, and no files that shouldn't be committed are staged.

**Files:**
- Verify: build pipeline

- [ ] **Step 1: Run the full build**

Run from `/data/projects/pasienky`:
```bash
npm run build
```

Expected: Server TypeScript compiles to `server/dist/`. Angular builds to `client/dist/client/browser/`. No errors.

- [ ] **Step 2: Run the full test suite**

Run from `/data/projects/pasienky`:
```bash
npm test
```

Expected: All server and client tests pass.

- [ ] **Step 3: Verify the output directory exists**

```bash
ls client/dist/client/browser/index.html
```

Expected: File exists. This is what Vercel serves as static content.

- [ ] **Step 4: Final commit with all remaining changes (if any)**

```bash
git status
```

If there are uncommitted changes (e.g., lock files), commit them:
```bash
git add -A
git commit -m "chore: update lock files for Vercel deployment"
```

---

## Environment Variables (User Action)

The following env vars must be set in the Vercel dashboard (Settings → Environment Variables):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PARSE_TRIGGER_TOKEN` | Shared secret for the parse trigger endpoint |
| `BRATISLAVA_PAGE_URL` | (Optional) Override for the Bratislava page URL |

## Deployment

After all tasks are complete, deploy with:
```bash
vercel --prod
```

Or connect the Git repo to Vercel for automatic deployments on push.
