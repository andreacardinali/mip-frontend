import api from "../api/api";
import type {
  ScreenerFilters,
  ScreenerOpportunity,
} from "../types/marketScreener";

export async function getScreenerOpportunities(filters: ScreenerFilters) {
  const response = await api.get<ScreenerOpportunity[]>("/screener", {
    params: filters,
  });
  return response.data;
}

export async function getScreenerOpportunity(opportunityId: string) {
  const response = await api.get<ScreenerOpportunity>(
    `/screener/${opportunityId}`,
  );
  return response.data;
}
