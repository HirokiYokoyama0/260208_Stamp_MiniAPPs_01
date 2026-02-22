import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * POST /api/families/members/add
 * 親が仮想子供メンバーを追加する
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, childName, ticketNumber } = body;

    console.log('[仮想メンバー追加] リクエスト:', { userId, childName, ticketNumber });

    // バリデーション
    if (!userId || !childName) {
      return NextResponse.json(
        { success: false, error: 'userId と childName は必須です' },
        { status: 400 }
      );
    }

    // 1. リクエストユーザーが親（family_role = 'parent'）であることを確認
    const { data: parentProfile, error: parentError } = await supabase
      .from('profiles')
      .select('id, family_id, family_role')
      .eq('line_user_id', userId)
      .single();

    if (parentError || !parentProfile) {
      console.error('[仮想メンバー追加] 親プロフィール取得エラー:', parentError);
      return NextResponse.json(
        { success: false, error: 'ユーザー情報が見つかりません' },
        { status: 404 }
      );
    }

    if (parentProfile.family_role !== 'parent') {
      console.error('[仮想メンバー追加] 権限エラー: family_role =', parentProfile.family_role);
      return NextResponse.json(
        { success: false, error: '親アカウントのみが子供を追加できます' },
        { status: 403 }
      );
    }

    if (!parentProfile.family_id) {
      console.error('[仮想メンバー追加] 家族未登録エラー');
      return NextResponse.json(
        { success: false, error: '家族情報が見つかりません' },
        { status: 400 }
      );
    }

    // 2. 手動IDを生成
    const virtualChildId = `manual-child-${randomUUID()}`;

    // 3. profiles テーブルに仮想子供を追加
    const { data: newChild, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: virtualChildId,
        line_user_id: null, // 仮想メンバーはLINEアカウントなし
        display_name: childName, // 表示名（検索用・互換性用）
        real_name: childName,    // 本名（実際の名前を保存）
        ticket_number: ticketNumber || null,
        stamp_count: 0,
        visit_count: 0,
        last_visit_date: null,
        family_id: parentProfile.family_id,
        family_role: 'child',
        view_mode: 'kids',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[仮想メンバー追加] 挿入エラー:', insertError);
      return NextResponse.json(
        { success: false, error: 'メンバーの追加に失敗しました', details: insertError },
        { status: 500 }
      );
    }

    console.log('[仮想メンバー追加] 成功:', newChild);

    return NextResponse.json({
      success: true,
      profile: newChild,
    });
  } catch (error) {
    console.error('[仮想メンバー追加] サーバーエラー:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
