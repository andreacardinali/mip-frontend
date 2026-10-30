import type { EntityAssetMatch } from "./catalyst";
import type { ScreenerOpportunity } from "./marketScreener";

export interface Entity {
  entity_id: string;

  name: string;

  entity_type: string;

  symbol?: string;

  exchange?: string;
  country_code?: string | null;
  description?: string | null;
  active?: boolean;
}

export interface ContextInstrument {
  instrument_id: string;
  entity_id: string;
  symbol: string | null;
  exchange: string | null;
  currency_code: string | null;
}

export interface EntityOverview {
  entity: Entity;
  asset_match: EntityAssetMatch;
  instruments: (ContextInstrument & {
    last_price: number | string | null;
    price_as_of: string | null;
    data_source: string | null;
    instrument_type: string | null;
  })[];
  universes: { universe_id: string; name: string; code: string; universe_type: string }[];
  news_count: number;
  news: { news_id: string; title: string | null; summary: string | null; url: string | null; published_at: string | null }[];
  catalyst_count: number;
  catalysts: { catalyst_id: string; title: string | null; catalyst_type: string | null; catalyst_day: string; status: string | null; importance: number | string | null; source: string | null }[];
  opportunities: ScreenerOpportunity[];
  observed_at: string;
}
