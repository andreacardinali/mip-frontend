#!/bin/bash
set -e

FRONT=/opt/mip/mip-frontend/src/pages

echo "Patching PortfolioPage.tsx..."

sed -i 's/import OpenInNewIcon/import HomeIcon from "@mui\/icons-material\/Home";\
import OpenInNewIcon/' \
$FRONT/PortfolioPage.tsx

sed -i '/<Box/a\
          <Button\
            startIcon={<HomeIcon />}\
            onClick={() => navigate("/")}\
          >\
            Home\
          </Button>' \
$FRONT/PortfolioPage.tsx


echo "Patching WatchlistsPage.tsx..."

sed -i 's/import DeleteIcon/import HomeIcon from "@mui\/icons-material\/Home";\
import DeleteIcon/' \
$FRONT/WatchlistsPage.tsx

sed -i '/<Box/a\
          <Button\
            startIcon={<HomeIcon />}\
            onClick={() => navigate("/")}\
          >\
            Home\
          </Button>' \
$FRONT/WatchlistsPage.tsx


echo "Patching PortfolioDetailsPage.tsx..."

grep -q "ArrowBackIcon" \
$FRONT/PortfolioDetailsPage.tsx || \
sed -i 's/import DeleteIcon/import ArrowBackIcon from "@mui\/icons-material\/ArrowBack";\
import DeleteIcon/' \
$FRONT/PortfolioDetailsPage.tsx

grep -q "useNavigate" \
$FRONT/PortfolioDetailsPage.tsx || \
sed -i 's/import { useParams } from "react-router-dom";/import { useParams, useNavigate } from "react-router-dom";/' \
$FRONT/PortfolioDetailsPage.tsx

sed -i '/const { id } = useParams();/a\
  const navigate = useNavigate();' \
$FRONT/PortfolioDetailsPage.tsx

sed -i 's/<Typography\
          variant="h4"\
        >\
          Portfolio Details\
        <\/Typography>/<Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>\
          <Button\
            startIcon={<ArrowBackIcon \/>}\
            onClick={() => navigate("\/portfolios")}\
          >\
            Back\
          <\/Button>\
          <Typography variant="h4">\
            Portfolio Details\
          <\/Typography>\
        <\/Box>/' \
$FRONT/PortfolioDetailsPage.tsx


echo "Patching WatchlistDetailsPage.tsx..."

grep -q "ArrowBackIcon" \
$FRONT/WatchlistDetailsPage.tsx || \
sed -i 's/import DeleteIcon/import ArrowBackIcon from "@mui\/icons-material\/ArrowBack";\
import DeleteIcon/' \
$FRONT/WatchlistDetailsPage.tsx

grep -q "useNavigate" \
$FRONT/WatchlistDetailsPage.tsx || \
sed -i 's/import { useParams } from "react-router-dom";/import { useParams, useNavigate } from "react-router-dom";/' \
$FRONT/WatchlistDetailsPage.tsx

sed -i '/const { id } = useParams();/a\
  const navigate = useNavigate();' \
$FRONT/WatchlistDetailsPage.tsx

sed -i 's/<Typography\
          variant="h4"\
        >\
          Watchlist Details\
        <\/Typography>/<Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>\
          <Button\
            startIcon={<ArrowBackIcon \/>}\
            onClick={() => navigate("\/watchlists")}\
          >\
            Back\
          <\/Button>\
          <Typography variant="h4">\
            Watchlist Details\
          <\/Typography>\
        <\/Box>/' \
$FRONT/WatchlistDetailsPage.tsx

echo "Done"