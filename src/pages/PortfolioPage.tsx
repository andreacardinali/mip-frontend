import { useState } from "react";

import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  Typography,
  Button,
  Paper,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
} from "@mui/material";

import HomeIcon from "@mui/icons-material/Home";
import OpenInNewIcon
  from "@mui/icons-material/OpenInNew";

import {
  DataGrid,
} from "@mui/x-data-grid";

import type {
  GridColDef,
} from "@mui/x-data-grid";

import type {
  Portfolio,
} from "../types/portfolio";

import {
  getPortfolios,
  createPortfolio,
} from "../services/portfolios";

import {
  useNavigate,
} from "react-router-dom";

export default function PortfolioPage() {

  const queryClient =
    useQueryClient();

  const navigate =
    useNavigate();

  const [open, setOpen] =
    useState(false);

  const [name, setName] =
    useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: getPortfolios,
  });

  const handleCreate =
    async () => {

      await createPortfolio(
        name,
        description,
      );

      await queryClient.invalidateQueries(
        {
          queryKey: [
            "portfolios",
          ],
        }
      );

      setOpen(false);

      setName("");
      setDescription("");
    };

  const columns: GridColDef[] =
    [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
      },
      {
        field: "description",
        headerName:
          "Description",
        flex: 2,
      },
      {
        field: "portfolio_type",
        headerName:
          "Type",
        flex: 1,
      },
      {
        field: "open",
        headerName:
          "Open",
        width: 90,

        sortable: false,

        renderCell:
          (params) => (
            <IconButton
              onClick={(e) => {

                e.stopPropagation();

                navigate(
                  `/portfolios/${params.row.portfolio_id}`
                );

              }}
            >
              <OpenInNewIcon />
            </IconButton>
          ),
      },
    ];

  return (
    <>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h4">
          Portfolios
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 2,
          }}
        >
          <Button
            startIcon={<HomeIcon />}
            onClick={() => navigate("/")}
          >
            Home
          </Button>

          <Button
            variant="outlined"
            onClick={() => refetch()}
          >
            Refresh
          </Button>

          <Button
            variant="contained"
            onClick={() => setOpen(true)}
          >
            New Portfolio
          </Button>
        </Box>
      </Box>

      <Paper
        sx={{
          height: 650,
        }}
      >
        <DataGrid
          rows={data}
          columns={
            columns
          }
          loading={
            isLoading
          }
          getRowId={(row) =>
            row.portfolio_id
          }
          onRowClick={(
            params
          ) =>
            navigate(
              `/portfolios/${params.row.portfolio_id}`
            )
          }
        />
      </Paper>

      <Dialog
        open={open}
        onClose={() =>
          setOpen(false)
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Create Portfolio
        </DialogTitle>

        <DialogContent>

          <TextField
            fullWidth
            margin="normal"
            label="Name"
            value={name}
            onChange={(e) =>
              setName(
                e.target.value
              )
            }
          />

          <TextField
            fullWidth
            margin="normal"
            label="Description"
            value={
              description
            }
            onChange={(e) =>
              setDescription(
                e.target.value
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
              handleCreate
            }
          >
            Create
          </Button>

        </DialogActions>
      </Dialog>

    </>
  );
}
