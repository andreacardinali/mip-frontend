import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import WatchlistsPage from "./pages/WatchlistsPage";
import PortfolioPage from "./pages/PortfolioPage";
import NewsPage from "./pages/NewsPage";
import CatalystsPage from "./pages/CatalystsPage";
import SettingsPage from "./pages/SettingsPage";
import WatchlistDetailsPage from "./pages/WatchlistDetailsPage";
import PortfolioDetailsPage from "./pages/PortfolioDetailsPage";
import Layout from "./components/Layout";

export default function App() {
  
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>

            <Route
              path="/"
              element={<DashboardPage />}
            />

            <Route
              path="/watchlists"
              element={<WatchlistsPage />}
            />

            <Route
              path="/portfolios"
              element={<PortfolioPage />}
            />

            <Route
              path="/news"
              element={<NewsPage />}
            />

            <Route
              path="/catalysts"
              element={<CatalystsPage />}
            />

            <Route
              path="/settings"
              element={<SettingsPage />}
            />
            <Route
              path="/watchlists/:id"
              element={<WatchlistDetailsPage />}
            />

            <Route
              path="/portfolios/:id"
              element={<PortfolioDetailsPage />}
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}