import type { Scenario, WorldState } from "./engine/types";
export interface SaveFile {
  format: "hollow-save-v1";
  scenario: Scenario;
  state: WorldState;
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("hollow-world", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("saves");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Local save storage unavailable; use Export instead."));
  });
}
export async function saveLocal(file: SaveFile) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("saves", "readwrite");
      tx.objectStore("saves").put(file, "latest");
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new Error("Save failed. Use Export to keep this world."));
    });
  } finally {
    db.close();
  }
}
export async function loadLocal(): Promise<SaveFile> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("saves")
        .objectStore("saves")
        .get("latest");
      request.onsuccess = () =>
        request.result
          ? resolve(request.result)
          : reject(new Error("No local save yet."));
      request.onerror = () => reject(new Error("Could not read saved world."));
    });
  } finally {
    db.close();
  }
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
