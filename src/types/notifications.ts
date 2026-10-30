export type NotificationType =
  | "UPCOMING_CATALYST"
  | "BREAKING_CATALYST"
  | "DAILY_MOVER"
  | "MARKET_SIGNAL"
  | "FIXED_PRICE"
  | "PERCENT_MOVE"
  | "SIGNAL_CHANGE"
  | "SCREENER_SUMMARY";

export type NotificationPreference = {
  notification_type: NotificationType;
  label: string;
  description: string;
  enabled: boolean;
  source_id: string | null;
  severity_min: string | null;
};

export type NotificationSource = {
  source_id: string;
  channel: string;
  source_name: string;
  external_id_masked: string | null;
  enabled: boolean;
  credential_configured: boolean;
  created_at: string;
};

export type SupportedNotificationChannel = {
  channel: string;
  label: string;
  destination_label: string;
  credential_label: string;
};

export type NotificationPreferencesResponse = {
  preferences: NotificationPreference[];
  sources: NotificationSource[];
  supported_channels: SupportedNotificationChannel[];
};

export type UpdateNotificationPreference = Pick<
  NotificationPreference,
  "notification_type" | "enabled" | "source_id" | "severity_min"
>;

export type NotificationSourcePayload = {
  source_type: string;
  source_name: string;
  external_id: string;
  credential?: string;
  enabled: boolean;
  parse_mode?: string | null;
  disable_web_page_preview?: boolean;
};
