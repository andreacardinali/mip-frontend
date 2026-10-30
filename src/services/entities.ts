import api from "../api/api";
import type { Entity, EntityOverview, EntityScope } from "../types/entity";

export async function getEntities(scope: EntityScope = "ALL", query = "") {
  const response =
    await api.get<Entity[]>("/entities", { params: { scope, query } });

  return response.data;
}

export async function getEntityOverview(id: string) {
  return (await api.get<EntityOverview>(`/entities/${id}/overview`)).data;
}
