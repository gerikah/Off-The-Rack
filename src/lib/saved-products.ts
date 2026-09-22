"use client";

import { useMemo, useSyncExternalStore } from "react";

const storageKey = "off-the-rack:saved-products:v1";
const changeEvent = "off-the-rack:saved-products-changed";
let sessionValue = "[]";
let inMemoryOnly = false;

function snapshot() {
  if (inMemoryOnly) return sessionValue;
  try {
    return window.localStorage.getItem(storageKey) || "[]";
  } catch {
    return sessionValue;
  }
}

function readIds(value: string): string[] {
  try {
    if (value.length > 20_000) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (id): id is string =>
                typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id),
            ),
          ),
        ].slice(0, 200)
      : [];
  } catch {
    return [];
  }
}

function subscribe(callback: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) callback();
  };
  window.addEventListener("storage", storageChanged);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", storageChanged);
    window.removeEventListener(changeEvent, callback);
  };
}

export function useSavedProducts() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const savedIds = useMemo(() => readIds(value), [value]);

  function toggleSaved(id: string) {
    const current = readIds(snapshot());
    const saved = !current.includes(id);
    const next = saved
      ? [...current.slice(-199), id]
      : current.filter((item) => item !== id);
    sessionValue = JSON.stringify(next);
    let persistent = true;
    try {
      window.localStorage.setItem(storageKey, sessionValue);
      inMemoryOnly = false;
    } catch {
      persistent = false;
      inMemoryOnly = true;
    }
    window.dispatchEvent(new Event(changeEvent));
    return { saved, persistent };
  }

  return { savedIds, toggleSaved };
}
