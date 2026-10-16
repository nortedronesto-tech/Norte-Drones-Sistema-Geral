// Conteúdo textual estático do site institucional.
// Baseado exclusivamente no Manual de Identidade Visual da Norte Drones e no
// posicionamento documentado nos materiais do projeto. Onde a informação não
// está confirmada nos materiais, o campo é marcado como [A DEFINIR] — não
// invente números, clientes, certificações ou capacidade operacional aqui.

export const brand = {
  name: "Norte Drones",
  tagline: "Tecnologia aplicada ao campo.",
  essence:
    "Posicionamento: tecnologia aplicada ao campo, precisão, produtividade e inovação.",
};

export const services = [
  {
    slug: "aplicacao-defensivos",
    name: "Aplicação de defensivos agrícolas",
    description:
      "Pulverização de defensivos líquidos com drone agrícola, com controle de dose e cobertura sobre a área.",
    benefit:
      "Mais uniformidade na aplicação, com potencial de reduzir deriva e desperdício de insumo frente a métodos convencionais.",
    icon: "spray",
  },
  {
    slug: "distribuicao-solidos",
    name: "Distribuição de sólidos (adubos e afins)",
    description:
      "Distribuição a lanço de adubos e outros insumos sólidos com drone agrícola.",
    benefit:
      "Agilidade para cobrir a área no momento certo, com menos dependência de trator em solo encharcado ou de difícil acesso.",
    icon: "solids",
  },
  {
    slug: "adubacao-foliar",
    name: "Aplicação de adubo foliar",
    description:
      "Pulverização de adubo foliar com drone, aplicado diretamente sobre a parte aérea da planta.",
    benefit:
      "Cobertura uniforme na fase de desenvolvimento da lavoura, com a mesma precisão da aplicação de defensivos.",
    icon: "leaf",
  },
];

// Espaço reservado para futuros serviços (ex.: mapeamento aéreo, monitoramento).
// Adicione novos itens aqui somente com informação confirmada pelo cliente.
export const additionalServicesPlaceholder = true;

export const whyUs = [
  {
    title: "Foco técnico",
    description:
      "Equipamento e processo pensados para dose e cobertura precisas em cada aplicação, do planejamento à execução.",
  },
  {
    title: "Agilidade",
    description:
      "O drone chega a áreas e aproveita janelas de aplicação onde trator ou avião tripulado têm mais dificuldade de operar.",
  },
  {
    title: "Presença no campo",
    description:
      "Acompanhamento da operação do início ao fim — a equipe está presente na aplicação, não só no orçamento.",
  },
  {
    title: "Raiz regional",
    description:
      "Atuação local, próxima do produtor rural do Tocantins — conhecemos a região e quem produz nela.",
  },
];

export const howItWorks = [
  {
    step: "01",
    title: "Contato",
    description:
      "Você fala com a Norte Drones pelo WhatsApp e conta a necessidade da sua lavoura.",
  },
  {
    step: "02",
    title: "Avaliação da área",
    description:
      "Levantamento das informações da área para dimensionar a aplicação.",
  },
  {
    step: "03",
    title: "Planejamento",
    description:
      "Definição do plano de voo, dose e janela de aplicação mais adequados.",
  },
  {
    step: "04",
    title: "Aplicação",
    description:
      "Execução da pulverização com o drone, com acompanhamento técnico em campo.",
  },
  {
    step: "05",
    title: "Acompanhamento",
    description:
      "Retorno sobre a aplicação realizada e alinhamento dos próximos passos com o produtor.",
  },
];

export const areaServed = {
  headline: "Porto Nacional, Palmas e região do Tocantins",
  note:
    "[A CONFIRMAR] Área de atuação identificada nos materiais do projeto — confirme antes da publicação se este é o raio de atendimento atual da Norte Drones.",
};
