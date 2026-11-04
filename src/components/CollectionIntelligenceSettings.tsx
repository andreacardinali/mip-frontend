import { useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert, Box, Button, Checkbox, CircularProgress, FormControl, FormControlLabel,
  InputLabel, MenuItem, Select, Stack, Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthProvider";
import {
  getMonitoringCollections, getNotificationPreferences, updateCollectionIntelligence,
} from "../services/notifications";
import { notifyOperationError } from "../services/operationFeedback";
import type {
  IntelligenceCategory, MonitoringCollection, MonitoringCollectionsResponse,
} from "../types/notifications";

const categories: { value: IntelligenceCategory; label: string }[] = [
  { value: "DAILY_MOVER", label: "Movimenti giornalieri" },
  { value: "UPCOMING_CATALYST", label: "Catalyst in arrivo" },
  { value: "BREAKING_CATALYST", label: "Catalyst urgenti" },
  { value: "NEWS", label: "Notizie" },
  { value: "DAILY_PORTFOLIO_REPORT", label: "Riepilogo giornaliero" },
  { value: "MARKET_SIGNAL", label: "Segnali di mercato" },
];
const collectionLabels = {
  PORTFOLIO: "Portafoglio", WATCHLIST: "Watchlist", UNIVERSE: "Universo",
};

function CollectionRow({ collection, selected, disabled, sources, onChange }: {
  collection: MonitoringCollection;
  selected: MonitoringCollection;
  disabled: boolean;
  sources: { source_id: string; source_name: string; channel: string }[];
  onChange: (selected: MonitoringCollection) => void;
}) {
  return (
    <Stack component="section" spacing={1.5} aria-label={`${collectionLabels[collection.collection_type]}: ${collection.collection_name}`}
      sx={{ py: 2, borderBottom: 1, borderColor: "divider" }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{collection.collection_name}</Typography>
          <Typography variant="body2" color="text.secondary">{collectionLabels[collection.collection_type]}</Typography>
        </Box>
      </Stack>
      <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", columnGap: 2 }}>
        {categories.filter(category => collection.collection_type === "PORTFOLIO" ||
          category.value !== "DAILY_PORTFOLIO_REPORT").map(category => (
          <FormControlLabel key={category.value} label={category.label}
            control={<Checkbox checked={selected.enabled_categories.includes(category.value)} disabled={disabled}
              onChange={(_, checked) => onChange({ ...selected, enabled_categories: checked
                ? [...selected.enabled_categories, category.value]
                : selected.enabled_categories.filter(value => value !== category.value) })} />} />
        ))}
      </Stack>
      <FormControl size="small" sx={{ maxWidth: 360 }}>
        <InputLabel id={`collection-source-${collection.collection_type}-${collection.collection_id}`}>Destinazione</InputLabel>
        <Select labelId={`collection-source-${collection.collection_type}-${collection.collection_id}`} label="Destinazione"
          value={selected.notification_source_id ?? ""} disabled={disabled}
          onChange={event => onChange({ ...selected, notification_source_id: event.target.value || null })}>
          <MenuItem value="">Predefinita</MenuItem>
          {sources.map(source => (
            <MenuItem key={source.source_id} value={source.source_id}>
              {source.source_name} ({source.channel})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}

function CollectionSettings({ userId }: { userId?: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["monitoring-collections", userId];
  const [drafts, setDrafts] = useState<Record<string, MonitoringCollection>>({});
  const collections = useQuery({
    queryKey,
    queryFn: getMonitoringCollections,
    enabled: !!userId,
  });
  const destinations = useQuery({
    queryKey: ["notification-preferences", userId],
    queryFn: getNotificationPreferences,
    enabled: !!userId,
  });
  const changedCollections = (collections.data?.collections ?? []).flatMap(collection => {
    const selected = drafts[`${collection.collection_type}:${collection.collection_id}`];
    if (!selected) return [];
    const categoriesChanged = selected.enabled_categories.length !== collection.enabled_categories.length ||
      selected.enabled_categories.some(category => !collection.enabled_categories.includes(category));
    return categoriesChanged || selected.notification_source_id !== collection.notification_source_id
      ? [{ ...collection, enabled_categories: selected.enabled_categories,
        notification_source_id: selected.notification_source_id }]
      : [];
  });
  const save = useMutation({
    mutationFn: async (changed: MonitoringCollection[]) => {
      await queryClient.cancelQueries({ queryKey });
      for (const collection of changed) {
        await updateCollectionIntelligence(
          collection.collection_type, collection.collection_id,
          collection.enabled_categories, collection.notification_source_id,
        );
        queryClient.setQueryData<MonitoringCollectionsResponse>(queryKey,
          current => current && ({ collections: current.collections.map(row =>
            row.collection_type === collection.collection_type && row.collection_id === collection.collection_id
              ? { ...row, enabled_categories: collection.enabled_categories,
                notification_source_id: collection.notification_source_id } : row,
          ) }),
        );
        setDrafts(current => {
          const remaining = { ...current };
          delete remaining[`${collection.collection_type}:${collection.collection_id}`];
          return remaining;
        });
      }
    },
    onError: error => notifyOperationError(error, "Impossibile salvare tutte le sottoscrizioni."),
  });
  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Stack direction="row" spacing={2} sx={{ mb: 1, alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6">Sottoscrizioni</Typography>
        <Button startIcon={save.isPending ? <CircularProgress size={18} /> : <SaveIcon />}
          disabled={!changedCollections.length || save.isPending || !collections.isSuccess || !userId}
          onClick={() => save.mutate(changedCollections)} sx={{ flexShrink: 0 }}>Salva</Button>
      </Stack>
      {save.isError && <Alert severity="error">Alcune modifiche non sono state salvate.</Alert>}
      {collections.isLoading && <CircularProgress size={24} aria-label="Caricamento collection" />}
      {destinations.isLoading && <CircularProgress size={24} aria-label="Caricamento destinazioni" />}
      {destinations.isError && <Alert severity="error">Impossibile caricare le destinazioni di notifica.</Alert>}
      {collections.isError && <Alert severity="error" action={
        <Button color="inherit" startIcon={<RefreshIcon />} disabled={collections.isFetching}
          onClick={() => void collections.refetch()}>Riprova</Button>
      }>Impossibile caricare le collection.</Alert>}
      {collections.isSuccess && collections.data.collections.length === 0 &&
        <Alert severity="info">Nessuna collection disponibile.</Alert>}
      {userId && collections.data?.collections.map(collection => {
        const key = `${collection.collection_type}:${collection.collection_id}`;
        return <CollectionRow key={key} collection={collection}
          selected={drafts[key] ?? collection} disabled={save.isPending}
          sources={destinations.data?.sources.filter(source => source.enabled) ?? []}
          onChange={selected => {
            save.reset();
            setDrafts(current => ({ ...current, [key]: selected }));
          }} />;
      })}
    </Box>
  );
}

export default function CollectionIntelligenceSettings() {
  const { user } = useAuth();
  return <CollectionSettings key={user?.user_id ?? "anonymous"} userId={user?.user_id} />;
}