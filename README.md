# Secure-webstore

[![CI](https://github.com/deiu/secure-webstore/actions/workflows/ci.yml/badge.svg)](https://github.com/deiu/secure-webstore/actions/workflows/ci.yml)

This is a secure, promise-based keyval store that encrypts data stored in IndexedDB.

The symmetric encryption key is derived from the provided passphrase, and then stored in an encrypted
form within the provided store name. The encryption key is only used in memory and never revealed.

The IndexedDB wrapper used internally is [idb-keyval](https://github.com/jakearchibald/idb-keyval/),
while the cryptographic operations are handled by [easy-web-crypto](https://github.com/deiu/easy-web-crypto),
a zero-dependency wrapper around the [Webcrypto API](https://caniuse.com/#search=web%20crypto) available in modern browsers.

Huge thanks to [@Jopie64](https://github.com/Jopie64) for Typescriptifying the source!

## Upgrading from 1.3.7

Two changes need you to act, and one long standing bug is fixed.

### Fixed: `destroy()` never resolved

`destroy()` used to hang forever. Three defects combined:

- The `Store` constructor started opening the database without awaiting it, and
  the first operation opened it again before that finished. Two connections
  opened, only one was tracked, and the untracked one held the database open.
- `destroy()` did not wait for the close before asking for the delete.
- Closing did not forget the connection. `IDBDatabase.close()` fires no
  `onclose` event, so the store kept a closed connection and every later call
  threw `InvalidStateError`.

That last one also made the page-freeze handler a one way door: freeze the page
and the store was dead. Both are fixed, so a store reopens on demand after a
close or a freeze.

### Breaking: `close()` now returns a promise

It used to close synchronously and return nothing.

```diff
- store.close()
- doSomethingThatNeedsTheConnectionClosed()
+ await store.close()
+ doSomethingThatNeedsTheConnectionClosed()
```

Awaiting it was always safe, so code that already awaited is unaffected.

### Breaking: the `<script>` tag bundle moved

The build moved from webpack to tsup, and with it the browser bundle.
`dist/cjs/secure-webstore.js` used to be a UMD bundle that set a `SecureStore`
global. It is now plain CommonJS and fails in a `<script>` tag. The browser
bundle is `dist/secure-webstore.global.js`.

```diff
- <script src="https://cdn.jsdelivr.net/npm/secure-webstore/dist/cjs/secure-webstore.js"></script>
+ <script src="https://cdn.jsdelivr.net/npm/secure-webstore/dist/secure-webstore.global.js"></script>
```

A page that pins a version keeps working. Importing through npm is unaffected.

### Also worth knowing

`destroy()` now rejects with a clear message when another connection blocks the
delete, instead of hanging. The store no longer assumes a `window`, so it works
off the main thread and under a test runner.

### Also in this release

Sources build to ESM, CJS and a browser bundle, each with its own declarations.
Tests run under vitest with `fake-indexeddb`, so they need no browser, and line
coverage of `src` went from 79.8% to 93.4%. CI typechecks, builds and tests
every push and pull request. `dist/` is no longer committed; a `prepare` script
builds it for `npm publish` and for an install from the git url.

## Installing

### Via npm

```sh
npm install --save secure-webstore
```

### Via `<script>` tag

Either host `dist/secure-webstore.global.js` yourself or use a CDN (e.g. jsDelivr) like this:
```html
<script type="application/javascript" src="https://cdn.jsdelivr.net/npm/secure-webstore@1.3.7/dist/secure-webstore.global.js"></script>
```
*You can then use `window.SecureStore` to access the library.*

## Usage

### Initialize

The init step takes care of key derivation and setting up the encryption/decryption key.

```js
// Assuming you have loaded the secure-webstore module in your HTML file <script>
const Store = window.SecureStore.Store

const store = new Store('some-store-name', 'super-secure-passphrase')

store.init().then(() => {
  // store is ready
})
```

### set:

```js
store.set('hello', 'world')
```

Since this is IDB-backed, you can store anything structured-clonable (numbers, arrays, objects, dates, blobs etc).

All methods return promises:

```js
store.set('hello', 'world')
  .then(() => console.log('It worked!'))
  .catch(err => console.log('It failed!', err))
```

### get:

```js
// logs: "world"
const val = await store.get('hello')
// console.log(val) -> "world"
```

If there is no 'hello' key, then `val` will be `undefined`.

### keys:

```js
// logs: ["hello", "foo"]
keys().then(keys => console.log(keys))
```

### del:

```js
store.del('hello')
```

### clear:

```js
store.clear()
```

### destroy:

Completely remove a database.

```js
store.destroy()
```

### updatePassphrase:

Update the passphrase that is used for key derivation. The encryption key used for data will not be affected, just the key that protects it.

```js
store.updatePassphrase(oldPass, newPass)
```

### export:

Export all (encrypted) key/vals as one JSON object.

```js
const dump = await store.export()
```

### import:

```js
// using the dump above
store.import(dump)
```

That's it!
