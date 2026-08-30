# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases made before this file existed are listed under
[Releases](https://github.com/deiu/secure-webstore/releases).

## [2.0.0] - 2026-08-30

### Fixed

- **`destroy()` never resolved.** Three defects together, all long standing
  ([#2]):
  - The `Store` constructor started `_init()` without awaiting it, and the
    first operation called `_init()` again before that open had resolved. The
    `if (this._dbp)` guard did not hold, so two connections opened and only the
    second was tracked. The first leaked and held the database open, so
    `deleteDatabase` stayed blocked, and with no `onblocked` handler neither
    `onsuccess` nor `onerror` ever fired.
  - `destroy()` did not wait for the close before asking for the delete.
  - `_close()` did not forget the connection. `IDBDatabase.close()` fires no
    `onclose` event, so `_dbp` kept pointing at a closed connection and every
    later call threw `InvalidStateError`. This is what made the `freeze`
    listener a one way door: freeze the page and the store was dead.
- A stray `console.log` in the version change handler ([#2]).

### Added

- Lifecycle tests: `destroy()`, the second connection case, a missing
  IndexedDB implementation, the `freeze` listener, and encrypting before
  `init()`. Line coverage of `src` goes from 79.8% to 93.4% ([#2]).
- A GitHub Actions workflow that typechecks, builds and tests on every push to
  `master` and every pull request. It replaces the Travis config that
  ([#1]) deleted ([#2], [#3]).
- A `prepare` script. `dist/` is no longer committed, so without it
  `npm publish` and an install from the git url both shipped a package with no
  build in it ([#2]).
- `typecheck` and `test:coverage` scripts. `typecheck` covers the tests as
  well as the sources ([#3]).

### Changed

- The build moves from webpack to tsup and emits ESM, CJS and a browser
  bundle, each with its own declarations ([#1]).
- The tests move from mocha-headless-chrome to vitest with `fake-indexeddb`,
  so they need no browser ([#1]).
- **`close()` now returns a promise.** It used to close the connection
  synchronously and return nothing. Await it if the next thing you do depends
  on the connection being closed ([#2]).
- `destroy()` now rejects with `Cannot delete the database while another
  connection is open` instead of hanging when the delete is blocked ([#2]).
- The `easy-web-crypto` dependency moves to ^2.0.0. Its runtime is unchanged; its types are more precise ([easy-web-crypto 2.0.0](https://github.com/deiu/easy-web-crypto/releases/tag/2.0.0)).
- The store reopens on demand after a `close()`, because the connection is
  forgotten rather than kept in a closed state ([#2]).
- **The `<script>` tag bundle moved to `dist/secure-webstore.global.js`.**
  `dist/cjs/secure-webstore.js` was a UMD bundle that set a `SecureStore`
  global; since the tsup move it is plain CommonJS and fails in a browser. A
  page that loads that path from a CDN without pinning a version must update
  the URL ([#1], [#2]).

### Removed

- `dist/` is no longer committed to the repository ([#1]).

[#1]: https://github.com/deiu/secure-webstore/pull/1
[#2]: https://github.com/deiu/secure-webstore/pull/2
[#3]: https://github.com/deiu/secure-webstore/pull/3
[2.0.0]: https://github.com/deiu/secure-webstore/releases/tag/2.0.0
