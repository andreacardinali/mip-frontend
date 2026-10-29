import api from "../api/api";

export type AlertType = "MARKET_SIGNAL" | "FIXED_PRICE" | "PERCENT_MOVE" | "SIGNAL_CHANGE";
export type MonitoringScope = "SCREENER" | "WATCHLIST" | "PORTFOLIO" | "ALL";

export interface AlertConditions {
  scope: MonitoringScope;
  scope_id?: string;
  max_age_minutes: number;
  threshold?: number;
  price_direction?: "UP" | "DOWN" | "ANY";
  symbols: string[];
  excluded_symbols: string[];
  directions: string[];
  verdicts: string[];
  origins: string[];
  strategy_codes: string[];
  min_composite_score: number;
  min_consensus_score: number;
  max_conflict_score: number;
  min_strategy_count: number;
}

export interface AlertRulePayload {
  alert_type: AlertType;
  name: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  channel: "TELEGRAM" | null;
  conditions: AlertConditions;
  cooldown_minutes: number;
  enabled: boolean;
}

export interface AlertRule extends Omit<AlertRulePayload, "conditions"> {
  rule_id: string;
  conditions: Partial<AlertConditions>;
}

export async function getAlertRules() {
  return (await api.get<AlertRule[]>("/alerts")).data;
}

export interface AlertEvent {
  alert_event_id: string;
  rule_id: string;
  instrument_id: string;
  signal_id: string | null;
  created_at: string;
  notification_id: string | null;
  notification_status: string | null;
  sent_at: string | null;
  payload: {
    rule_name?: string;
    alert_type?: AlertType;
    scope?: MonitoringScope;
    scope_id?: string | null;
    symbol?: string;
    observed_at?: string | null;
    last_price?: number | null;
    reference_price?: number | null;
    reference_at?: string | null;
    event_type?: string | null;
    direction?: string;
    verdict?: string | null;
    composite_score?: number;
    consensus_score?: number;
    strategy_codes?: string[];
    summary?: string | null;
  };
}

export async function getAlertEvents(ruleId: string, limit = 25, offset = 0) {
  return (await api.get<AlertEvent[]>(`/alerts/${ruleId}/events`, {
    params: { limit, offset },
  })).data;
}

export async function saveAlertRule(payload: AlertRulePayload, ruleId?: string) {
  return ruleId
    ? (await api.put<{ rule_id: string }>(`/alerts/${ruleId}`, payload)).data
    : (await api.post<{ rule_id: string }>("/alerts", payload)).data;
}