import api from "../api/api";

export async function importSymbol(
  symbol: string
) {
  const response =
    await api.post(
      "/import/entity",
      {
        symbol,
      }
    );

  return response.data;
}
