(() => {
  const Game = window.CubDep;

  const DB_NAME = 'cubic-depths';
  const DB_VERSION = 2;
  const WORLD_STORE = 'worlds';
  const CHUNK_STORE = 'chunkSnapshots';

  let dbPromise = null;
  let available = typeof indexedDB !== 'undefined';

  function openDb() {
    if (!available) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WORLD_STORE)) {
          db.createObjectStore(WORLD_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(CHUNK_STORE)) {
          const store = db.createObjectStore(CHUNK_STORE, { keyPath: 'id' });
          store.createIndex('worldId', 'worldId', { unique: false });
        } else {
          const store = request.transaction.objectStore(CHUNK_STORE);
          if (!store.indexNames.contains('worldId')) store.createIndex('worldId', 'worldId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        available = false;
        resolve(null);
      };
      request.onblocked = () => resolve(null);
    });
    return dbPromise;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionToPromise(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function chunkRecordId(worldId, chunkKey) {
    return `${worldId}:${chunkKey}`;
  }

  async function saveWorldMeta(worldMeta) {
    const db = await openDb();
    if (!db || !worldMeta || !worldMeta.id) return false;
    try {
      const tx = db.transaction(WORLD_STORE, 'readwrite');
      tx.objectStore(WORLD_STORE).put({ ...worldMeta, updatedAt: worldMeta.updatedAt || Date.now() });
      await transactionToPromise(tx);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function listWorldMetas() {
    const db = await openDb();
    if (!db) return [];
    try {
      const tx = db.transaction(WORLD_STORE, 'readonly');
      const worlds = await requestToPromise(tx.objectStore(WORLD_STORE).getAll());
      return (worlds || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (error) {
      return [];
    }
  }

  async function listChunkKeys(worldId) {
    const db = await openDb();
    if (!db || !worldId) return [];
    try {
      const tx = db.transaction(CHUNK_STORE, 'readonly');
      const index = tx.objectStore(CHUNK_STORE).index('worldId');
      const records = await requestToPromise(index.getAll(IDBKeyRange.only(worldId)));
      return (records || []).map((record) => record.chunkKey).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  async function deleteWorld(worldId) {
    const db = await openDb();
    if (!db || !worldId) return false;
    try {
      const tx = db.transaction([WORLD_STORE, CHUNK_STORE], 'readwrite');
      tx.objectStore(WORLD_STORE).delete(worldId);
      const chunkStore = tx.objectStore(CHUNK_STORE);
      const index = chunkStore.index('worldId');
      index.openCursor(IDBKeyRange.only(worldId)).onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };
      await transactionToPromise(tx);
      return true;
    } catch (error) {
      return false;
    }
  }

  function deleteWorldChunksInTransaction(tx, worldId) {
    const chunkStore = tx.objectStore(CHUNK_STORE);
    const index = chunkStore.index('worldId');
    index.openCursor(IDBKeyRange.only(worldId)).onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  }

  async function deleteWorldChunks(worldId) {
    const db = await openDb();
    if (!db || !worldId) return false;
    try {
      const tx = db.transaction(CHUNK_STORE, 'readwrite');
      deleteWorldChunksInTransaction(tx, worldId);
      await transactionToPromise(tx);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function copyWorldChunks(sourceWorldId, targetWorldId) {
    const db = await openDb();
    if (!db || !sourceWorldId || !targetWorldId || sourceWorldId === targetWorldId) return false;
    try {
      const tx = db.transaction(CHUNK_STORE, 'readwrite');
      deleteWorldChunksInTransaction(tx, targetWorldId);
      const chunkStore = tx.objectStore(CHUNK_STORE);
      const index = chunkStore.index('worldId');
      index.openCursor(IDBKeyRange.only(sourceWorldId)).onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;
        const record = { ...cursor.value };
        record.id = chunkRecordId(targetWorldId, record.chunkKey);
        record.worldId = targetWorldId;
        record.updatedAt = Date.now();
        chunkStore.put(record);
        cursor.continue();
      };
      await transactionToPromise(tx);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function saveChunkSnapshot(worldId, chunkKey, snapshot) {
    const db = await openDb();
    if (!db || !worldId || !chunkKey || !snapshot || !snapshot.blocks || !snapshot.fluidLevel) return false;
    const record = {
      id: chunkRecordId(worldId, chunkKey),
      worldId,
      chunkKey,
      cx: snapshot.cx,
      cy: snapshot.cy,
      cz: snapshot.cz,
      blocks: snapshot.blocks.buffer.slice(snapshot.blocks.byteOffset, snapshot.blocks.byteOffset + snapshot.blocks.byteLength),
      fluidLevel: snapshot.fluidLevel.buffer.slice(snapshot.fluidLevel.byteOffset, snapshot.fluidLevel.byteOffset + snapshot.fluidLevel.byteLength),
      grassLevel: snapshot.grassLevel
        ? snapshot.grassLevel.buffer.slice(snapshot.grassLevel.byteOffset, snapshot.grassLevel.byteOffset + snapshot.grassLevel.byteLength)
        : null,
      waterSources: snapshot.waterSources || [],
      lavaSources: snapshot.lavaSources || [],
      blockDamage: snapshot.blockDamage || {},
      updatedAt: Date.now(),
    };
    try {
      const tx = db.transaction(CHUNK_STORE, 'readwrite');
      tx.objectStore(CHUNK_STORE).put(record);
      await transactionToPromise(tx);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function loadChunkSnapshot(worldId, chunkKey) {
    const db = await openDb();
    if (!db || !worldId || !chunkKey) return null;
    try {
      const tx = db.transaction(CHUNK_STORE, 'readonly');
      const record = await requestToPromise(tx.objectStore(CHUNK_STORE).get(chunkRecordId(worldId, chunkKey)));
      if (!record || !record.blocks || !record.fluidLevel) return null;
      return {
        cx: record.cx,
        cy: record.cy,
        cz: record.cz,
        chunkKey: record.chunkKey,
        blocks: new Uint16Array(record.blocks),
        fluidLevel: new Uint8Array(record.fluidLevel),
        grassLevel: record.grassLevel ? new Uint8Array(record.grassLevel) : null,
        waterSources: record.waterSources || [],
        lavaSources: record.lavaSources || [],
        blockDamage: record.blockDamage || {},
      };
    } catch (error) {
      return null;
    }
  }

  Game.storage3d = {
    saveWorldMeta,
    listWorldMetas,
    listChunkKeys,
    deleteWorld,
    deleteWorldChunks,
    copyWorldChunks,
    saveChunkSnapshot,
    loadChunkSnapshot,
    isAvailable: () => available,
  };
})();
