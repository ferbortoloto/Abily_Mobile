import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { class_request_id, instructor_id } = await req.json() as {
      class_request_id: string;
      instructor_id:    string;
    };

    // Busca o pagamento vinculado à solicitação + student_id do request
    const { data: classReq } = await supabase
      .from('class_requests')
      .select('student_id')
      .eq('id', class_request_id)
      .single();
    const student_id = classReq?.student_id ?? null;

    const { data: avulsa, error: avulsaErr } = await supabase
      .from('avulsa_payments')
      .select('id, price, status, payment_method')
      .eq('class_request_id', class_request_id)
      .maybeSingle();

    if (avulsaErr || !avulsa) {
      return new Response(JSON.stringify({ error: 'Pagamento não encontrado.' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (avulsa.status !== 'paid') {
      return new Response(JSON.stringify({ error: 'Pagamento ainda não confirmado pelo aluno.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Aceita a solicitação (crédito ao instrutor ocorre apenas após a aula ser concluída)
    await supabase
      .from('class_requests')
      .update({ status: 'accepted' })
      .eq('id', class_request_id);

    // Notifica o aluno (fire & forget)
    if (student_id) {
      try {
        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('push_token, name')
          .eq('id', student_id)
          .single();

        await supabase.from('notifications').insert({
          user_id: student_id,
          type: 'class_accepted',
          title: 'Aula confirmada! 🎉',
          body: 'Sua aula foi aceita pelo instrutor. Prepare-se!',
          data: { class_request_id },
        });

        if (studentProfile?.push_token?.startsWith('ExponentPushToken')) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: studentProfile.push_token,
              title: '✅ Aula confirmada!',
              body: 'Sua aula foi aceita pelo instrutor. Prepare-se!',
              sound: 'default',
              priority: 'high',
              data: { type: 'class_accepted', class_request_id },
            }),
          });
        }
      } catch (notifErr) {
        console.error('Notification error (non-blocking):', notifErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('accept-avulsa error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
