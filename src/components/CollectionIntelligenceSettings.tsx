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

function CollectionRow({ collection, userId }: {
  collection: MonitoringCollection; userId: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<IntelligenceCategory[] | null>(null);
  const selected = draft ?? collection.enabled_categories;
  const changed = [...selected].sort().join(",") !==
    [...collection.enabled_categories].sort().join(",");
  const save = useMutation({
    mutationFn: (enabledCategories: IntelligenceCategory[]) => updateCollectionIntelligence(
      collection.collection_type, collection.collection_id, enabledCategories,
    ),
    onSuccess: (_, enabledCategories) => {
      queryClient.setQueryData<MonitoringCollectionsResponse>(
        ["monitoring-collections", userId],
        current => current && ({ collections: current.collections.map(row =>
          row.collection_type === collection.collection_type && row.collection_id === collection.collection_id
            ? { ...row, enabled_categories: enabledCategories } : row,
        ) }),
      );
      setDraft(null);
    },
    onError: error => notifyOperationError(error, "Impossibile salvare la sottoscrizione."),
  });

  return (
    <Stack component="section" spacing={1.5} aria-label={`${collectionLabels[collection.collection_type]}: ${collection.collection_name}`}
      sx={{ py: 2, borderBottom: 1, borderColor: "divider" }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{collection.collection_name}</Typography>
          <Typography variant="body2" color="text.secondary">{collectionLabels[collection.collection_type]}</Typography>
        </Box>
        <Button startIcon={save.isPending ? <CircularProgress size={18} /> : <SaveIcon />}
          disabled={!changed || save.isPending} onClick={() => save.mutate([...selected])}
          sx={{ flexShrink: 0 }}>Salva</Button>
      </Stack>
      <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", columnGap: 2 }}>
        {categories.map(category => (
          <FormControlLabel key={category.value} label={category.label}
            control={<Checkbox checked={selected.includes(category.value)} disabled={save.isPending}
              onChange={(_, checked) => setDraft(checked
                ? [...selected, category.value]
                : selected.filter(value => value !== category.value))} />} />
        ))}
      </Stack>
      {save.isError && <Alert severity="error">Sottoscrizione non salvata.</Alert>}
    </Stack>
  );
}

export default function CollectionIntelligenceSettings() {
  const { user } = useAuth();
  const collections = useQuery({
    queryKey: ["monitoring-collections", user?.user_id],
    queryFn: getMonitoringCollections,
    enabled: !!user,
  });
  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Sottoscrizioni</Typography>
      {collections.isLoading && <CircularProgress size={24} aria-label="Caricamento collection" />}
      {collections.isError && <Alert severity="error" action={
        <Button color="inherit" startIcon={<RefreshIcon />} disabled={collections.isFetching}
          onClick={() => void collections.refetch()}>Riprova</Button>
      }>Impossibile caricare le collection.</Alert>}
      {collections.isSuccess && collections.data.collections.length === 0 &&
        <Alert severity="info">Nessuna collection disponibile.</Alert>}
      {user && collections.data?.collections.map(collection => (
        <CollectionRow key={`${user.user_id}:${collection.collection_type}:${collection.collection_id}`}
          collection={collection} userId={user.user_id} />
      ))}
    </Box>
  );
}