# Spec · Full-site Passkey (Designer Hub · Monad)

- Date: 2026-10-10
- Status: approved (design "overall OK")
- Goal: make the **whole site wallet-free for Passkey users** (the mint/transaction main flow), and
  collapse the top bar from "Passkey blurb + advanced-mode wallet button" down to a **single Passkey control**.

## Background & constraints

The site is a Monad Testnet DApp (Next.js 14, `web/`). There are two identity/signing paths:

1. **Passkey** (primary): the `P256PasskeyAccount` smart account. The address is derived via CREATE2 by
   the factory `accountOf(x,y,rpIdHash,originHash)`; the private key never leaves the device secure
   element; transactions go through `/api/relay` where the relayer **pays gas** (`value` is always 0).
2. **MetaMask** (fallback / advanced): an EOA calling contracts directly, paying its own gas.

### Key constraints (confirmed in code)

- relay `execute` currently **hard-forbids value** (`value_must_be_zero`, "the relayer does not forward ETH/MON").
- `applyScheme` is **payable** (pays `price` MON) → a passkey cannot sponsor it.
- So this design uses **Option A: paid purchases stay wallet-only**; everything else that can be gasless is passkey-enabled.

## Design

### ① Top-bar refactor (`components/Header.tsx`)

- Remove the top-right "advanced mode" microcopy and the RainbowKit `ConnectButton`.
- Replace the top-right with a **single Passkey control**, whose display depends on state:
  - not created → "Create passkey" → links to `/passkey`
  - created → `Passkey · 0x…` (short address) + a deploy-status dot → click goes to `/passkey`
- Remove the `Passkey` item from the nav (the top-right control is the entry point); keep:
  `Gallery · Mint · Trades · Board · Docs`.
- Move the MetaMask connection into the `/passkey` page as a **fallback** ("Already have a wallet? Connect MetaMask").
- The Header must be aware of passkey state: `lib/passkeyAccount.ts` dispatches a `dh:passkey-changed`
  event on save/clear; the Header listens and re-reads localStorage on route changes.

### ② Passkey covers Remix and listing/pricing

- Reuse `executeViaPasskey({ to, data })` (internally handling "deploy via relayer first if not deployed").
- `app/remix/[id]/page.tsx`: `const useMetaMask = isConnected; const usePasskey = !isConnected && Boolean(pk);`.
  The passkey branch uses `encodeFunctionData(dreamSchemeAbi, "remix", [tokenId, contentHash, KIMI_AGENT_ID, tokenUri])` executed through the passkey.
- `app/scheme/[id]/page.tsx`: **list / change price** (`setPrice`) is opened up for "passkey-owned schemes"
  (`ownerOf == passkey address`).
- **"Apply to my home" (purchase) stays wallet-only**: a passkey user clicking it sees "payment requires connecting a wallet".
- `/trades` is a read-only ledger; no change needed.

### ③ Docs update

- Delete "MetaMask (advanced mode)" wording; standardize on "Passkey is the primary flow / connecting a wallet is the fallback".
- Add the note (text specified by the user):

  > **Passkey keys never touch funds; the payment key is the user's choice.** The Passkey is used only
  > for identity and signing (mint / Remix / listing & pricing); it does not custody or touch your funds.
  > For payments (apply to my home), which payment method and key to use is the user's own choice.

### ④ Verification

- `npm run build` passes.
- E2E (fresh Chrome): passkey gasless **Remix** and **setPrice** each run through once.

## Impact surface

| File | Change |
|---|---|
| `components/Header.tsx` | top-bar Passkey control; drop ConnectButton / advanced mode |
| `lib/passkeyAccount.ts` | dispatch `dh:passkey-changed`; reusable across pages |
| `app/passkey/page.tsx` | includes "Connect MetaMask (fallback)" |
| `app/remix/[id]/page.tsx` | passkey Remix branch |
| `app/scheme/[id]/page.tsx` | passkey setPrice branch; purchase prompt |
| `app/mint/create/page.tsx` | copy: advanced mode → connect wallet (fallback) |
| `app/docs/page.tsx` | copy + new statement |

## Non-goals (YAGNI)

- No contract changes; no change to relay's `value_must_be_zero`.
- No top-up entry for passkey accounts.
- Comments (EIP-191 signatures) are untouched this cycle; still wallet-signed.
