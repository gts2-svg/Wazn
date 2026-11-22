#!/bin/sh
# يجهّز تطبيق «وزن» الأصلي (SwiftUI) للبناء: ينسخ القاموس والمختارات والمساجلة والدواوين من data/
# إلى داخل التطبيق، ويضبط رقم نسخته (MARKETING_VERSION) من ios/VERSION.
# نواة المحرك ios/App/JS/wazn-core.js مولَّدة من src/ بالأمر: node ios/core/build.mjs
# الاسم باقٍ كما هو لأن سير البناء ورفع TestFlight يستدعيانه.
set -e
cd "$(dirname "$0")/.."
rm -rf ios/App/Data && mkdir -p ios/App/Data
cp data/dict.tsv data/mukhtarat.json data/musajala.json ios/App/Data/
cp -R data/diwans ios/App/Data/diwans
test -f ios/App/JS/wazn-core.js || { echo "ios/App/JS/wazn-core.js missing: run node ios/core/build.mjs"; exit 1; }
V=$(tr -d ' \r\n' < ios/VERSION)
sed -i.bak -E "s/MARKETING_VERSION: \"[0-9.]+\"/MARKETING_VERSION: \"$V\"/" ios/project.yml && rm -f ios/project.yml.bak
echo "data copied, version $V"
du -sh ios/App/Data
