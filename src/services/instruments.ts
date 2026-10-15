import api from "../api/api";

export async function getInstruments() {
  const response =
    await api.get("/instruments");

  return response.data;
}
