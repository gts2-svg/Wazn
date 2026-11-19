#!/bin/sh
# ينسخ ملفات الموقع (كما هي في المستودع) إلى داخل تطبيق الآيفون، ويضبط رقم نسخة التطبيق على رقم نسخة الموقع.
set -e
cd "$(dirname "$0")/.."
rm -rf ios/Shell/Web && mkdir -p ios/Shell/Web
for f in *; do
  case "$f" in ios|tools|README.md|package.json|package-lock.json|node_modules) continue ;; esac
  cp -R "$f" ios/Shell/Web/
done
V=$(grep -m1 -oE "const VERSION = '[0-9.]+'" app.js | grep -oE "[0-9.]+")
sed -i.bak -E "s/MARKETING_VERSION: \"[0-9.]+\"/MARKETING_VERSION: \"$V\"/" ios/project.yml && rm -f ios/project.yml.bak
echo "web files copied, version $V"; du -sh ios/Shell/Web
