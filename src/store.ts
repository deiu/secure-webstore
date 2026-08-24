// Forked from https://github.com/jakearchibald/idb-keyval/commit/ea7d507
// Adds a function for closing the database, ala https://github.com/jakearchibald/idb-keyval/pull/65
class Store {
  storeName: string
  private _dbName: string
  private _storeName: string
  private _dbp?: Promise<IDBDatabase>

  constructor (dbName = 'keyval-store', storeName = 'keyval') {
    this.storeName = storeName
    this._dbName = dbName
    this._storeName = storeName
  }

  async _withIDBStore <T>(type: IDBTransactionMode, callback: (store: IDBObjectStore) => T): Promise<T> {
    const db = await this._init()

    let ret: T | undefined
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, type)
      transaction.oncomplete = () => resolve()
      transaction.onabort = transaction.onerror = () => reject(transaction.error)
      ret = callback(transaction.objectStore(this.storeName))
    });
    return ret!;
  }

  async _init (): Promise<IDBDatabase> {
    if (!this._dbp) {
      // assigned before the first await so concurrent callers share one
      // connection instead of each opening (and leaking) their own
      this._dbp = new Promise<IDBDatabase>((resolve, reject) => {
        const idb = globalThis.indexedDB || (typeof window !== 'undefined' ? window.indexedDB : undefined)
        if (!idb) {
          throw new Error('IndexedDB is not supported in this environment')
        }
        const openreq = idb.open(this._dbName, 1)
        openreq.onerror = () => reject(openreq.error)
        openreq.onsuccess = () => resolve(openreq.result)
        // First time setup: create an empty object store
        openreq.onupgradeneeded = () => {
          openreq.result.createObjectStore(this._storeName)
        }
      }).then(db => {
        db.onclose = () => {
          this._dbp = undefined
        }
        db.onversionchange = (e) => {
          if (e.newVersion === null) { // an attempt is made to delete the db
            db.close() // force close our connection to the db
            this._dbp = undefined
          }
        }
        return db
      })
      // a failed open must not poison the store for every later call
      this._dbp.catch(() => { this._dbp = undefined })
    }
    return this._dbp
  }

  async _close () {
    const dbp = this._dbp
    this._dbp = undefined
    if (!dbp) {
      return
    }
    try {
      (await dbp).close()
    } catch {
      // the connection never opened, so there is nothing to close
    }
  }
}

let store: Store | undefined

function getDefaultStore () {
  if (!store) {
    store = new Store()
  }
  return store
}

async function get (key: IDBValidKey | IDBKeyRange, store = getDefaultStore()) {
  const request = await store._withIDBStore('readonly', store =>
    store.get(key)
  )
  return request.result;
}

function set (key: IDBValidKey, value: any, store = getDefaultStore()) {
  return store._withIDBStore('readwrite', store => {
    store.put(value, key)
  })
}

function del (key: IDBValidKey | IDBKeyRange, store = getDefaultStore()) {
  return store._withIDBStore('readwrite', store => {
    store.delete(key)
  })
}

function clear (store = getDefaultStore()) {
  return store._withIDBStore('readwrite', store => {
    store.clear()
  })
}

function keys (store = getDefaultStore()): Promise<IDBValidKey[]> {
  return store._withIDBStore('readonly', store => {
    // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
    // And openKeyCursor isn't supported by Safari.
    const keys: IDBValidKey[] = [];
    (store.openKeyCursor || store.openCursor).call(store).onsuccess = function () {
      if (!this.result) {
        return
      }
      keys.push(this.result.key)
      this.result.continue()
    }
    return keys
  })
}

function close (store = getDefaultStore()) {
  return store._close()
}

export { Store, get, set, del, clear, keys, close }
