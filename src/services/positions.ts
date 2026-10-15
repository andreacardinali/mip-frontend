import api from "../api/api";

export async function getPositions(
  portfolioId: string
) {
  const response =
    await api.get(
      `/positions/portfolio/${portfolioId}`
    );

  return response.data;
}

export async function savePosition(
  payload: {
    position_id?: string;
    portfolio_id: string;
    instrument_id: string;
    quantity: number;
    avg_price?: number;
    opened_at?: string;
    notes?: string;
  }
) {
  const response =
    await api.post(
      "/positions/upsert",
      payload
    );

  return response.data;
}

export async function deletePosition(
  positionId: string
) {
  const response =
    await api.delete(
      `/positions/${positionId}`
    );

  return response.data;
}
