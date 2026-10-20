from pathlib import Path

root = Path(__file__).resolve().parents[1]
main_path = root / "src/main.tsx"
page_path = root / "src/pages/WatchlistDetailsPage.tsx"

main = main_path.read_text()
if 'PriceRefreshProvider' not in main:
    anchor = 'import {\n  AuthProvider,\n} from "./contexts/AuthProvider";'
    replacement = anchor + '\nimport { PriceRefreshProvider } from "./contexts/PriceRefreshProvider";'
    if anchor not in main:
        anchor = 'import { AuthProvider } from "./contexts/AuthProvider";'
        replacement = anchor + '\nimport { PriceRefreshProvider } from "./contexts/PriceRefreshProvider";'
    if anchor not in main:
        raise SystemExit("AuthProvider import not found in src/main.tsx")
    main = main.replace(anchor, replacement)
    main = main.replace(
        '<AuthProvider>\n        <App />\n      </AuthProvider>',
        '<AuthProvider>\n        <PriceRefreshProvider>\n          <App />\n        </PriceRefreshProvider>\n      </AuthProvider>',
    )
    main_path.write_text(main)

page = page_path.read_text()
if 'Prezzo in aggiornamento' not in page:
    old = '''            {
              field: "last_price",
              headerName: "Current",
              flex: 1,
            },'''
    new = '''            {
              field: "last_price",
              headerName: "Current",
              flex: 1.35,
              renderCell: (params) => {
                if (params.value !== null && params.value !== undefined) {
                  return params.value;
                }

                const status = params.row.price_refresh_status;
                const active = ["PENDING", "PROCESSING", "RETRY"].includes(status);

                return (
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
                );
              },
            },'''
    if old not in page:
        raise SystemExit("last_price column not found in WatchlistDetailsPage.tsx")
    page_path.write_text(page.replace(old, new))

print("Global price refresh UI applied")
