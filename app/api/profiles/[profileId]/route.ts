import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/profiles/[profileId]
 * プロフィールIDでプロフィール情報を取得する
 * 仮想メンバーにも対応
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { profileId } = await params;

    console.log('[プロフィール取得] リクエスト:', { profileId });

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'profileId は必須です' },
        { status: 400 }
      );
    }

    // プロフィールを取得
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError || !profile) {
      console.error('[プロフィール取得] エラー:', profileError);
      return NextResponse.json(
        { success: false, error: 'プロフィールが見つかりません' },
        { status: 404 }
      );
    }

    console.log('[プロフィール取得] 成功:', profile);

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('[プロフィール取得] サーバーエラー:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
