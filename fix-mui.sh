#!/bin/bash

set -e

echo "Fixing legacy MUI spacing props..."

find src -type f \( -name "*.tsx" -o -name "*.ts" \) | while read file
do
    sed -i 's/<Box p={\([0-9]\+\)}>/<Box sx={{ p: \1 }}>/' "$file"
    sed -i 's/<Box m={\([0-9]\+\)}>/<Box sx={{ m: \1 }}>/' "$file"
    sed -i 's/<Box mt={\([0-9]\+\)}>/<Box sx={{ mt: \1 }}>/' "$file"
    sed -i 's/<Box mb={\([0-9]\+\)}>/<Box sx={{ mb: \1 }}>/' "$file"
    sed -i 's/<Box ml={\([0-9]\+\)}>/<Box sx={{ ml: \1 }}>/' "$file"
    sed -i 's/<Box mr={\([0-9]\+\)}>/<Box sx={{ mr: \1 }}>/' "$file"
done

echo
echo "Checking remaining Box shorthand props..."
grep -R "<Box .*p={" src || true
grep -R "<Box .*m={" src || true

echo
echo "Done."
