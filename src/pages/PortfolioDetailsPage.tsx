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
import DeleteIcon
  from "@mui/icons-material/Delete";

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

  const queryClient =
    useQueryClient();

  const [open, setOpen] =
    useState(false);

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

    if (!instrument) {
      return;
    }

    const imported =
      await importSymbol(
        instrument.symbol
      );

    console.log(
      "Selected instrument",
      instrument
    );

    console.log(
      "Import result",
      imported
    );
    if (
      !imported ||
      !imported.instrument_id
    ) {

      console.error(
        "Import failed",
        imported
      );

      alert(
        imported?.error ??
        "Unable to import instrument"
      );

      return;
    }

    await savePosition({
      portfolio_id:
        id!,

      instrument_id:
        imported.instrument_id,

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

    setOpen(false);
    setSearchText("");
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
        <Typography
          variant="h4"
        >
          Portfolio Details
        </Typography>

        <Button
          variant="contained"
          onClick={() =>
            setOpen(true)
          }
        >
          Add Position
        </Button>
      </Box>

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
              field: "avg_price",
              headerName: "Avg Price",
              flex: 1,
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
          Add Position
        </DialogTitle>

        <DialogContent>

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

          <TextField
            fullWidth
            margin="normal"
            label="Quantity"
            type="number"
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
