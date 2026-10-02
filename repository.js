const DATABASE = "DondeLoDejeWeb";
const STORE = "placements";

export class IndexedDBPlacementRepository {
  constructor() { this.database = null; }

  open() {
    if (this.database) return Promise.resolve(this.database);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => {
        this.database = request.result;
        this.database.onversionchange = () => { this.database.close(); this.database = null; };
        resolve(this.database);
      };
      request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento."));
      request.onblocked = () => reject(new Error("Cierra otras ventanas de la app y vuelve a intentarlo."));
    });
  }

  async all() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)));
      request.onerror = () => reject(request.error || new Error("No se pudieron leer los datos."));
    });
  }

  async add(record) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).add(record);
      transaction.oncomplete = () => resolve(record);
      transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar."));
      transaction.onabort = () => reject(transaction.error || new Error("No se pudo guardar."));
    });
  }

  async merge(records) {
    const existing = await this.all();
    const ids = new Set(existing.map(record => record.id));
    const additions = records.filter(record => !ids.has(record.id));
    if (!additions.length) return 0;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      additions.forEach(record => store.add(record));
      transaction.oncomplete = () => resolve(additions.length);
      transaction.onerror = () => reject(transaction.error || new Error("No se pudo importar la copia."));
      transaction.onabort = () => reject(transaction.error || new Error("No se pudo importar la copia."));
    });
  }
}
