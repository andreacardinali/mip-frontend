import { createTheme } from "@mui/material";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#006b64", contrastText: "#ffffff" },
    secondary: { main: "#a52b53" },
    background: { default: "#f3f6f7", paper: "#ffffff" },
    text: { primary: "#17252b", secondary: "#52646d" },
    divider: "#d5dfe3",
    error: { main: "#b42335" },
    warning: { main: "#955600" },
    success: { main: "#187448" },
    info: { main: "#176b98" },
  },
  typography: {
    fontFamily: '"Segoe UI", sans-serif',
    fontSize: 14,
    allVariants: { letterSpacing: 0 },
    h4: { fontSize: "1.65rem", fontWeight: 650 },
    h5: { fontSize: "1.3rem", fontWeight: 650 },
    h6: { fontSize: "1.05rem", fontWeight: 650 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 650, backgroundColor: "#edf2f4" } } },
    MuiAppBar: { styleOverrides: { root: { backgroundColor: "#ffffff", color: "#17252b", boxShadow: "none", borderBottom: "1px solid #d5dfe3" } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: "#263b44", color: "#ffffff" } } },
    MuiCssBaseline: { styleOverrides: { body: { colorScheme: "light" }, "pre, code": { color: "#17252b", backgroundColor: "#edf2f4" }, "a": { color: "#006b64" } } },
  },
});
