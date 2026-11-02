import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { getPipelineDiagnostics } from "../services/systemAdmin";
import { formatTimestamp } from "../services/timestamps";

function StatusChip({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const color = normalized.includes("FAIL") || normalized === "ERROR"
    ? "error"
    : normalized.includes("SUCCESS") || normalized === "SENT" || normalized === "COMPLETED"
      ? "success"
      : normalized.includes("RETRY") || normalized.includes("PENDING") || normalized.includes("RUNNING")
        ? "warning"
        : "default";
  return <Chip size="small" label={status} color={color} variant="outlined" />;
}

export default function PipelineDiagnosticsPage() {
  const diagnostics = useQuery({
    queryKey: ["pipeline-diagnostics"],
    queryFn: () => getPipelineDiagnostics(),
    staleTime: 30_000,
  });
  const data = diagnostics.data;

  return (
    <Box sx={{ maxWidth: 1600, mx: "auto", py: 1 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h4">Diagnostica pipeline</Typography>
          <Typography color="text.secondary">
            Ingresso dati, elaborazioni e stato delle notifiche negli ultimi {data?.window_days ?? 7} giorni.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={diagnostics.isFetching ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={() => void diagnostics.refetch()}
          disabled={diagnostics.isFetching}
        >
          Aggiorna
        </Button>
      </Stack>

      {diagnostics.isLoading && <CircularProgress aria-label="Caricamento diagnostica" />}
      {diagnostics.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Impossibile caricare la diagnostica. {diagnostics.error.message}
        </Alert>
      )}
      {data && (
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Snapshot generato {formatTimestamp(data.generated_at)}. I dati mostrati non includono credenziali o payload delle notifiche.
          </Typography>

          <Box component="section" aria-labelledby="ingestion-heading">
            <Typography id="ingestion-heading" variant="h6" sx={{ mb: 1.5 }}>Ingresso dati</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Fase</TableCell><TableCell>Fonte</TableCell>
                  <TableCell align="right">Eventi (7 gg)</TableCell><TableCell>Ultimo ingresso</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {data.ingestion.by_stage_source.map((row, index) => (
                    <TableRow key={`${row.stage}-${row.source}-${index}`}>
                      <TableCell>{row.stage}</TableCell><TableCell>{row.source}</TableCell>
                      <TableCell align="right">{row.event_count}</TableCell>
                      <TableCell>{formatTimestamp(row.latest_ingested_at)}</TableCell>
                    </TableRow>
                  ))}
                  {data.ingestion.by_stage_source.length === 0 && <TableRow><TableCell colSpan={4}>Nessun evento nella finestra selezionata.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Eventi recenti</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow>
                  <TableCell>Ricevuto</TableCell><TableCell>Tipo</TableCell><TableCell>Fase</TableCell>
                  <TableCell>Fonte</TableCell><TableCell>Chiave evento</TableCell><TableCell>Entity</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {data.ingestion.recent_events.map((event) => (
                    <TableRow key={event.event_id}>
                      <TableCell>{formatTimestamp(event.ingested_at)}</TableCell><TableCell>{event.event_type}</TableCell>
                      <TableCell>{event.stage}</TableCell><TableCell>{event.source}</TableCell>
                      <TableCell sx={{ maxWidth: 260, overflowWrap: "anywhere" }}>{event.event_key}</TableCell>
                      <TableCell>{event.entity_id ?? "N/D"}</TableCell>
                    </TableRow>
                  ))}
                  {data.ingestion.recent_events.length === 0 && <TableRow><TableCell colSpan={6}>Nessun evento registrato.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Box component="section" aria-labelledby="processing-heading">
            <Typography id="processing-heading" variant="h6" sx={{ mb: 1.5 }}>Elaborazione</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead><TableRow><TableCell>Esito</TableCell><TableCell align="right">Esecuzioni (7 gg)</TableCell><TableCell>Ultimo avvio</TableCell></TableRow></TableHead>
                <TableBody>
                  {data.processing.by_status.map((row) => (
                    <TableRow key={row.status}><TableCell><StatusChip status={row.status} /></TableCell><TableCell align="right">{row.run_count}</TableCell><TableCell>{formatTimestamp(row.latest_started_at)}</TableCell></TableRow>
                  ))}
                  {data.processing.by_status.length === 0 && <TableRow><TableCell colSpan={3}>Nessuna esecuzione nella finestra selezionata.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Esecuzioni recenti</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow><TableCell>Avvio</TableCell><TableCell>Job</TableCell><TableCell>Stato</TableCell><TableCell>Fine</TableCell><TableCell>Errore</TableCell></TableRow></TableHead>
                <TableBody>
                  {data.processing.recent_runs.map((run) => (
                    <TableRow key={run.job_run_id}>
                      <TableCell>{formatTimestamp(run.started_at)}</TableCell><TableCell>{run.job_name}</TableCell>
                      <TableCell><StatusChip status={run.status} /></TableCell><TableCell>{formatTimestamp(run.completed_at)}</TableCell>
                      <TableCell sx={{ maxWidth: 420, overflowWrap: "anywhere" }}>{run.error_message ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                  {data.processing.recent_runs.length === 0 && <TableRow><TableCell colSpan={5}>Nessuna esecuzione registrata.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Box component="section" aria-labelledby="notification-heading">
            <Typography id="notification-heading" variant="h6" sx={{ mb: 1.5 }}>Notifiche e canali</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              “Pronte” indica sorgenti configurate come abilitate e con credenziale presente; non certifica l&apos;attivazione delle preferenze utente né la consegna effettiva.
            </Alert>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead><TableRow><TableCell>Canale</TableCell><TableCell align="right">Sorgenti</TableCell><TableCell align="right">Abilitate</TableCell><TableCell align="right">Con credenziale</TableCell><TableCell align="right">Pronte</TableCell></TableRow></TableHead>
                <TableBody>
                  {data.notifications.channels.map((channel) => (
                    <TableRow key={channel.channel}><TableCell>{channel.channel}</TableCell><TableCell align="right">{channel.configured_sources}</TableCell><TableCell align="right">{channel.enabled_sources}</TableCell><TableCell align="right">{channel.credentialed_sources}</TableCell><TableCell align="right">{channel.ready_sources}</TableCell></TableRow>
                  ))}
                  {data.notifications.channels.length === 0 && <TableRow><TableCell colSpan={5}>Nessun canale configurato.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Conteggi per stato e canale</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead><TableRow><TableCell>Stato</TableCell><TableCell>Canale</TableCell><TableCell align="right">Notifiche (7 gg)</TableCell><TableCell>Ultima creazione</TableCell></TableRow></TableHead>
                <TableBody>
                  {data.notifications.by_status_channel.map((row) => (
                    <TableRow key={`${row.status}-${row.channel}`}><TableCell><StatusChip status={row.status} /></TableCell><TableCell>{row.channel}</TableCell><TableCell align="right">{row.notification_count}</TableCell><TableCell>{formatTimestamp(row.latest_created_at)}</TableCell></TableRow>
                  ))}
                  {data.notifications.by_status_channel.length === 0 && <TableRow><TableCell colSpan={4}>Nessuna notifica nella finestra selezionata.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Notifiche recenti</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow><TableCell>Creata</TableCell><TableCell>Titolo</TableCell><TableCell>Stato</TableCell><TableCell>Canale</TableCell><TableCell align="right">Tentativi</TableCell><TableCell>Prossimo tentativo</TableCell><TableCell>Errore</TableCell></TableRow></TableHead>
                <TableBody>
                  {data.notifications.recent.map((notification) => (
                    <TableRow key={notification.notification_id}>
                      <TableCell>{formatTimestamp(notification.created_at)}</TableCell><TableCell>{notification.title}</TableCell>
                      <TableCell><StatusChip status={notification.status} /></TableCell><TableCell>{notification.channel ?? "N/D"}</TableCell>
                      <TableCell align="right">{notification.attempt_count}</TableCell><TableCell>{formatTimestamp(notification.next_attempt_at)}</TableCell>
                      <TableCell sx={{ maxWidth: 360, overflowWrap: "anywhere" }}>{notification.last_error ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                  {data.notifications.recent.length === 0 && <TableRow><TableCell colSpan={7}>Nessuna notifica registrata.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>
      )}
    </Box>
  );
}