export interface Portfolio {
  portfolio_id: string;
  user_id: string;
  name: string;
  description?: string | null;
  portfolio_type?: string | null;
  base_currency?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioUpsertRequest {
  portfolio_id?: string;
  name: string;
  description?: string | null;
  portfolio_type: string;
  base_currency: string;
}
