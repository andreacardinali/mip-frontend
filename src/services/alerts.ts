import api from "../api/api";

export interface AlertConditions {
  symbols: string[];
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
  name: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  channel: "TELEGRAM" | null;
  conditions: AlertConditions;
  cooldown_minutes: number;
  enabled: boolean;
}

export interface AlertRule extends Omit<AlertRulePayload, "conditions"> {
  rule_id: string;
  alert_type: "MARKET_SIGNAL";
  conditions: Partial<AlertConditions>;
}

export async function getAlertRules() {
  return (await api.get<AlertRule[]>("/alerts")).data;
}

export async function saveAlertRule(payload: AlertRulePayload, ruleId?: string) {
  return ruleId
    ? (await api.put<{ rule_id: string }>(`/alerts/${ruleId}`, payload)).data
    : (await api.post<{ rule_id: string }>("/alerts", payload)).data;
}