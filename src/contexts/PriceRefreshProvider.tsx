import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useQueryClient } from "@tanstack/react-query";

import api from "../api/api";
import { useAuth } from "./AuthProvider";

const STORAGE_KEY = "mip.realtime-price-refresh";
const REFRESH_INTERVAL_MS = 30_000;
const PRICE_QUERY_KEYS = new Set([
  "watchlist-items",
  "positions",
  "portfolio-summary",
  "portfolios",
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
  const { authenticated } = useAuth();
  const [enabled, setEnabledState] = useState(initialEnabled);
  const [waitingForPrices, setWaitingForPrices] = useState(false);
  const refreshInProgress = useRef(false);
  const pollingDeadline = useRef(0);

  const refetchPriceQueries = useCallback(async () => {
    await queryClient.refetchQueries({
      type: "active",
      predicate: (query) => {
        const rootKey = query.queryKey[0];
        return typeof rootKey === "string" && PRICE_QUERY_KEYS.has(rootKey);
      },
    });
  }, [queryClient]);

  const refreshNow = useCallback(async (silentFeedback = false) => {
    if (!authenticated || refreshInProgress.current) return;

    refreshInProgress.current = true;
    try {
      const response = await api.post<{ enqueued_count: number }>("/market-data/prices/refresh", undefined, { silentFeedback });
      if (response.data.enqueued_count > 0) {
        pollingDeadline.current = Date.now() + 180_000;
        setWaitingForPrices(true);
      }
      await refetchPriceQueries();
    } catch (error) {
      console.error("[MIP prices] Live price refresh failed", error);
    } finally {
      refreshInProgress.current = false;
    }
  }, [authenticated, refetchPriceQueries]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    window.localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  useEffect(() => {
    if (!enabled || !authenticated) return undefined;

    void refreshNow(true);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshNow(true);
      }
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, authenticated, refreshNow]);

  useEffect(() => {
    if (!authenticated || !waitingForPrices) return undefined;
    let cancelled = false;
    let polling = false;
    const intervalId = window.setInterval(async () => {
      if (Date.now() >= pollingDeadline.current) {
        setWaitingForPrices(false);
        return;
      }
      if (polling || document.visibilityState !== "visible") return;
      polling = true;
      try {
        await refetchPriceQueries();
        const pending = queryClient.getQueryCache().findAll({ type: "active" }).some((query) => {
          if (!PRICE_QUERY_KEYS.has(String(query.queryKey[0]))) return false;
          const rows = Array.isArray(query.state.data) ? query.state.data : [query.state.data];
          return rows.some((row) => row && (
            row.price_refresh_pending === true ||
            ["PENDING", "PROCESSING"].includes(row.price_refresh_status)
          ));
        });
        if (!cancelled && !pending) setWaitingForPrices(false);
      } catch (error) {
        console.error("[MIP prices] Price polling failed", error);
      } finally {
        polling = false;
      }
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authenticated, waitingForPrices, queryClient, refetchPriceQueries]);

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
