/**
 * File-based router.
 *
 * Every file in `client/pages/` is a route:
 *   pages/index.tsx         → /
 *   pages/missions.tsx      → /missions
 *   pages/replay/[id].tsx   → /replay/:id
 *   pages/404.tsx           → anything that does not match
 *
 * Pages are code-split and loaded on first visit (and prefetched when a link is
 * hovered), so the first page a visitor opens only downloads its own code.
 */
import {
  lazy,
  Suspense,
  useEffect,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react";

type PageModule = { default: ComponentType };
type Loader = () => Promise<PageModule>;
type Route = {
  path: string;
  pattern: RegExp;
  keys: string[];
  load: Loader;
  Page: ComponentType;
};

const modules = import.meta.glob<PageModule>("./pages/**/*.tsx");

function toPath(file: string) {
  const path = file
    .replace(/^\.\/pages/, "")
    .replace(/\.tsx$/, "")
    .replace(/\/index$/, "")
    .replace(/\[(\w+)\]/g, ":$1");
  return path || "/";
}

function compile(path: string) {
  const keys: string[] = [];
  const source = path
    .split("/")
    .map((part) => {
      if (!part.startsWith(":")) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      keys.push(part.slice(1));
      return "([^/]+)";
    })
    .join("/");
  return { keys, pattern: new RegExp(`^${source || "/"}/?$`) };
}

const routes: Route[] = [];
let notFound: Route | undefined;
for (const [file, load] of Object.entries(modules)) {
  const path = toPath(file);
  const route = { path, load, Page: lazy(load), ...compile(path) };
  if (path === "/404") notFound = route;
  else routes.push(route);
}
// Static segments win over dynamic ones (/replay/latest before /replay/:id).
routes.sort((a, b) => a.keys.length - b.keys.length || b.path.length - a.path.length);

function match(pathname: string) {
  for (const route of routes) {
    const hit = route.pattern.exec(pathname);
    if (!hit) continue;
    const params: Record<string, string> = {};
    route.keys.forEach((key, i) => (params[key] = decodeURIComponent(hit[i + 1])));
    return { route, params };
  }
  return notFound ? { route: notFound, params: {} } : null;
}

/* ---------- location store ---------- */
const NAVIGATE = "hood-rivals:navigate";
const subscribe = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  window.addEventListener(NAVIGATE, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(NAVIGATE, notify);
  };
};
const snapshot = () => location.pathname + location.search;

export function useLocation() {
  const href = useSyncExternalStore(subscribe, snapshot, snapshot);
  const url = new URL(href, location.origin);
  return { pathname: url.pathname, search: url.search, searchParams: url.searchParams };
}

export function useParams<T extends Record<string, string>>() {
  const { pathname } = useLocation();
  return (match(pathname)?.params ?? {}) as T;
}

export function navigate(to: string, { replace = false } = {}) {
  if (to === snapshot()) return;
  history[replace ? "replaceState" : "pushState"](null, "", to);
  window.dispatchEvent(new Event(NAVIGATE));
  if (!replace) window.scrollTo({ top: 0 });
}

export function prefetch(to: string) {
  const hit = match(new URL(to, location.origin).pathname);
  void hit?.route.load().catch(() => {});
}

/** True when `to` is the current page (used for nav highlighting). */
export function useIsActive(to: string) {
  const { pathname } = useLocation();
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref?: Ref<HTMLAnchorElement>;
  to: string;
  replace?: boolean;
  children: ReactNode;
};

/** A real link (open-in-new-tab, copy link, crawlers all work) that navigates without a reload. */
export function Link({ to, replace, onClick, onPointerEnter, onFocus, ...rest }: LinkProps) {
  const onNavigate = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== "_self") return;
    e.preventDefault();
    navigate(to, { replace });
  };
  return (
    <a
      href={to}
      {...rest}
      onClick={onNavigate}
      onPointerEnter={(e) => {
        prefetch(to);
        onPointerEnter?.(e);
      }}
      onFocus={(e) => {
        prefetch(to);
        onFocus?.(e);
      }}
    />
  );
}

/** Sets the tab title for the current page. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Hood Rivals` : "Hood Rivals — A small world. A long memory.";
  }, [title]);
}

export function RouterView({ fallback }: { fallback: ReactNode }) {
  const { pathname } = useLocation();
  const hit = match(pathname);
  if (!hit) return null;
  const { Page } = hit.route;
  return (
    <Suspense fallback={fallback}>
      <Page key={hit.route.path} />
    </Suspense>
  );
}
