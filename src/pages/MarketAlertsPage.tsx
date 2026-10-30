import { useState } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import AlertRuleSettings from "../components/AlertRuleSettings";
import SettingsPage from "./SettingsPage";

export default function MarketAlertsPage() {
  const [tab, setTab] = useState("rules");
  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", py: 2 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Alert di mercato</Typography>
      <Tabs value={tab} onChange={(_, value: string) => setTab(value)} aria-label="Alert di mercato" sx={{ mb: 3 }}>
        <Tab value="rules" label="Regole" id="market-alerts-rules-tab" aria-controls="market-alerts-rules" />
        <Tab value="delivery" label="Canali di invio" id="market-alerts-delivery-tab" aria-controls="market-alerts-delivery" />
      </Tabs>
      <Box hidden={tab !== "rules"} role="tabpanel" id="market-alerts-rules" aria-labelledby="market-alerts-rules-tab">
        <AlertRuleSettings />
      </Box>
      <Box hidden={tab !== "delivery"} role="tabpanel" id="market-alerts-delivery" aria-labelledby="market-alerts-delivery-tab">
        {tab === "delivery" && <SettingsPage view="delivery" />}
      </Box>
    </Box>
  );
}