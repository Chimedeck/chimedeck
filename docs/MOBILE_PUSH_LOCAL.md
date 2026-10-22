# Test mobile push locally

This full local stack is optional. If Docker is unavailable, use the hosted test/staging path in [Mobile push](MOBILE_PUSH.md). An Android emulator can run the mobile client against that server without a local database or Docker.

Run the backend from a Chimedeck checkout containing the mobile push implementation. The Flutter project stays in its own repository. Local migrations and test accounts are separate from a shared environment.

## Local backend

Prerequisites are Bun (at least the repository's 1.3.5 requirement) and Docker with Compose. The complete local PostgreSQL/storage stack and browser flow were verified; see [verification evidence](../specs/tests/mobile-push-verification.md).

From the prepared backend checkout:

```sh
bun install --frozen-lockfile
cp -n .env.example .env
```

Edit the ignored `.env` for local development. The Compose database is named `chimedeck_dev`; the example's database name must be corrected. Use these local settings, keeping sender credentials empty initially:

```dotenv
DATABASE_URL=postgresql://chimedeck:chimedeck@localhost:5432/chimedeck_dev
APP_PORT=3000
VITE_APP_URL=http://localhost:5173
APP_BASE_URL=http://localhost:3000
FLAG_USE_REDIS=false
FLAG_USE_LOCAL_STORAGE=true
FLAG_VIRUS_SCAN_ENABLED=false
FLAG_EMAIL_VERIFICATION_ENABLED=false
FLAG_SES_ENABLED=false
EMAIL_DOMAIN_RESTRICTION_ENABLED=false
AUTOMATION_SCHEDULER_ENABLED=false
MOBILE_PUSH_ENABLED=false
MOBILE_PUSH_DEVELOPMENT_CREDENTIALS_JSON=
MOBILE_PUSH_PRODUCTION_CREDENTIALS_JSON=
```

Use a local database, not the shared server's database. Keep any existing local JWT key pair; if both JWT fields are blank in this fresh `.env`, generate a local-only pair without printing the keys:

```sh
bun run - <<'JS'
const fs = require('node:fs');
const { generateKeyPairSync } = require('node:crypto');
let text = fs.readFileSync('.env', 'utf8');
for (const name of ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY']) {
  if (!new RegExp('^' + name + '=[ \\t]*$', 'm').test(text)) {
    throw new Error('JWT fields are not both blank; keep the existing local pair.');
  }
}
const pair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
for (const [name, pem] of Object.entries({
  JWT_PRIVATE_KEY: pair.privateKey,
  JWT_PUBLIC_KEY: pair.publicKey,
})) {
  text = text.replace(new RegExp('^' + name + '=.*$', 'm'),
    name + '=' + Buffer.from(pem).toString('base64'));
}
fs.writeFileSync('.env', text, { mode: 0o600 });
fs.chmodSync('.env', 0o600);
console.log('Local JWT pair saved in ignored .env');
JS
```

Start dependencies, migrate the local database, and start the API plus web development server:

```sh
docker compose up -d postgres localstack
bun run db:migrate
bun test server/extensions/notifications/push
bun run dev:local
```

The migration command applies all pending migrations, including `0134_mobile_push.ts`. On an existing local database, `bun run db:migrate:safe` also checks for migration locks/blockers; the precheck expects Knex's migration tables to exist. Do not use a rollback to repair an unknown migration failure.

In another terminal:

```sh
curl http://localhost:3000/health
```

Expect `{"status":"ok"}`. Open `http://localhost:5173`, register two local test accounts, create a workspace/board, and give both accounts access. Shared-server accounts and boards do not exist in a fresh local database. No production data import is needed for this test.

## Connect the phone and enable the sender

The native environment configuration requires HTTPS. Expose only your local test API on port 3000 through a trusted HTTPS endpoint. For example, after installing `cloudflared`:

```sh
cloudflared tunnel --url http://localhost:3000
```

Use its printed HTTPS hostname. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) are temporary public endpoints for development; stop the process when testing ends. Interactive email authentication on a tunnel does not work for this native API client.

In the separate Flutter project, copy the existing private `config/development.json` to ignored `config/development.local.json`. Change only `API_BASE_URL` in the copy to the HTTPS endpoint plus `/api/v1/`. Keep the development environment, identifiers, and matched Firebase files. Then run:

```sh
fvm flutter run --flavor development --dart-define-from-file=config/development.local.json --no-enable-impeller
```

Sign in with the local test account. The inbox and WebSocket now connect to the local backend; web actions must use the local web app too. If this installation already registered alerts on the shared server, disable them there before switching its API endpoint.

To test FCM sending, keep the private development Firebase Admin credential outside the checkout and use the runtime ADC configuration in [Keep the Firebase credential private](MOBILE_PUSH.md#keep-the-firebase-credential-private). Restart the backend, then enable Device notifications in the app and wait for Device connected. Firebase sender permission and iOS APNs/signing setup remain required.

Authenticated `GET /api/v1/notifications/push-capabilities` should return `data.development: true`. This confirms the enable flag and presence of sender configuration; it does not validate credentials or prove delivery. Use the two-account foreground/background/terminated test sequence from the Flutter notifications guide to verify actual delivery. The five-second delivery worker runs inside the backend process; no separate worker command is needed.

## Automated local proof

The real-boundary suite refuses to mutate any database except `chimedeck_mobile_push_test` on localhost. Create and migrate that separate disposable database before running it:

```sh
docker compose exec -T postgres createdb -U chimedeck chimedeck_mobile_push_test
DATABASE_URL=postgresql://chimedeck:chimedeck@localhost:5432/chimedeck_mobile_push_test bun run db:migrate
DATABASE_URL=postgresql://chimedeck:chimedeck@localhost:5432/chimedeck_mobile_push_test \
  MOBILE_PUSH_ENABLED=true MOBILE_PUSH_DEVELOPMENT_CREDENTIALS_JSON=application-default \
  bun test specs/tests/mobile-push.integration.test.ts
```

No Firebase credentials are needed for that suite: it injects a fake sender after exercising the real auth, HTTP, migration, queue and database boundaries. Run it separately from the focused unit suite, which mocks modules.

With Chrome installed and `bun run dev:local` running with push disabled:

```sh
bun run specs/tests/mobile-push.browser.ts
```

This opt-in script uses only `http://localhost:5173`, retains a synthetic local test account, and writes its login and screenshot under ignored `.secrets/` with private file permissions. It verifies signup, rejected/valid login, the bell inbox, and authenticated/denied push API paths. No password or token is printed.

## Stop and resume

Stop `bun run dev:local` with Ctrl+C. Stop the supporting containers with `docker compose stop postgres localstack`; this preserves local data. Resume them with `docker compose up -d postgres localstack` and run `bun run dev:local` again.

## Submit changes

Follow `CONTRIBUTING.md` and the PR template. Feature PRs target `main`; contributors without upstream push access use their fork. Keep `.env`, `.secrets/` and private Firebase files out of Git. Committing or pushing does not migrate or deploy a shared database. Commit Flutter changes separately in its mobile repository.
