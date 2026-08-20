/**
 * OMP-IMPA Pre-Commit Guard Hook (Compatibility Bridge)
 *
 * Meneruskan ke modul terpadu hooks/ompimpa-guard.ts
 */
import ompimpaGuard, { type OmpEventBus } from "./ompimpa-guard";

export default function (pi: OmpEventBus) {
  ompimpaGuard(pi);
}
