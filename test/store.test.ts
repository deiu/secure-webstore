import 'fake-indexeddb/auto';
import { describe, it, expect, assert } from 'vitest';
import { Store as SecStore, _idb } from '../src/secure-webstore';

describe('Store', function () {
  describe('API', () => {
    const storeName = 'test-store';
    const passphrase = 'password';
    const newPass = 'new password';
    const data = { foo: 'bar' };

    it('Should fail to initialize if store name or passphrase are not provided', async () => {
      let store: any;
      let err: any;
      try {
        store = new (SecStore as any)();
      } catch (error) {
        err = error;
      }
      assert.isUndefined(store);
      assert.equal(err.message, 'Store name and passphrase required', 'Reject if no params are provided');

      try {
        store = new SecStore(storeName, undefined as any);
      } catch (error) {
        err = error;
      }
      assert.isUndefined(store);
      assert.equal(err.message, 'Store name and passphrase required', 'Reject if no pass');

      try {
        store = new SecStore(undefined as any, passphrase);
      } catch (error) {
        err = error;
      }
      assert.isUndefined(store);
      assert.equal(err.message, 'Store name and passphrase required', 'Reject if no store');
    });

    it('Should successfully initialize', async () => {
      let err: any;
      let store: any;
      try {
        store = new SecStore(storeName, passphrase);
        await store.init();
      } catch (error) {
        err = error;
      }
      assert.isUndefined(err);
      await store.close();
    });

    it('Should fail to initialize existing store with bad password', async () => {
      let err: any;
      let store: any;
      try {
        store = new SecStore(storeName, 'foo');
        await store.init();
      } catch (error) {
        err = error;
      }
      assert.equal(err.message, 'Wrong passphrase');
      await store?.close();
    });

    it('Should successfully set an encrypted key/value pair', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      await store.set('one', data);

      const _store = new _idb.Store(storeName, storeName);
      const encItem: any = await _idb.get('one', _store);
      assert.exists(encItem.iv);
      assert.exists(encItem.ciphertext);
      await store.close();
    });

    it('Should successfully get an non-existing key/value pair', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      assert.isUndefined(await store.get('baz'));
      await store.close();
    });

    it('Should successfully get an encrypted key/value pair', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      const dec = await store.get('one');
      assert.deepEqual(dec, data);
      await store.close();
    });

    it('Should successfully list all keys in the store', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      const items = await store.keys(); // [ 'one' ]
      assert.equal(items.length, 1);
      await store.close();
    });

    it('Should successfully call delete on a non-existent key from the store', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      await store.del('two');

      const items = await store.keys(); // [ 'one' ]
      assert.equal(items.length, 1);
      await store.close();
    });

    it('Should successfully delete a key from the store', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      await store.del('one');

      const items = await store.keys(); // []
      assert.equal(items.length, 0);
      await store.close();
    });

    it('Should successfully clear the store', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      await store.clear();

      const items = await store.keys(); // []
      assert.equal(items.length, 0);
      await store.close();
    });

    it('Should successfully export data', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      await store.set('one', data);

      const dump = await store.export();

      const keys = await store.keys();
      for (const key of keys) {
        assert.exists(Object.keys(dump), String(key));
      }
      await store.close();
    });

    it('Should fail to import data if none is provided', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      let err: any;
      try {
        await (store as any).import();
      } catch (error) {
        err = error;
      }
      assert.equal(err.message, 'No data provided');

      try {
        await store.import({});
      } catch (error) {
        err = error;
      }
      assert.equal(err.message, 'No data provided');

      try {
        await store.import('foo' as any);
      } catch (error) {
        err = error;
      }
      assert.equal(err.message, 'Data must be a valid JSON object');

      await store.close();
    });

    it('Should successfully import data', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      const keys = await store.keys();
      const dump = await store.export();

      await store.del('one');

      await store.import(dump);

      assert.deepEqual(keys, await store.keys());

      await store.close();
    });

    it('Should fail to updatePassphrase with wrong (previous) password', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      let err: any;
      try {
        await store.updatePassphrase('foo', newPass);
      } catch (error) {
        err = error;
      }
      assert.equal(err.message, 'Wrong passphrase');
      await store.close();
    });

    it('Should successfully updatePassphrase with the new password and retrieve saved data', async () => {
      const store = new SecStore(storeName, passphrase);
      await store.init();

      await store.set('one', data);

      await store.updatePassphrase(passphrase, newPass);

      const dec = await store.get('one');
      assert.deepEqual(dec, data);
      await store.close();
    });
  });

  describe('Lifecycle', () => {
    const passphrase = 'password';
    const data = { foo: 'bar' };

    it('Should refuse to encrypt before init', async () => {
      const store = new SecStore('lifecycle-uninit', passphrase);

      let err: any;
      try {
        await store.set('one', data);
      } catch (error) {
        err = error;
      }
      assert.equal(err.message, 'Master key not initialized');
      await store.close();
    });

    it('Should destroy the database and drop its contents', async () => {
      const storeName = 'lifecycle-destroy';
      const store = new SecStore(storeName, passphrase);
      await store.init();
      await store.set('one', data);
      assert.deepEqual(await store.keys(), ['one']);

      await store.destroy();

      // a fresh store on the same name starts empty, which proves the
      // database was deleted rather than merely closed
      const reopened = new SecStore(storeName, passphrase);
      await reopened.init();
      assert.deepEqual(await reopened.keys(), []);
      await reopened.close();
    });

    it('Should close a second connection so destroy is not blocked', async () => {
      const storeName = 'lifecycle-versionchange';
      const first = new SecStore(storeName, passphrase);
      await first.init();
      await first.set('one', data);

      const second = new SecStore(storeName, passphrase);
      await second.init();

      // deleteDatabase blocks while another connection is open, so this only
      // resolves because onversionchange closes the first connection
      await second.destroy();

      const reopened = new SecStore(storeName, passphrase);
      await reopened.init();
      assert.deepEqual(await reopened.keys(), []);
      await reopened.close();
    });

    it('Should report a missing IndexedDB implementation on destroy', async () => {
      const store = new SecStore('lifecycle-no-idb', passphrase);
      await store.init();

      const real = globalThis.indexedDB;
      delete (globalThis as any).indexedDB;
      let err: any;
      try {
        await store.destroy();
      } catch (error) {
        err = error;
      } finally {
        (globalThis as any).indexedDB = real;
      }
      assert.equal(err.message, 'IndexedDB is not supported in this environment');
    });

    it('Should report a missing IndexedDB implementation on open', async () => {
      const real = globalThis.indexedDB;
      delete (globalThis as any).indexedDB;
      let err: any;
      try {
        const store = new _idb.Store('lifecycle-no-idb-open', 'lifecycle-no-idb-open');
        await _idb.get('one', store);
      } catch (error) {
        err = error;
      } finally {
        (globalThis as any).indexedDB = real;
      }
      assert.equal(err.message, 'IndexedDB is not supported in this environment');
    });

    it('Should close the connection when the page is frozen', async () => {
      const storeName = 'lifecycle-freeze';
      const listeners: Record<string, Function[]> = {};
      const hadWindow = 'window' in globalThis;
      (globalThis as any).window = {
        addEventListener: (type: string, cb: Function) => {
          listeners[type] = listeners[type] || [];
          listeners[type].push(cb);
        }
      };

      try {
        const store = new SecStore(storeName, passphrase);
        await store.init();
        await store.set('one', data);

        assert.lengthOf(listeners.freeze || [], 1, 'init must register one freeze listener');
        listeners.freeze[0]();

        // the store reopens on demand, so a freeze must not lose data
        assert.deepEqual(await store.get('one'), data);
        await store.close();
      } finally {
        if (!hadWindow) {
          delete (globalThis as any).window;
        }
      }
    });
  });
});
