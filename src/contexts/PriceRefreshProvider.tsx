import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "mip.realtime-price-refresh";
const REFRESH_INTERVAL_MS = 5_000;
const PRICE_QUERY_KEYS = new Set([
  "watchlist-items",
  "positions",
  "portfolio-summary",
]);

type PriceRefreshContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  refreshNow: () => Promise<void>;
  intervalMs: number;
};

const PriceRefreshContext = createContext<PriceRefreshContextValue | null>(null);

function initialEnabled() {
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function PriceRefreshProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabledState] = useState(initialEnabled);

  const refreshNow = useCallback(async () => {
    await queryClient.refetchQueries({
      type: "active",
      predicate: (query) => {
        const rootKey = query.queryKey[0];
        return typeof rootKey === "string" && PRICE_QUERY_KEYS.has(rootKey);
      },
    });
  }, [queryClient]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    window.localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    void refreshNow();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshNow();
      }
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, refreshNow]);

  const value = useMemo(
    () => ({ enabled, setEnabled, refreshNow, intervalMs: REFRESH_INTERVAL_MS }),
    [enabled, setEnabled, refreshNow],
  );

  return (
    <PriceRefreshContext.Provider value={value}>
      {children}
    </PriceRefreshContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePriceRefresh() {
  const context = useContext(PriceRefreshContext);
  if (!context) {
    throw new Error("usePriceRefresh must be used within PriceRefreshProvider");
  }
  return context;
}
