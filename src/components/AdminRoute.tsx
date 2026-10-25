import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../contexts/AuthProvider";

export default function AdminRoute() {
  const { user } = useAuth();

  if (!user?.roles.includes("ADMIN")) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
