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
