import { useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel,
  Stack, Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthProvider";
import { getMonitoringCollections, updateCollectionIntelligence } from "../services/notifications";
import { notifyOperationError } from "../services/operationFeedback";
import type {
  IntelligenceCategory, MonitoringCollection, MonitoringCollectionsResponse,
} from "../types/notifications";

const categories: { value: IntelligenceCategory; label: string }[] = [
  { value: "DAILY_MOVER", label: "Movimenti giornalieri" },
  { value: "UPCOMING_CATALYST", label: "Catalyst in arrivo" },
  { value: "BREAKING_CATALYST", label: "Catalyst urgenti" },
  { value: "NEWS", label: "Notizie" },
];
const collectionLabels = {
  PORTFOLIO: "Portafoglio", WATCHLIST: "Watchlist", UNIVERSE: "Universo",
};

function CollectionRow({ collection, selected, disabled, onChange }: {
  collection: MonitoringCollection;
  selected: IntelligenceCategory[];
  disabled: boolean;
  onChange: (selected: IntelligenceCategory[]) => void;
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
        {categories.map(category => (
          <FormControlLabel key={category.value} label={category.label}
            control={<Checkbox checked={selected.includes(category.value)} disabled={disabled}
              onChange={(_, checked) => onChange(checked
                ? [...selected, category.value]
                : selected.filter(value => value !== category.value))} />} />
        ))}
      </Stack>
    </Stack>
  );
}

function CollectionSettings({ userId }: { userId?: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["monitoring-collections", userId];
  const [drafts, setDrafts] = useState<Record<string, IntelligenceCategory[]>>({});
  const collections = useQuery({
    queryKey,
    queryFn: getMonitoringCollections,
    enabled: !!userId,
  });
  const changedCollections = (collections.data?.collections ?? []).flatMap(collection => {
    const selected = drafts[`${collection.collection_type}:${collection.collection_id}`];
    return selected && (selected.length !== collection.enabled_categories.length ||
      selected.some(category => !collection.enabled_categories.includes(category)))
      ? [{ ...collection, enabled_categories: selected }] : [];
  });
  const save = useMutation({
    mutationFn: async (changed: MonitoringCollection[]) => {
      await queryClient.cancelQueries({ queryKey });
      for (const collection of changed) {
        await updateCollectionIntelligence(
          collection.collection_type, collection.collection_id, collection.enabled_categories,
        );
        queryClient.setQueryData<MonitoringCollectionsResponse>(queryKey,
          current => current && ({ collections: current.collections.map(row =>
            row.collection_type === collection.collection_type && row.collection_id === collection.collection_id
              ? { ...row, enabled_categories: collection.enabled_categories } : row,
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
      {collections.isError && <Alert severity="error" action={
        <Button color="inherit" startIcon={<RefreshIcon />} disabled={collections.isFetching}
          onClick={() => void collections.refetch()}>Riprova</Button>
      }>Impossibile caricare le collection.</Alert>}
      {collections.isSuccess && collections.data.collections.length === 0 &&
        <Alert severity="info">Nessuna collection disponibile.</Alert>}
      {userId && collections.data?.collections.map(collection => {
        const key = `${collection.collection_type}:${collection.collection_id}`;
        return <CollectionRow key={key} collection={collection}
          selected={drafts[key] ?? collection.enabled_categories} disabled={save.isPending}
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