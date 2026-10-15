import api from "../api/api";

export async function getEntities() {
  const response =
    await api.get("/entities");

  return response.data;
}
