export type PortfolioMatchType =
  | "EXACT_INSTRUMENT"
  | "SAME_ISIN"
  | "SAME_ENTITY"
  | "NO_MATCH";

export interface ScreenerInstrument {
  instrument_id: string;
  symbol: string;
  exchange: string | null;
  currency_code: string | null;
  isin: string | null;
  is_source?: boolean;
  same_isin?: boolean;
}

export interface ScreenerPortfolioPosition {
  position_id: string;
  portfolio_id: string;
  portfolio_name: string;
  instrument_id: string;
  symbol: string;
  exchange: string | null;
  currency_code: string | null;
  isin: string | null;
  quantity: number | string;
  match_type: Exclude<PortfolioMatchType, "NO_MATCH">;
}

export interface ScreenerOpportunity {
  opportunity_id: string;
  signal_id: string;
  entity_id: string;
  entity_name: string;
  instrument_id: string;
  source_instrument_id: string;
  symbol: string;
  source_symbol: string;
  source_exchange: string | null;
  source_currency_code: string | null;
  source_isin: string | null;
  direction: string;
  origin: string;
  attention_score: number | null;
  technical_score: number | null;
  quant_score: number | null;
  llm_score: number | null;
  composite_score: number;
  ranking_position: number;
  verdict: string | null;
  summary: string | null;
  evidence: Record<string, unknown> | null;
  algorithm_version: string;
  created_at: string;
  updated_at: string;
  portfolio_match: boolean;
  portfolio_match_type: PortfolioMatchType;
  portfolio_position_count: number;
  portfolio_symbols: string[];
  portfolio_names: string[];
  portfolio_positions: ScreenerPortfolioPosition[];
  alternative_instruments: ScreenerInstrument[];
}

export interface ScreenerFilters {
  algorithm_version?: string;
  origin?: string;
  direction?: string;
  verdict?: string;
  portfolio_match?: boolean;
  minimum_score?: number;
  query?: string;
  limit?: number;
}
