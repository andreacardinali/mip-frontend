import api from "../api/api";
import type { ContextInstrument } from "../types/entity";
import type { ScreenerAnalysisResult, ScreenerContext, ScreenerContextType } from "../types/marketScreener";
import type { ScreenerSnapshotChanges } from "../types/marketScreener";
import type { ScreenerPerformance, ScreenerPerformanceFilters } from "../types/marketScreener";
import type { ScreenerFilters, ScreenerOpportunity, ScreenerRankingSnapshot, ScreenerRun, ScreenerSignalEvent, ScreenerSnapshotItem } from "../types/marketScreener";
export async function getScreenerOpportunities(filters: ScreenerFilters) { return (await api.get<ScreenerOpportunity[]>("/screener", { params: filters })).data; }
export async function getScreenerContexts() {
	return (await api.get<ScreenerContext[]>("/screener/contexts")).data;
}
export async function getScreenerContextInstruments(contextType: ScreenerContextType, contextId: string) {
	return (await api.get<ContextInstrument[]>(`/screener/contexts/${contextType}/${encodeURIComponent(contextId)}/instruments`)).data;
}
export async function analyzeScreenerContext(context: { context_type:ScreenerContextType; context_id:string; llm_enabled?:boolean }) {
	return (await api.post<ScreenerAnalysisResult>("/screener/analyze", context)).data;
}
export async function getScreenerOpportunity(id: string) { return (await api.get<ScreenerOpportunity>(`/screener/${id}`)).data; }
export async function getScreenerSignalEvents(id: string, limit = 100) {
	return (await api.get<ScreenerSignalEvent[]>(`/screener/${id}/signal-events`, { params: { limit } })).data;
}
export async function getScreenerRuns(limit = 20) { return (await api.get<ScreenerRun[]>("/screener/runs", { params: { limit } })).data; }
export async function getScreenerSnapshots(limit = 20) { return (await api.get<ScreenerRankingSnapshot[]>("/screener/snapshots", { params: { limit } })).data; }
export async function getScreenerSnapshotChanges(snapshotId?: string) {
	return (await api.get<ScreenerSnapshotChanges | null>("/screener/changes", { params: { snapshot_id: snapshotId } })).data;
}
export async function getScreenerSnapshotItems(id: string) { return (await api.get<ScreenerSnapshotItem[]>(`/screener/snapshots/${id}/items`)).data; }
export async function getScreenerPerformance(filters: ScreenerPerformanceFilters) {
	return (await api.get<ScreenerPerformance[]>("/screener/performance", { params: filters })).data;
}
