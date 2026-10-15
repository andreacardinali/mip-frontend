import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  IconButton,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";

import {
  DataGrid,
} from "@mui/x-data-grid";

import {
  getPositions,
  savePosition,
  deletePosition,
} from "../services/positions";

import {
  searchAssets,
} from "../services/search";

import {
  importSymbol,
} from "../services/imports";

export default function PortfolioDetailsPage() {

  const { id } =
    useParams();

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [open, setOpen] =
    useState(false);

  const [
    editingPosition,
    setEditingPosition,
  ] = useState<any>(null);

  const [
    instrument,
    setInstrument,
  ] = useState<any>(null);

  const [
    quantity,
    setQuantity,
  ] = useState(0);

  const [
    avgPrice,
    setAvgPrice,
  ] = useState(0);

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const {
    data = [],
    isLoading,
  } = useQuery({
    queryKey: [
      "positions",
      id,
    ],

    queryFn: () =>
      getPositions(id!),
  });

  const {
    data: searchResults,
  } = useQuery({
    queryKey: [
      "asset-search",
      searchText,
    ],

    queryFn: () =>
      searchAssets(
        searchText
      ),

    enabled:
      searchText.length >= 2,
  });

  async function handleSave() {

    let instrumentId;

    if (editingPosition) {

      instrumentId =
        editingPosition.instrument_id;

    } else {

      if (!instrument) {
        return;
      }

      const imported =
        await importSymbol(
          instrument.symbol
        );

      if (
        !imported ||
        !imported.instrument_id
      ) {
        return;
      }

      instrumentId =
        imported.instrument_id;
    }

    await savePosition({
      position_id:
        editingPosition?.position_id,

      portfolio_id:
        id!,

      instrument_id:
        instrumentId,

      quantity,

      avg_price:
        avgPrice,
    });

    await queryClient.invalidateQueries({
      queryKey: [
        "positions",
        id,
      ],
    });

    setEditingPosition(null);
    setOpen(false);
  }

  async function handleDelete(
    positionId: string
  ) {

    if (
      !window.confirm(
        "Delete position?"
      )
    ) {
      return;
    }

    await deletePosition(
      positionId
    );

    await queryClient.invalidateQueries({
      queryKey: [
        "positions",
        id,
      ],
    });
  }

  const portfolioTotals: Record<string, number> =
    data.reduce(
      (
        acc: Record<string, number>,
        row: any
      ) => {
        const currency =
          row.currency_code ??
          "N/A";

        acc[currency] =
          (acc[currency] ?? 0) +
          Number(
            row.market_value ?? 0
          );

        return acc;
      },
      {} as Record<string, number>
    );

  return (
    <Box sx={{ p: 3 }}>

      <Box
        sx={{
          display: "flex",
          justifyContent:
            "space-between",
          mb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/portfolios")}
          >
            Portfolios
          </Button>

          <Typography variant="h4">
            Portfolio Details
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={() => {
            setEditingPosition(null);
            setInstrument(null);
            setQuantity(0);
            setAvgPrice(0);
            setOpen(true);
          }}
        >
          Add Position
        </Button>
      </Box>

      <Paper
        sx={{
          p: 2,
          mb: 2,
        }}
      >
        <Typography
          variant="h6"
        >
          Portfolio Value
        </Typography>

        {Object.entries(
          portfolioTotals
        ).map(
          ([currency, value]) => (
            <Typography
              key={currency}
            >
              {currency}:{" "}
              {Number(value).toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </Typography>
          )
        )}

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1 }}
        >
          Positions: {data.length}
        </Typography>
      </Paper>

      <Paper sx={{ height: 700 }}>
        <DataGrid
          rows={data}
          loading={isLoading}
          getRowId={(row) =>
            row.position_id
          }
          columns={[
            {
              field: "symbol",
              headerName: "Symbol",
              flex: 1,
            },
            {
              field: "name",
              headerName: "Company",
              flex: 2,
            },
            {
              field: "quantity",
              headerName: "Quantity",
              flex: 1,
            },
            {
              field: "currency_code",
              headerName: "Currency",
              width: 90,
            },
            {
              field: "avg_price",
              headerName: "Avg Price",
              flex: 1,
            },
            {
              field: "last_price",
              headerName: "Current",
              flex: 1,
            },
            {
              field: "market_value",
              headerName: "Value",
              flex: 1,
            },
            {
              field: "profit_loss",
              headerName: "P/L",
              flex: 1,
            },
            {
              field: "profit_loss_pct",
              headerName: "P/L %",
              flex: 1,
            },
            {
              field: "edit",
              headerName: "Edit",
              width: 90,

              renderCell:
                (params) => (
                  <IconButton
                    color="primary"
                    onClick={() => {

                      setEditingPosition(
                        params.row
                      );

                      setQuantity(
                        Number(
                          params.row.quantity
                        )
                      );

                      setAvgPrice(
                        Number(
                          params.row.avg_price
                        )
                      );

                      setOpen(true);

                    }}
                  >
                    ✏️
                  </IconButton>
                ),
            },
            {
              field: "delete",
              headerName: "Delete",
              width: 100,

              renderCell:
                (params) => (
                  <IconButton
                    color="error"
                    onClick={() =>
                      handleDelete(
                        params.row.position_id
                      )
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                ),
            },
          ]}
        />
      </Paper>

      <Dialog
        open={open}
        onClose={() =>
          setOpen(false)
        }
      >
        <DialogTitle>
          {
            editingPosition
              ? "Edit Position"
              : "Add Position"
          }
        </DialogTitle>

        <DialogContent>

          {
            !editingPosition && (
              <Autocomplete
                options={
                  searchResults?.results
                  ?? []
                }
                getOptionLabel={
                  (option: any) =>
                    `${option.symbol} - ${option.name}`
                }
                inputValue={
                  searchText
                }
                onInputChange={
                  (_, value) =>
                    setSearchText(
                      value
                    )
                }
                onChange={
                  (_, value) =>
                    setInstrument(
                      value
                    )
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Symbol"
                  />
                )}
              />
            )
          }

          <TextField
            fullWidth
            margin="normal"
            label="Quantity"
            type="number"
            value={quantity}
            onChange={(e) =>
              setQuantity(
                Number(
                  e.target.value
                )
              )
            }
          />

          <TextField
            fullWidth
            margin="normal"
            label="Average Price"
            type="number"
            value={avgPrice}
            onChange={(e) =>
              setAvgPrice(
                Number(
                  e.target.value
                )
              )
            }
          />

        </DialogContent>

        <DialogActions>

          <Button
            onClick={() =>
              setOpen(false)
            }
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={
              handleSave
            }
          >
            Save
          </Button>

        </DialogActions>

      </Dialog>

    </Box>
  );
}
