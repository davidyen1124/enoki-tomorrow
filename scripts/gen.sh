#!/bin/zsh
# usage: scripts/gen.sh <outname> <promptfile> [input images...]
# One Codex run per asset: imagegen skill, built-in image_gen tool, result copied to ./assets-src/gen/<outname>.png
name=$1; pf=$2; shift 2
imgs=()
for i in "$@"; do imgs+=("--image=$i"); done
body=$(cat "$pf")
if [ $# -gt 0 ]; then
  mode="This is an EDIT task: the attached image(s) are provided. Use the built-in image_gen tool in edit mode with the attached image(s) as described below."
else
  mode="This is a GENERATE task."
fi
prompt="Use the imagegen skill with the built-in image_gen tool (NOT the CLI fallback, no API key needed). $mode Make exactly ONE image_gen call, then copy the resulting file to ./assets-src/gen/$name.png (overwrite if exists). Do NOT request a transparent background (leave transparent_background off); the backdrop must be exactly as described. Do nothing else; do not ask questions.

$body"
cd "$(dirname "$0")/.." || exit 1   # the repo root, wherever it is checked out (this script lives in scripts/)
mkdir -p assets-src/gen/logs        # git-ignored, so a fresh clone does not have it
codex exec --skip-git-repo-check -c model_reasoning_effort="low" "${imgs[@]}" -- "$prompt" < /dev/null > assets-src/gen/logs/$name.log 2>&1
if [ -f assets-src/gen/$name.png ]; then echo "OK $name"; else echo "FAIL $name"; fi
