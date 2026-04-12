const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { type, title, body, senderName, senderEmail } = await req.json() as {
      type?:       string;
      title:       string;
      body:        string;
      senderName?: string;
      senderEmail?: string;
    };
    const isSuggestion = type === 'suggestion';

    if (!title?.trim() || !body?.trim()) {
      return new Response(JSON.stringify({ error: 'Título e descrição são obrigatórios.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Serviço de e-mail não configurado.' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const fromLine = senderName ? `${senderName} via Abily` : 'Abily App';
    const typeLabel = isSuggestion ? 'Sugestão de Melhoria' : 'Bug / Problema Reportado';
    const headerColor = isSuggestion ? '#EA580C' : '#DC2626';
    const htmlBody = `
      <h2 style="color:${headerColor};">${typeLabel}</h2>
      <p><strong>Título:</strong> ${title.trim()}</p>
      <p><strong>${isSuggestion ? 'Ideia' : 'Descrição'}:</strong></p>
      <pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;">${body.trim()}</pre>
      ${senderName  ? `<p><strong>Usuário:</strong> ${senderName}</p>`  : ''}
      ${senderEmail ? `<p><strong>E-mail:</strong> ${senderEmail}</p>` : ''}
      <hr/>
      <p style="color:#888;font-size:12px;">Enviado pelo app Abily</p>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'Abily App <onboarding@resend.dev>',
        to:      ['abilyoficial@gmail.com'],
        subject: `[Abily] ${isSuggestion ? 'Sugestão' : 'Bug'}: ${title.trim()}`,
        html:    htmlBody,
        reply_to: senderEmail || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Falha ao enviar e-mail. Tente novamente.' }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-support-email error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
