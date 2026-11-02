import { useState } from "react";
import { Box, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import AlertRuleSettings from "../components/AlertRuleSettings";
import CollectionIntelligenceSettings from "../components/CollectionIntelligenceSettings";
import SettingsPage from "./SettingsPage";

const workflowSteps = [
  {
    title: "Collection Intelligence",
    description: "Sottoscrivi categorie come Daily Mover, Catalyst o News per ogni portafoglio, watchlist o universo: producono eventi condivisi indipendentemente dalle regole personalizzate.",
  },
  {
    title: "Regole personalizzate",
    description: "Definisci soglie, filtri e soggetti (strumenti, portafogli, watchlist) per attivare alert su segnali specifici che non sono coperti dalle collection.",
  },
  {
    title: "Destinazioni",
    description: "Configura canali (email, webhook, Slack) e pause: sia gli eventi delle collection sia quelli delle regole vengono recapitati qui tramite il canale predefinito.",
  },
];

function AlertWorkflowGuide() {
  return (
    <Stack component="section" spacing={2} sx={{ mb: 3 }}>
      <Typography variant="subtitle1" color="text.secondary">Per ricevere notifiche:</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {workflowSteps.map(step => (
          <Paper key={step.title} variant="outlined" sx={{ flex: 1, p: 2, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>{step.title}</Typography>
            <Typography variant="body2" color="text.secondary">{step.description}</Typography>
          </Paper>
        ))}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Le sottoscrizioni alle collection condividono il canale predefinito configurato nella scheda Destinazioni: non è possibile assegnare fonti diverse per portafogli o universi singoli.
      </Typography>
    </Stack>
  );
}

export default function MarketAlertsPage() {
  const [tab, setTab] = useState("rules");
  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", py: 2 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Alert di mercato</Typography>
      <AlertWorkflowGuide />
      <Tabs value={tab} onChange={(_, value: string) => setTab(value)} aria-label="Alert di mercato" sx={{ mb: 3 }}>
        <Tab value="rules" label="Regole" id="market-alerts-rules-tab" aria-controls="market-alerts-rules" />
        <Tab value="collections" label="Collection" id="market-alerts-collections-tab" aria-controls="market-alerts-collections" />
        <Tab value="delivery" label="Destinazioni" id="market-alerts-delivery-tab" aria-controls="market-alerts-delivery" />
      </Tabs>
      <Box hidden={tab !== "rules"} role="tabpanel" id="market-alerts-rules" aria-labelledby="market-alerts-rules-tab">
        <AlertRuleSettings />
      </Box>
      <Box hidden={tab !== "collections"} role="tabpanel" id="market-alerts-collections" aria-labelledby="market-alerts-collections-tab">
        {tab === "collections" && <CollectionIntelligenceSettings />}
      </Box>
      <Box hidden={tab !== "delivery"} role="tabpanel" id="market-alerts-delivery" aria-labelledby="market-alerts-delivery-tab">
        {tab === "delivery" && <SettingsPage view="delivery" />}
      </Box>
    </Box>
  );
}