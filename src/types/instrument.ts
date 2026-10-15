export interface Instrument {
  instrument_id: string;

  entity_id?: string;

  symbol: string;

  exchange?: string;

  instrument_type?: string;

  currency_code?: string;
}
