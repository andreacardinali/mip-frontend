import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Alert, AlertTitle, Box, Button, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

export default class NewsErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Errore di rendering nella pagina News", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Box sx={{ py: 1 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>News</Typography>
        <Alert severity="error">
          <AlertTitle>Impossibile visualizzare le news</AlertTitle>
          <Typography component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {this.state.error.message}
          </Typography>
        </Alert>
        <Button sx={{ mt: 2 }} variant="outlined" startIcon={<RefreshIcon />}
          onClick={() => this.setState({ error: null })}>
          Riprova
        </Button>
      </Box>
    );
  }
}