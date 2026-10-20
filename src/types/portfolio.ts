export interface Portfolio {
  portfolio_id: string;
  user_id: string;
  name: string;
  description?: string | null;
  portfolio_type?: string | null;
  base_currency?: string | null;
  invested_value?: number | string | null;
  portfolio_value?: number | string | null;
  profit_loss?: number | string | null;
  profit_loss_pct?: number | string | null;
  positions_count?: number | string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioSummary {
  portfolio_currency: string;
  reporting_currency: string;
  invested_value_native: number | string;
  portfolio_value_native: number | string;
  profit_loss_native: number | string;
  invested_value_reporting: number | string;
  portfolio_value_reporting: number | string;
  profit_loss_reporting: number | string;
  profit_loss_pct: number | string | null;
  positions_count: number | string;
}

export interface PortfolioUpsertRequest {
  portfolio_id?: string;
  name: string;
  description?: string | null;
  portfolio_type: string;
  base_currency: string;
}
