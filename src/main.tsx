import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import App from "./App";



import "./index.css";

const queryClient = new QueryClient();

import {
  AuthProvider,
} from "./contexts/AuthProvider";
import { PriceRefreshProvider } from "./contexts/PriceRefreshProvider";

createRoot(
  document.getElementById("root")!,
).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PriceRefreshProvider>
          <App />
        </PriceRefreshProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
