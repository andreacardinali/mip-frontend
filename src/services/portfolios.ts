import api from "../api/api";

import type {
  Portfolio,
  PortfolioSummary,
  PortfolioUpsertRequest,
} from "../types/portfolio";

export async function getPortfolios(): Promise<Portfolio[]> {
  const response = await api.get("/portfolios");
  return response.data;
}

export async function savePortfolio(payload: PortfolioUpsertRequest) {
  const response = await api.post("/portfolios/upsert", payload);
  return response.data;
}

export async function createPortfolio(
  name: string,
  description: string,
  baseCurrency = "EUR",
) {
  return savePortfolio({
    name,
    description,
    portfolio_type: "PORTFOLIO",
    base_currency: baseCurrency,
  });
}

export async function deletePortfolio(portfolioId: string) {
  const response = await api.delete(`/portfolios/${portfolioId}`);
  return response.data;
}

export async function getPortfolioSummary(
  portfolioId: string,
): Promise<PortfolioSummary> {
  const response = await api.get(`/portfolios/${portfolioId}/summary`);
  return response.data;
}
