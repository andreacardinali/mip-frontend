// contexts/PriceRefreshContext.ts

import { createContext } from "react";

export interface PriceRefreshContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  refreshNow: () => Promise<void>;
  intervalMs: number;
};

export const PriceRefreshContext =
  createContext<PriceRefreshContextValue | undefined>(undefined);