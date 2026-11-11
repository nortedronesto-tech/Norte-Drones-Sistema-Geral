// IndexedDB mínimo (sem biblioteca): guarda no aparelho a fila do financeiro e as fotos de recibo feitas sem sinal.
// Só roda no navegador. A lógica da fila fica em lib/finance-queue.ts (pura e testada).
import type { AsyncStore } from "./finance-queue";

const DB_NAME = "norte-offline";
const DB_VERSION = 1;
export const STORES = { queue: "queue", blobs: "blobs" } as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Este navegador não permite guardar dados no aparelho."));
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of Object.values(STORES)) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error ?? new Error("Não foi possível abrir o armazenamento do aparelho.")); };
  });
  return dbPromise;
}

function run<R>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<R>): Promise<R> {
  return openDb().then((db) => new Promise<R>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error("Gravação cancelada (sem espaço no aparelho?)."));
  }));
}

export function idbStore<T>(store: string): AsyncStore<T> {
  return {
    all: () => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
    get: (k) => run<T | undefined>(store, "readonly", (s) => s.get(k) as IDBRequest<T | undefined>),
    put: async (k, v) => void (await run(store, "readwrite", (s) => s.put(v, k))),
    del: async (k) => void (await run(store, "readwrite", (s) => s.delete(k))),
  };
}
