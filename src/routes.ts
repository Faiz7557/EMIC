import { useSyncExternalStore } from "react";

export const routes = [
  { path: "/", label: "Ruang tunggu", title: "Apa yang terjadi saat seseorang batuk?", group: "Apa yang terjadi?" },
  { path: "/dasbor", label: "Dasbor pengelola", title: "Apa yang dilihat pengelola?", group: "Apa yang terjadi?" },
  { path: "/alat", label: "Simpul dan pager", title: "Apa isi alatnya?", group: "Apa alatnya?" },
  { path: "/batas-audio", label: "Batas audio", title: "Apa yang keluar dari alat?", group: "Apa alatnya?" },
  { path: "/ambang", label: "Uji ambang", title: "Kenapa dua tingkat?", group: "Bisakah dipercaya?" },
  { path: "/bukti", label: "Status bukti", title: "Seberapa kuat buktinya?", group: "Bisakah dipercaya?" },
] as const;

export type RoutePath = (typeof routes)[number]["path"];

export function parseHash(hash: string): { path: RoutePath; demo: boolean } {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const route = routes.find((route) => route.path === path);
  return { path: route?.path ?? "/", demo: !!route && new URLSearchParams(query).get("demo") === "1" };
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "#/");
  const route = parseHash(hash);
  return { ...route, hash, demo: route.demo || new URLSearchParams(window.location.search).get("demo") === "1" };
}
