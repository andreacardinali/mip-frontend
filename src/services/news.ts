import api from "../api/api";
import type { NewsFacets, NewsFilters, NewsItem, NewsScope } from "../types/news";

export async function getNews(filters: NewsFilters) {
  const response = await api.get<NewsItem[]>("/news", { params: filters });
  return response.data;
}

export async function getNewsFacets(scope: NewsScope) {
  const response = await api.get<NewsFacets>("/news/facets", {
    params: { scope },
  });
  return response.data;
}
