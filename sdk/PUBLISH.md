# Publishing `@freya-codex/sdk`

This SDK is published to the **GitHub Packages** npm registry, not to npmjs.com.

- **Package name:** `@freya-codex/sdk` (brand name: `@designerhub/sdk`)
- **Registry:** `https://npm.pkg.github.com`
- **Scope rule:** on GitHub Packages the package scope **must equal** the GitHub owner
  (`Freya-Codex`), which is why the published name is `@freya-codex/sdk`.

> **Why not npmjs.com?** From this network `www.npmjs.com` is blocked by a Cloudflare
> challenge (`cf-mitigated: challenge`, HTTP 403) — the sign-up / login web UI is unreachable.
> The publish API `registry.npmjs.org` *is* reachable, but registering an account requires the
> website. GitHub Packages has no such blocker, so it is the registry we use.

---

## 1. One-time setup — create a token

1. Open <https://github.com/settings/tokens> → **Generate new token (classic)**.
2. Scopes: **`write:packages`** + **`read:packages`** (add `repo` if you also want to read
   private repos). Only `read:packages` is needed for *installing*.
3. Copy the token (`ghp_…`) — it is shown only once.

## 2. Configure auth

Create `sdk/.npmrc` (this file is **git-ignored** — see the root `.gitignore`):

```
@freya-codex:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<YOUR_GITHUB_PAT>
```

Or, to avoid a token in the working tree, export it and reference the env var:

```
@freya-codex:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

A template lives at [`./.npmrc.example`](./.npmrc.example).

## 3. Build & publish

```bash
cd sdk
npm install                 # installs typescript (devDependency)

# verify auth resolves to your account
npm whoami --registry=https://npm.pkg.github.com    # → Freya-Codex

# publish (publishConfig.registry already points at GitHub Packages,
# and prepublishOnly runs `npm run build` first)
npm publish
```

Success looks like: `+ @freya-codex/sdk@0.1.0`.

The package page: <https://github.com/Freya-Codex?tab=packages>

## 4. Release a new version

```bash
cd sdk
npm version patch      # or minor / major — bumps package.json
npm publish
```

`prepublishOnly` rebuilds `dist/` so a stale build is never shipped.

---

## 5. How consumers install it

GitHub Packages requires auth **even for public packages**, so the consumer needs a
`read:packages` token in their project `.npmrc`:

```
@freya-codex:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<THEIR_READ_ONLY_TOKEN>
```

Then:

```bash
npm i @freya-codex/sdk viem
```

`viem` (>= 2) is a peer dependency.

**No-auth alternative:** build a tarball and hand it over directly:

```bash
cd sdk && npm pack        # → freya-codex-sdk-0.1.0.tgz
# consumer:
npm i ./freya-codex-sdk-0.1.0.tgz
```

If you later need a registry that installs *without* auth, options are a self-hosted
registry (Verdaccio on `designerhub.asia`) or JSR (<https://jsr.io>).

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `ENEEDAUTH` | Not logged in, or the token source ≠ publish registry. Re-check `sdk/.npmrc`. |
| `403 Forbidden` on publish | Token lacks `write:packages`, or the package scope ≠ GitHub owner. |
| `EPRIVATE` / `--access` error | On GitHub Packages, **do not** pass `--access public`; private/public is controlled by the repo's package visibility, not npm. |
| Stale build published | `prepublishOnly` handles it; if bypassed, run `npm run build` manually first. |
| `tsc: command not found` | Run `npm install` in `sdk/` to get the `typescript` devDependency. |

## Security notes

- Never commit `sdk/.npmrc` (it is git-ignored).
- Rotate the token if it is ever shared; delete old ones at
  <https://github.com/settings/tokens>.
