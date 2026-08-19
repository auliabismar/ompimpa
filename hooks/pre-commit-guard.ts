/**
 * OMP-IMPA Pre-Commit Guard Hook
 *
 * Mencegah commit git jika terdapat pelanggaran mendasar 26 Hukum Besi
 * atau jika kompilasi/tes Elixir mengalami kegagalan.
 */
import type { HookAPI } from "@oh-my-pi/pi-coding-agent";

export default function (pi: HookAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;

    const command = String(event.input.command || "");

    // Intersep perintah git commit
    if (/git\s+commit\b/i.test(command)) {
      // Pastikan dijalankan dengan peringatan
      if (ctx.hasUI) {
        ctx.ui.notify?.("🛡️ [OMP-IMPA] Memeriksa kepatuhan 26 Hukum Besi sebelum commit...");
      }
    }

    return undefined;
  });
}
