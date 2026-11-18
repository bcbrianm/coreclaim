// Single guarded service-worker registrar. Never registers in dev, iframes, or Lovable preview hosts.
const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;
const LOVABLE_HOSTS = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"];

function refused(): boolean {
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  const host = window.location.hostname.toLowerCase();
  const label = host.split(".")[0];
  if (LOVABLE_HOSTS.some((h) => host.endsWith(h)) && PREVIEW_LABEL.test(label)) return true;
  if (host === "id-preview--56ec43aa-7994-5cd8-a276-bf3ef54cd903.lovable.app") return true;
  if (/^project--[a-z0-9-]+-dev\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host)) return true;
  for (const d of ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"]) if (host === d || host.endsWith("." + d)) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterAppWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js") || r.installing?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()));
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (refused()) { void unregisterAppWorkers(); return; }
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}
