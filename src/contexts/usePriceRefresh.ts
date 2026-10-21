// contexts/usePriceRefresh.ts

import { useContext } from "react";
import { PriceRefreshContext } from "./PriceRefreshContext";

export function usePriceRefresh() {
  const context = useContext(PriceRefreshContext);

  if (context === undefined) {
    throw new Error(
      "usePriceRefresh must be used within a PriceRefreshProvider",
    );
  }

  return context;
}