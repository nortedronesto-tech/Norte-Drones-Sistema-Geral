// Conteúdo do Guia de campo (passo a passo e tira-dúvidas). Texto próprio, em linguagem simples.
// Referências: Syngenta (preparo da calda) e Agrobula (calculadora). Regras gerais — a BULA do produto,
// o RECEITUÁRIO do agrônomo e a legislação vigente sempre mandam mais do que qualquer guia.

export const SOURCES: { label: string; href?: string }[] = [
  { label: "Syngenta — Calda para pulverização: como preparar e utilizar corretamente", href: "https://maisagro.syngenta.com.br/tudo-sobre-agro/calda-para-pulverizacao-como-preparar-e-utilizar-corretamente/" },
  { label: "Agrobula — Calculadora de calda", href: "https://www.agrobula.com.br/ferramentas/calculadora-calda" },
  { label: "Embrapa Gado de Corte — Pragas das pastagens: características, danos e manejo (Documentos 300, 2022)" },
  { label: "Agrofit (MAPA) — produtos registrados", href: "http://agrofit.agricultura.gov.br/" },
];

export const DISCLAIMER =
  "Este guia é uma ajuda de campo, não uma recomendação técnica. Produto, dose e mistura são definidos pela bula e pelo receituário de um engenheiro agrônomo. Em caso de dúvida, não aplique: pergunte ao agrônomo.";

export const EMERGENCY = "Intoxicação: Disque-Intoxicação 0800 722 6001 (Anvisa) ou SAMU 192. Leve o rótulo do produto.";

export type Step = { title: string; body: string; tip?: string };

export const STEPS: Step[] = [
  {
    title: "Antes de começar",
    body: "Tenha em mãos o receituário e a bula de cada produto, os EPIs e um local pavimentado ou protegido, longe de rio, lago, poço e nascente. Treine quem vai ajudar.",
    tip: "Quem prepara a calda não come, não bebe e não fuma durante o trabalho.",
  },
  {
    title: "Confira a água",
    body: "A água é mais de 90% da calda. Veja se está limpa (sem barro e sem sujeira), meça o pH e, se precisar, corrija com acidificante ou condicionador conforme a bula. Água muito dura (cálcio e magnésio) pode atrapalhar alguns produtos.",
    tip: "Filtre a água: sujeira entope bico e filtro do drone.",
  },
  {
    title: "Faça a conta",
    body: "Use a Calculadora: área, volume de calda por hectare e volume do tanque. Ela diz quantos tanques serão e quanto de cada produto vai em cada um. Separe e meça os produtos antes de abrir o tanque.",
  },
  {
    title: "Teste de jarra (compatibilidade)",
    body: "Num frasco transparente, com a mesma água, repita a mistura em tamanho pequeno, na mesma ordem e na mesma concentração da calda de verdade. Espere 15 a 30 minutos. Se aparecer grumo, floco, separação, calor forte ou espuma demais, não use essa combinação.",
    tip: "Calda de drone é mais concentrada: o teste precisa ser na concentração do drone.",
  },
  {
    title: "Encha 70 a 80% do tanque com água",
    body: "Coloque a maior parte da água primeiro e ligue a agitação. Se o tanque do drone não tem agitador, prepare num recipiente maior com agitação e passe para o drone por um filtro.",
  },
  {
    title: "Pré-dilua pós e granulados",
    body: "Pó molhável e granulado dispersível vão primeiro num balde limpo, com um pouco de água, até virar uma mistura uniforme. Só então vão para o tanque. Produtos líquidos normalmente não precisam dessa etapa.",
  },
  {
    title: "Adicione na ordem, devagar",
    body: "Regra geral: corretivo de água → pós e granulados pré-diluídos → suspensões (SC) → emulsões (EC) → soluções e fertilizantes foliares → adjuvantes por último. Coloque um de cada vez, devagar, sem parar a agitação. Se a bula pedir outra ordem, vale a bula.",
    tip: "A Calculadora já mostra os produtos nessa ordem.",
  },
  {
    title: "Complete a água e mantenha a agitação",
    body: "Complete o volume do tanque e mantenha a agitação até a aplicação, para a mistura não decantar.",
  },
  {
    title: "Aplique logo",
    body: "Não deixe a calda parada por muito tempo: alguns produtos degradam ou separam. Se precisar esperar, agite bem antes de usar e siga o que a bula diz.",
  },
  {
    title: "Limpe tudo no fim",
    body: "Lave tanque, mangueiras, filtros e bicos com água e detergente indicado. Dê o destino correto à água da lavagem (nunca em rio, lago ou esgoto). Faça a tríplice lavagem das embalagens, inutilize e devolva onde a nota fiscal indicar.",
  },
  {
    title: "Registre a aplicação",
    body: "Anote data, hora, área, produtos e doses, volume, clima (temperatura, umidade, vento), operador e drone. É o histórico que protege você e o produtor.",
  },
];

export type Faq = { cat: string; q: string; a: string; tags?: string };

export const FAQ: Faq[] = [
  // ------------------------------------------------------------------ preparo
  { cat: "Preparo da calda", q: "Qual a ordem para colocar os produtos na calda?", a: "Regra geral: corretivo de água, depois pós e granulados já pré-diluídos, depois suspensões (SC), emulsões (EC), soluções e fertilizantes foliares, e por último os adjuvantes. Sempre devagar e com a agitação ligada. A bula do produto tem a palavra final; se ela pedir outra ordem, siga a bula.", tags: "ordem mistura sequencia adjuvante" },
  { cat: "Preparo da calda", q: "Preciso pré-diluir os produtos?", a: "Pós e granulados (WP, WG, SP, SG) sim: misture num balde limpo com um pouco de água até ficar uniforme e só depois vá ao tanque. Líquidos como EC, SC e SL normalmente não precisam.", tags: "pre diluir balde po granulado" },
  { cat: "Preparo da calda", q: "Quanta água coloco no tanque antes dos produtos?", a: "Comece com 70 a 80% da água do tanque, com a agitação ligada, e complete o volume no fim.", tags: "agua tanque 70 80" },
  { cat: "Preparo da calda", q: "Por que a agitação não pode parar?", a: "Sem agitação os produtos decantam no fundo: a calda fica fraca no começo e forte no fim, e pode entupir bico e filtro. Mantenha a agitação do preparo até o fim da aplicação.", tags: "agitacao decanta sedimenta" },
  { cat: "Preparo da calda", q: "Como faço o teste de jarra (compatibilidade)?", a: "Use um frasco transparente de 500 mL a 1 L com a água da própria calda. Coloque os produtos em tamanho reduzido, na mesma ordem e na mesma concentração da calda real. Agite, espere 15 a 30 minutos e observe: grumos, flocos, separação em camadas, calor forte ou espuma demais significam incompatibilidade. Nesse caso não faça essa mistura.", tags: "jarra compatibilidade teste jar test" },
  { cat: "Preparo da calda", q: "Posso misturar qualquer produto com qualquer outro?", a: "Não. Só misture o que a bula permite ou o agrônomo recomendou, e sempre depois do teste de jarra. A mistura em tanque é responsabilidade técnica.", tags: "mistura compativel incompativel" },
  { cat: "Preparo da calda", q: "Quanto tempo a calda pode ficar parada?", a: "O menos possível. Alguns produtos degradam ou separam com o tempo. Se precisar esperar, agite bem antes de usar e siga o que o rótulo diz sobre estabilidade da calda.", tags: "tempo parada validade calda" },
  { cat: "Preparo da calda", q: "Como calculo a quantidade por tanque?", a: "Hectares por tanque = volume do tanque ÷ volume de calda por hectare. Produto por tanque = dose por hectare × hectares por tanque. Exemplo: tanque de 40 L e 10 L/ha cobre 4 ha; dose de 0,5 L/ha vira 2 L por tanque. A Calculadora faz isso para todos os produtos e também para o último tanque, que costuma ser parcial.", tags: "calculo tanque dose hectare" },
  // ------------------------------------------------------------------ água
  { cat: "Água", q: "Qual o pH ideal da água da calda?", a: "Muitos produtos trabalham melhor com água levemente ácida (algo em torno de pH 5 a 7), e alguns degradam em água alcalina. Meça com fita ou medidor e confira na bula do produto o que ele aceita.", tags: "ph acidez alcalina" },
  { cat: "Água", q: "Água dura, barrenta ou suja atrapalha?", a: "Sim. Água com muito cálcio e magnésio (dura) reduz a eficiência de alguns produtos, e água com barro ou partículas entope bico e filtro e pode reagir com a calda. Filtre ou deixe decantar, e use condicionador se a bula indicar.", tags: "agua dura barro suja filtro" },
  { cat: "Água", q: "Posso pegar água de rio, açude ou poço?", a: "Pode, se for limpa e analisada. Nunca deixe a mangueira do tanque dentro do rio ou açude sem proteção contra retorno: a calda pode voltar e contaminar a fonte. Prefira encher por uma caixa intermediária ou use válvula de retenção.", tags: "rio acude poco captacao retorno" },
  // ------------------------------------------------------------------ drone
  { cat: "Drone", q: "Qual volume de calda usar no drone?", a: "O drone trabalha com volume baixo, em geral na faixa de 8 a 20 L/ha. O valor certo para cada produto e cultura é o da bula e do receituário. Informe esse volume na Calculadora.", tags: "volume calda drone litros hectare taxa" },
  { cat: "Drone", q: "A calda de drone é mais concentrada: o que muda?", a: "Com pouca água, os produtos ficam mais concentrados: sobe o risco de incompatibilidade, de espuma e de entupimento. Faça o teste de jarra na concentração real do drone, use antiespumante só se a bula permitir e mantenha filtros limpos.", tags: "concentrada espuma entupimento drone" },
  { cat: "Drone", q: "O tanque do drone não tem agitação. Como faço?", a: "Em geral prepare a calda num recipiente maior, com agitação, e passe para o drone por um filtro, aplicando logo em seguida. Evite deixar a calda parada no tanque do drone entre uma bateria e outra.", tags: "agitador tanque drone misturar" },
  { cat: "Drone", q: "Como evitar entupimento de bico e filtro?", a: "Use água limpa e filtrada, pré-dilua pós e granulados, não use calda velha ou decantada, e limpe filtros e bicos no fim de cada dia. Calda com grumos é sinal para parar e rever a mistura.", tags: "entupimento bico filtro limpar" },
  { cat: "Drone", q: "Altura de voo, velocidade e tamanho de gota: como ajustar?", a: "Siga o recomendado pelo fabricante do drone e pela bula. Gota mais fina cobre melhor, mas deriva mais; gota mais grossa deriva menos. Um papel hidrossensível mostra como a calda está caindo. Ajuste devagar e anote o que funcionou.", tags: "altura velocidade gota deriva papel hidrossensivel" },
  // ------------------------------------------------------------------ clima
  { cat: "Clima e deriva", q: "Quais condições de tempo são boas para aplicar?", a: "Como referência geral: vento fraco a moderado (cerca de 3 a 10 km/h), temperatura abaixo de uns 30 °C e umidade relativa acima de uns 55 a 60%. Evite calmaria total com ar quente subindo ou inversão térmica, e evite aplicar com previsão de chuva logo depois. A bula e a orientação do agrônomo valem mais que essa referência.", tags: "clima vento temperatura umidade chuva horario" },
  { cat: "Clima e deriva", q: "Posso aplicar com vento forte?", a: "Não. O vento leva a calda para fora do alvo (deriva) e pode atingir cultura vizinha, moradias, água e abelhas. Se o vento passou do limite, pare e espere.", tags: "vento deriva forte" },
  { cat: "Clima e deriva", q: "Quanto tempo sem chuva depois da aplicação?", a: "Depende do produto: a bula informa o período necessário para a calda secar e ser absorvida. Confira a previsão antes de aplicar.", tags: "chuva lavagem absorcao" },
  // ------------------------------------------------------------------ segurança
  { cat: "Segurança", q: "Quais EPIs devo usar no preparo?", a: "O que o rótulo indicar. Em geral: luvas resistentes ao produto, óculos ou viseira, máscara com filtro adequado, avental ou macacão impermeável e botas. Troque o EPI danificado e lave após o uso.", tags: "epi luva mascara oculos bota avental" },
  { cat: "Segurança", q: "O que fazer em caso de contato ou intoxicação?", a: "Tire a roupa contaminada e lave a pele com muita água e sabão. Se for nos olhos, lave com água corrente por cerca de 15 minutos. Procure atendimento médico levando o rótulo. Telefones: Disque-Intoxicação 0800 722 6001 (Anvisa) e SAMU 192. Não provoque vômito a menos que o rótulo mande.", tags: "intoxicacao emergencia primeiros socorros" },
  { cat: "Segurança", q: "Posso comer, beber ou fumar durante o preparo?", a: "Não. Lave bem as mãos e as áreas expostas logo depois de mexer com os produtos, antes de comer, beber ou ir ao banheiro.", tags: "comer beber fumar lavar maos" },
  // ------------------------------------------------------------------ depois
  { cat: "Depois da aplicação", q: "O que faço com a sobra de calda?", a: "O melhor é calcular direito para não sobrar. Se sobrar, nunca jogue no chão, em rio ou no esgoto. Siga o rótulo e a orientação do agrônomo: em alguns casos dá para reaplicar na área já tratada, sem passar da dose permitida.", tags: "sobra calda descarte" },
  { cat: "Depois da aplicação", q: "Como limpar o drone e o tanque?", a: "Enxágue com água e detergente indicado, passando por tanque, mangueiras, filtros e bicos. A água da lavagem tem destino correto (não vai para rio, lago ou esgoto). Deixe o equipamento limpo para a próxima calda não reagir com resíduo da anterior.", tags: "lavar limpar drone tanque" },
  { cat: "Depois da aplicação", q: "O que fazer com as embalagens vazias?", a: "Faça a tríplice lavagem das embalagens que podem ser lavadas, inutilize (fure o fundo) e devolva no local indicado na nota fiscal, como a central de recebimento da região. Embalagem não lavada tem outro destino: veja o rótulo.", tags: "embalagem triplice lavagem devolucao inpev" },
  { cat: "Depois da aplicação", q: "O que são intervalo de segurança, carência e reentrada?", a: "Carência é o tempo mínimo entre a última aplicação e a colheita. Intervalo de reentrada é o tempo antes de pessoas voltarem à área tratada sem proteção. Os dois estão na bula do produto.", tags: "carencia intervalo reentrada colheita" },
  // ------------------------------------------------------------------ pragas de pastagem (Embrapa)
  { cat: "Pragas de pastagem", q: "Quando aplicar inseticida contra cigarrinha-das-pastagens?", a: "O químico é a última opção. Se for necessário, deve coincidir com o início do aparecimento dos adultos, que ficam nas folhas e vivem só 7 a 10 dias. Aplicar depois que o pasto já amarelou costuma ser em vão. Não há nível de controle oficial: a decisão depende do histórico da área e do agrônomo. Use só produto registrado para pastagem e respeite a retirada dos animais.", tags: "cigarrinha inseticida quando aplicar adultos pastagem" },
  { cat: "Pragas de pastagem", q: "Como confirmar o percevejo-castanho no pasto?", a: "Cave até 60 cm na borda da reboleira, entre o capim verde e o seco, em vários pontos, espalhando a terra numa lona escura para enxergar as ninfas brancas. Sinais: touceira que sai fácil, cheiro de “maria-fedida” e reboleiras que crescem. Não há nível de dano definido, e o controle químico é pouco viável.", tags: "percevejo castanho confirmar cavar reboleira" },
  { cat: "Pragas de pastagem", q: "Como diferenciar praga de seca no pasto?", a: "O percevejo-das-gramíneas e o castanho causam murcha e amarelecimento em reboleiras que lembram falta de água. Veja se o dano acompanha a chuva: se a mancha cresce mesmo com umidade, procure insetos na base e nas raízes. Cigarrinha deixa espuma na base e estrias esbranquiçadas nas folhas.", tags: "praga ou seca diferenciar amarelecimento reboleira" },
  { cat: "Pragas de pastagem", q: "Como evitar cigarrinha sem produto químico?", a: "Use capim resistente (Marandu resiste às típicas, mas não às de Mahanarva; BRS Ipyporã resiste às duas), ajuste altura e carga animal para reduzir a palha no solo e considere o fungo Metarhizium anisopliae, que não exige retirar o gado.", tags: "cigarrinha resistente capim manejo biologico" },
  { cat: "Pragas de pastagem", q: "Onde vejo quais produtos são registrados para pastagem?", a: "No Agrofit, do Ministério da Agricultura (agrofit.agricultura.gov.br). Só use produto registrado para a praga e a cultura, com receituário do agrônomo, e confira carência e retirada dos animais na bula.", tags: "agrofit registro produto pastagem receituario" },
  // ------------------------------------------------------------------ documentos
  { cat: "Documentos e regras", q: "Preciso de receituário agronômico?", a: "Sim. Agrotóxico só é vendido e aplicado com receituário de engenheiro agrônomo habilitado. É ele que define produto, dose e mistura. Guarde a cópia junto do registro da aplicação.", tags: "receituario agronomo obrigatorio" },
  { cat: "Documentos e regras", q: "Posso aplicar perto de casas, rios e criações?", a: "Respeite as distâncias mínimas de moradias, povoados, criações, mananciais e culturas sensíveis definidas pela legislação do Ministério da Agricultura e pelo rótulo do produto. Confirme as regras vigentes para aplicação com drone antes de voar perto desses pontos.", tags: "distancia casas rios criacao abelhas legislacao mapa" },
  { cat: "Documentos e regras", q: "O que devo anotar a cada aplicação?", a: "Data e hora, local e área, produtos, doses e lotes, volume de calda, clima (temperatura, umidade e vento), operador, drone e observações. Esse registro é sua prova de que fez do jeito certo.", tags: "registro anotar caderno historico" },
];

export const FAQ_CATEGORIES = [...new Set(FAQ.map((f) => f.cat))];

// Seções do guia de campo (uma página por seção em /gestao/campo/[secao]).
export type Secao = "pulverizacao" | "foliar" | "solidos" | "pragas" | "passo-a-passo" | "duvidas";

export const SECOES: { id: Secao; label: string }[] = [
  { id: "pulverizacao", label: "Pulverização" },
  { id: "foliar", label: "Foliar" },
  { id: "solidos", label: "Sólidos" },
  { id: "pragas", label: "Pragas de pastagem" },
  { id: "passo-a-passo", label: "Passo a passo" },
  { id: "duvidas", label: "Tira-dúvidas" },
];
