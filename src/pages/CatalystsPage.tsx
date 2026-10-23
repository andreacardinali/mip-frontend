import { useMemo, useState } from "react";

import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";

import { getCatalystFacets, getCatalysts } from "../services/catalysts";
import type { Catalyst, CatalystScope } from "../types/catalyst";

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return value ? `${value}T00:00:00` : undefined;
}

function endOfDay(value: string) {
  return value ? `${value}T23:59:59` : undefined;
}

function formatDate(value: string | null) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function importanceValue(value: Catalyst["importance"]) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function importanceLabel(value: Catalyst["importance"]) {
  const number = importanceValue(value);
  if (number === null) return "N/D";
  if (number >= 75) return `Alta (${number})`;
  if (number >= 40) return `Media (${number})`;
  return `Bassa (${number})`;
}

function importanceColor(value: Catalyst["importance"]) {
  const number = importanceValue(value);
  if (number === null) return "default" as const;
  if (number >= 75) return "error" as const;
  if (number >= 40) return "warning" as const;
  return "default" as const;
}

function scopeLabel(value: Catalyst["asset_scope"]) {
  return {
    PORTFOLIO: "Portafoglio",
    WATCHLIST: "Watchlist",
    BOTH: "Entrambi",
    GLOBAL: "Globale",
  }[value];
}

export default function CatalystsPage() {
  const today = new Date();
  const fromDefault = new Date(today);
  fromDefault.setDate(today.getDate() - 30);
  const toDefault = new Date(today);
  toDefault.setDate(today.getDate() + 90);

  const [scope, setScope] = useState<CatalystScope>("MY_ASSETS");
  const [dateFrom, setDateFrom] = useState(dateInput(fromDefault));
  const [dateTo, setDateTo] = useState(dateInput(toDefault));
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [importanceMin, setImportanceMin] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Catalyst | null>(null);

  const filters = useMemo(
    () => ({
      scope,
      date_from: startOfDay(dateFrom),
      date_to: endOfDay(dateTo),
      catalyst_type: type || undefined,
      status: status || undefined,
      importance_min: importanceMin ? Number(importanceMin) : undefined,
      query: query.trim() || undefined,
      limit: 1000,
    }),
    [scope, dateFrom, dateTo, type, status, importanceMin, query],
  );

  const catalystsQuery = useQuery({
    queryKey: ["catalysts", filters],
    queryFn: () => getCatalysts(filters),
  });
  const facetsQuery = useQuery({
    queryKey: ["catalyst-facets", scope],
    queryFn: () => getCatalystFacets(scope),
  });

  const data = catalystsQuery.data ?? [];
  const upcomingCount = data.filter((row) => {
    if (!row.catalyst_date) return false;
    return new Date(row.catalyst_date).getTime() >= Date.now();
  }).length;
  const highCount = data.filter(
    (row) => (importanceValue(row.importance) ?? -1) >= 75,
  ).length;

  const columns: GridColDef<Catalyst>[] = [
    {
      field: "catalyst_date",
      headerName: "Data evento",
      width: 175,
      renderCell: ({ row }) => formatDate(row.catalyst_date),
    },
    { field: "symbol", headerName: "Simbolo", width: 105 },
    { field: "entity_name", headerName: "Entità", minWidth: 180, flex: 1 },
    { field: "catalyst_type", headerName: "Tipo", width: 150 },
    {
      field: "importance",
      headerName: "Importanza",
      width: 135,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          color={importanceColor(row.importance)}
          label={importanceLabel(row.importance)}
        />
      ),
    },
    { field: "status", headerName: "Stato", width: 120 },
    { field: "title", headerName: "Titolo", minWidth: 260, flex: 1.4 },
    { field: "source", headerName: "Fonte", width: 140 },
    {
      field: "asset_scope",
      headerName: "Ambito",
      width: 125,
      valueGetter: (_, row) => scopeLabel(row.asset_scope),
    },
  ];

  return (
    <Box sx={{ py: 1 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", mb: 2 }}
      >
        <Box>
          <Typography variant="h4">Catalyst</Typography>
          <Typography color="text.secondary">
            Eventi raccolti dai job, filtrati per portafogli e watchlist.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void catalystsQuery.refetch()}
        >
          Aggiorna
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          <TextField
            select
            size="small"
            label="Ambito"
            value={scope}
            sx={{ minWidth: 190 }}
            onChange={(event) => setScope(event.target.value as CatalystScope)}
          >
            <MenuItem value="MY_ASSETS">I miei asset</MenuItem>
            <MenuItem value="PORTFOLIO">Portafogli</MenuItem>
            <MenuItem value="WATCHLIST">Watchlist</MenuItem>
            <MenuItem value="ALL">Tutti i catalyst</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="date"
            label="Dal"
            value={dateFrom}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <TextField
            size="small"
            type="date"
            label="Al"
            value={dateTo}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(event) => setDateTo(event.target.value)}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={type}
            sx={{ minWidth: 160 }}
            onChange={(event) => setType(event.target.value)}
          >
            <MenuItem value="">Tutti</MenuItem>
            {(facetsQuery.data?.types ?? []).map((value) => (
              <MenuItem key={value} value={value}>{value}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Stato"
            value={status}
            sx={{ minWidth: 140 }}
            onChange={(event) => setStatus(event.target.value)}
          >
            <MenuItem value="">Tutti</MenuItem>
            {(facetsQuery.data?.statuses ?? []).map((value) => (
              <MenuItem key={value} value={value}>{value}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Importanza"
            value={importanceMin}
            sx={{ minWidth: 145 }}
            onChange={(event) => setImportanceMin(event.target.value)}
          >
            <MenuItem value="">Tutte</MenuItem>
            <MenuItem value="40">Media e alta</MenuItem>
            <MenuItem value="75">Solo alta</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Cerca"
            placeholder="Simbolo, entità, titolo o fonte"
            value={query}
            sx={{ minWidth: 240, flex: 1 }}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <Chip label={`${data.length} catalyst`} />
        <Chip color="primary" label={`${upcomingCount} futuri`} />
        <Chip color="error" label={`${highCount} ad alta importanza`} />
      </Stack>

      {catalystsQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Impossibile caricare i catalyst. Verifica migrazione SQL e route backend.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ height: 660 }}>
        <DataGrid
          rows={data}
          columns={columns}
          loading={catalystsQuery.isLoading}
          getRowId={(row) => row.catalyst_id}
          onRowClick={(params) => setSelected(params.row)}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
            sorting: {
              sortModel: [{ field: "catalyst_date", sort: "asc" }],
            },
          }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Paper>

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{selected?.title ?? "Dettaglio catalyst"}</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Chip label={selected.symbol ?? selected.entity_name} />
                <Chip label={selected.catalyst_type ?? "Tipo non disponibile"} />
                <Chip
                  color={importanceColor(selected.importance)}
                  label={importanceLabel(selected.importance)}
                />
                <Chip label={scopeLabel(selected.asset_scope)} />
              </Stack>
              <Typography><strong>Entità:</strong> {selected.entity_name}</Typography>
              <Typography><strong>Data:</strong> {formatDate(selected.catalyst_date)}</Typography>
              <Typography><strong>Stato:</strong> {selected.status ?? "N/D"}</Typography>
              <Typography><strong>Fonte:</strong> {selected.source ?? "N/D"}</Typography>
              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Payload raccolto</Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    overflow: "auto",
                    maxHeight: 360,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {JSON.stringify(selected.raw_payload ?? {}, null, 2)}
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Chiudi</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
