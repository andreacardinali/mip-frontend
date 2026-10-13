import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import WatchlistsPage from "./pages/WatchlistsPage";
import PortfolioPage from "./pages/PortfolioPage";
import NewsPage from "./pages/NewsPage";
import CatalystsPage from "./pages/CatalystsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
      </Routes>
    </BrowserRouter>
  );
}