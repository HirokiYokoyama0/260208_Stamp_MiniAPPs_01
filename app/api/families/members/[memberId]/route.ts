import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { isProxyMember } from '@/lib/members';

/**
 * PATCH /api/families/members/[memberId]
 * 代理管理メンバーの情報を編集する
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const body = await request.json();
    const { userId, childName, ticketNumber } = body;

    console.log('[仮想メンバー編集] リクエスト:', { memberId, userId, childName, ticketNumber });

    // バリデーション
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId は必須です' },
        { status: 400 }
      );
    }

    // 1. リクエストユーザーが親であることを確認
    const { data: parentProfile, error: parentError } = await supabase
      .from('profiles')
      .select('id, family_id, family_role')
      .eq('line_user_id', userId)
      .single();

    if (parentError || !parentProfile) {
      console.error('[仮想メンバー編集] 親プロフィール取得エラー:', parentError);
      return NextResponse.json(
        { success: false, error: 'ユーザー情報が見つかりません' },
        { status: 404 }
      );
    }

    if (parentProfile.family_role !== 'parent') {
      console.error('[仮想メンバー編集] 権限エラー: family_role =', parentProfile.family_role);
      return NextResponse.json(
        { success: false, error: '親アカウントのみが子供情報を編集できます' },
        { status: 403 }
      );
    }

    // 2. 編集対象の子供メンバーを取得
    const { data: childProfile, error: childError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', memberId)
      .single();

    if (childError || !childProfile) {
      console.error('[仮想メンバー編集] 子供プロフィール取得エラー:', childError);
      return NextResponse.json(
        { success: false, error: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // 3. 同じ家族に所属していることを確認
    if (childProfile.family_id !== parentProfile.family_id) {
      console.error('[仮想メンバー編集] 家族不一致エラー');
      return NextResponse.json(
        { success: false, error: '異なる家族のメンバーは編集できません' },
        { status: 403 }
      );
    }

    // 4. 更新データを準備
    const updateData: any = {};
    if (childName !== undefined) {
      updateData.display_name = childName;
    }
    if (ticketNumber !== undefined) {
      updateData.ticket_number = ticketNumber;
    }

    // 5. プロフィールを更新
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', memberId)
      .select()
      .single();

    if (updateError) {
      console.error('[仮想メンバー編集] 更新エラー:', updateError);
      return NextResponse.json(
        { success: false, error: 'メンバー情報の更新に失敗しました', details: updateError },
        { status: 500 }
      );
    }

    console.log('[仮想メンバー編集] 成功:', updatedProfile);

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error('[仮想メンバー編集] サーバーエラー:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/families/members/[memberId]
 * メンバーを削除する
 * 注意: 代理管理メンバー（line_user_id = NULL かつ manual-で始まる）の場合は完全削除、
 *       実メンバーの場合は家族紐付けのみ解除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('[仮想メンバー削除] リクエスト:', { memberId, userId });

    // バリデーション
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId は必須です' },
        { status: 400 }
      );
    }

    // 1. リクエストユーザーが親であることを確認
    const { data: parentProfile, error: parentError } = await supabase
      .from('profiles')
      .select('id, family_id, family_role')
      .eq('line_user_id', userId)
      .single();

    if (parentError || !parentProfile) {
      console.error('[仮想メンバー削除] 親プロフィール取得エラー:', parentError);
      return NextResponse.json(
        { success: false, error: 'ユーザー情報が見つかりません' },
        { status: 404 }
      );
    }

    if (parentProfile.family_role !== 'parent') {
      console.error('[仮想メンバー削除] 権限エラー: family_role =', parentProfile.family_role);
      return NextResponse.json(
        { success: false, error: '親アカウントのみが子供を削除できます' },
        { status: 403 }
      );
    }

    // 2. 削除対象の子供メンバーを取得
    const { data: childProfile, error: childError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', memberId)
      .single();

    if (childError || !childProfile) {
      console.error('[仮想メンバー削除] 子供プロフィール取得エラー:', childError);
      return NextResponse.json(
        { success: false, error: 'メンバーが見つかりません' },
        { status: 404 }
      );
    }

    // 3. 同じ家族に所属していることを確認
    if (childProfile.family_id !== parentProfile.family_id) {
      console.error('[仮想メンバー削除] 家族不一致エラー');
      return NextResponse.json(
        { success: false, error: '異なる家族のメンバーは削除できません' },
        { status: 403 }
      );
    }

    // 4. 代理管理メンバー（line_user_id = NULL かつ id が manual- で始まる）の場合は完全削除、
    //    実メンバーの場合は家族紐付けのみ解除
    if (isProxyMember(childProfile)) {
      // 代理管理メンバー: 完全削除（安全チェック付き）
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', memberId);

      if (deleteError) {
        console.error('[代理管理メンバー削除] 削除エラー:', deleteError);
        return NextResponse.json(
          { success: false, error: 'メンバーの削除に失敗しました', details: deleteError },
          { status: 500 }
        );
      }

      console.log('[代理管理メンバー削除] 完全削除成功:', memberId);
    } else {
      // 実メンバー: 家族紐付けのみ解除
      const { error: unlinkError } = await supabase
        .from('profiles')
        .update({
          family_id: null,
          family_role: null,
        })
        .eq('id', memberId);

      if (unlinkError) {
        console.error('[実メンバー削除] 紐付け解除エラー:', unlinkError);
        return NextResponse.json(
          { success: false, error: '家族紐付けの解除に失敗しました', details: unlinkError },
          { status: 500 }
        );
      }

      console.log('[実メンバー削除] 紐付け解除成功:', memberId);
    }

    return NextResponse.json({
      success: true,
      message: '削除しました',
    });
  } catch (error) {
    console.error('[仮想メンバー削除] サーバーエラー:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
