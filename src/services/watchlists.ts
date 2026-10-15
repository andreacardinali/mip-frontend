import api from "../api/api";

export async function getWatchlists() {
  const response = await api.get("/watchlists");
  return response.data;
}

export async function createWatchlist(
  name: string,
  description: string,
) {
  const response = await api.post(
    "/watchlists",
    {
      name,
      description,
    },
  );

  return response.data;
}

export async function deleteWatchlist(
  watchlistId: string,
) {
  const response = await api.delete(
    `/watchlists/${watchlistId}`,
  );

  return response.data;
}
