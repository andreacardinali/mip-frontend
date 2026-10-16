import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { useAuth } from "../contexts/AuthProvider";

export default function ProtectedRoute() {
  const {
    loading,
    authenticated,
  } = useAuth();

  console.log({
    loading,
    authenticated,
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!authenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <Outlet />;
}
