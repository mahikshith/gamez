# Refunds and the one-time purchases

The one-time products (Starter Nest, Unlock Everything, The Whole Coop) follow the store's own record. There is no game
server, so the phone checks what it can, and `src/guard.js` decides.

## Android (wired)

- Every one-time grant is remembered in the save (`save.guard`) with its purchase token and what it really added (the
  outfits, eggs and chicks the player did not have yet, the coins it paid).
- After a **successful** `queryPurchasesAsync` (at billing connect, at game start, on every resume), `Monetization.java`
  sends the page the one-time product ids Play lists (`window.__eggStore`). Not on an error, not while Play does not know
  the app's products (the proof APK), not from a release build without the licence key, and the page ignores it while the
  phone says it is offline.
- A purchase missing from two such lists at least an hour apart is taken back: the unlock flags, the items it added
  (equipped ones go back to the defaults), its coins only as far as the purse goes. Stars, levels won, things bought with
  coins and consumables stay. One line, once: "Your Unlock Everything purchase was refunded, so it has been removed."
  The shop offers it again; buying again restores everything. The same purchase listed again undoes it, coins included.

What Google documents: `queryPurchasesAsync` "returns purchases details for currently owned items" ("only active
subscriptions and non-consumed one-time purchases"). The documents do not say how fast a refund reaches it, nor whether
it answers from a cache offline; hence the two checks an hour apart and the offline rule. A refund without "revoke"
leaves the purchase owned and is not in the Voided Purchases API either.

What this does not stop:
- a phone kept offline (or whose app is never opened) after the refund;
- cleared app data or a reinstall after a refund: the old save is gone, and Play no longer lists it, so nothing comes back
  anyway; coins spent before the refund stay spent;
- coin packs and other consumables (Play stops listing them once consumed);
- the iPhone (purchases are not wired there yet).

What a server would add later: a small cloud job polls the Voided Purchases API (OAuth or a service account with "View
financial reports"; the last 30 days; 6,000 queries a day) or listens to Real-time developer notifications, and the
phone asks it about its own tokens. That also covers consumables and phones that stay offline.

## The licence key (release blocker)

`PLAY_LICENSE_KEY` in `android/app/src/main/java/com/eggscape/game/Monetization.java` is empty. A debuggable (proof)
build still accepts test purchases; a release build refuses every purchase until the key is pasted there. It is in Play
Console: the app > Monetize with Play > Monetization setup > Licensing, "Base64-encoded RSA public key" (one line).

## iOS (to wire with StoreKit 2)

StoreKit 2 gives the same picture on the device:
- `Transaction.currentEntitlements` holds the non-consumables the account owns now; revoked (refunded) transactions are
  not in it, and consumables never are.
- A refunded transaction carries a `revocationDate` (and `revocationReason`); `Transaction.updates` delivers it while the
  app runs. Apple's guidance: do not deliver content for a transaction with a `revocationDate`.

To feed the same `guard.js`: after `for await r in Transaction.currentEntitlements` finishes (a verified result each),
collect the product ids and call `window.__eggStore(JSON list)` from `Bridge.swift`, exactly as Android does; grant each
new one through `window.__eggGrant(productId, String(transaction.id), false)` so it is remembered with its token. On a
`Transaction.updates` item with a `revocationDate`, run the same `currentEntitlements` pass. Apple also sends the server
a `REFUND` notification (App Store Server Notifications V2) and asks apps to tell players what was done.

Until ads are wired on iOS, every video button there is shown offline-style and pays nothing (`ads.videoOk`).
