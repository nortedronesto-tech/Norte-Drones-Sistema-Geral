// Pragas de pastagem — resumo em linguagem própria do documento da Embrapa Gado de Corte:
// TORRES, F. Z. V. Pragas das pastagens: características, danos e manejo. Campo Grande: Embrapa Gado de Corte, 2022
// (Documentos 300). Só entra aqui o que o documento afirma. Dose e produto NÃO são sugeridos: vêm do receituário
// do agrônomo e do registro no Agrofit (produto registrado para pastagem, com carência e retirada dos animais).

export type Praga = {
  id: string;
  nome: string;
  cientifico: string;
  grupo: "Sugadoras da parte aérea" | "Subterrâneas" | "Lagartas" | "Outras";
  resumo: string;
  procurar: string[]; // como identificar no campo
  danos: string;
  conferir: string; // como confirmar / monitorar
  manejo: string[];
  atencao?: string;
  tags: string;
};

export const PRAGAS: Praga[] = [
  {
    id: "cigarrinhas", nome: "Cigarrinhas-das-pastagens", cientifico: "Deois, Notozulia, Mahanarva e outras", grupo: "Sugadoras da parte aérea",
    resumo: "A principal praga das pastagens: reduz capim, capacidade de suporte e produção de carne e leite. Só aparece na época das chuvas.",
    procurar: [
      "Espuma branca na base do capim e nas raízes superficiais: dentro dela ficam as ninfas.",
      "Adultos saltando nas folhas (vivem 7 a 10 dias), de cor muito variável conforme a espécie.",
      "Estrias esbranquiçadas nas folhas (adultos) e amarelecimento da base (ninfas).",
      "Na seca ficam só os ovos, que esperam a chuva para eclodir.",
    ],
    danos: "Sugam a seiva e injetam saliva tóxica. O pasto amarela, seca e parece queimado (“queima das pastagens”). Os danos aparecem por inteiro cerca de 3 semanas depois que os adultos surgem. Em um estudo citado no documento, 25 adultos por m² reduziram a matéria seca em cerca de 35%. As espécies de Mahanarva atacam também capins de menor porte, como o Marandu, e causam dano tanto como ninfa quanto como adulto.",
    conferir: "Vistorie no início das chuvas, afastando a palhada na base: ninfas na espuma e fêmeas perto das raízes. O documento cita, como referência de estudo, cerca de 5 ninfas por 0,25 m² ou 10 adultos por 35 redadas de rede de varredura no começo da estação chuvosa. Não existe nível de controle oficial: a decisão depende do histórico da área.",
    manejo: [
      "Capim resistente é o método mais recomendado e mais barato. Marandu resiste às cigarrinhas típicas de pasto, mas não às de Mahanarva; o BRS Ipyporã resiste a ambas. Há outras opções (Piatã, vários Panicum, andropogon, Paspalum Pojuca).",
      "Manejo do pasto: ajuste da altura e da carga animal. Menos palha no solo significa menos umidade e menos cigarrinha; o pisoteio ajuda.",
      "Controle biológico com fungo Metarhizium anisopliae: não exige tirar o animal e poupa inimigos naturais.",
      "Químico é a última opção. Para valer, a aplicação deve coincidir com o início do aparecimento dos adultos, quando estão nas folhas; pulverizar depois dos danos visíveis costuma ser em vão, porque os adultos já morreram e os ovos não são atingidos.",
    ],
    atencao: "Use só produto registrado para pastagem (consulte o Agrofit) e respeite a retirada dos animais indicada na bula.",
    tags: "cigarrinha espuma queima pasto mahanarva deois notozulia marandu ipypora metarhizium",
  },
  {
    id: "percevejo-castanho", nome: "Percevejo-castanho", cientifico: "Scaptocoris", grupo: "Subterrâneas",
    resumo: "Praga do solo, agressiva e de difícil controle; em alguns locais pode ser pior que a cigarrinha. Mais visível em solo arenoso.",
    procurar: [
      "Reboleiras (manchas) de capim murcho, amarelo e seco, que podem se juntar e deixar o solo descoberto ou tomado por daninhas.",
      "A touceira sai fácil do chão, às vezes com ninfas e adultos presos nas raízes.",
      "Cheiro forte parecido com o de “maria-fedida”, mais sentido em época de revoada.",
      "Revoadas de novembro a março, no fim da tarde ou depois de chuva.",
    ],
    danos: "Ninfas e adultos sugam a seiva das raízes. Com pouca população o capim só cresce menos; com muita, morre em touceiras. Costuma haver dano grande quando o ataque é percebido.",
    conferir: "Cave na borda da reboleira, entre o capim verde e o seco, até 60 cm, em vários pontos. Espalhe a terra numa lona escura para ver as ninfas brancas. O documento informa que não há nível de dano econômico estabelecido.",
    manejo: [
      "Controle químico é pouco viável: o inseto fica fundo no solo e os sistêmicos sobem para a parte aérea, deixando as raízes sem proteção.",
      "Fungos biológicos tiveram baixa eficiência em campo, com alguns isolados promissores.",
      "Solo corrigido e adubado, com capim vigoroso, suporta melhor o ataque.",
      "Integração lavoura-pecuária(-floresta) ajuda na recuperação; em infestação severa, 1 a 2 anos de lavoura com medidas preventivas reduzem a população.",
    ],
    atencao: "Ainda não há informação sobre capins resistentes. Procure o agrônomo antes de gastar com produto.",
    tags: "percevejo castanho scaptocoris reboleira raiz solo arenoso revoada",
  },
  {
    id: "lagartas", nome: "Lagartas (curuquerê e lagarta-militar)", cientifico: "Mocis latipes e Spodoptera frugiperda", grupo: "Lagartas",
    resumo: "Pragas ocasionais, mas podem destruir o capim rápido se ninguém perceber. Pesam mais em pasto em formação.",
    procurar: [
      "Lagartas nas folhas, bainhas, colmos, no solo e na palha.",
      "O curuquerê anda “medindo palmos” (só dois pares de pernas atrás).",
      "Folhas raspadas ou comidas e pasto falhado.",
    ],
    danos: "Consomem a folha e podem acabar com o capim atacado em pouco tempo se não houver ação.",
    conferir: "Vistorie com frequência, mais ainda depois de corte, pastejo ou adubação nitrogenada, que podem aumentar a população (principalmente da lagarta-militar), e em pasto recém-formado.",
    manejo: [
      "Produtos biológicos à base de Bacillus thuringiensis são bastante indicados em pastagem.",
      "Químico só com produto registrado para pastagem, respeitando carência e reentrada do gado; muitas vezes é caro e pesado para grandes áreas.",
    ],
    tags: "lagarta curuquere militar spodoptera mocis bacillus thuringiensis",
  },
  {
    id: "cochonilhas", nome: "Cochonilhas", cientifico: "cochonilha-dos-capins e Duplachionaspis divergens", grupo: "Sugadoras da parte aérea",
    resumo: "Sugam a seiva e enfraquecem o capim. A cochonilha-dos-capins é antiga; a D. divergens foi confirmada recentemente em pastagem.",
    procurar: [
      "Folhas amareladas e murchas, perda da capacidade de rebrota.",
      "Insetos fixos na planta (cochonilhas) — confirme com o agrônomo.",
    ],
    danos: "Sem controle, em 2 a 4 anos podem causar a “geada dos pastos”: pasto seco e improdutivo. O dano é pior com falta d’água, solo pobre e pastejo intenso.",
    conferir: "Observe a base e as bainhas das plantas amareladas, principalmente na seca.",
    manejo: [
      "Para a D. divergens ainda não há controle estabelecido (químico, biológico ou cultural).",
      "Um estudo inicial mostrou menos infestação com capim mais baixo: 12,5% a 15 cm, 36,9% a 25 cm e 47,4% a 35 cm. Pasto com sobra favorece a praga.",
    ],
    tags: "cochonilha geada dos pastos duplachionaspis capim",
  },
  {
    id: "percevejo-gramineas", nome: "Percevejo-das-gramíneas", cientifico: "Blissus", grupo: "Sugadoras da parte aérea",
    resumo: "Praga ocasional que sai em reboleiras e é fácil de confundir com seca.",
    procurar: [
      "Capim murcho e amarelado em manchas, com o centro seco que dificilmente se recupera.",
      "Sintomas parecidos com estresse hídrico.",
    ],
    danos: "Ninfas e adultos sugam a seiva. O capim morre no centro da mancha ou cresce menos.",
    conferir: "Se o amarelecimento em manchas não tem relação com falta de chuva, procure os insetos na base das plantas.",
    manejo: ["Consulte o agrônomo e os produtos registrados no Agrofit para pastagem."],
    tags: "percevejo gramineas blissus reboleira estresse hidrico",
  },
  {
    id: "pulguinha", nome: "Pulguinha-do-arroz (pulga-saltona)", cientifico: "Chaetocnema", grupo: "Outras",
    resumo: "Praga nova nas gramíneas forrageiras. É um besourinho preto de até 2 mm que salta e fica sob as bainhas das folhas.",
    procurar: ["Besourinhos pretos, lisos e brilhantes, de até 2 mm, que pulam.", "Larvas brancas e finas no solo, na base das plantas."],
    danos: "Ataca a planta por baixo da bainha, o que dificulta ver e controlar.",
    conferir: "Abra as bainhas das folhas e observe a base das plantas.",
    manejo: [
      "O controle é difícil. A rotação de culturas ajuda a baixar a população.",
      "Há inseticidas registrados para pastagem. O fungo Beauveria bassiana chegou a cerca de 80% de eficiência 7 dias após a aplicação em estudo citado.",
      "O mais recomendado é usar plantas resistentes, algo ainda em estudo no Brasil.",
    ],
    tags: "pulguinha arroz pulga saltona chaetocnema besouro bainha",
  },
  {
    id: "formigas", nome: "Formigas cortadeiras", cientifico: "Atta e Acromyrmex", grupo: "Outras",
    resumo: "Dano localizado, mas pode exigir controle em alta população. Ninhos subterrâneos dificultam achar e tratar.",
    procurar: ["Carreiros e olheiros (buracos) de saúva.", "Capim cortado ao redor do formigueiro."],
    danos: "Cortam o capim para cultivar o fungo de que se alimentam. A saúva-mata-pasto (A. bisphaerica) e a saúva-parda (A. capiguara) são as mais ligadas a pastagem.",
    conferir: "Localize os formigueiros e acompanhe a atividade nos carreiros.",
    manejo: ["Use produtos registrados e orientação do agrônomo; o documento trata o tema de forma geral."],
    tags: "formiga saúva cortadeira quenquem formigueiro",
  },
];

export const AGROFIT = { label: "Agrofit (MAPA): consulte produtos registrados para pastagem", href: "http://agrofit.agricultura.gov.br/" };
export const PRAGAS_FONTE = "Resumo de: Torres, F. Z. V. Pragas das pastagens: características, danos e manejo. Embrapa Gado de Corte, Documentos 300, 2022.";
export const PRAGA_GRUPOS = [...new Set(PRAGAS.map((p) => p.grupo))];
