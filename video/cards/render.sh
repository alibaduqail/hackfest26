#!/bin/sh
# Renders cards 1-8 to png/card-0N.png at 1920x1080 (final state, ?still=1). Needs Google Chrome on macOS.
cd "$(dirname "$0")"
for n in 1 2 3 4 5 6 7 8; do
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1920,1080 \
    --virtual-time-budget=4000 --screenshot="$PWD/png/card-0$n.png" "file://$PWD/index.html?card=$n&still=1" >/dev/null 2>&1
done
