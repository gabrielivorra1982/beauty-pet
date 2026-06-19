/**
 * Registro del Service Worker de Kiwoko.
 * Solo se registra en producción y fuera de entornos de preview/dev de Lovable.
 * En cualquier contexto rechazado se intenta desregistrar SWs previos.
 */

const APP_SW_URL = "/sw.js";

function isForbiddenContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  // iframe (Lovable preview embebido)
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;
  return false;
}

async function unregisterAppSw(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const scriptUrl =
            r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
          return scriptUrl.endsWith(APP_SW_URL);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    // ignore
  }
}

export function registerPwa(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (isForbiddenContext()) {
    void unregisterAppSw();
    return;
  }
  // Registro diferido tras la carga para no competir con el render inicial.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(APP_SW_URL, { scope: "/" }).catch(() => {
      // silencioso: la app sigue funcionando sin SW
    });
  });
}
