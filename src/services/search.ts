import api from "../api/api";

export async function searchAssets(
  query: string
) {
  const response =
    await api.get(
      "/search",
      {
        params: {
          q: query,
        },
      }
    );

  return response.data;
}
