#!/bin/bash
set -e

FRONT=/opt/mip/mip-frontend/src/pages

echo "=== PortfolioDetailsPage ==="

grep -q "ArrowBackIcon" \
$FRONT/PortfolioDetailsPage.tsx || \
sed -i '/DeleteIcon/a\
import ArrowBackIcon from "@mui/icons-material/ArrowBack";' \
$FRONT/PortfolioDetailsPage.tsx

grep -q "useNavigate" \
$FRONT/PortfolioDetailsPage.tsx || \
sed -i \
's/import { useParams } from "react-router-dom";/import { useParams, useNavigate } from "react-router-dom";/' \
$FRONT/PortfolioDetailsPage.tsx

grep -q "const navigate = useNavigate();" \
$FRONT/PortfolioDetailsPage.tsx || \
sed -i '/const queryClient/a\
  const navigate = useNavigate();' \
$FRONT/PortfolioDetailsPage.tsx

perl -0777 -i -pe '
s/<Typography\s+variant="h4"\s*>\s*Portfolio Details\s*<\/Typography>/<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>\n          <Button\n            startIcon={<ArrowBackIcon \/>}\n            onClick={() => navigate("\/portfolios")}\n          >\n            Portfolios\n          <\/Button>\n\n          <Typography variant="h4">\n            Portfolio Details\n          <\/Typography>\n        <\/Box>/s
' \
$FRONT/PortfolioDetailsPage.tsx


echo "=== WatchlistDetailsPage ==="

grep -q "ArrowBackIcon" \
$FRONT/WatchlistDetailsPage.tsx || \
sed -i '/DeleteIcon/a\
import ArrowBackIcon from "@mui/icons-material/ArrowBack";' \
$FRONT/WatchlistDetailsPage.tsx

grep -q "useNavigate" \
$FRONT/WatchlistDetailsPage.tsx || \
sed -i \
's/import { useParams } from "react-router-dom";/import { useParams, useNavigate } from "react-router-dom";/' \
$FRONT/WatchlistDetailsPage.tsx

grep -q "const navigate = useNavigate();" \
$FRONT/WatchlistDetailsPage.tsx || \
sed -i '/const queryClient/a\
  const navigate = useNavigate();' \
$FRONT/WatchlistDetailsPage.tsx

perl -0777 -i -pe '
s/<Typography\s+variant="h4"\s*>\s*Watchlist Details\s*<\/Typography>/<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>\n          <Button\n            startIcon={<ArrowBackIcon \/>}\n            onClick={() => navigate("\/watchlists")}\n          >\n            Watchlists\n          <\/Button>\n\n          <Typography variant="h4">\n            Watchlist Details\n          <\/Typography>\n        <\/Box>/s
' \
$FRONT/WatchlistDetailsPage.tsx

echo "=== Build ==="

cd /opt/mip/mip-frontend

npm run build

echo
echo "[OK] Navigation buttons installed"