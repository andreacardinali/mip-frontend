// src/services/logout.ts

export function logout() {

  localStorage.removeItem(
    "access_token"
  );

  localStorage.removeItem(
    "user_id"
  );

  window.location.href =
    "/login";
}
