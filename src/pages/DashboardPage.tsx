import { Alert, Box, Button, Chip, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { ArrowForward, Refresh } from "@mui/icons-material";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getScreenerContexts, getScreenerRuns } from "../services/marketScreener";

export default function DashboardPage() {
  const contexts = useQuery({ queryKey: ["market-screener-contexts"], queryFn: getScreenerContexts });
  const runs = useQuery({ queryKey: ["market-screener-runs", "overview"], queryFn: () => getScreenerRuns(10) });
  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Typography variant="h4">Panoramica operativa</Typography>
        <Button startIcon={<Refresh />} onClick={() => { void contexts.refetch(); void runs.refetch(); }} disabled={contexts.isFetching || runs.isFetching}>Aggiorna</Button>
      </Stack>
      {(contexts.isFetching || runs.isFetching) && <LinearProgress aria-label="Aggiornamento panoramica" />}
      {contexts.isError && <Alert severity="error">Contesti non disponibili. {contexts.error.message}</Alert>}
      <Box>
        <Typography variant="h6" gutterBottom>Contesti</Typography>
        <TableContainer>
          <Table size="small" aria-label="Contesti disponibili">
            <TableHead><TableRow><TableCell>Nome</TableCell><TableCell>Tipo</TableCell><TableCell align="right">Strumenti</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {contexts.data?.map(context => <TableRow key={`${context.context_type}:${context.context_id}`} hover>
                <TableCell><Button component={Link} to={context.context_type === "UNIVERSE" ? `/universes/${context.context_id}` : context.context_type === "WATCHLIST" ? `/watchlists/${context.context_id}` : `/portfolios/${context.context_id}`}>{context.name}</Button></TableCell>
                <TableCell>{context.context_type}</TableCell><TableCell align="right">{context.instrument_count}</TableCell>
                <TableCell align="right"><Button component={Link} to={`/screener?context=${context.context_type}:${context.context_id}`} endIcon={<ArrowForward />}>Analisi</Button></TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </TableContainer>
        {contexts.isSuccess && contexts.data.length === 0 && <Alert severity="info">Nessun contesto disponibile.</Alert>}
      </Box>
      <Box>
        <Typography variant="h6" gutterBottom>Diagnostica analisi</Typography>
        {runs.isError && <Alert severity="error">Stato delle analisi non disponibile. {runs.error.message}</Alert>}
        {runs.isSuccess && runs.data.length === 0 && <Alert severity="info">Nessuna esecuzione registrata.</Alert>}
        <TableContainer>
          <Table size="small" aria-label="Ultime esecuzioni screener">
            <TableHead><TableRow><TableCell>Avvio</TableCell><TableCell>Stato</TableCell><TableCell align="right">Opportunita</TableCell><TableCell>Termine</TableCell><TableCell>Errore</TableCell></TableRow></TableHead>
            <TableBody>{runs.data?.map(run => <TableRow key={run.screener_run_id}>
              <TableCell>{new Date(run.started_at).toLocaleString("it-IT")}</TableCell>
              <TableCell><Chip size="small" label={run.status} color={run.status === "FAILED" ? "error" : run.status === "PARTIAL" ? "warning" : run.status === "SUCCESS" ? "success" : "info"} /></TableCell>
              <TableCell align="right">{run.opportunity_count}</TableCell><TableCell>{run.completed_at ? new Date(run.completed_at).toLocaleString("it-IT") : "Non conclusa"}</TableCell><TableCell sx={{ overflowWrap: "anywhere" }}>{run.error_message ?? "-"}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Stack>
  );
}
