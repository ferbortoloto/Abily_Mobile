export const SUPPORT_SECTIONS = [
  {
    id: 'primeiros_passos',
    title: 'Primeiros Passos',
    icon: 'rocket-outline',
    items: [
      {
        question: 'O que é o Abily?',
        answer:
          'O Abily é uma plataforma que conecta alunos a instrutores de autoescola particulares. Pelo app, você encontra profissionais perto de você, contrata planos de aulas, agenda sessões e acompanha seu progresso, tudo em um só lugar.',
      },
      {
        question: 'Como criar minha conta?',
        answer:
          'Na tela inicial, toque em "Criar conta" e preencha seus dados: nome, e-mail e senha. Você receberá um código de verificação no e-mail cadastrado. Após confirmar o código, escolha se deseja usar o app como Aluno ou como Instrutor e complete seu perfil.',
      },
      {
        question: 'Posso usar o mesmo e-mail para conta de aluno e instrutor?',
        answer:
          'Não. Cada e-mail está vinculado a um único tipo de conta. Caso queira usar o app nas duas funções, crie contas com e-mails diferentes.',
      },
      {
        question: 'Esqueci minha senha. Como recupero?',
        answer:
          'Na tela de login, toque em "Esqueci minha senha" e informe o e-mail cadastrado. Você receberá um link de redefinição no e-mail em poucos minutos. Verifique também a caixa de spam caso não encontre.',
      },
      {
        question: 'Como altero minha senha?',
        answer:
          'Acesse a aba "Perfil", toque em "Alterar senha" e preencha a senha atual seguida da nova senha. A alteração é aplicada imediatamente.',
      },
    ],
  },
  {
    id: 'para_alunos',
    title: 'Para Alunos',
    icon: 'school-outline',
    items: [
      {
        question: 'Como encontro um instrutor?',
        answer:
          'Na aba "Mapa", você verá os instrutores disponíveis próximos à sua localização. Você também pode usar a aba "Planos" para buscar e explorar perfis de instrutores com diferentes especialidades e preços.',
      },
      {
        question: 'Como ver o perfil de um instrutor?',
        answer:
          'Toque no marcador do instrutor no mapa ou no card dele na listagem de planos. O perfil exibe a bio, preço por aula, categorias de CNH atendidas, tipo de veículo (manual, automático, elétrico), avaliações de outros alunos e os planos disponíveis.',
      },
      {
        question: 'O que são planos?',
        answer:
          'Planos são pacotes de aulas com preço fechado. Por exemplo, "10 aulas por R$ 800,00". Ao contratar, você garante esse valor fixo e agenda as aulas aos poucos, conforme a disponibilidade do instrutor.',
      },
      {
        question: 'O que são aulas avulsas?',
        answer:
          'Aulas avulsas são aulas únicas, sem compromisso de pacote. Você paga por uma sessão de cada vez. São indicadas para quem quer experimentar o instrutor antes de fechar um plano, ou para complementar um pacote.',
      },
      {
        question: 'Como agendar uma aula?',
        answer:
          'Após contratar um plano, acesse-o pela aba "Planos". Cada plano tem um botão de agendamento que abre o calendário de disponibilidade do instrutor. Escolha o dia e horário desejados e confirme.',
      },
      {
        question: 'Posso cancelar uma aula agendada?',
        answer:
          'Sim. Abra o plano e toque na sessão agendada. O cancelamento é permitido com antecedência mínima estabelecida pelo instrutor (geralmente 24 horas). Cancelamentos dentro da janela mínima podem não gerar reembolso dos créditos.',
      },
      {
        question: 'Como funciona a política de reembolso?',
        answer:
          'Você tem direito a reembolso integral em até 7 dias corridos após a contratação, desde que nenhuma aula tenha sido realizada. Após esse prazo ou após realizar aulas, o reembolso é proporcional às sessões restantes, a critério da plataforma. Para solicitar, entre em contato pelo suporte.',
      },
      {
        question: 'Meu plano ficou ativo mas não consigo agendar. O que faço?',
        answer:
          'Verifique se o instrutor tem horários disponíveis na agenda dele. Caso a agenda esteja vazia, entre em contato com o instrutor pelo chat do app. Se o problema persistir, relate pelo suporte.',
      },
      {
        question: 'Como avalio um instrutor?',
        answer:
          'Após a conclusão de uma sessão, aparecerá a opção de avaliação no plano. Toque em "Avaliar" e deixe sua nota e comentário. As avaliações ficam visíveis no perfil público do instrutor.',
      },
      {
        question: 'Como uso o chat?',
        answer:
          'A aba "Mensagens" lista suas conversas com instrutores. Toque em uma conversa para abri-la e envie mensagens de texto. Use o chat para tirar dúvidas, combinar detalhes do ponto de encontro e comunicar imprevistos.',
      },
    ],
  },
  {
    id: 'para_instrutores',
    title: 'Para Instrutores',
    icon: 'car-outline',
    items: [
      {
        question: 'Como configurar meu perfil de instrutor?',
        answer:
          'Na aba "Perfil", você pode editar sua bio, definir o preço por aula, escolher as categorias de CNH que atende (A, B, C, D, E), informar o tipo de veículo que usa (manual, automático, elétrico), adicionar seus carros e motos e fazer o upload da foto de perfil.',
      },
      {
        question: 'Como configurar minha disponibilidade?',
        answer:
          'Na aba "Agenda", você vê uma grade semanal com os dias e horários. Ative os blocos de tempo em que está disponível para aulas. Ao salvar, esses horários ficam visíveis para os alunos na tela de agendamento. Alterações não salvas ficam pendentes até você confirmar.',
      },
      {
        question: 'Como criar um plano para oferecer aos alunos?',
        answer:
          'No painel principal (aba "Painel"), toque no botão "+" ou "Novo plano". Defina o nome do plano, a quantidade de sessões e o preço total. Publique e o plano ficará disponível para contratação no seu perfil público.',
      },
      {
        question: 'Posso pausar ou encerrar planos?',
        answer:
          'Sim. No "Perfil", você pode pausar todos os planos ativos (suspende novos agendamentos) ou encerrar planos individualmente. Sessões já agendadas não são afetadas pela pausa.',
      },
      {
        question: 'Como funciona o painel de alunos e sessões?',
        answer:
          'No "Painel" você vê em tempo real: solicitações de novos planos pendentes (aguardando sua aprovação), planos ativos com seus alunos e as próximas sessões agendadas. Você pode aceitar ou recusar solicitações diretamente por lá.',
      },
      {
        question: 'Como confirmo o início e fim de uma aula?',
        answer:
          'Quando a sessão estiver no horário, abra-a no Painel e toque em "Iniciar sessão". Ao término, toque em "Encerrar sessão". O app registra a duração e atualiza o status para "concluída".',
      },
      {
        question: 'Como recebo meus pagamentos?',
        answer:
          'Os pagamentos dos alunos são processados pela plataforma e creditados na sua carteira no Abily. No aba "Financeiro", você vê o saldo disponível e o histórico de transações. Para sacar, toque em "Solicitar saque" e informe sua chave Pix.',
      },
      {
        question: 'Quando posso sacar meu saldo?',
        answer:
          'O saldo fica disponível para saque após cada sessão ser marcada como concluída. Saques são processados em até 1–2 dias úteis após a solicitação.',
      },
      {
        question: 'Qual é a comissão da plataforma?',
        answer:
          'A comissão varia conforme o preço que você define por aula: Econômico (até R$ 60): 20% | Moderado (até R$ 80): 15% | Recomendado (até R$ 100): 12% | Premium (acima de R$ 100): 10%. O valor líquido que você recebe já é mostrado na configuração de preço do perfil.',
      },
      {
        question: 'Como recebo e-mail ou notificações de novos alunos?',
        answer:
          'O app envia notificações push para solicitações de planos, mensagens no chat e lembretes de sessões. Certifique-se de que as notificações do Abily estejam ativadas nas configurações do seu celular.',
      },
    ],
  },
  {
    id: 'pagamentos',
    title: 'Pagamentos',
    icon: 'card-outline',
    items: [
      {
        question: 'Quais formas de pagamento são aceitas?',
        answer:
          'Aceitamos Pix, cartão de crédito e boleto bancário. O processamento é feito de forma segura pela plataforma de pagamentos integrada ao app.',
      },
      {
        question: 'O pagamento é cobrado na hora da contratação?',
        answer:
          'Sim. Ao finalizar a contratação de um plano ou aula avulsa, o pagamento é processado imediatamente. Só após a confirmação do pagamento o plano é ativado.',
      },
      {
        question: 'Meu pagamento falhou. O que faço?',
        answer:
          'Verifique se os dados do cartão estão corretos ou se há saldo suficiente. Para Pix, confirme se o QR Code ou a chave estão corretos e se o pagamento foi feito dentro do prazo de validade. Se o problema persistir, tente outro método de pagamento ou entre em contato com o suporte.',
      },
      {
        question: 'Como peço reembolso?',
        answer:
          'Solicite reembolso pelo suporte, enviando o comprovante de compra e o motivo do pedido para abilyoficial@gmail.com. Atendemos dentro de 2 dias úteis. Lembrando que o prazo para reembolso integral é de 7 dias corridos sem aulas realizadas.',
      },
    ],
  },
  {
    id: 'conta_privacidade',
    title: 'Conta & Privacidade',
    icon: 'shield-checkmark-outline',
    items: [
      {
        question: 'Como altero meu e-mail ou telefone?',
        answer:
          'Acesse "Perfil" e toque em "Editar". Você pode atualizar seu telefone diretamente. Para alterar o e-mail, entre em contato com o suporte, pois é necessária verificação de identidade.',
      },
      {
        question: 'Meus dados estão seguros?',
        answer:
          'Sim. Usamos o Supabase como banco de dados com criptografia em trânsito (TLS) e em repouso. Senhas são armazenadas com hash seguro e nunca em texto puro. Os dados de pagamento são tratados integralmente pelo provedor de pagamentos, sem armazenamento no Abily.',
      },
      {
        question: 'Como excluo minha conta?',
        answer:
          'Para solicitar a exclusão da conta e de todos os seus dados, envie um e-mail para abilyoficial@gmail.com com o assunto "Exclusão de conta" a partir do endereço cadastrado. Processamos a solicitação em até 5 dias úteis.',
      },
      {
        question: 'O app acessa minha localização?',
        answer:
          'Sim, com sua permissão. A localização é usada para mostrar instrutores próximos no mapa e facilitar o ponto de encontro das aulas. O Abily não armazena seu histórico de localização.',
      },
    ],
  },
];
