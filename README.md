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

Two changes need your attention. One old bug is also fixed.

### Breaking: close() returns a promise

Before, `close()` closed the connection immediately and returned nothing.

```diff
- store.close()
- doWorkThatNeedsTheConnectionClosed()
+ await store.close()
+ doWorkThatNeedsTheConnectionClosed()
```

Code that already awaited `close()` is not affected.

### Breaking: the script tag bundle moved

`dist/cjs/secure-webstore.js` was a UMD bundle. It set a `SecureStore` global.
After the move to tsup it is plain CommonJS, and it fails in a `<script>` tag.

Use `dist/secure-webstore.global.js`.

```diff
- <script src="https://cdn.jsdelivr.net/npm/secure-webstore/dist/cjs/secure-webstore.js"></script>
+ <script src="https://cdn.jsdelivr.net/npm/secure-webstore/dist/secure-webstore.global.js"></script>
```

A page that pins a version continues to work. npm users are not affected.

### Fixed: destroy() never resolved

`destroy()` used to wait for ever. Three faults caused it:

- The `Store` constructor opened the database without an await. The first
  operation then opened it again. Two connections opened, the code tracked one,
  and the other kept the database open. The delete request stayed blocked, and no
  handler reported it.
- `destroy()` did not wait for the close before it asked for the delete.
- The close did not forget the connection. `IDBDatabase.close()` sends no
  `onclose` event. Thus the store kept a closed connection, and each later call
  threw `InvalidStateError`.

The last fault also made the page freeze handler permanent. If the page froze,
the store stopped working.

All three are fixed. A store opens again when you use it. `destroy()` now rejects
with a clear message if another connection blocks the delete.

### Other changes

The store no longer needs a `window`. It thus works off the main thread and under
a test runner. The sources build to ESM, CJS and a browser bundle, and each one
has its own declarations. The tests run under vitest with `fake-indexeddb`, so
they need no browser. Line coverage of `src` went from 79.8% to 93.4%. CI
typechecks, builds and tests each push and each pull request. `dist/` is no
longer in the repository. A `prepare` script builds it for `npm publish` and for
an install from the git url.

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
