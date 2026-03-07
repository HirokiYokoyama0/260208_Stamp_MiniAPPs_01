#!/bin/bash

echo "=== Verifying fixed files ==="

# Files that were specified as having broken links
files_to_check=(
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

broken_count=0

for file in "${files_to_check[@]}"; do
  if grep -q "03_機能仕様書\.md)\|05_Database_Schema\.md)\|10_TODO\.md)\|90_実装履歴\.md\|91_仕様変更履歴\.md\|83_イベントログ設計\|84_イベントログ仕様\|70_子供画面切替\|82_QRコードスキャン\|81_QRコード表示\|60_スタンプルール\.md)\|50_利用構造形態\.md)\|25_仮想メンバー機能仕様\|85_アンケート機能仕様\|86_アンケート機能\|87_アンケート機能\|21_家族ひもづけ機能.*管理ダッシュボード\|Implementation_Log_mio\.md)" "$file" 2>/dev/null; then
    # Check if it's an actual markdown link or just text reference
    if grep -q "\](.*03_機能仕様書\.md\|.*05_Database_Schema\.md\|.*10_TODO\.md\|.*90_実装履歴\.md\|.*91_仕様変更\|.*83_イベントログ\|.*84_イベント\|.*70_子供画面\|.*82_QRコード\|.*81_QRコード\|.*60_スタンプ\|.*50_利用構\|.*25_仮想\|.*85_アンケート\|.*86_アンケート\|.*87_アンケート\|.*21_家族ひもづけ\|.*Implementation_Log" "$file" 2>/dev/null; then
      echo "❌ $file - BROKEN MARKDOWN LINKS FOUND"
      broken_count=$((broken_count + 1))
    else
      echo "✅ $file - OK (only text references)"
    fi
  else
    echo "✅ $file - OK (no old references)"
  fi
done

if [ $broken_count -eq 0 ]; then
  echo ""
  echo "✅ ALL FILES VERIFIED - No broken markdown links found!"
else
  echo ""
  echo "❌ $broken_count files still have broken links"
fi
