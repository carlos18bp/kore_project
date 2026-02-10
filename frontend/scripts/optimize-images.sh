#!/usr/bin/env bash
# =============================================================
# KÓRE - Image Optimization Script
# Converts images (png, jpg, jpeg) to WebP format
# Usage: ./scripts/optimize-images.sh [source_dir] [quality]
#   source_dir: directory with images (default: public/images)
#   quality:    WebP quality 0-100 (default: 80)
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SOURCE_DIR="${1:-$PROJECT_ROOT/public/images}"
QUALITY="${2:-80}"

if ! command -v cwebp &> /dev/null; then
  echo "❌ 'cwebp' not found. Install it with:"
  echo "   sudo apt install webp        # Debian/Ubuntu"
  echo "   brew install webp             # macOS"
  exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Directory not found: $SOURCE_DIR"
  exit 1
fi

echo "🔄 Optimizing images in: $SOURCE_DIR"
echo "   Quality: $QUALITY"
echo ""

count=0

for img in "$SOURCE_DIR"/*.{png,jpg,jpeg,PNG,JPG,JPEG}; do
  [ -f "$img" ] || continue

  filename=$(basename "$img")
  name="${filename%.*}"
  output="$SOURCE_DIR/${name}.webp"

  if [ -f "$output" ]; then
    echo "⏭  Skip (already exists): $filename → ${name}.webp"
    continue
  fi

  echo "✅ Converting: $filename → ${name}.webp"
  cwebp -q "$QUALITY" "$img" -o "$output" -quiet
  count=$((count + 1))
done

echo ""
echo "🎉 Done! Converted $count image(s) to WebP."
