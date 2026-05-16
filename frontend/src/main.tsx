import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./index.css";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";

if (import.meta.env.DEV && "serviceWorker" in navigator) {
    navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
            Promise.all(registrations.map((registration) => registration.unregister()))
        )
        .catch(() => undefined);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AppProviders>
            <AppRouter />
        </AppProviders>
    </React.StrictMode>
);
