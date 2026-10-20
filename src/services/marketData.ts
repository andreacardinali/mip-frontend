import api from "../api/api";

export interface CurrencyOption {
  code: string;
}

export interface CurrencyCatalog {
  provider: string;
  as_of: string;
  base_currency: string;
  currencies: CurrencyOption[];
}

export async function getCurrencyCatalog(): Promise<CurrencyCatalog> {
  const response = await api.get("/market-data/currencies");
  return response.data;
}
