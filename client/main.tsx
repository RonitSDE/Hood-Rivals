import { createRoot } from "react-dom/client";
import { AppProvider } from "./app/AppState";
import { Layout } from "./components/Layout";
import "./style.css";
import "./theme.css";

// Old share links used query strings; send them to their page URLs.
const legacy = new URLSearchParams(location.search);
if (legacy.get("replay"))
  history.replaceState(null, "", "/replay/" + encodeURIComponent(legacy.get("replay")!));
else if (legacy.get("room") && location.pathname === "/")
  history.replaceState(null, "", "/play" + location.search);

createRoot(document.getElementById("root")!).render(
  <AppProvider>
    <Layout />
  </AppProvider>,
);
