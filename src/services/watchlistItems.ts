import api from "../api/api";

export async function getWatchlistItems(
  watchlistId: string
) {
  const response =
    await api.get(
      `/watchlist-items/${watchlistId}/items`
    );

  return response.data;
}

export async function saveWatchlistItem(
  payload: {
    watchlist_item_id?: string;
    watchlist_id: string;
    entity_id: string;
    priority?: number;
    target_price?: number;
    notes?: string;
  }
) {
  const response =
    await api.post(
      "/watchlist-items/upsert",
      payload
    );

  return response.data;
}

export async function deleteWatchlistItem(
  watchlistItemId: string
) {
  const response =
    await api.delete(
      `/watchlist-items/${watchlistItemId}`
    );

  return response.data;
}
