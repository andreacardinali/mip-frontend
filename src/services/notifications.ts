import api from "../api/api";
import type {
  NotificationPreferencesResponse,
  NotificationSourcePayload,
  UpdateNotificationPreference,
} from "../types/notifications";

export async function getNotificationPreferences() {
  const response = await api.get<NotificationPreferencesResponse>(
    "/notification-preferences",
  );
  return response.data;
}

export async function updateNotificationPreferences(
  preferences: UpdateNotificationPreference[],
) {
  const response = await api.put<NotificationPreferencesResponse>(
    "/notification-preferences",
    { preferences },
  );
  return response.data;
}

export async function createNotificationSource(
  payload: NotificationSourcePayload,
) {
  const response = await api.post<{ source_id: string }>(
    "/notification-preferences/sources",
    payload,
  );
  return response.data;
}

export async function updateNotificationSource(
  sourceId: string,
  payload: NotificationSourcePayload,
) {
  const response = await api.put<{ source_id: string }>(
    `/notification-preferences/sources/${sourceId}`,
    payload,
  );
  return response.data;
}

export async function deleteNotificationSource(sourceId: string) {
  await api.delete(`/notification-preferences/sources/${sourceId}`);
}

export async function testNotificationSource(sourceId: string) {
  const response = await api.post<{ status: string; provider_message_id: string }>(
    `/notification-preferences/sources/${sourceId}/test`,
  );
  return response.data;
}
