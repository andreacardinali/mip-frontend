import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Box, Chip, Tooltip, Typography } from "@mui/material";
import { formatTimestamp } from "../services/timestamps";

export type PriceDisplayProps = {
  value: number | string | null | undefined;
  priceAsOf?: string | null;
  priceIsStale?: boolean | null;
  refreshStatus?: string | null;
  formatter: (value: unknown) => string;
};

function formatPriceDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return formatTimestamp(date);
}

export default function PriceDisplay({
  value,
  priceAsOf,
  priceIsStale,
  refreshStatus,
  formatter,
}: PriceDisplayProps) {
  const status = String(refreshStatus ?? "").toUpperCase();
  const active = ["PENDING", "PROCESSING", "RETRY"].includes(status);

  if (value === null || value === undefined || value === "") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
        <Chip
          size="small"
          color={active ? "warning" : "default"}
          variant={active ? "filled" : "outlined"}
          label={
            active
              ? "Prezzo in aggiornamento"
              : status === "FAILED"
                ? "Prezzo non disponibile"
                : "Nessun prezzo"
          }
        />
      </Box>
    );
  }

  const formattedDate = formatPriceDate(priceAsOf);
  const tooltip = formattedDate
    ? `${priceIsStale ? "Prezzo non aggiornato" : "Prezzo aggiornato"}: ${formattedDate}`
    : "Data dell'ultimo prezzo non disponibile";

  return (
    <Tooltip title={tooltip} arrow enterDelay={250}>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          height: "100%",
          minWidth: 0,
          cursor: "help",
        }}
      >
        <Typography
          component="span"
          variant="body2"
          sx={{ lineHeight: 1.4, whiteSpace: "nowrap" }}
        >
          {formatter(value)}
        </Typography>

        {priceIsStale && (
          <Chip
            icon={<WarningAmberRoundedIcon />}
            size="small"
            color="warning"
            variant="outlined"
            label="Non aggiornato"
            sx={{
              height: 22,
              "& .MuiChip-label": { px: 0.75 },
              "& .MuiChip-icon": { fontSize: 16, ml: 0.5 },
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}
