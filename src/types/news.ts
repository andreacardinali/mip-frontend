import type { EntityAssetMatch } from "./catalyst";
export type NewsScope = "MY_ASSETS" | "PORTFOLIO" | "WATCHLIST" | "ALL";
export type NewsEntity = { entity_id:string; name:string; relevance:number|string|null; sentiment:number|string|null; impact:number|string|null };
export type NewsSymbol = { symbol:string; exchange:string|null };
export type NewsItem = { news_id:string; cluster_id:string|null; title:string|null; summary:string|null; url:string|null; published_at:string|null; source:string|null; entities:NewsEntity[]; symbols:NewsSymbol[]; relevance:number|string|null; sentiment:number|string|null; impact:number|string|null; direct_impact:number|string|null; propagated_impact:number|string|null; confidence:number|string|null; in_portfolio:boolean; in_watchlist:boolean; asset_scope:"PORTFOLIO"|"WATCHLIST"|"BOTH"|"GLOBAL"; raw_json:(Record<string,unknown>&{asset_matches?:EntityAssetMatch[]})|null };
export type NewsFilters = { scope:NewsScope; date_from?:string; date_to?:string; source?:string; sentiment_min?:number; sentiment_max?:number; impact_min?:number; query?:string; limit?:number };
export type NewsFacets = { sources:string[]; published_from:string|null; published_to:string|null };
