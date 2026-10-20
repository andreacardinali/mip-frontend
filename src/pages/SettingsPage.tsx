import { useEffect, useState } from "react";

import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../contexts/AuthProvider";
import CurrencySelect from "../components/CurrencySelect";
import { updateAccountPreferences } from "../services/auth";


export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const [reportingCurrency, setReportingCurrency] = useState("EUR");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.reporting_currency) {
      setReportingCurrency(user.reporting_currency);
    }
  }, [user]);

  async function handleSave() {
    if (isSaving) return;

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      await updateAccountPreferences(reportingCurrency);
      await refreshUser();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["portfolios"] }),
        queryClient.invalidateQueries({ queryKey: ["portfolio-summary"] }),
      ]);
      setMessage("Preferenze account salvate.");
    } catch (saveError) {
      console.error("[MIP account] Preference save failed", saveError);
      setError("Impossibile salvare le preferenze account.");
    } finally {
      setIsSaving(false);
    }
  }

  const changed = reportingCurrency !== (user?.reporting_currency ?? "EUR");

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", py: 2 }}>
      <Typography variant="h4" sx={{ mb: 0.75 }}>
        Account
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Gestisci i dati dell'account e la valuta principale usata nei riepiloghi.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          {message && <Alert severity="success">{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          <Box>
            <Typography variant="h6">Profilo</Typography>
            <Typography variant="body2" color="text.secondary">
              Informazioni associate all'utente autenticato.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label="Username"
              value={user?.username ?? ""}
              disabled
            />
            <TextField
              fullWidth
              label="Email"
              value={user?.email ?? ""}
              disabled
            />
          </Stack>

          <Divider />

          <Box>
            <Typography variant="h6">Preferenze</Typography>
            <Typography variant="body2" color="text.secondary">
              La valuta principale viene usata come reporting currency nei riepiloghi. La valuta nativa resta configurabile per ciascun portafoglio.
            </Typography>
          </Box>

          <CurrencySelect
            label="Valuta principale"
            value={reportingCurrency}
            disabled={isSaving}
            helperText="Valuta consolidata dell'account."
            onChange={(value) => {
              setReportingCurrency(value);
              setMessage(null);
              setError(null);
            }}
          />

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              startIcon={
                isSaving
                  ? <CircularProgress size={18} color="inherit" />
                  : <SaveIcon />
              }
              disabled={!changed || isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? "Salvataggio..." : "Salva preferenze"}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
