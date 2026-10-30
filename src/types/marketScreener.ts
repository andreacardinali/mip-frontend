export type PortfolioMatchType = "EXACT_INSTRUMENT" | "SAME_ISIN" | "SAME_ENTITY" | "NO_MATCH";
export type ConsensusDirection = "LONG" | "SHORT" | "CONFLICT" | "NEUTRAL";
export interface ScreenerSnapshotChange {
	change_type: "NEW" | "CHANGED" | "REMOVED";
	current: ScreenerSnapshotItem | null;
	previous: ScreenerSnapshotItem | null;
}
export interface ScreenerSnapshotChanges {
	ranking_snapshot_id: string;
	previous_snapshot_id: string | null;
	observed_at: string;
	opportunity_count: number;
	new_count: number;
	changed_count: number;
	removed_count: number;
	changes: ScreenerSnapshotChange[];
}
export interface ScreenerPerformanceFilters {
	instrument_id?: string;
	strategy_code?: string;
	status?: "OPEN" | "CLOSED";
	limit?: number;
	offset?: number;
}
export interface ScreenerPerformance {
	performance_id: string;
	signal_id: string;
	instrument_id: string;
	symbol: string;
	exchange: string | null;
	currency_code: string | null;
	strategy_code: string;
	timeframe: string;
	direction: "LONG" | "SHORT";
	status: "OPEN" | "CLOSED";
	end_reason: string | null;
	entry_at: string;
	exit_at: string | null;
	entry_price: number | null;
	valuation_price: number | null;
	entry_price_at: string | null;
	valuation_price_at: string | null;
	entry_price_source: string | null;
	valuation_price_source: string | null;
	historical_backfill: boolean;
	return_pct: number | null;
}
export interface ScreenerSignalEvent {
	signal_event_id: string;
	signal_id: string;
	instrument_id: string;
	strategy_code: string;
	timeframe: string;
	previous_status: string | null;
	new_status: string;
	previous_direction: string | null;
	new_direction: string;
	event_type: string;
	reason: string | null;
	observed_at: string;
	created_at: string;
	updated_at: string;
	payload: Record<string, unknown>;
}
export interface ScreenerInstrument { instrument_id:string; symbol:string; exchange:string|null; currency_code:string|null; isin:string|null; is_source?:boolean; same_isin?:boolean; }
export interface ScreenerPortfolioPosition { position_id:string; portfolio_id:string; portfolio_name:string; instrument_id:string; symbol:string; exchange:string|null; currency_code:string|null; isin:string|null; quantity:number|string; match_type:Exclude<PortfolioMatchType,"NO_MATCH">; }
export interface StrategyConsensus { strategy_count:number; bullish_strategy_count:number; bearish_strategy_count:number; consensus_direction:ConsensusDirection; consensus_score:number; conflict_score:number; supporting_strategies:string[]; opposing_strategies:string[]; supporting_signal_ids?:string[]; }
export interface ScreenerOpportunity extends StrategyConsensus { strategy_code:string|null; signal_type:string|null; signal_timeframe:string|null; signal_trend:string|null; signal_confidence:number|null; reference_price:number|null; invalidation_price:number|null; target_price:number|null; signal_reasons:string[]; technical_evidence:Record<string,unknown>; opportunity_id:string; signal_id:string; entity_id:string; entity_name:string; instrument_id:string; source_instrument_id:string; symbol:string; source_symbol:string; source_exchange:string|null; source_currency_code:string|null; source_isin:string|null; direction:string; origin:string; attention_score:number|null; technical_score:number|null; quant_score:number|null; llm_score:number|null; composite_score:number; ranking_position:number; verdict:string|null; summary:string|null; evidence:Record<string,unknown>|null; created_at:string; updated_at:string; portfolio_match:boolean; portfolio_match_type:PortfolioMatchType; portfolio_position_count:number; portfolio_symbols:string[]; portfolio_names:string[]; portfolio_positions:ScreenerPortfolioPosition[]; alternative_instruments:ScreenerInstrument[]; }
export type ScreenerContextType = "WATCHLIST" | "PORTFOLIO" | "UNIVERSE";
export interface ScreenerContext { context_type:ScreenerContextType; context_id:string; name:string; instrument_count:number; }
export interface ScreenerAnalysisResult { status:"SUCCESS"|"PARTIAL"|"FAILED"; run_id:string; ranking_snapshot_id:string; scan:Record<string,unknown>; ranking:Record<string,unknown>; llm_enrichment?: { status:"SUCCESS"|"PARTIAL"|"FAILED"; selected?:number; enriched?:number; failed?:number; reason?:string }; }
export interface ScreenerFilters { origin?:string; direction?:string; verdict?:string; portfolio_match?:boolean; watchlist_match?:boolean; consensus_direction?:ConsensusDirection; strategy_code?:string; context_type?:ScreenerContextType; context_id?:string; minimum_score?:number; query?:string; limit?:number; }
export interface ScreenerRun { screener_run_id:string; status:"RUNNING"|"SUCCESS"|"PARTIAL"|"FAILED"; discovery_snapshot_id:string|null; scan_run_id:string|null; started_at:string; completed_at:string|null; phase_results:Record<string,unknown>; error_message:string|null; ranking_snapshot_id:string|null; opportunity_count:number; }
export interface ScreenerRankingSnapshot { ranking_snapshot_id:string; screener_run_id:string; observed_at:string; opportunity_count:number; }
export interface ScreenerSnapshotItem extends StrategyConsensus { strategy_code:string|null; signal_type:string|null; signal_timeframe:string|null; signal_trend:string|null; signal_confidence:number|null; reference_price:number|null; invalidation_price:number|null; target_price:number|null; signal_reasons:string[]; technical_evidence:Record<string,unknown>; ranking_snapshot_item_id:string; ranking_snapshot_id:string; opportunity_id:string; signal_id:string; entity_id:string; instrument_id:string; symbol:string; direction:string; origin:string; ranking_position:number; previous_ranking_position:number|null; ranking_change:number|null; attention_score:number|null; technical_score:number|null; quant_score:number|null; llm_score:number|null; composite_score:number; verdict:string|null; summary:string|null; evidence:Record<string,unknown>; }
