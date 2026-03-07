#!/bin/bash

echo "=== FINAL VERIFICATION OF BROKEN MARKDOWN LINKS ==="
echo ""

# Check for actual broken references (old names NOT in archive/)
# Pattern: \](...old_name.md) but NOT archive/old_name.md

files=(
  "03_Database_Schema.md"
  "10_機能仕様書.md"
  "12_利用構造形態.md"
  "21_家族機能_実装計画書.md"
  "25_家族機能_招待コード参加.md"
  "40_QRコード表示仕様.md"
  "41_QRコードスキャン_実装完了.md"
  "42_スタンプ履歴表示改善.md"
  "43_本名カラム追加計画.md"
  "50_アンケート_懸念点対応方針.md"
  "51_アンケート_実装完了報告.md"
  "81_実行コマンド.md"
)

total_broken=0

for file in "${files[@]}"; do
  # Check for broken links - these patterns should NOT be found
  broken=$(grep -E '\]\(.*03_機能仕様書\.md\)|\]\(.*05_Database_Schema\.md\)|\]\(.*10_TODO\.md\)|\]\(.*90_実装履歴\.md\)|\]\(.*91_仕様変更|\]\(.*83_イベント|\]\(.*84_イベント|\]\(.*70_子供画面|\]\(.*82_QRコード|\]\(.*81_QRコード表示|\]\(.*60_スタンプルール\.md\)|\]\(.*50_利用構造形態\.md\)|\]\(.*25_仮想メンバー.*\.md\)|\]\(.*85_アンケート|\]\(.*86_アンケート|\]\(.*87_アンケート|\]\(.*21_家族ひもづけ.*\.md\)|\]\(.*Implementation_Log_mio\.md\)' "$file" 2>/dev/null | grep -v "archive/")
  
  if [ -n "$broken" ]; then
    echo "❌ $file"
    echo "$broken" | sed 's/^/   /'
    echo ""
    total_broken=$((total_broken + 1))
  else
    echo "✅ $file"
  fi
done

echo ""
if [ $total_broken -eq 0 ]; then
  echo "=========================================="
  echo "✅ SUCCESS: All broken links have been fixed!"
  echo "=========================================="
else
  echo "❌ FAILED: $total_broken files still have broken links"
fi
