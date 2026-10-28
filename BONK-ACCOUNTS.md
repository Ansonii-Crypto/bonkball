# Bonk accounts and administrator access

The homepage and content navigation now show **Account**. Signed-in users see their Bonk username, an avatar containing its first character, and a dropdown with **Profile**, **Admin tools** for eligible accounts, and **Log out** in red. Profile shows the signed-in user and assessment cards for the player name matching their verified Bonk username (ignoring case and surrounding spaces). Cards run left to right, newest first by default. A single dropdown supports newest, oldest, ascending points, and descending points. Its Admins submenu opens to the right on hover and filters the cards by assessor; it also works by tap and keyboard. Each card opens its specific assessment to show ratings, notes and assessment comments. Profiles without assessments omit the assessment heading and controls. Dates use the stored assessment date/time, with assessment IDs breaking ties. This display match does not grant permissions. The active skin from the Bonk login response replaces the initial avatar when available. Its code is stored as cosmetic data and displayed via Bonk Leagues? SVG image renderer; no credentials or tokens go to that renderer. Image failures fall back to the username initial. Sign out and back in to refresh a changed skin. The login page is `#/account`; administrator tools remain at `#/admin` and are linked from Behind the Scenes.

Everyone starts with a regular user session. Only a linked administrator can unlock admin tools using that account's existing six-digit personal code. No default code exists. Ordinary accounts are never offered personal-code setup. Admin elevation lasts 30 minutes; the normal account session lasts 24 hours. Lock admin access ends elevation while retaining the Bonk login. Log out removes both privileges for that browser session.

## Before publishing

These changes are prepared locally, not deployed. Deploy the database/Worker changes before publishing the frontend.

1. The primary Bonk ID is configured as **3177088** in `worker/wrangler.toml`. On its first verified login, it is linked to the existing primary administrator. The existing personal code is retained and still required. No username match can claim the primary account. Changing the configured ID does not replace an existing database link.
2. From `player-database-site/worker`, run:

   ```powershell
   npx wrangler d1 execute player-database --remote --file=./migrations/0010_bonk_identity.sql
   npx wrangler deploy
   ```

   Apply the migration once. It deliberately signs out old code-only administrator sessions. It preserves administrators, codes, invitations, players, assessments, and drafts. Previous migrations must already have been applied.
3. Ensure the existing `ALLOWED_ORIGIN` Worker secret is the site's exact origin, `https://bonk-critic.com`, without a trailing slash. Mutation requests from other origins are rejected. Existing rate-limiter bindings are required.
4. Publish the frontend changes together, including the new `account.js` and `account.css`, by your usual GitHub Pages process. Nothing has been committed or pushed automatically.
5. Test a real login from the deployed Worker, first with an incorrect password and then with the correct password. Confirm the primary account can browse normally, unlock with its existing code, and lock again. The user-confirmed local Python login does not establish that Bonk accepts Cloudflare's outgoing connection. Provider rejection is reported as a failure; it never falls back to code-only login.

## Existing and new administrators

After unlocking the primary account, open **Manage Accounts**. Existing secondary administrators initially show **Bonk account not linked**. Enter each intended account's numeric Bonk ID and choose **Link account**. Existing personal codes are preserved. An account may only be linked once through this UI; correcting an erroneous link requires an operator database correction. Verify IDs with their owners before linking them.

Adding a new administrator requires a display name and the intended Bonk account ID. The generated invitation is bound to that ID, expires after ten minutes, and is consumed after successful personal-code creation. Its owner must first sign in to the matching Bonk account. Existing setup links also require a matching link; link old secondary accounts before sending their setup invitation.

All unlocked administrators may open Manage Accounts to view the list. Only the primary administrator can add/delete accounts, link identities, issue invitations, reset codes, or view account statistics. Secondary administrators cannot obtain invitation tokens through the account-list API. Revoking an account or resetting its code invalidates its elevated sessions.

## Identity and server enforcement

The Worker sends credentials directly to the fixed HTTPS endpoint `https://bonk2.io/scripts/login_legacy.php`, with redirects disabled and a timeout. Only a successful response containing a token, a valid numeric ID, and a username establishes identity. Browser-provided IDs, usernames, role flags, and Bonk tokens cannot substitute for that response. Passwords and upstream tokens are not written to the database, logged by this code, or returned to the browser. Browser password managers may separately offer to save a password.

This is direct server-side authentication through Bonk's undocumented login endpoint, as used by [Bonkverse's published login implementation](https://github.com/Bonkverse/bonkverse/blob/main/skins/login.py). It is not an official OAuth integration or a separately verified token-introspection API. The Worker discards the upstream token after checking the successful login response; subsequent site requests use Bonk Critic's own sessions.

Site session tokens are random, stored as SHA-256 hashes server-side, and sent in secure HttpOnly cookies. As with the previous site, a tab-scoped sessionStorage fallback supports browsers blocking cross-site cookies. Both normal and elevated sessions are verified server-side. Elevated sessions must match the exact normal session and its linked Bonk ID, have an unexpired lifetime, and belong to an existing administrator with a configured code. Every protected endpoint checks those conditions. Editing frontend scripts does not grant access.

Logins are rate limited by IP and by username; code verification retains its per-admin attempt limit. Mutation requests require the configured origin and JSON, with bounded request sizes. Invitation setup retains transactional consumption. Session expiry is enforced on the server.

## Verification

From the repository root:

```powershell
node --test worker/tests/*.test.mjs
```

Tests cover provider failures, forged browser identities, account-bound invitations, code checks, primary-only operations, regular user access, session expiry, switching accounts, logout, and the account UI. Upstream responses are mocked; no real account credentials are included in tests.


## Active avatar update

Apply `worker/migrations/0011_account_avatars.sql` before deploying the updated Worker:

```powershell
# From worker/
npx wrangler d1 execute player-database --remote --file=./migrations/0011_account_avatars.sql
npx wrangler deploy
```

Publish the updated account.js and account.css, then sign out and sign in again. Existing sessions without a saved skin show the initial until the next successful Bonk login. The selected slot is read from activeAvatarNumber (or its lowercase spelling); zero maps to the first slot, following Bonk Leagues' skin manager. Invalid or missing skin data never blocks login. The browser decodes the selected avatar code locally and produces an SVG data URL from assets/skins/shapes.json. This feature does not update your skin on Bonk.


### Local skin renderer

Publish `skin-renderer.js`, `assets/skins/shapes.json`, and the updated `index.html` and `account.js` together. This replaces the external renderer without a Worker deployment or database migration. Saved active skin codes work immediately; only accounts with no saved skin need to sign in again.

The decoder accepts JSON, base64 and URL-encoded version-2 binary skin codes. It validates colours, transforms, layer count and shape IDs, then draws the layers with a circular clip. Invalid/unsupported skins or missing assets leave the username initial visible. Local shape assets and up to 32 rendered avatar URLs are cached in memory. Shape attribution is in `assets/skins/README.md`. Future Bonk encoding/shape changes may require updating the decoder or asset bundle.


## Profile and assessment comments

Player records have a public profile thread. Each assessment has a separate Comments expander in its assessment view. Profile assessment cards link to that view; profile pages only contain the general profile thread. Anyone can read comments; a verified Bonk session is required to post. Profiles without a player record do not yet have a comment target.

Authors can delete their own comments. Administrators must unlock their admin session to remove other users' comments. Deletion redacts the stored body and author association, replacing the display with a deleted placeholder while retaining replies. New replies are allowed only on a live immediate parent; live children of deleted parents can still receive replies. These permissions and author identity are enforced by the Worker, regardless of browser-supplied fields. Posts are plain text, limited to 2,000 characters and five per account per minute. Comment pages contain at most 20 entries, newest first, with Load older comments. Deleting a profile's player record or an assessment also removes its associated comments. Editing an assessment retains its existing thread.

From worker/, apply the migration before deploying:

```powershell
npx wrangler d1 execute player-database --remote --file=./migrations/0012_comments.sql
npx wrangler deploy
```

Publish comments.js, comments.css, and the updated index.html, account.js and app.js together. No Bonk passwords or provider tokens are stored with comments. Public comment responses include author usernames but not their Bonk account IDs. Assessment comment threads load only when their Comments expander opens.


### Nested replies and public avatars

Apply `worker/migrations/0013_comment_replies.sql` once before deploying the updated Worker. The migration preserves existing comments and adds parent links and redacted deletion. Each thread paginates its root comments separately from each comment's replies. The server rejects cross-thread parent IDs and rechecks the parent during insertion to prevent replies racing deletion. Profile and assessment deletion still remove the whole associated thread.

Public profiles and live comment authors use saved active skins via the local renderer. Profile lookup matches the player name to a known Bonk username, without returning a Bonk ID. Users without a saved skin retain the initial fallback. Deleted comments return no author name, skin, original text, or timestamp. The Delete hover has a translucent red background.


### Mentions and comment actions

Reply and Show/Hide replies share one action row. Comments mentioning the signed-in user's exact @username (case-insensitive, including names with spaces) highlight only that mention. Email-like text and longer usernames do not match. The highlight uses the saved active skin's base colour, with contrasting text and a 12-second shine. Missing/invalid skins use a warm fallback colour. Reduced-motion preferences disable the shine. Mentions are display-only; no notification inbox or email is generated.

The public Bonk Leagues skin history is based on skins observed in public games, not a guaranteed current active-skin lookup. No dependency on that service was added. Users without a saved skin still show their initial until they sign in.


### Deep reply navigation

Indentation stops after three steps on desktop and one step on phones. Deeper replies show a clickable excerpt of the exact parent comment, not just the author's name. Clicking scrolls to and focuses that parent's content and highlights it for two seconds. Deleted parents are labelled without their former text or author, including when deleted while replies are already open. Reduced-motion preferences disable smooth scrolling and highlight transitions. This is frontend-only; no migration or Worker deployment is needed.
