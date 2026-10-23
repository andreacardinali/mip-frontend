import api from "../api/api";
import type {
  Catalyst,
  CatalystFacets,
  CatalystFilters,
  CatalystScope,
} from "../types/catalyst";

export async function getCatalysts(filters: CatalystFilters) {
  const response = await api.get<Catalyst[]>("/catalysts", {
    params: filters,
  });
  return response.data;
}

export async function getCatalystFacets(scope: CatalystScope) {
  const response = await api.get<CatalystFacets>("/catalysts/facets", {
    params: { scope },
  });
  return response.data;
}
