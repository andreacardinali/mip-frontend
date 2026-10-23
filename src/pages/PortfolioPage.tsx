import { useState } from "react";
import { useNavigate } from "react-router-dom";

import EditIcon from "@mui/icons-material/Edit";
import HomeIcon from "@mui/icons-material/Home";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

import CurrencySelect from "../components/CurrencySelect";
import { getPortfolios, savePortfolio } from "../services/portfolios";
import type { Portfolio } from "../types/portfolio";

function numericValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMoney(value: unknown, currency?: string | null) {
  const number = numericValue(value);
  if (number === null) return "N/D";
  return `${number.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency ?? ""}`.trim();
}

function formatSignedMoney(value: unknown, currency?: string | null) {
  const number = numericValue(value);
  if (number === null) return "N/D";
  const sign = number > 0 ? "+" : "";
  return `${sign}${formatMoney(number, currency)}`;
}

function formatSignedPercent(value: unknown) {
  const number = numericValue(value);
  if (number === null) return "N/D";
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function pnlColor(value: unknown) {
  const number = numericValue(value);
  if (number === null || number === 0) return "text.secondary";
  return number > 0 ? "success.main" : "error.main";
}

export default function PortfolioPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [portfolioType, setPortfolioType] = useState("PORTFOLIO");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data = [], isLoading, refetch } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: getPortfolios,
    refetchInterval: (query) => {
      const portfolios = query.state.data;
      return portfolios?.some((portfolio) => portfolio.pricing_complete === false)
        ? 5000
        : false;
    },
  });

  function resetDialog() {
    setEditingPortfolio(null);
    setName("");
    setDescription("");
    setPortfolioType("PORTFOLIO");
    setBaseCurrency("EUR");
    setSaveError(null);
  }

  function openCreateDialog() {
    resetDialog();
    setOpen(true);
  }

  function openEditDialog(portfolio: Portfolio) {
    setEditingPortfolio(portfolio);
    setName(portfolio.name);
    setDescription(portfolio.description ?? "");
    setPortfolioType(portfolio.portfolio_type ?? "PORTFOLIO");
    setBaseCurrency((portfolio.base_currency ?? "EUR").toUpperCase());
    setSaveError(null);
    setOpen(true);
  }

  function closeDialog() {
    if (isSaving) return;
    setOpen(false);
    resetDialog();
  }

  async function handleSave() {
    const normalizedName = name.trim();
    const normalizedCurrency = baseCurrency.trim().toUpperCase();
    if (!normalizedName || normalizedCurrency.length !== 3 || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await savePortfolio({
        portfolio_id: editingPortfolio?.portfolio_id,
        name: normalizedName,
        description: description.trim() || null,
        portfolio_type: portfolioType,
        base_currency: normalizedCurrency,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["portfolios"] }),
        editingPortfolio
          ? queryClient.invalidateQueries({
              queryKey: ["portfolio-summary", editingPortfolio.portfolio_id],
            })
          : Promise.resolve(),
      ]);
      setOpen(false);
      resetDialog();
    } catch (error) {
      console.error("[MIP portfolio] Save failed", error);
      setSaveError("Impossibile salvare il portafoglio.");
    } finally {
      setIsSaving(false);
    }
  }

  const columns: GridColDef<Portfolio>[] = [
    { field: "name", headerName: "Name", minWidth: 170, flex: 1 },
    { field: "portfolio_type", headerName: "Type", width: 120 },
    {
      field: "base_currency",
      headerName: "Currency",
      width: 95,
      valueGetter: (_, row) => row.base_currency ?? "EUR",
    },
    {
      field: "portfolio_value",
      headerName: "Value",
      minWidth: 150,
      flex: 1,
      sortable: true,
      renderCell: ({ row }) => row.pricing_complete === false
        ? "In aggiornamento"
        : formatMoney(row.portfolio_value, row.base_currency),
    },
    {
      field: "invested_value",
      headerName: "Invested",
      minWidth: 150,
      flex: 1,
      renderCell: ({ row }) => formatMoney(row.invested_value, row.base_currency),
    },
    {
      field: "profit_loss",
      headerName: "P/L",
      minWidth: 150,
      flex: 1,
      renderCell: ({ row }) => (
        <Typography
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            height: "100%",
            color: pnlColor(row.profit_loss),
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {row.pricing_complete === false
            ? `In aggiornamento (${row.pending_price_count ?? 0})`
            : formatSignedMoney(row.profit_loss, row.base_currency)}
        </Typography>
      ),
    },
    {
      field: "profit_loss_pct",
      headerName: "P/L %",
      width: 115,
      renderCell: ({ row }) => (
        <Typography
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            height: "100%",
            color: pnlColor(row.profit_loss_pct),
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {row.pricing_complete === false
            ? "—"
            : formatSignedPercent(row.profit_loss_pct)}
        </Typography>
      ),
    },
    {
      field: "edit",
      headerName: "Edit",
      width: 70,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <IconButton
          aria-label={`Edit ${params.row.name}`}
          color="primary"
          onClick={(event) => {
            event.stopPropagation();
            openEditDialog(params.row);
          }}
        >
          <EditIcon />
        </IconButton>
      ),
    },
    {
      field: "open",
      headerName: "Open",
      width: 70,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <IconButton
          aria-label={`Open ${params.row.name}`}
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/portfolios/${params.row.portfolio_id}`);
          }}
        >
          <OpenInNewIcon />
        </IconButton>
      ),
    },
  ];

  const canSave = Boolean(name.trim())
    && baseCurrency.trim().length === 3
    && !isSaving;

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Portfolios</Typography>
        <Stack direction="row" spacing={2}>
          <Button startIcon={<HomeIcon />} onClick={() => navigate("/")}>Home</Button>
          <Button variant="outlined" onClick={() => void refetch()}>Refresh</Button>
          <Button variant="contained" onClick={openCreateDialog}>New Portfolio</Button>
        </Stack>
      </Box>

      <Paper sx={{ height: 650 }}>
        <DataGrid
          rows={data}
          columns={columns}
          loading={isLoading}
          getRowId={(row) => row.portfolio_id}
          onRowClick={(params) => navigate(`/portfolios/${params.row.portfolio_id}`)}
        />
      </Paper>

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          <DialogTitle>{editingPortfolio ? "Edit Portfolio" : "Create Portfolio"}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.25} sx={{ pt: 0.5 }}>
              {saveError && <Alert severity="error">{saveError}</Alert>}
              <TextField
                fullWidth required autoFocus label="Name" value={name} disabled={isSaving}
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                fullWidth label="Description" value={description} disabled={isSaving}
                multiline minRows={3} onChange={(event) => setDescription(event.target.value)}
              />
              <TextField
                select fullWidth label="Type" value={portfolioType} disabled={isSaving}
                onChange={(event) => setPortfolioType(event.target.value)}
              >
                <MenuItem value="PORTFOLIO">Portfolio</MenuItem>
                <MenuItem value="BENCHMARK">Benchmark</MenuItem>
                <MenuItem value="MODEL">Model</MenuItem>
              </TextField>
              <CurrencySelect
                required
                label="Portfolio currency"
                value={baseCurrency}
                disabled={isSaving}
                helperText={editingPortfolio
                  ? "Changing this currency recalculates the portfolio native value without changing positions."
                  : "Currency used for the portfolio native value."}
                onChange={setBaseCurrency}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={closeDialog} disabled={isSaving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!canSave}>
              {isSaving ? "Saving..." : editingPortfolio ? "Save Changes" : "Create"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
