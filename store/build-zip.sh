#!/bin/sh
# Builds the zip to upload to the Chrome Web Store: only the files the extension needs.
set -e
cd "$(dirname "$0")/.."
mkdir -p store/out
rm -f store/out/feedback-autofill.zip
zip -q -r store/out/feedback-autofill.zip manifest.json core.js content.js options.html options.js icons/icon16.png icons/icon48.png icons/icon128.png
unzip -l store/out/feedback-autofill.zip
