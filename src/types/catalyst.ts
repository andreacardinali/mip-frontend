export type CatalystScope = "MY_ASSETS" | "PORTFOLIO" | "WATCHLIST" | "ALL";

export type Catalyst = {
  catalyst_id: string;
  entity_id: string;
  entity_name: string;
  symbol: string | null;
  exchange: string | null;
  catalyst_type: string | null;
  catalyst_date: string | null;
  status: string | null;
  importance: number | string | null;
  title: string | null;
  source: string | null;
  raw_payload: Record<string, unknown> | null;
  in_portfolio: boolean;
  in_watchlist: boolean;
  asset_scope: "PORTFOLIO" | "WATCHLIST" | "BOTH" | "GLOBAL";
};

export type CatalystFacets = {
  types: string[];
  statuses: string[];
  sources: string[];
};

export type CatalystFilters = {
  scope: CatalystScope;
  date_from?: string;
  date_to?: string;
  catalyst_type?: string;
  status?: string;
  importance_min?: number;
  query?: string;
  limit?: number;
};
