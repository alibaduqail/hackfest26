// Simulated clinic signature. NOT cryptography: a deterministic stand-in so the engine stays sync and replay-safe.
// Label it "simulated signature" anywhere it shows in the UI or write-up.
import type { Pod } from "./types";

export const CLINIC_KEY = "hollow-clinic-key-v1";

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const sign = (id: string): string => fnv1a(id + CLINIC_KEY);
export const verify = (pod: Pick<Pod, "id" | "sig">): boolean => pod.sig === sign(pod.id);
