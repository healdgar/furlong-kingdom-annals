#!/bin/sh
# Stamp the loading screen with the build time (UTC) and the commit it builds on. Run before committing a release.
cd "$(dirname "$0")/.." || exit 1
T=$(date -u +'%Y-%m-%d %H:%M UTC'); H=$(git rev-parse --short HEAD 2>/dev/null || echo dev)
node tools/embed-advisor.mjs || exit 1
sed -E "s|(<div id=\"buildstamp\"[^>]*>)[^<]*(</div>)|\1build $T · after $H\2|" index.html > index.html.tmp && mv index.html.tmp index.html
grep -o 'build [0-9-]* [0-9:]* UTC[^<]*' index.html
