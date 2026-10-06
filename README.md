# Player Database — GitHub Pages + Cloudflare

This project gives you a public, polished player database with a private administrator API.

## Why it is split in two
GitHub Pages is static hosting and cannot securely run server-side authentication or a database. The frontend therefore lives on GitHub Pages, while a Cloudflare Worker handles authentication/API requests and Cloudflare D1 stores player records and assessment history.

## Features
- Public read-only player list
- Searchable players
- Detailed player profiles
- Assessment history
- Administrator-only add/edit/delete
- Lock records so they cannot be changed/deleted
- Unlocking requires re-entering the same 6-digit admin code in Settings
- Six separate digit inputs for the code
- Admin code is a Cloudflare Worker secret, not frontend JavaScript
- No home server or home IP is involved

## Setup

### 1. GitHub
Create a repository and upload this project. Keep `config.js` with its placeholder until the Worker exists.

Enable Pages: **Repository → Settings → Pages → GitHub Actions**.

### 2. Cloudflare
Install Node.js, then:

```bash
npm install -g wrangler
wrangler login
cd worker
npx wrangler d1 create player-database
```

Copy the returned database ID into `worker/wrangler.toml` in `database_id`.

Initialise the production database:

```bash
npx wrangler d1 execute player-database --remote --file=./schema.sql
```

### 3. Set the private code

```bash
npx wrangler secret put ADMIN_CODE
```

Enter exactly six digits. Do not put the code in GitHub files.

Set the GitHub Pages origin as another Worker secret:

```bash
npx wrangler secret put ALLOWED_ORIGIN
```

For a repository site, this is normally `https://YOURUSERNAME.github.io` — do not add the repository path.

### 4. Deploy the Worker

```bash
npx wrangler deploy
```

Copy the Worker URL it gives you into the root `config.js`:

```js
window.APP_CONFIG={API_URL:"https://YOUR-WORKER.workers.dev"};
```

Commit/push to GitHub.

### 5. Use it
Public visitors can browse `/` and `/player/...` pages.

Go to `#/admin` to log in. Once authenticated you can:
- create players
- edit players
- delete players
- lock players
- enter Settings and re-enter the 6-digit code to unlock a locked player

## Important security limitation
A six-digit code has only one million possible combinations, so this is intentionally lightweight authentication rather than a high-security account system. The code is nevertheless kept server-side and the browser receives only an HTTP-only session cookie. Do not use this design for sensitive financial, medical, or other high-value information.

Your home IP is not used as an origin server. Visitors connect to GitHub Pages and Cloudflare; nothing needs to run on your computer.

## Your current rating system
The UI accepts the 0–300 attributes:
Control, Execution, Defending, Reaction Time, Chemistry, Game Sense.

Current integer tier boundaries:
- S 257–300
- A 215–256
- B 172–214
- C 129–171
- D 86–128
- E 43–85
- F 0–42

Overall Player Tier remains separate from Attribute Tier.

## Updating
Frontend: push changes to GitHub.
Worker: from `worker/`, run `npx wrangler deploy`.

Make periodic D1 backups once the database becomes important.

## Accounts and logs upgrade

The account picker initially contains **Zimble**. Select an account and enter the admin code to sign in. Switching accounts during an authenticated session does not require the code again. After signing out or session expiry, a new sign-in requires the code. Only this protected primary account can add/delete administrators in **Manage Accounts**. Accounts share the entry code; selection identifies the acting user without separate passwords.

**Logs** records player creation, updates, deletion, locking/unlocking, and admin creation/deletion. Player names are bold, with assessment dates and assessment references. Logs preserve names after deletion. Previous activity is not backfilled. Locks still apply to the current player record, and logs identify its assessment at the time.

For an existing database, run from `worker/` before deploying:

```bash
npx wrangler d1 execute player-database --remote --file=./migrations/0001_admin_accounts.sql
npx wrangler deploy
```

New databases use `schema.sql`. The migration preserves player data; existing sessions require signing in again. Publish the updated frontend files too.

## Unique player names upgrade

Player names must be unique, ignoring ASCII letter casing and surrounding spaces. Adding a new assessment means editing the existing player. Apply this migration before deploying the Worker:

```bash
npx wrangler d1 execute player-database --remote --file=./migrations/0002_unique_player_names.sql
npx wrangler deploy
```

If the migration reports a unique constraint error, existing duplicate players must first be renamed or removed through the admin interface. The migration does not delete or merge any records. To find duplicates:

```bash
npx wrangler d1 execute player-database --remote --command="SELECT trim(name) AS name, COUNT(*) AS count FROM players GROUP BY trim(name) COLLATE NOCASE HAVING COUNT(*) > 1"
```

## Personal admin codes

Apply `migrations/0003_personal_admin_codes.sql` before deploying the Worker. This signs out all existing sessions. Zimble uses the existing ADMIN_CODE once to create a personal six-digit code. In Manage Accounts, new accounts receive a one-time setup invitation to share privately with their owner. For existing accounts without a code, choose Create setup invitation. Owners enter that invitation and then create/confirm their own code. Invitations are consumed by setup; existing codes cannot be overwritten through invitations. Account switching and player unlocking now require the target/current account personal code. Codes use salted PBKDF2 hashes and are never returned by the API.

```bash
npx wrangler d1 execute player-database --remote --file=./migrations/0003_personal_admin_codes.sql
npx wrangler deploy
```

Publish the updated frontend too. This supersedes earlier shared-code and code-free switching instructions.
