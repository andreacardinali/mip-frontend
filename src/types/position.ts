export interface Position {
  position_id: string;

  portfolio_id: string;

  symbol: string;

  quantity: number;

  average_cost: number;

  market_value?: number;
}
