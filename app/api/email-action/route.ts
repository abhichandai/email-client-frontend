import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const { action, emailId, userId, value, senderEmail, accountToken } = await request.json();
  const supabase = getSupabase();

  if (action === 'set_priority_override') {
    // Override priority for this email
    await supabase.from('emails')
      .update({ priority_override: value, updated_at: new Date().toISOString() })
      .eq('id', emailId).eq('user_id', userId);

    // Also add sender to priority rules if boosting/lowering
    if (senderEmail) {
      const { data: existing } = await supabase
        .from('priority_rules').select('*').eq('user_id', userId).single();

      if (existing) {
        let importantSenders = existing.important_senders || [];
        let unimportantSenders = existing.unimportant_senders || [];

        if (value === 'HIGH') {
          importantSenders = [...new Set([...importantSenders, senderEmail])];
          unimportantSenders = unimportantSenders.filter((s: string) => s !== senderEmail);
        } else if (value === 'LOW') {
          unimportantSenders = [...new Set([...unimportantSenders, senderEmail])];
          importantSenders = importantSenders.filter((s: string) => s !== senderEmail);
        } else {
          importantSenders = importantSenders.filter((s: string) => s !== senderEmail);
          unimportantSenders = unimportantSenders.filter((s: string) => s !== senderEmail);
        }
        await supabase.from('priority_rules')
          .update({ important_senders: importantSenders, unimportant_senders: unimportantSenders })
          .eq('user_id', userId);
      } else {
        await supabase.from('priority_rules').insert({
          user_id: userId,
          important_senders: value === 'HIGH' ? [senderEmail] : [],
          unimportant_senders: value === 'LOW' ? [senderEmail] : [],
          important_domains: [],
          important_keywords: [],
        });
      }
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'mark_read' || action === 'mark_unread') {
    const isRead = action === 'mark_read';
    await supabase.from('emails')
      .update({ is_read: isRead, updated_at: new Date().toISOString() })
      .eq('id', emailId).eq('user_id', userId);

    // Also call Gmail API to sync read state
    if (accountToken) {
      const labelAction = isRead
        ? { removeLabelIds: ['UNREAD'] }
        : { addLabelIds: ['UNREAD'] };
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accountToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(labelAction),
      });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
