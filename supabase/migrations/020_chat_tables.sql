-- Abily — Tabelas de chat (conversations + messages)

-- 1. Tabela conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, student_id)
);

-- 2. Tabela messages
CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text            text NOT NULL CHECK (char_length(text) > 0 AND char_length(text) <= 1000),
  read            boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS conversations_instructor_id_idx ON public.conversations(instructor_id);
CREATE INDEX IF NOT EXISTS conversations_student_id_idx ON public.conversations(student_id);

-- 4. RLS — conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Participante pode ver suas próprias conversas
CREATE POLICY "conversations_select"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (instructor_id = auth.uid() OR student_id = auth.uid());

-- Qualquer autenticado pode criar conversa (como instrutor ou aluno)
CREATE POLICY "conversations_insert"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (instructor_id = auth.uid() OR student_id = auth.uid());

-- 5. RLS — messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Só participantes da conversa podem ler mensagens
CREATE POLICY "messages_select"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.instructor_id = auth.uid() OR c.student_id = auth.uid())
    )
  );

-- Só participantes podem enviar mensagens, e apenas como si mesmos
CREATE POLICY "messages_insert"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.instructor_id = auth.uid() OR c.student_id = auth.uid())
    )
  );

-- Só o destinatário pode marcar como lido
CREATE POLICY "messages_update_read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    sender_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.instructor_id = auth.uid() OR c.student_id = auth.uid())
    )
  )
  WITH CHECK (read = true);
