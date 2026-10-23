from pathlib import Path

path = Path("src/pages/PortfolioPage.tsx")
source = path.read_text()
source = source.replace(
'  const { data = [], isLoading, refetch } = useQuery<Portfolio[]>({\n    queryKey: ["portfolios"],\n    queryFn: getPortfolios,\n  });',
'  const { data = [], isLoading, refetch } = useQuery<Portfolio[]>({\n    queryKey: ["portfolios"],\n    queryFn: getPortfolios,\n    refetchInterval: (query) => {\n      const portfolios = query.state.data;\n      return portfolios?.some((portfolio) => portfolio.pricing_complete === false)\n        ? 5000\n        : false;\n    },\n  });',
)
source = source.replace(
'      renderCell: ({ row }) => formatMoney(row.portfolio_value, row.base_currency),',
'      renderCell: ({ row }) => row.pricing_complete === false\n        ? "In aggiornamento"\n        : formatMoney(row.portfolio_value, row.base_currency),',
)
source = source.replace(
'          {formatSignedMoney(row.profit_loss, row.base_currency)}',
'          {row.pricing_complete === false\n            ? `In aggiornamento (${row.pending_price_count ?? 0})`\n            : formatSignedMoney(row.profit_loss, row.base_currency)}',
)
source = source.replace(
'          {formatSignedPercent(row.profit_loss_pct)}',
'          {row.pricing_complete === false\n            ? "—"\n            : formatSignedPercent(row.profit_loss_pct)}',
)
path.write_text(source)
print("patched src/pages/PortfolioPage.tsx")
