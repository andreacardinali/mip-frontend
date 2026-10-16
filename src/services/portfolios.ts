import api from "../api/api";

export async function getPortfolios() {
  const response =
    await api.get("/portfolios");

  return response.data;
}

export async function createPortfolio(
  name: string,
  description: string,
) {
  const response =
    await api.post(
      "/portfolios",
      {
        name,
        description,
      },
    );

  return response.data;
}

export async function deletePortfolio(
  portfolioId: string,
) {
  const response =
    await api.delete(
      `/portfolios/${portfolioId}`,
    );

  return response.data;
}

export async function getPortfolioSummary(
  portfolioId: string
) {

  const response =
    await api.get(
      `/portfolios/${portfolioId}/summary`
    );

  return response.data;

}
