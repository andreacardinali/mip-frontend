import api from "../api/api";
import type { Entity, EntityOverview } from "../types/entity";

export async function getEntities() {
  const response =
    await api.get<Entity[]>("/entities");

  return response.data;
}

export async function getEntityOverview(id: string) {
  return (await api.get<EntityOverview>(`/entities/${id}/overview`)).data;
}
