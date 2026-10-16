"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/gestao" }).catch(() => {
      /* sem SW o app continua funcionando online */
    });
  }, []);
  return null;
}
