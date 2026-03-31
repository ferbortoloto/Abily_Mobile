// Abily — Termos de Uso
// Versão MVP · Vigência: 60 dias a partir da aceitação

export const TERMS_VERSION = '1.0-MVP';
export const TERMS_VALIDITY_DAYS = 60;

// ─────────────────────────────────────────────
// TERMOS GERAIS (comuns às duas partes)
// ─────────────────────────────────────────────
const GENERAL_INTRO = `
TERMOS DE USO — ABILY
Versão ${TERMS_VERSION} | Válidos por ${TERMS_VALIDITY_DAYS} dias a partir da data de aceite

Leia atentamente estes Termos de Uso antes de utilizar o aplicativo Abily ("Aplicativo", "Plataforma", "Abily"). Ao concluir seu cadastro ou utilizar qualquer funcionalidade do Aplicativo, você declara ter lido, compreendido e concordado integralmente com todas as disposições abaixo.

Caso não concorde com alguma cláusula, não utilize o Aplicativo.
`;

const GENERAL_SECTIONS = [
  {
    title: '1. DEFINIÇÕES',
    body: `1.1 "Abily" ou "Plataforma": o aplicativo móvel Abily, seus sistemas, serviços e infraestrutura tecnológica.
1.2 "Usuário": qualquer pessoa que acesse ou utilize o Aplicativo, seja como Aluno ou como Instrutor.
1.3 "Aluno": pessoa física que utiliza a Plataforma para buscar, contratar e realizar aulas de direção.
1.4 "Instrutor": profissional autônomo que oferece aulas de direção por meio da Plataforma.
1.5 "Aula": sessão de prática de direção veicular com duração padrão de 50 (cinquenta) minutos, realizada entre Aluno e Instrutor.
1.6 "Plano": pacote de Aulas adquirido pelo Aluno com validade definida.
1.7 "Sessão": período ativo de uma Aula verificado por código digital gerado na Plataforma.
1.8 "Código de Sessão": código numérico de 6 dígitos utilizado para confirmar o início de uma Aula.
1.9 "Comissão": percentual retido pela Abily sobre o valor de cada Aula concluída.
1.10 "Período MVP": fase inicial de ${TERMS_VALIDITY_DAYS} dias a partir do aceite destes Termos, durante a qual regras, funcionalidades e condições comerciais poderão ser modificadas com aviso prévio de 7 dias.`,
  },
  {
    title: '2. NATUREZA DA PLATAFORMA',
    body: `2.1 A Abily é uma plataforma de intermediação tecnológica que conecta Alunos a Instrutores autônomos. A Abily NÃO é auto-escola, NÃO ministra aulas e NÃO possui vínculo empregatício, societário ou de qualquer outra natureza com os Instrutores cadastrados.
2.2 A Abily não participa fisicamente das aulas e não monitora, supervisiona nem controla a condução dos veículos ou o comportamento das partes durante as Sessões.
2.3 A relação contratual principal de prestação de serviços de instrução de direção se dá diretamente entre Aluno e Instrutor. A Abily atua exclusivamente como facilitador tecnológico desse encontro.
2.4 A Abily não se responsabiliza pela qualidade pedagógica, didática ou técnica das aulas ministradas pelos Instrutores.
2.5 Qualquer divergência, litígio ou reclamação referente ao conteúdo, qualidade ou execução das aulas deve ser resolvida diretamente entre Aluno e Instrutor.`,
  },
  {
    title: '3. CADASTRO E ELEGIBILIDADE',
    body: `3.1 Para utilizar o Aplicativo, o Usuário deve ter pelo menos 18 (dezoito) anos de idade ou a maioridade legal aplicável.
3.2 O Usuário é responsável pela veracidade, precisão e atualização das informações fornecidas no cadastro, incluindo nome, CPF, data de nascimento, telefone e endereço.
3.3 O fornecimento de informações falsas, incompletas ou desatualizadas poderá resultar na suspensão ou exclusão da conta, sem prejuízo de medidas legais cabíveis.
3.4 Cada Usuário pode manter apenas uma conta ativa. É vedado o compartilhamento de credenciais de acesso.
3.5 A Abily reserva-se o direito de recusar ou cancelar cadastros a seu exclusivo critério, sem obrigação de justificativa.`,
  },
  {
    title: '4. PRIVACIDADE E DADOS PESSOAIS',
    body: `4.1 O tratamento de dados pessoais dos Usuários é regido pela Política de Privacidade da Abily, disponível no Aplicativo, e observa as disposições da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
4.2 Ao se cadastrar, o Usuário consente com a coleta, uso, armazenamento e compartilhamento de seus dados na medida necessária para a prestação dos serviços da Plataforma.
4.3 Dados de localização são utilizados exclusivamente para exibir Instrutores próximos e calcular rotas, nunca sendo comercializados a terceiros.
4.4 Dados de pagamento são processados por provedores terceiros certificados (PCI-DSS). A Abily não armazena dados completos de cartões de crédito.
4.5 O Usuário pode solicitar a exclusão de sua conta e de seus dados pessoais a qualquer momento, observadas as obrigações legais de retenção.`,
  },
  {
    title: '5. RESPONSABILIDADES DO USUÁRIO',
    body: `5.1 O Usuário é o único responsável por suas ações dentro e fora da Plataforma, incluindo comportamento durante as Aulas.
5.2 É vedado ao Usuário:
   a) utilizar o Aplicativo para fins ilícitos, fraudulentos ou contrários à ordem pública;
   b) assediar, ameaçar, discriminar ou ofender outros Usuários;
   c) falsificar documentos, identidade ou qualificações;
   d) manipular avaliações, avaliações falsas ou deturpadas;
   e) ceder, vender ou transferir sua conta a terceiros;
   f) tentar comprometer a segurança, disponibilidade ou integridade técnica do Aplicativo.
5.3 O Usuário concorda em indenizar a Abily por quaisquer danos, perdas, custas e honorários advocatícios decorrentes de violação destes Termos ou de conduta ilícita.`,
  },
  {
    title: '6. AVALIAÇÕES E REPUTAÇÃO',
    body: `6.1 Após cada Aula, Alunos e Instrutores podem avaliar a experiência com nota (1 a 5 estrelas) e comentário escrito, dentro de 7 dias corridos após o encerramento da Sessão.
6.2 Avaliações devem ser verídicas, baseadas na experiência real da Aula avaliada.
6.3 A Abily pode remover avaliações que contenham linguagem ofensiva, discriminatória ou manifestamente falsa, a seu exclusivo critério.
6.4 A Abily não se responsabiliza pelo conteúdo das avaliações nem garante que reflitam a qualidade real dos serviços prestados.`,
  },
  {
    title: '7. DISPONIBILIDADE DA PLATAFORMA',
    body: `7.1 A Abily envidará esforços razoáveis para manter o Aplicativo disponível, mas não garante disponibilidade ininterrupta, livre de falhas ou erros.
7.2 A Abily pode realizar manutenções programadas ou emergenciais sem aviso prévio, durante as quais o Aplicativo poderá ficar temporariamente indisponível.
7.3 A Abily não se responsabiliza por perdas, prejuízos ou danos decorrentes de indisponibilidade técnica, falhas de conexão, erros de software ou qualquer outro problema técnico fora de seu controle direto.
7.4 Durante o Período MVP, funcionalidades podem ser adicionadas, modificadas ou removidas com aviso de 7 dias antecedência sempre que possível.`,
  },
  {
    title: '8. LIMITAÇÃO DE RESPONSABILIDADE',
    body: `8.1 A Abily não se responsabiliza, em nenhuma hipótese, por:
   a) acidentes de trânsito, danos físicos, materiais ou morais ocorridos durante a realização de Aulas;
   b) infrações de trânsito cometidas durante as Aulas;
   c) danos a veículos, pertences ou terceiros causados durante as Sessões;
   d) qualidade, eficácia ou resultado pedagógico das aulas;
   e) conduta de Instrutores ou Alunos fora do Aplicativo;
   f) inadimplência de qualquer das partes;
   g) perda de dados decorrente de mau uso do dispositivo pelo Usuário;
   h) força maior, caso fortuito ou eventos fora do controle razoável da Abily.
8.2 Em qualquer hipótese em que a responsabilidade da Abily seja reconhecida judicialmente, o valor máximo de indenização fica limitado ao total de comissões efetivamente pagas à Abily pelo Usuário nos últimos 90 dias.
8.3 A Abily não oferece garantia de resultado quanto à aprovação em exames do DETRAN ou à obtenção de habilitação.`,
  },
  {
    title: '9. ALTERAÇÕES NOS TERMOS',
    body: `9.1 A Abily pode revisar estes Termos a qualquer momento. Quando ocorrerem mudanças relevantes, os Usuários serão notificados pelo Aplicativo com antecedência mínima de 7 dias.
9.2 O uso continuado do Aplicativo após a entrada em vigor das alterações implica aceitação dos novos Termos.
9.3 Estes Termos têm vigência de ${TERMS_VALIDITY_DAYS} dias a partir da data de aceite pelo Usuário. Após esse prazo, uma nova versão poderá ser apresentada para aceite.`,
  },
  {
    title: '10. LEGISLAÇÃO APLICÁVEL E FORO',
    body: `10.1 Estes Termos são regidos pelas leis da República Federativa do Brasil.
10.2 Fica eleito o foro da Comarca de [cidade da sede da Abily] para dirimir quaisquer controvérsias oriundas destes Termos, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
  },
];

// ─────────────────────────────────────────────
// TERMOS ESPECÍFICOS — ALUNO
// ─────────────────────────────────────────────
const STUDENT_SPECIFIC_SECTIONS = [
  {
    title: 'A1. CONTRATAÇÃO DE AULAS E PLANOS',
    body: `A1.1 O Aluno pode contratar Aulas de forma avulsa ou por meio de Planos de pacote de Aulas disponíveis no perfil do Instrutor escolhido.
A1.2 Planos adquiridos durante o Período MVP possuem validade de até 60 (sessenta) dias corridos a partir da data de compra, prazo após o qual as Aulas remanescentes expiram sem direito a reembolso.
A1.3 O Aluno é responsável por agendar as Aulas dentro do prazo de validade do Plano. A expiração por inércia do Aluno não gera obrigação de restituição pela Abily ou pelo Instrutor.
A1.4 A duração padrão de cada Aula na Plataforma é de 50 (cinquenta) minutos, conforme definido pela Abily. O Aluno reconhece e aceita esse padrão ao adquirir qualquer Plano ou Aula avulsa.`,
  },
  {
    title: 'A2. PAGAMENTOS',
    body: `A2.1 Os pagamentos são realizados pelo Aplicativo, mediante os métodos disponíveis (Pix, cartão de crédito em até 12x ou boleto bancário com vencimento em 3 dias úteis).
A2.2 A confirmação do pagamento é condição para a liberação do agendamento de Aulas.
A2.3 Boletos não pagos dentro do prazo de vencimento são cancelados automaticamente, sem geração de crédito ou reserva de Aulas.
A2.4 A Abily não armazena dados completos de cartões de crédito. O processamento é realizado por operadoras terceirizadas certificadas.
A2.5 O Aluno é responsável pela exatidão dos dados de pagamento informados. Cobranças indevidas decorrentes de dados errados são de responsabilidade exclusiva do Aluno.`,
  },
  {
    title: 'A3. POLÍTICA DE REEMBOLSO',
    body: `A3.1 O Aluno tem direito a solicitar reembolso integral do valor pago por um Plano nas seguintes condições cumulativas:
   a) a solicitação seja feita dentro de 7 (sete) dias corridos da data de compra;
   b) nenhuma Aula do Plano tenha sido iniciada ou marcada como concluída;
   c) o status do Plano seja "ativo".
A3.2 Solicitado o reembolso, o Plano é imediatamente suspenso e nenhuma nova Aula poderá ser agendada.
A3.3 O prazo para processamento do reembolso é de até 10 dias úteis, sujeito ao prazo de cada método de pagamento.
A3.4 Após o início da primeira Aula do Plano, ou após 7 dias da compra, não haverá direito a reembolso, parcial ou total.
A3.5 Aulas avulsas (fora de Planos) não são reembolsáveis após a confirmação do pagamento.
A3.6 A Abily não se responsabiliza por reembolsos referentes a Aulas canceladas pelo Instrutor após iniciadas. Nesses casos, o crédito de Aula é devolvido ao Plano do Aluno.`,
  },
  {
    title: 'A4. AGENDAMENTO E CANCELAMENTO DE AULAS',
    body: `A4.1 O Aluno pode agendar Aulas individualmente ou em lote (múltiplas datas de uma vez) a partir do Plano adquirido, sujeito à disponibilidade informada pelo Instrutor.
A4.2 Solicitações de agendamento ficam em status "pendente" até aceite ou recusa pelo Instrutor.
A4.3 O Aluno pode cancelar uma Aula pendente (ainda não aceita pelo Instrutor) sem ônus.
A4.4 Cancelamentos de Aulas já aceitas pelo Instrutor com menos de 24 horas de antecedência poderão resultar na dedução da Aula do Plano, a critério do Instrutor.
A4.5 A Abily não garante a disponibilidade de nenhum Instrutor específico nem a aceitação de nenhuma solicitação de agendamento.`,
  },
  {
    title: 'A5. VERIFICAÇÃO DE SESSÃO E CONDUTA DURANTE A AULA',
    body: `A5.1 No início de cada Aula, o Instrutor gera um Código de Sessão de 6 dígitos. O Aluno deve inserir esse código no Aplicativo para confirmar o início oficial da Aula.
A5.2 O Aluno não deve inserir o Código de Sessão antes de estar fisicamente presente no local combinado e em condições de realizar a Aula.
A5.3 O Aluno não deve dirigir sob influência de álcool, drogas ou qualquer substância que comprometa seu discernimento ou habilidades motoras.
A5.4 O Aluno deve portar todos os documentos legalmente exigidos para conduzir um veículo no Brasil (Permissão para Dirigir ou CNH conforme a fase do processo de habilitação).
A5.5 O Aluno reconhece que assume integralmente os riscos inerentes à prática de direção veicular e que a Abily não possui qualquer controle sobre o veículo ou a condução durante as Aulas.
A5.6 O Aluno é responsável por quaisquer danos, multas, infrações ou acidentes causados durante a Aula, eximindo a Abily de qualquer responsabilidade civil, criminal ou administrativa decorrente.`,
  },
  {
    title: 'A6. SEGURANÇA VIÁRIA',
    body: `A6.1 A Abily recomenda fortemente que o Aluno verifique previamente as condições do veículo a ser utilizado na Aula.
A6.2 A Abily não realiza qualquer vistoria, inspeção ou verificação dos veículos utilizados pelos Instrutores.
A6.3 Em caso de desconforto, sensação de insegurança ou comportamento inadequado do Instrutor durante a Aula, o Aluno deve solicitar a interrupção imediata da Sessão e reportar o ocorrido pelo canal de suporte do Aplicativo.
A6.4 A Abily não se responsabiliza por acidentes, avarias, multas ou quaisquer eventos adversos ocorridos durante ou em decorrência das Aulas.`,
  },
  {
    title: 'A7. COMUNICAÇÃO COM INSTRUTORES',
    body: `A7.1 A comunicação entre Aluno e Instrutor deve ocorrer preferencialmente pelo chat integrado ao Aplicativo.
A7.2 É vedado ao Aluno utilizar o chat para assediar, ofender, ameaçar ou realizar propostas comerciais fora da Plataforma com o objetivo de burlar as regras e comissões da Abily.
A7.3 A Abily pode monitorar conversas no chat para fins de segurança, moderação e resolução de conflitos, nos termos da Política de Privacidade.`,
  },
];

// ─────────────────────────────────────────────
// TERMOS ESPECÍFICOS — INSTRUTOR
// ─────────────────────────────────────────────
const INSTRUCTOR_SPECIFIC_SECTIONS = [
  {
    title: 'I1. NATUREZA DO VÍNCULO',
    body: `I1.1 O Instrutor é um prestador de serviços autônomo e independente. Não existe entre o Instrutor e a Abily qualquer relação de emprego, subordinação, sociedade, parceria, representação ou franquia.
I1.2 O Instrutor é livre para definir sua disponibilidade, preços, localização de atendimento e número máximo de Alunos, dentro dos parâmetros técnicos da Plataforma.
I1.3 O Instrutor não pode se apresentar a terceiros como empregado, representante legal ou sócio da Abily.
I1.4 O Instrutor é o único responsável pelo pagamento de seus tributos (ISS, IR, contribuições previdenciárias etc.), seguros e demais obrigações legais decorrentes da sua atividade profissional.`,
  },
  {
    title: 'I2. HABILITAÇÃO E REGULARIDADE PROFISSIONAL',
    body: `I2.1 Para se cadastrar como Instrutor, o profissional deve possuir e manter válidos todos os documentos, licenças e certificações exigidos pela legislação brasileira para o exercício da atividade de instrutor de trânsito, incluindo mas não se limitando ao registro no DETRAN competente e à CNH definitiva na categoria correspondente às aulas oferecidas.
I2.2 O Instrutor declara, sob as penas da lei, que as informações de qualificação fornecidas no cadastro são verdadeiras e atualizadas.
I2.3 A Abily não verifica a autenticidade dos documentos fornecidos e não se responsabiliza por quaisquer consequências decorrentes de irregularidades na situação profissional do Instrutor.
I2.4 O Instrutor deve comunicar imediatamente a Abily caso qualquer de suas licenças seja suspensa, cassada ou expire, abstendo-se de ministrar aulas enquanto em situação irregular.
I2.5 A Abily reserva-se o direito de suspender ou excluir o cadastro de Instrutor que apresente irregularidades documentais comprovadas, sem dever de indenização.`,
  },
  {
    title: 'I3. VEÍCULO',
    body: `I3.1 O Instrutor é o único responsável pela manutenção, segurança, regularidade documental (CRLV, licenciamento, vistoria) e cobertura de seguro de seu veículo.
I3.2 O Instrutor declara que o veículo utilizado nas Aulas possui, no mínimo, seguro obrigatório DPVAT/SPVAT vigente e recomenda-se fortemente a contratação de seguro contra terceiros.
I3.3 A Abily não realiza qualquer inspeção dos veículos dos Instrutores e não se responsabiliza por danos decorrentes de avarias, falhas mecânicas ou inadequação do veículo.
I3.4 O veículo utilizado deve possuir todos os equipamentos de segurança exigidos pelo Código de Trânsito Brasileiro (CTB), incluindo pedaleira dupla de freio para veículos de instrução.
I3.5 Acidentes, multas, infrações de trânsito e quaisquer danos causados pelo veículo do Instrutor são de responsabilidade exclusiva deste, não podendo ser atribuídos à Abily.`,
  },
  {
    title: 'I4. PRECIFICAÇÃO E COMISSÃO',
    body: `I4.1 O Instrutor define livremente o valor por hora de suas aulas dentro do intervalo permitido pela Plataforma (R$ 40,00 a R$ 180,00 por hora, podendo ser alterado pela Abily mediante aviso prévio de 7 dias).
I4.2 A Abily retém uma comissão sobre cada Aula concluída, conforme a tabela vigente disponível na tela de Perfil do Instrutor no Aplicativo:
   • até R$ 60/h → 20% de comissão
   • R$ 61–R$ 80/h → 15% de comissão
   • R$ 81–R$ 100/h → 12% de comissão
   • acima de R$ 100/h → 10% de comissão
I4.3 Os percentuais de comissão são válidos para o Período MVP de ${TERMS_VALIDITY_DAYS} dias e poderão ser revisados ao término deste, com comunicação prévia de 7 dias.
I4.4 O repasse dos valores líquidos ao Instrutor seguirá o cronograma de pagamentos definido pela Abily e informado no Aplicativo.
I4.5 A Abily não garante nenhum volume mínimo de Aulas, faturamento ou renda ao Instrutor.`,
  },
  {
    title: 'I5. DISPONIBILIDADE E GESTÃO DE AGENDA',
    body: `I5.1 O Instrutor é responsável por manter sua grade de disponibilidade atualizada na Plataforma.
I5.2 Ao aceitar uma solicitação de agendamento de um Aluno, o Instrutor assume o compromisso de comparecer ao local e horário combinados.
I5.3 Cancelamentos frequentes de Aulas aceitas poderão resultar em penalidades, rebaixamento de visibilidade no mapa ou suspensão da conta, a critério da Abily.
I5.4 O Instrutor deve gerar o Código de Sessão apenas quando estiver fisicamente no local combinado e pronto para iniciar a Aula.
I5.5 Sessões não iniciadas dentro de um limite de tempo razoável após o horário marcado poderão ser automaticamente marcadas como "perdidas" pelo sistema, o que poderá impactar a reputação do Instrutor.`,
  },
  {
    title: 'I6. CONDUTA DURANTE AS AULAS',
    body: `I6.1 O Instrutor é o único responsável pela segurança do Aluno e de terceiros durante a realização das Aulas, devendo observar rigorosamente todas as normas do CTB e as melhores práticas de instrução de trânsito.
I6.2 É vedado ao Instrutor:
   a) ministrar aulas sob influência de álcool, drogas ou qualquer substância psicoativa;
   b) realizar manobras que coloquem em risco a integridade física do Aluno ou de terceiros;
   c) exigir valores adicionais do Aluno além do acordado na Plataforma;
   d) subcontratar outro profissional para realizar Aulas sem conhecimento prévio do Aluno;
   e) assediar, discriminar ou constranger o Aluno.
I6.3 O Instrutor reconhece que a Abily não possui qualquer controle sobre as Aulas e que eventuais acidentes, multas ou danos são de responsabilidade exclusiva do Instrutor.`,
  },
  {
    title: 'I7. PLANOS OFERECIDOS AOS ALUNOS',
    body: `I7.1 O Instrutor pode criar e disponibilizar Planos de pacote de Aulas no Aplicativo, definindo nome, número de aulas, valor total e validade.
I7.2 Ao disponibilizar um Plano, o Instrutor se compromete a honrar as condições oferecidas para todos os Alunos que adquirirem o Plano enquanto estiver ativo.
I7.3 O Instrutor pode pausar a venda de novos Planos a qualquer momento, mas deve cumprir os Planos já adquiridos pelos Alunos.
I7.4 A Abily pode remover Planos que violem políticas da Plataforma ou contenham informações enganosas.`,
  },
  {
    title: 'I8. RESPONSABILIDADE POR REEMBOLSOS',
    body: `I8.1 Reembolsos concedidos dentro da Política de 7 dias (sem aulas iniciadas) serão estornados integralmente ao Aluno. O valor já repassado ao Instrutor referente a esse Plano, se houver, será descontado nos próximos repasses.
I8.2 Reembolsos decorrentes de falha exclusivamente comprovada do Instrutor (não comparecimento, comportamento inadequado) poderão ser debitados integralmente da conta do Instrutor.
I8.3 O Instrutor concorda que a Abily tem o direito de reter repasses para cobrir reembolsos devidos.`,
  },
  {
    title: 'I9. COMUNICAÇÃO COM ALUNOS',
    body: `I9.1 A comunicação com Alunos deve ocorrer preferencialmente pelo chat integrado ao Aplicativo.
I9.2 É vedado ao Instrutor solicitar ou aceitar pagamentos fora da Plataforma por serviços oferecidos nela, com o objetivo de burlar a comissão da Abily.
I9.3 A violação do item I9.2 poderá resultar em suspensão permanente da conta do Instrutor e cobrança retroativa das comissões devidas.`,
  },
];

// ─────────────────────────────────────────────
// EXPORTAÇÕES
// ─────────────────────────────────────────────

/** Estrutura completa dos termos para ALUNO */
export const STUDENT_TERMS = {
  role: 'student',
  title: 'Termos de Uso — Aluno',
  version: TERMS_VERSION,
  validityDays: TERMS_VALIDITY_DAYS,
  intro: GENERAL_INTRO,
  sections: [
    ...GENERAL_SECTIONS,
    ...STUDENT_SPECIFIC_SECTIONS,
  ],
};

/** Estrutura completa dos termos para INSTRUTOR */
export const INSTRUCTOR_TERMS = {
  role: 'instructor',
  title: 'Termos de Uso — Instrutor',
  version: TERMS_VERSION,
  validityDays: TERMS_VALIDITY_DAYS,
  intro: GENERAL_INTRO,
  sections: [
    ...GENERAL_SECTIONS,
    ...INSTRUCTOR_SPECIFIC_SECTIONS,
  ],
};

/** Retorna os termos corretos com base no papel do usuário */
export function getTermsByRole(role) {
  return role === 'instructor' ? INSTRUCTOR_TERMS : STUDENT_TERMS;
}
