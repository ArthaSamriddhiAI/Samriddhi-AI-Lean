# Quick Start

Get Lean Samriddhi MVP running locally from a fresh clone.

## Prerequisites

- **Node 22+** (LTS recommended; project depends on `@types/node ^22`). Verify: `node -v`.
- **npm** (bundled with Node). No other package manager required.
- SQLite is bundled via Prisma; no separate database install needed.

## 1. Clone and install

```bash
git clone <repo-url>
cd <repo-directory>
npm install
```

## 2. Environment setup

Copy the example env file:

```bash
cp .env.example .env.local
```

`.env.example` ships with sensible defaults. Edit `.env.local` as needed.

### STUB_MODE path (recommended for first-time setup)

Set `STUB_MODE=true`. No API key required. The system renders the Shailesh diagnostic case and the Sharma proposal case from pre-recorded fixtures, zero LLM spend.

```env
DATABASE_URL="file:./dev.db"
STUB_MODE=true
STUB_RECORD=false
```

### Live mode path

Set `STUB_MODE=false`. After the server starts, navigate to `/settings` and enter your Anthropic API key in the Settings UI. Do not set the key as an env var; the production-posture decision routes it through the database. See [Anthropic's docs](https://docs.anthropic.com) for key acquisition.

## 3. Database setup

Run these three commands in order:

```bash
npm run db:generate   # generate Prisma Client from schema
npm run db:push       # create prisma/dev.db and apply schema
npm run db:seed       # load investors, snapshots, settings, and case fixtures
```

The seed populates six investor archetypes, nine snapshot metadata rows, a default settings row (advisor: Priya Nair, model: claude-opus-4-7), and the pre-generated Shailesh and Sharma case fixtures.

## 4. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000. The root redirects to `/cases`.

## 5. What to look at first

1. Open `/cases`. Two pre-seeded cases should be visible.
2. Click the **Shailesh diagnostic case** (Samriddhi 2). Open the briefing PDF from the case detail view.
3. Click the **Sharma proposal case** (Samriddhi 1). Explore the Outcome tab and the Analyst Reports tab; the IC1 sentinel state and deliberation memo are visible there.

For agent reasoning details, see `foundation/foundation.md` and the `agents/` directory.

## Troubleshooting

**SQLite db file not found**
`prisma/dev.db` is not committed. Run `npm run db:push` then `npm run db:seed` to create and populate it.

**STUB_MODE confusion**
The Settings UI at `/settings` can override the env var; the database value takes precedence when set. If behavior is unexpected, open Settings and set "Stub mode" to "Inherit env (STUB_MODE)", then verify your `.env.local`.

**PDF route returns 404 or 409**
404 means the case ID was not found; verify the seed ran successfully. 409 means the case status is not `ready`; re-run `npm run db:seed` or check the case detail for a processing error.

**Port conflict**
Next.js defaults to port 3000. If that port is occupied, start with `PORT=3001 npm run dev`.

**Clean reset**
`npm run db:reset` runs `db:push --force-reset` followed by `db:seed` in one step, wiping and re-seeding the database.
