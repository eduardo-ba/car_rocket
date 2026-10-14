// Saved settings (localStorage) and the chosen song (IndexedDB, because songs are too big
// for localStorage). Every call is wrapped so the game still works in private windows.
const PREFIX = 'rcms-';

export const prefs = {
  get(key, fallback = null){
    try { const v = localStorage.getItem(PREFIX + key); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  },
  set(key, value){
    try { localStorage.setItem(PREFIX + key, String(value)); } catch (e) {}
  }
};

let dbPromise = null;
function openDB(){
  if (!dbPromise){
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open('rc-mega-soccer', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    }).catch(err => { dbPromise = null; throw err; });
  }
  return dbPromise;
}

async function run(mode, fn){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const songStore = {
  get: () => run('readonly', s => s.get('song')),
  set: record => run('readwrite', s => s.put(record, 'song')),
  clear: () => run('readwrite', s => s.delete('song'))
};

