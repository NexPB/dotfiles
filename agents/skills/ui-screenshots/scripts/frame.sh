#!/usr/bin/env bash
# Frame screenshots for a PR: rounded corners, a shadow, padding on a soft background.
# Two inputs become one labelled Before/After image; one input is framed alone.
# Usage: frame.sh <before.png> <after.png> <out.png>
#        frame.sh <image.png> <out.png>
# Env: FRAME_BG (default #f4f4f5), FRAME_LABELS (default "Before,After"), FRAME_FONT.
set -euo pipefail

usage() { echo "usage: frame.sh <before.png> <after.png> <out.png> | frame.sh <image.png> <out.png>" >&2; exit 2; }

case $# in
  2) inputs=("$1"); out=$2 ;;
  3) inputs=("$1" "$2"); out=$3 ;;
  *) usage ;;
esac

for f in "${inputs[@]}"; do [[ -f $f ]] || { echo "frame.sh: no such file: $f" >&2; exit 1; }; done

bg="${FRAME_BG:-#f4f4f5}"
IFS=, read -r label_before label_after <<<"${FRAME_LABELS:-Before,After}"
labels=("$label_before" "$label_after")
font="${FRAME_FONT:-Arial}"

# Sizes assume a 2x capture: 16px radius and 28px labels read as 8px and 14px on screen.
radius=16 gap=48 pad=64 label_size=28 max_side=2400
# -shadow grows the card by 2*sigma on each side; the label is indented by the same amount.
shadow_sigma=20 shadow_margin=40

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Round the corners, then put a soft shadow under the result.
card() {
  local in=$1 out=$2 w h
  read -r w h < <(magick identify -format '%w %h\n' "$in")
  magick "$in" -alpha set \
    \( -size "${w}x${h}" xc:none -fill white -draw "roundrectangle 0,0 $((w - 1)),$((h - 1)) $radius,$radius" \) \
    -compose DstIn -composite \
    \( +clone -background '#18181b' -shadow "18x${shadow_sigma}+0+12" \) +swap \
    -background none -compose Over -layers merge +repage "$out"
}

for i in "${!inputs[@]}"; do
  card "${inputs[$i]}" "$tmp/card$i.png"
done

if ((${#inputs[@]} == 1)); then
  cp "$tmp/card0.png" "$tmp/body.png"
else
  for i in 0 1; do
    magick \( -background none -fill '#52525b' -font "$font" -pointsize "$label_size" "label:${labels[$i]}" -splice "${shadow_margin}x0" +repage \) \
      "$tmp/card$i.png" -background none -gravity west -append +repage "$tmp/labelled$i.png"
  done

  read -r w0 h0 < <(magick identify -format '%w %h\n' "${inputs[0]}")
  read -r w1 h1 < <(magick identify -format '%w %h\n' "${inputs[1]}")
  if ((w0 > h0 && w1 > h1)); then
    magick "$tmp/labelled0.png" "$tmp/labelled1.png" -background none -gravity west -smush "$gap" "$tmp/body.png"
  else
    magick "$tmp/labelled0.png" "$tmp/labelled1.png" -background none -gravity north +smush "$gap" "$tmp/body.png"
  fi
fi

magick "$tmp/body.png" -bordercolor none -border "$pad" -background "$bg" -flatten \
  -resize "${max_side}x${max_side}>" -strip -define png:compression-level=9 "$out"

echo "$out"
