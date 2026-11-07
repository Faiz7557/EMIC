import { useEffect, useRef } from "react";
import { routes, useRoute, type RoutePath } from "./routes";
import { SimProvider } from "./store/sim-store";
import { Shell } from "./ui/shell";
import Ruang from "./pages/ruang";
import Dasbor from "./pages/dasbor";
import Alat from "./pages/alat";
import BatasAudio from "./pages/batas-audio";
import Ambang from "./pages/ambang";
import Bukti from "./pages/bukti";

const pages = { "/": Ruang, "/dasbor": Dasbor, "/alat": Alat, "/batas-audio": BatasAudio, "/ambang": Ambang, "/bukti": Bukti } satisfies Record<RoutePath, typeof Ruang>;

function Router() {
  const { path, hash, demo } = useRoute();
  const previous = useRef(path);
  const main = useRef<HTMLElement>(null);
  const Page = pages[path];

  useEffect(() => {
    const rawPath = hash.replace(/^#/, "").split("?")[0];
    if (!routes.some((route) => route.path === rawPath)) {
      window.location.replace(`${window.location.pathname}${window.location.search}#/`);
    }
    document.title = `SUAR · ${routes.find((route) => route.path === path)!.label}`;
    if (previous.current !== path) {
      main.current?.focus();
      window.scrollTo(0, 0);
      previous.current = path;
    }
  }, [hash, path]);

  return <Shell path={path} demoRequested={demo}>
    <main id="main-content" className="page" key={path} ref={main} tabIndex={-1}><Page /></main>
  </Shell>;
}

export default function App() {
  return <SimProvider><Router /></SimProvider>;
}
