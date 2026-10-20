import { Alert, MenuItem, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { getCurrencyCatalog } from "../services/marketData";

interface CurrencySelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
}

export default function CurrencySelect({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  helperText,
}: CurrencySelectProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["currency-catalog"],
    queryFn: getCurrencyCatalog,
    staleTime: 60 * 60 * 1000,
  });

  if (isError) {
    return (
      <Alert severity="error">
        Catalogo valute temporaneamente non disponibile.
      </Alert>
    );
  }

  const currencies = data?.currencies ?? [];
  const valueAvailable = currencies.some(
    (currency) => currency.code === value,
  );

  return (
    <TextField
      select
      fullWidth
      required={required}
      label={label}
      value={value}
      disabled={disabled || isLoading}
      helperText={
        helperText
        ?? (data
          ? `Fonte tassi: ${data.provider.toUpperCase()} · ${data.as_of}`
          : "Caricamento valute...")
      }
      onChange={(event) => onChange(event.target.value)}
    >
      {value && !valueAvailable && (
        <MenuItem value={value} disabled>
          {value} · non disponibile dal provider corrente
        </MenuItem>
      )}
      {currencies.map((currency) => (
        <MenuItem key={currency.code} value={currency.code}>
          {currency.code}
        </MenuItem>
      ))}
    </TextField>
  );
}
