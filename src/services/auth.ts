import api from "../api/api";

export interface CurrentUser {
  user_id: string;
  username: string;
  email: string;
  is_active: boolean;
  reporting_currency: string;
  display_name?: string | null;
}

export async function login(
  username: string,
  password: string,
) {
  const response = await api.post(
    "/auth/login",
    { username, password },
  );

  return response.data;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await api.get("/auth/me");
  return response.data;
}

export async function updateAccountPreferences(
  reportingCurrency: string,
): Promise<CurrentUser> {
  const response = await api.put(
    "/auth/me/preferences",
    {
      reporting_currency: reportingCurrency.trim().toUpperCase(),
    },
  );

  return response.data;
}
