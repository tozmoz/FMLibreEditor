// The Brazilian Portuguese text of the UI: the same shape as `en.ts` (a missing or extra key fails the build). The
// comments in `en.ts` say what each string is for.
//
// The football words are the ones a Brazilian player says (goleiro, zagueiro, time, torcedores), chosen from the
// words of FM's Brazilian community and not yet matched against the game's own list: `languages.fmf` only holds the
// European Portuguese, so someone with the game open should check attributes, positions, jobs and squad statuses.

import type {
  CheckKey,
  Concern,
  EditEntity,
  Entity,
  ExportEntity,
  ExportFormat,
  GraphicsCounts,
  MassOperationKind,
  MassPreview,
  OpportunityKind,
  PlayerSort,
  SessionChoice,
  SquadSort,
  StaffSort,
  Storefront,
} from "../types";
import { fieldName } from "./fieldNames";
import { reasonText } from "./reasons";
import type { ErrorTexts, Strings } from "./en";
import { REASONS_PT_BR } from "./reasons/pt-BR";

const numbers = new Intl.NumberFormat("pt-BR");
const percents = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** A count or an amount with the thousands separators of the language: "12.345". */
const format = (value: number) => numbers.format(value);

/** "Nenhuma alteração", "1 alteração", "3 alterações", "12.345 alterações". */
const changeCount = (count: number) =>
  count === 0 ? "Nenhuma alteração" : count === 1 ? "1 alteração" : `${format(count)} alterações`;

/** "1 jogador", "12 jogadores". */
const playerCount = (count: number) => (count === 1 ? "1 jogador" : `${format(count)} jogadores`);

/** "1 valor mantido", "12 valores mantidos". */
const valuesLeftAlone = (count: number) =>
  count === 1 ? "1 valor mantido" : `${format(count)} valores mantidos`;

/** "237 jogadores", "1 jogador", "237 funcionários", "1 funcionário", "12 clubes", "1 clube". */
const entityCount: Record<Entity, (count: number) => string> = {
  player: (count) => (count === 1 ? "1 jogador" : `${format(count)} jogadores`),
  staff: (count) => (count === 1 ? "1 funcionário" : `${format(count)} funcionários`),
  club: (count) => (count === 1 ? "1 clube" : `${format(count)} clubes`),
};

/** What each list holds, in the plural. */
const entityNouns: Record<Entity, string> = { player: "jogadores", staff: "funcionários", club: "clubes" };

/**
 * Squad statuses, by the codes contracts hold them as; named as the game's contract screen names them. 15, 16,
 * 17, 20 and 21 are goalkeepers' (21 is the game's "Emergency Backup" too).
 */
const SQUAD_STATUSES: Partial<Record<number, string>> = {
  1: "Craque do time",
  2: "Jogador importante",
  3: "Titular absoluto",
  4: "Jogador do elenco",
  5: "Reserva decisivo",
  7: "Jogador de composição",
  9: "Reserva de emergência",
  10: "Promessa em ascensão",
  11: "Promessa para o futuro",
  13: "Jovem",
  14: "Titular do time B",
  15: "Goleiro titular",
  16: "Goleiro das copas",
  17: "Goleiro da copa nacional",
  20: "Reserva",
  21: "Reserva de emergência (goleiro)",
  22: "Fora dos planos",
};

/** The kinds of contract, by the codes contracts hold them as; 8, 10 and 11 are the MLS's, and the game
 * shows 8 and 11 under one name. */
const CONTRACT_TYPES: Partial<Record<number, string>> = {
  0: "Contrato de meio período",
  1: "Contrato de tempo integral",
  2: "Contrato de amador",
  3: "Contrato de base",
  4: "Sem contrato",
  8: "Contrato profissional",
  10: "Contrato profissional com salário mínimo",
  11: "Contrato profissional",
};

/**
 * Sentences for the failures of the Rust commands, by code (see `describeError` in format.ts). Each gets the values
 * the failure names, its amounts and dates already written out; fields come as keys, which `fieldName` names. A code
 * a dictionary leaves out shows the English message the command sent.
 */

/** The name of the field a failure names. */
const field = (key: string | undefined) => fieldName(ptBR, key ?? "");

/** A day the commands name as "20280131", written out: "31 de janeiro de 2028". */
const dayText = (value: string | undefined) => {
  const [y, m, d] = [Number(value?.slice(0, 4)), Number(value?.slice(4, 6)), Number(value?.slice(6, 8))];
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
};

/** What a check is about, from the key a failure gives, with a capital: "Contratos". */
const checkName = (key: string | undefined) => {
  const name = (ptBR.checks as Partial<Record<string, string>>)[key ?? ""] ?? key ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** Messages for the commands' failures, in Portuguese. */
const errors: ErrorTexts = {
  "team.nobodyInjured": () => "Ninguém neste time está lesionado.",
  "team.noCohesion": () =>
    "O editor não consegue ler o entrosamento deste time: esta versão do jogo ainda não foi verificada para isso, ou nenhum jogador tem registro no clube.",
  "team.noTactics": () =>
    "O editor não consegue ler o quanto este time conhece a tática: esta versão do jogo ainda não foi verificada para isso, ou o time não joga com uma tática que você escolhe.",
  "edit.unknownField": (p) => `Não existe um campo editável “${p.field}” aqui.`,
  "edit.outOfRange": (p) => `${p.value} não é um valor válido para ${field(p.field)}: aceita de ${p.min} a ${p.max}.`,
  "edit.notADate": (p) => `${p.value} não é uma data válida para ${field(p.field)}.`,
  "edit.notAChoice": (p) => `${p.value} não é um dos valores que ${field(p.field)} aceita.`,
  "edit.taken": (p) => `O número ${p.value} já está em uso: ${p.name ?? `o jogador com UID ${p.uid}`} usa essa camisa.`,
  "edit.unsupported": (p) => `${field(p.field)} não pode ser alterado dessa forma: ${p.reason}.`,
  "edit.noRecord": (p) => `${field(p.field)} não pode ser alterado aqui: o registro está ausente ou não confere.`,
  "edit.unset": (p) => `${field(p.field)} não está definido no jogo, então foi mantido como está.`,
  "edit.implausible": (p) => `${field(p.field)} mostra ${p.value}, valor que ele não pode ter; foi mantido como está por segurança.`,
  "edit.notApplied": (p) => `${field(p.field)}: foi gravado ${p.wrote}, mas a leitura devolveu ${p.read}.`,
  "edit.conflict": (p) => `${field(p.field)} agora é ${p.found}, não ${p.expected}: o jogo o alterou depois.`,
  "move.outOfRange": (p) => `${p.value} não é um valor válido para ${field(p.field)}: aceita de ${p.min} a ${p.max}.`,
  "loan.end": (p) => `O empréstimo deve terminar depois da chegada dele e, no máximo, junto com o contrato: de ${dayText(p.earliest)} a ${dayText(p.latest)}.`,
  "loan.noModel": () =>
    "O jogo não tem nenhum empréstimo em andamento para servir de modelo a este. Tente de novo depois que um dia passar no jogo.",
  "names.unknown": () =>
    "O editor não encontra onde o jogo guarda os nomes das pessoas nesta versão, então não consegue alterá-los.",
  "names.noRoom": (p) =>
    `O jogo não tem espaço para ${({ first: "mais um nome", last: "mais um sobrenome", common: "mais um nome popular" } as Record<string, string>)[p.table] ?? "mais um nome"} novo neste momento. ` +
    "Ele abre espaço sozinho conforme novos jogadores e funcionários chegam; ou salve o jogo, carregue o save de novo e tente outra vez.",
  "names.same": () => "Esse já é o nome.",
  "names.bad": (p) =>
    `O nome ou o sobrenome não pode ficar vazio, e nenhum nome pode começar ou terminar com espaço, ter caracteres de controle ou passar de ${p.max} bytes.`,
  "export.failed": (p) => `Não foi possível gravar o arquivo: ${p.reason}`,
  "export.notAllowed": (p) =>
    `O FMLibreEditor não pode gravar em ${p.folder}. Se o macOS perguntou se ele pode usar a pasta Documentos, permita ` +
    "em Ajustes do Sistema › Privacidade e Segurança › Arquivos e Pastas e exporte de novo.",
  "export.openFailed": (p) => `Não foi possível abrir: ${p.reason}`,
  "guard.unknownBuild": () =>
    "O FMLibreEditor não foi verificado com esta versão do jogo, então não grava nela. “Editar mesmo assim”, no " +
    "aviso no topo, liga a edição.",
  "guard.failed": (p) =>
    `${checkName(p.check)} não conferiu nesta versão do jogo, então o FMLibreEditor deixa esses dados como estão.`,
  "guard.saveChanged": () =>
    "O jogo carregou um save ou voltou ao menu principal depois que o FMLibreEditor o leu, então nada é alterado " +
    "até você recarregar os dados.",
  "memory.noBridge": () =>
    "O macOS não deixa o FMLibreEditor entrar no jogo: o jogo foi iniciado sem a ponte do FMLibreEditor. Configure " +
    "a ponte e inicie o jogo de novo pela Steam.",
  "staff.directorTaken": (p) =>
    `${p.name ?? "Outra pessoa"} já é o diretor de futebol do clube. Dê a este funcionário outra função ` +
    `lá, ou mova ${p.name ?? "essa pessoa"} primeiro.`,
  "staff.managerTaken": (p) =>
    `${p.name ?? "Outra pessoa"} já é o treinador do clube. Dê a este funcionário outra função lá, ou ` +
    `mova ${p.name ?? "essa pessoa"} primeiro.`,
  "staff.yourClub": () =>
    "Você treina este clube. Dê a este funcionário outra função lá: o FMLibreEditor nunca toma o seu lugar.",
  "staff.noJob": () => "Escolha a função que a pessoa assume no clube.",
  "staff.noModel": (p) =>
    p.staff === "0"
      ? "Este clube não tem funcionários: o jogo não mantém nenhum em clubes de ligas que não são jogáveis neste save."
      : "Nenhum funcionário deste clube tem um contrato integral próprio para servir de modelo a um novo.",
  "scout.noClub": () => "Você não treina nenhum clube neste save, então não há para quem observar jogadores.",
  "scout.noTactic": (p) => `Não foi possível ler a tática de ${p.club} no jogo.`,
  "scout.notPlaced": () => "O jogador não está em uma posição da tática.",
  "scout.unknownRole": (p) => `O editor não conhece a função ${p.role}.`,
  "setup.steamRunning": () =>
    "A Steam está aberta, então as opções de inicialização do FM27 foram mantidas; a ponte em si está instalada. Feche a Steam e " +
    "tente de novo, ou digite você mesmo a opção de inicialização na Steam.",
};

/**
 * The kinds of contract clauses and bonuses, by the codes contracts hold them as; named as the game's contract
 * screen names them (6, which only the German one was seen in, after what it does). The game shows no 54, 58 or 63.
 */
const CLAUSE_NAMES_EN: Partial<Record<number, string>> = {
  0: "Cláusula de rescisão por valor mínimo",
  1: "Cláusula de rescisão por rebaixamento",
  2: "Cláusula de rescisão por não acesso",
  3: "Aumento salarial anual",
  4: "Aumento salarial por acesso",
  5: "Redução salarial por rebaixamento",
  6: "Cláusula de rescisão para uma função na comissão",
  8: "Percentual da venda futura",
  9: "Percentual do lucro da venda futura",
  10: "Bônus por marca de gols na temporada",
  11: "Renovação de um ano após jogos no campeonato (última temporada)",
  12: "Cláusula de maior salário do elenco",
  13: "Salário após atingir jogos pelo clube no campeonato",
  14: "Aumento salarial por acesso à primeira divisão",
  15: "Redução salarial por rebaixamento da primeira divisão",
  16: "Cláusula de rescisão por valor mínimo (clubes estrangeiros)",
  17: "Cláusula de rescisão por valor mínimo (clubes nacionais de divisão superior)",
  18: "Cláusula de rescisão por valor mínimo (clubes nacionais)",
  19: "Salário após atingir jogos pela seleção",
  20: "Percentual do salário pago pelo patrocinador",
  21: "Percentual da renda dos jogos pago ao jogador",
  22: "Renovação opcional do contrato pelo clube",
  23: "Dispensa de indenização ao clube por função de treinador",
  25: "Renovação de um ano após jogos no campeonato (acesso na última temporada)",
  26: "Renovação de um ano após jogos no campeonato (permanência na última temporada)",
  27: "Cláusula de rescisão por valor mínimo (clubes na Liga dos Campeões da UEFA)",
  28: "Cláusula de contrato garantido da MLS",
  29: "Renovação do contrato após o acesso",
  30: "Cláusula de rescisão por lesão",
  31: "Cláusula de rescisão por valor mínimo (clubes em competição continental)",
  32: "Bônus por jogo disputado",
  33: "Bônus por gol",
  34: "Bônus por jogo sem sofrer gols",
  37: "Bônus por jogo pela seleção",
  38: "Valor por reserva não utilizado",
  39: "Bônus por assistência",
  40: "Bônus por marca de assistências na temporada",
  41: "Bônus por marca combinada de gols e assistências na temporada",
  54: "Não exibido no jogo (54)",
  55: "Cláusula de rescisão ativa por rebaixamento",
  56: "Cláusula de rescisão ativa por não acesso",
  58: "Não exibido no jogo (58)",
  63: "Não exibido no jogo (63)",
};

/** Players' traits (preferred moves), by their bit in the game's mask; named as FMRTE names them. */
const TRAIT_NAMES_EN: readonly string[] = [
  "Corre com a bola pela esquerda",
  "Corre com a bola pela direita",
  "Corre com a bola pelo meio",
  "Entra na área adversária",
  "Infiltra-se pelos corredores",
  "Avança sempre que possível",
  "Faz passes curtos e simples",
  "Tenta passes decisivos com frequência",
  "Chuta de longe",
  "Chuta com força",
  "Chuta colocado",
  "Chuta colocando efeito na bola",
  "Gosta de driblar o goleiro",
  "Gosta de tentar quebrar a linha de impedimento",
  "Usa o lado de fora do pé",
  "Marca o adversário de perto",
  "Provoca os adversários",
  "Discute com a arbitragem",
  "Joga de costas para o gol",
  "Recua para buscar a bola",
  "Joga tabelinhas",
  "Gosta de tentar encobrir o goleiro",
  "Dita o ritmo do jogo",
  "Tenta bicicletas",
  "Procura o passe em vez de tentar finalizar",
  "Não tenta passes em profundidade",
  "Quebra o ritmo do jogo",
  "Toca a bola para além do adversário",
  "Passa a bola para o pé direito antes de driblar",
  "Passa a bola para o pé esquerdo antes de driblar",
  "Segura a bola",
  "Chega atrasado à área adversária",
  "Tenta sair de situações difíceis jogando",
  "Fica sempre na defesa",
  "Evita usar o pé mais fraco",
  "Tenta firulas",
  "Tenta faltas de longa distância",
  "Entra forte nas divididas",
  "Não entra forte nas divididas",
  "Corta para dentro",
  "Fica colado à linha lateral",
  "Anima a torcida",
  "Tenta finalizações de primeira",
  "Tenta passes longos",
  "Gosta de receber a bola no pé",
  "Bate faltas com força",
  "Gosta de driblar o mesmo adversário repetidamente",
  "Gosta de inverter o jogo para o outro lado",
  "Vai se aposentar no auge",
  "Vai jogar futebol pelo maior tempo possível",
  "Tem lateral longo e rasteiro",
  "Corre com a bola com frequência",
  "Raramente corre com a bola",
  "Tenta desenvolver o pé mais fraco",
  "Pivô fixo",
  "Usa lateral longo para iniciar contra-ataques",
  "Evita chutes de longe",
  "Corta para dentro pela ponta esquerda",
  "Corta para dentro pela ponta direita",
  "Cruza cedo",
  "Sai jogando com a bola da defesa",
  "Joga com os pés"
];

export const ptBR: Strings = {
  attributes: {
    // Technical
    corners: "Escanteios",
    crossing: "Cruzamentos",
    dribbling: "Drible",
    finishing: "Finalização",
    first_touch: "Domínio de Bola",
    free_kicks: "Cobrança de Falta",
    heading: "Cabeceio",
    long_shots: "Chutes de Fora da Área",
    long_throws: "Laterais Longos",
    marking: "Marcação",
    passing: "Passe",
    penalty_taking: "Cobrança de Pênalti",
    tackling: "Desarme",
    technique: "Técnica",
    // Mental
    aggression: "Agressividade",
    anticipation: "Antecipação",
    bravery: "Coragem",
    composure: "Compostura",
    concentration: "Concentração",
    decisions: "Tomada de Decisão",
    determination: "Determinação",
    flair: "Criatividade",
    leadership: "Liderança",
    off_the_ball: "Movimentação sem a Bola",
    positioning: "Posicionamento",
    teamwork: "Trabalho em Equipe",
    vision: "Visão de Jogo",
    work_rate: "Dedicação",
    // Physical
    acceleration: "Aceleração",
    agility: "Agilidade",
    balance: "Equilíbrio",
    jumping_reach: "Impulsão",
    natural_fitness: "Condição Física Natural",
    pace: "Velocidade",
    stamina: "Resistência",
    strength: "Força",
    // Goalkeeping (first touch and passing are shared with Technical)
    aerial_reach: "Alcance Aéreo",
    command_of_area: "Domínio da Área",
    communication: "Comunicação",
    eccentricity: "Excentricidade",
    handling: "Trabalho com as Mãos",
    kicking: "Chute",
    one_on_ones: "Um contra Um",
    punching: "Socos (Tendência)",
    reflexes: "Reflexos",
    rushing_out: "Saídas do Gol (Tendência)",
    throwing: "Reposição com as Mãos",
    // Hidden
    consistency: "Regularidade",
    dirtiness: "Jogo Sujo",
    important_matches: "Jogos Importantes",
    injury_proneness: "Propensão a Lesões",
    versatility: "Versatilidade",
    // Feet
    left_foot: "Pé Esquerdo",
    right_foot: "Pé Direito",
  },

  staffAttributes: {
    // Coaching
    attacking: "Ataque",
    defending: "Defesa",
    fitness: "Preparo Físico",
    goalkeeping: "Goleiros",
    possession: "Posse de Bola",
    set_pieces: "Bolas Paradas",
    tactical: "Tática",
    technical: "Técnica",
    working_with_youngsters: "Trabalho com Jovens",
    // Mental
    authority: "Autoridade",
    determination: "Determinação",
    motivating: "Motivação",
    people_management: "Gestão de Pessoas",
    // Knowledge
    data_analysis: "Análise de Dados",
    judging_ability: "Avaliação da Habilidade do Jogador",
    judging_potential: "Avaliação do Potencial do Jogador",
    judging_staff: "Avaliação da Habilidade de Funcionários",
    negotiating: "Negociação",
    tactical_knowledge: "Conhecimento Tático",
    // Medical
    physiotherapy: "Fisioterapia",
    sports_science: "Ciência do Esporte",
  },

  personality: {
    adaptability: "Adaptabilidade",
    ambition: "Ambição",
    loyalty: "Lealdade",
    pressure: "Pressão",
    professionalism: "Profissionalismo",
    sportsmanship: "Espírito Esportivo",
    temperament: "Temperamento",
    controversy: "Polêmica",
  },

  /** The abbreviations of the positions, as Brazilian players know them. */
  positions: {
    gk: "GOL",
    sw: "LIB",
    dl: "LE",
    dc: "ZC",
    dr: "LD",
    dm: "VOL",
    ml: "ME",
    mc: "MC",
    mr: "MD",
    aml: "PE",
    amc: "MEI",
    amr: "PD",
    st: "ATA",
    wbl: "ALE",
    wbr: "ALD",
  },

  clubFacilities: {
    training: "Treinamento",
    youth_facilities: "Instalações da Base",
    youth_coaching: "Treinadores da Base",
    youth_recruitment: "Captação da Base",
    /** Only a club with finances has it. */
    corporate: "Camarotes Corporativos",
  },

  supporterTraits: {
    loyalty: "Lealdade",
    passion: "Paixão",
    patience: "Paciência",
    affluence: "Poder Aquisitivo",
    temperament: "Temperamento",
    expectations: "Expectativas",
  },

  /** The kinds of supporters, in the order of the supporter-mix bar. */
  supporterMix: {
    hardcore: "Fanáticos",
    core: "Fiéis",
    family: "Família",
    fair_weather: "Modinhas",
    corporate: "Corporativos",
    casual: "Ocasionais",
  },

  /** FM's job codes as stored in contracts. */
  jobs: {
    1: "Jogador",
    2: "Preparador",
    4: "Presidente do Conselho",
    6: "Diretor",
    10: "Diretor de Futebol",
    12: "Fisioterapeuta",
    14: "Olheiro",
    16: "Treinador Principal",
    20: "Treinador Adjunto",
    22: "Treinador de Bolas Paradas",
    26: "Preparador Físico",
    34: "Preparador de Goleiros",
    38: "Médico-Chefe",
    40: "Cientista Esportivo Chefe",
    44: "Olheiro-Chefe",
    46: "Médico do Clube",
    48: "Cientista Esportivo",
    50: "Fisioterapeuta-Chefe",
    58: "Analista de Recrutamento",
    60: "Analista de Desempenho",
    62: "Chefe de Análise de Desempenho",
    64: "Diretor das Camadas Jovens",
    66: "Dono",
    70: "Presidente",
    86: "Gestor de Empréstimos",
    88: "Diretor Técnico",
  },

  /** The names of the fields that are not attributes, personality or positions, by key. */
  fields: {
    current_ability: "Habilidade atual",
    potential_ability: "Habilidade potencial",
    height: "Altura (cm)",
    date_of_birth: "Data de nascimento",
    asking_price: "Preço pedido",
    nation: "Nacionalidade",
    city_of_birth: "Cidade de nascimento",
    "reputation.home": "Reputação nacional",
    "reputation.current": "Reputação atual",
    "reputation.world": "Reputação mundial",
    "international.caps": "Jogos pela seleção",
    "international.goals": "Gols pela seleção",
    "international.u21_caps": "Jogos pela seleção sub-21",
    "international.u21_goals": "Gols pela seleção sub-21",
    // What the game changes every day.
    condition: "Energia",
    match_sharpness: "Ritmo de jogo",
    jadedness: "Cansaço acumulado",
    morale: "Moral",
    "contract.wage": "Salário por semana",
    wageShare: "parcela do salário",
    monthlyFee: "taxa mensal",
    optionFee: "opção de compra",
    "contract.loyalty_bonus": "Bônus de lealdade por semana",
    "contract.happiness": "Felicidade",
    "contract.playing_time_happiness": "Felicidade com o tempo de jogo",
    "contract.unhappiness": "Motivos de insatisfação",
    "contract.expires": "Fim do contrato",
    "contract.squad_number": "Número da camisa",
    "contract.squad_status": "Status no elenco",
    "contract.transfer_listed": "Na lista de transferências",
    "contract.loan_listed": "Na lista de empréstimos",
    "loan.expires": "Fim do empréstimo",
    "loan.option_fee": "Opção de compra",
    // A member of staff's job, which the change log keeps as a change of its code.
    "contract.job": "Função",
    // A player's ties, which the change log keeps as changes of the nation or club (see `ties`).
    "tie.nationality": "Segunda nacionalidade",
    "tie.trainedInNation": "Formado no país",
    "tie.trainedAtClub": "Formado no clube",
    "tie.workPermit": "Sem necessidade de permissão de trabalho em",
    // A move to another club, which the change log keeps as a change of the player's club.
    club: "Clube",
    // Healing a player, which the change log keeps as a change of his injuries.
    injuries: "Lesões",
    // Setting a player's cohesion with his club, which the change log keeps as a change of it.
    cohesion: "Entrosamento",
    tactics: "Familiaridade tática",
    // Lifting a player's bans, which the change log keeps as a change of his bans.
    bans: "Suspensões",
    // Keeping a player from retiring, which the change log keeps as a change of the date he was to retire on.
    retirement: "Aposentadoria",
    // A change to a player's contract clauses, which the change log keeps as a change of the clause's amount.
    clause: "Cláusula do contrato",
    "clause.amount": "Valor da cláusula",
    "clause.condition": "Condição da cláusula",
    // Making a player the captain or vice-captain of one of a club's teams, which the change log keeps as a change of
    // the club's captain or vice-captain.
    captain: "Capitão",
    vice_captain: "Vice-capitão",
    // A club's own reputation, which has no home, current or world.
    reputation: "Reputação",
    "facilities.training": "Instalações de treinamento",
    "facilities.youth_facilities": "Instalações da base",
    "facilities.youth_coaching": "Treinadores da base",
    "facilities.youth_recruitment": "Captação da base",
    "facilities.corporate": "Camarotes corporativos",
    youth_rating: "Avaliação da base",
    game_importance: "Importância do futebol",
    fa_financial_power: "Poder financeiro da federação",
    fa_patience: "Paciência da federação",
    attendance: "Público",
    min_attendance: "Público mínimo",
    max_attendance: "Público máximo",
    economic_factor: "Fator econômico",
    state_of_development: "Estado de desenvolvimento",
    "finance.balance": "Saldo",
    "finance.transfer_budget": "Orçamento de transferências",
    "finance.wage_budget": "Orçamento salarial",
    "finance.total_wage_budget": "Orçamento salarial total",
    "stadium.capacity": "Capacidade do estádio",
    "stadium.name": "Nome do estádio",
    "name.first": "Nome",
    "name.last": "Sobrenome",
    "name.common": "Nome popular",
    "name.full": "Nome completo",
    "stadium.seating": "Capacidade sentada",
    "stadium.used": "Capacidade em uso",
    "stadium.expansion": "Capacidade de ampliação",
    // Prize money a club's league pays, which the change log keeps as a change of the club (see `leaguePrizes`).
    "prize.win": "Premiação da liga por vitória",
    "prize.draw": "Premiação da liga por empate",
    "prize.loss": "Premiação da liga por derrota",
  },

  profile: {
    close: "Fechar perfil",
    loading: "Carregando perfil…",
    /** The handle on the left edge of the panel. */
    resize: "Redimensionar o painel do perfil",
    resizeHint: "Arraste para deixar o painel mais largo ou mais estreito; clique duas vezes para restaurar",
    /** Shown where a value is missing. */
    none: "—",

    // Header
    freeAgent: "Sem clube",
    born: "Nascimento",
    height: (cm: number) => `${cm} cm`,
    /** After the input of the height, while the player is edited. */
    heightUnit: "cm",
    uid: "UID",
    currentAbility: "Habilidade atual",
    currentAbilityShort: "HA",
    potentialAbility: "Habilidade potencial",
    potentialAbilityShort: "POT",
    /** Hover text of a potential ability that is set as a range (the game stores it as a negative number). */
    potentialRange: "Potencial definido como faixa",

    // Attributes
    technical: "Técnicos",
    goalkeeping: "Goleiro",
    mental: "Mentais",
    physical: "Físicos",
    hidden: "Ocultos",
    feet: "Pés",
    personality: "Personalidade",
    /** Hover text of an attribute: the value as stored, 0–100 unless the game stores it on another scale. */
    raw: (raw: number, scale = 100) => `bruto ${raw} / ${scale}`,
    lowerIsBetter: "quanto menor, melhor",
    age: (age: number) => `${age} anos`,

    // Positions
    positions: "Posições",
    positionsSummary: (best: string) => `Avaliação das posições: ${best}`,
    /** The group of every position's rating, under the pitch. */
    positionRatings: "Avaliação das posições",
    positionTiers: {
      natural: "Natural",
      accomplished: "Experiente",
      competent: "Competente",
      unconvincing: "Pouco convincente",
      ineffective: "Ineficaz",
    },
    positionTooltip: (position: string, rating: number, tier: string) => `${position} · ${rating} · ${tier}`,

    // Contract
    contract: "Contrato",
    wage: "Salário por semana",
    /** Under the wage: the game keeps money in pounds; `converted` when the app shows another currency. */
    wageNote: (converted: boolean): string =>
      converted
        ? "o jogo guarda libras; exibido pela taxa de câmbio do próprio FM"
        : "o jogo guarda libras; outra moeda pode ser escolhida nas configurações",
    signed: "Assinado em",
    expires: "Vence em",
    joined: "Chegou em",
    /** Under a contract's dates: the button that makes it run `years` longer, while it does, and its hover text. */
    extendContract: (years: number) => `Estender por ${years} anos`,
    extendingContract: "Estendendo…",
    /** `until` is the day the contract would end then. */
    extendContractTitle: (years: number, until: string) => `Faz o contrato durar ${years} anos a mais, até ${until}`,
    squadStatus: "Status no elenco",
    squadStatusName: (status: number) => SQUAD_STATUSES[status] ?? `Status ${status}`,
    contractType: "Tipo de contrato",
    contractTypeName: (code: number) => CONTRACT_TYPES[code] ?? `Tipo ${code}`,
    squadNumber: "Número da camisa",
    transferListed: "Na lista de transferências",
    loanListed: "Na lista de empréstimos",

    // Career
    career: "Carreira",
    internationalCaps: "Jogos pela seleção",
    internationalGoals: "Gols pela seleção",
    u21Caps: "Jogos pela seleção sub-21",
    u21Goals: "Gols pela seleção sub-21",
    askingPrice: "Preço pedido",
    notSet: "Não definido",
    reputation: "Reputação",
    reputationHome: "Nacional",
    reputationCurrent: "Atual",
    reputationWorld: "Mundial",
    /** The retirement the game has planned for a player, and the button that keeps him playing. */
    retirement: "Aposentadoria",
    retires: "Pretende se aposentar",
    noRetirement: "O jogo não planejou a aposentadoria dele",
    keepPlaying: "Impedir aposentadoria",
    keepingPlaying: "Impedindo…",
    keepPlayingTitle: "Cancela a aposentadoria planejada e dá a ele o traço “Vai jogar futebol pelo maior tempo possível”",

    // Medical (the group's heading is `medical`, below; the names of its values are in `fields`)
    /** A player's morale, 1–20. */
    morale: (value: number) => `${value} / 20`,
    /** Hover text of his morale: the game shows it as his overall happiness. */
    /** A player's traits (preferred moves): the heading, none, and each one's name by its bit. */
    traits: "Traços",
    noTraits: "Sem traços",
    traitName: (bit: number) => TRAIT_NAMES_EN[bit] ?? `Traço ${bit}`,
    /** A player's reasons to be unhappy, as FMRTE lists them, and the button that removes them all. */
    unhappiness: "Insatisfação",
    noUnhappiness: "Nada o deixa insatisfeito",
    removeUnhappiness: "Remover todos",
    removingUnhappiness: "Removendo…",
    removeUnhappinessTitle: "Tira todos os motivos de insatisfação da lista dele",
    /** The second line of Remove all's hover text: what the game then does about his teammates. */
    removeUnhappinessFollows: "Os motivos dos companheiros sobre ele terminam quando o jogo avança: clique em Continuar no jogo",
    concernSince: (date: string) => `desde ${date}`,
    /** After a reason held about a teammate whose sentence does not name him: who he is. */
    concernAbout: (name: string) => `sobre ${name}`,
    concernKind: (kind: number) => (kind === 1 ? "Preocupado" : kind === 2 ? "Interno" : `Tipo ${kind}`),
    /** A reason by the game's sentence for it (see `reasons.ts`); a motive without one by its number. */
    concernMotive: (concern: Concern) => reasonText(REASONS_PT_BR, concern) ?? `Motivo ${concern.motive}`,
    /** A contract's clauses and bonuses: the heading, and what each kind the game has is called. */
    clauses: "Bônus e cláusulas",
    noClauses: "Sem bônus ou cláusulas",
    loyaltyBonus: "Bônus de lealdade",
    happiness: "Felicidade",
    playingTimeHappiness: "Felicidade com o tempo de jogo",
    moodTitle: "Como o FMRTE mostra, de -100 a 100; o jogo mostra em palavras",
    /** The name of a clause or bonus by its kind; a kind the app does not know yet by its number. */
    clauseName: (kind: number) => CLAUSE_NAMES_EN[kind] ?? `Cláusula ${kind}`,
    /** A player's loan: where he is on loan, and the button that brings him back. */
    loan: "Empréstimo",
    loanAt: "Emprestado a",
    loanParent: "Pertence a",
    loanFrom: "De",
    loanUntil: "Até",
    loanNumber: "Número lá",
    recall: "Chamar de volta",
    recallTitle: "Traz ele de volta ao clube hoje; pede confirmação antes",
    recallAgain: "Chamar de volta de novo",
    makePermanent: "Tornar definitivo",
    makePermanentTitle: "Mantém ele no clube que o recebeu por empréstimo, com contrato; pede confirmação antes",
    /** Where the Recall button was, once the loan ends today: recalled by the editor, or ending today anyway. */
    recalledWaiting: "Chamado de volta · retorno pendente",
    endsTodayWaiting: "Termina hoje · retorno pendente",
    pendingTitle: (parent: string) => `O empréstimo termina hoje: avance um dia no jogo e ele volta para ${parent}`,
    endPassed: (date: string) =>
      `O empréstimo deveria terminar em ${date}, mas o jogo não o trouxe de volta. Chame-o de volta de novo e avance um dia.`,
    /** The loan's terms, as the game's Loan Club tab shows them. */
    loanCanRecall: "Pode ser chamado de volta",
    loanCanRecallTitle: "Se o clube dele pode chamá-lo de volta no jogo. “Chamar de volta” aqui funciona de qualquer jeito",
    loanCanTerminate: "Pode ser encerrado antes",
    loanCupMatches: "Joga em jogos de copa",
    loanAgainstClub: "Joga contra o próprio clube",
    loanOptionFee: "Opção de compra",
    loanOptionFeeTitle: "O valor pelo qual o clube que o recebeu por empréstimo pode contratá-lo em definitivo",
    loanMonthlyFee: "Taxa mensal",
    loanMonthlyFeeTitle: "O que o clube que o recebeu paga ao clube dele por cada mês em que ele joga",
    loanUnusedFee: "Taxa mensal se não utilizado",
    loanUnusedFeeTitle: "O que o clube que o recebeu paga ao clube dele por cada mês em que ele não é utilizado",
    /** What a clause depends on, by kind: goals, assists, league games, matches, years or a percentage. */
    clauseCondition: (kind: number, value: number) => {
      switch (kind) {
        case 10:
          return value === 1 ? "1 gol" : `${value} gols`;
        case 40:
          return value === 1 ? "1 assistência" : `${value} assistências`;
        case 41:
          return `${value} gols e assistências`;
        case 19:
          return value === 1 ? "1 jogo pela seleção" : `${value} jogos pela seleção`;
        case 11:
        case 13:
        case 25:
        case 26:
          return value === 1 ? "1 jogo no campeonato" : `${value} jogos no campeonato`;
        case 22:
        case 29:
          return value === 1 ? "1 ano" : `${value} anos`;
        case 3:
        case 4:
        case 5:
        case 8:
        case 9:
        case 14:
        case 15:
        case 20:
        case 21:
          return `${value}%`;
        default:
          return String(value);
      }
    },
    /** When a release clause expires: on `date`, or, with the contract's start not known, `days` after it. */
    clauseExpires: (date: string) => `vence em ${date}`,
    clauseExpiresAfter: (days: number) =>
      days === 1 ? "vence 1 dia após a assinatura" : `vence ${format(days)} dias após a assinatura`,
    /** A sell-on clause on the profit: its percentage of what the selling club makes over the amount. */
    clauseProfitShare: (percent: string, amount: string) => `${percent} do lucro acima de ${amount}`,
    /** The wage a clause gives from then on. */
    clauseWage: (amount: string) => `${amount} por semana`,
    moraleTitle: "Felicidade geral no jogo: satisfeito com 10, um pouco feliz com 11, extremamente feliz com 15 e 20",
    /** Hover text of jadedness, which the profile shows as stored. */
    jadednessTitle:
      "O quanto ele está desgastado por jogar: -500 é totalmente descansado e, quanto maior, mais ele precisa de descanso",
    noInjuries: "Sem lesões",
    /** The name of an injury the game gave none for. */
    unknownInjury: "Lesão desconhecida",
    /** Under the name of an injury: when it began, and when he is expected back (`dates`: one date, or a range). */
    injuryStarted: (date: string) => `Início em ${date}`,
    injuryBack: (dates: string) => `Volta prevista: ${dates}`,
    /** Heals every injury of the player at once. */
    heal: "Curar",
    healTitle: "Cura todas as lesões deste jogador no jogo",
    noBans: "Sem suspensões",
    /** A ban: how many matches the player still has to miss, and under it when it began. */
    banMatches: (matches: number) => (matches === 1 ? "1 jogo" : `${format(matches)} jogos`),
    banStarted: (date: string) => `A partir de ${date}`,
    /** Lifts every ban of the player at once. */
    liftBans: "Anular",
    liftBansTitle: "Cancela todas as suspensões deste jogador no jogo",

    // Above the attributes, while the profile is read
    /** Sets every attribute of the player to its best at once. */
    maxAttributes: "Maximizar atributos",
    maxAttributesTitle: "Coloca todos os atributos no máximo: 20, e 1 para propensão a lesões e jogo sujo",
    /** What Max attributes wrote, beside the button that takes it back; then what that undid. */
    maxAttributesDone: (count: number) =>
      count === 0 ? "Todos os atributos já estão no máximo" : `Gravado: ${changeCount(count)}`,
    maxAttributesUndone: (count: number) => (count === 0 ? "Nada foi desfeito" : `Desfeito: ${changeCount(count)}`),
    undoMax: "Desfazer",
    undoMaxTitle: "Grava de volta no jogo os atributos antigos dele",
    /** Freezing his attributes, while the game can be written to, and what that does. */
    freezeAttributes: "Congelar atributos",
    freezeAttributesNote:
      "Os atributos dele não pioram enquanto o app está aberto e conectado; as melhoras continuam valendo",
    /** The same for a member of staff, who has no injury proneness or dirtiness. */
    maxStaffAttributesTitle: "Coloca todos os atributos deste funcionário no máximo: 20",
    undoMaxStaffTitle: "Grava de volta no jogo os atributos antigos",
    freezeStaffAttributesNote:
      "Os atributos deles não pioram enquanto o app está aberto e conectado; as melhoras continuam valendo",
    /** Freezing his energy and match sharpness, under them in the Medical group, and what that does. */
    freezeFitness: "Congelar energia e ritmo de jogo",
    freezeFitnessNote:
      "A energia e o ritmo de jogo dele não caem enquanto o app está aberto e conectado; os ganhos continuam valendo",
    /** Freezing his position ratings: the box under the pitch, and the (i) after it, which says what that does. */
    freezePositions: "Congelar",
    freezePositionsInfo: "O que faz congelar as posições?",
    freezePositionsNote:
      "Enquanto o app está aberto e conectado, as avaliações de posição dele ficam como estão: ele não aprende uma posição nova, " +
      "e as avaliações não sobem nem caem. O app lembra disso para este save.",

    // Staff
    /** Badge on the manager the user controls. */
    you: "Você",
    youTitle: "O treinador que você controla neste save",
    id: "ID",
    job: "Função",
    /** Giving a member of staff another job at their club, under the job in the contract. */
    changeJob: "Mudar função",
    changeJobTitle: "Dá a este funcionário outra função no clube dele, no jogo",
    newJob: "Nova função",
    applyJob: "Aplicar",
    cancelJob: "Cancelar",
    unemployed: "Desempregado",
    coaching: "Treinamento",
    knowledge: "Conhecimento",
    medical: "Médico",
    /** A coaching job held by someone who still plays. */
    playerCoach: (job: string) => `${job} (jogador-treinador)`,
    unknownJob: (code: number) => `Função ${code}`,
  },

  /** The player list: search, filter bar and columns. */
  playerList: {
    /** The entry in the sidebar. */
    nav: "Jogadores",
    /** In the status line, once connected. */
    count: (total: number) => `${format(total)} jogadores`,
    search: "Buscar jogadores por nome ou UID",
    /**
     * The line beside the search box. `sorted` is the order a column header was clicked for, or null while the
     * list is in its default order (best current ability first); its `by` is a name from `sortNames`.
     */
    summary: (total: number, shown: number, sorted: { by: string; ascending: boolean } | null) => {
      const count = `${format(total)} jogadores`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · mostrando os ${shown} primeiros por habilidade atual`
        : `${count} · mostrando os ${shown} primeiros por ${sorted.by}, ordem ${sorted.ascending ? "crescente" : "decrescente"}`;
    },
    /** The message under an empty table; `filtered` is whether any filter is in effect. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Nenhum jogador corresponde a esses filtros." : "Nenhum jogador encontrado.";
      }
      return filtered ? `Nenhum jogador corresponde a “${query}” com esses filtros.` : `Nenhum jogador corresponde a “${query}”.`;
    },
    columns: {
      name: "Nome",
      age: "Idade",
      positions: "Posições",
      nation: "País",
      club: "Clube",
      contractExpires: "Contrato",
      born: "Nascimento",
      currentAbility: "HA",
      potentialAbility: "POT",
      uid: "UID",
    } satisfies Record<PlayerSort | "positions" | "born" | "uid", string>,
    /** Hover text of a column header that sorts the list; `by` is a name from `sortNames`. */
    sortBy: (by: string) => `Ordenar por ${by}`,
    /** The name of each sortable column, as the summary line and the hover text of a header say it. */
    sortNames: {
      currentAbility: "habilidade atual",
      potentialAbility: "habilidade potencial",
      age: "idade",
      name: "nome",
      nation: "país",
      club: "clube",
      contractExpires: "fim do contrato",
    } satisfies Record<PlayerSort, string>,
    /** The filters; the staff list has those that are not about players too (see FilterBar.tsx). */
    filters: {
      /** The button that shows or hides the filters. */
      toggle: "Filtros",
      /** Its name for assistive technology while `count` of the filters are in effect. */
      toggleActive: (count: number) => `Filtros ativos: ${count}`,
      clear: "Limpar",
      /** The entry of the position select that is no filter. */
      any: "Qualquer",
      position: "Posição",
      /** Whom the list shows: the select's name, and its choices after `any`. */
      gender: "Gênero",
      men: "Homens",
      women: "Mulheres",
      age: "Idade",
      minAge: "Idade mínima",
      maxAge: "Idade máxima",
      /** The hint in an empty age input. */
      minPlaceholder: "Mín",
      maxPlaceholder: "Máx",
      minCurrentAbility: "HA mín.",
      minCurrentAbilityTitle: "Habilidade atual mínima",
      minPotentialAbility: "POT mín.",
      minPotentialAbilityTitle: "Habilidade potencial mínima",
      /** The hint in an empty ability input: what it accepts. */
      abilityPlaceholder: "1–200",
      nation: "País",
      club: "Clube",
      freeAgentsOnly: "Só sem clube",
      contractEndsBy: "Contrato termina até",
      transferListedOnly: "Só na lista de transferências",
      loanListedOnly: "Só na lista de empréstimos",
      /** Bounds on attributes, a row each, under the other filters; the staff list has them too. */
      attributes: {
        heading: "Atributos",
        /** The select of a row, for assistive technology, and its entry before an attribute is picked. */
        attribute: "Atributo",
        pick: "Escolha um atributo",
        /** The two inputs of a row, for assistive technology; `name` is the attribute, "" before one is picked. */
        min: (name: string) => (name ? `Mínimo de ${name}` : "Mínimo"),
        max: (name: string) => (name ? `Máximo de ${name}` : "Máximo"),
        add: "Adicionar atributo",
        /** The button that takes a row away, for assistive technology and as its hover text. */
        remove: (name: string) => (name ? `Remover ${name}` : "Remover esta linha"),
      },
      /** Saving the filters in effect, and the sort, under a name of the user's own; the names stay as typed. */
      saved: {
        /** The button that starts saving, and its hover text. */
        save: "Salvar",
        saveTitle: "Salva os filtros e a ordenação atuais com um nome",
        /** The name input, for assistive technology, and the hint in it while it is empty. */
        name: "Nome do filtro salvo",
        namePlaceholder: "Nome do filtro",
        ok: "OK",
        cancel: "Cancelar",
        /** The select of the saved filters: its name, and what it shows while none is the one in effect. */
        select: "Filtros salvos",
        delete: "Excluir",
        /** The name and hover text of Delete; `name` is the saved filter's. */
        deleteTitle: (name: string) => `Excluir o filtro salvo: ${name}`,
        /** The question when the name is taken; `name` is the one typed. */
        replaceQuestion: (name: string) => `Já existe um filtro salvo chamado “${name}”. Substituir?`,
        replace: "Substituir",
        /** When the name is a new one and `max` filters are saved already. */
        full: (max: number) =>
          `Dá para salvar até ${max} filtros. Exclua um antes, ou use o nome de um filtro salvo para substituí-lo.`,
      },
    },
  },

  /** The staff list. */
  staffList: {
    /** The entry in the sidebar. */
    nav: "Funcionários",
    /** In the status line, once connected. */
    count: (total: number) => `${format(total)} funcionários`,
    search: "Buscar funcionários por nome ou ID",
    /**
     * The line beside the search box. `sorted` is the order a column header was clicked for, or null while the
     * list is in its default order (the human manager first, then the best current ability); its `by` is a name from
     * `sortNames`.
     */
    summary: (total: number, shown: number, sorted: { by: string; ascending: boolean } | null) => {
      const count = `${format(total)} funcionários`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · mostrando os ${shown} primeiros por habilidade atual`
        : `${count} · mostrando os ${shown} primeiros por ${sorted.by}, ordem ${sorted.ascending ? "crescente" : "decrescente"}`;
    },
    /** The message under an empty table; `filtered` is whether any filter is in effect. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Nenhum funcionário corresponde a esses filtros." : "Nenhum funcionário encontrado.";
      }
      return filtered ? `Nenhum funcionário corresponde a “${query}” com esses filtros.` : `Nenhum funcionário corresponde a “${query}”.`;
    },
    columns: {
      name: "Nome",
      age: "Idade",
      job: "Função",
      club: "Clube",
      nation: "País",
      born: "Nascimento",
      currentAbility: "HA",
      potentialAbility: "POT",
      id: "ID",
    } satisfies Record<StaffSort | "job" | "born" | "id", string>,
    /** Hover text of a column header that sorts the list; `by` is a name from `sortNames`. */
    sortBy: (by: string) => `Ordenar por ${by}`,
    /** The name of each sortable column, as the summary line and the hover text of a header say it. */
    sortNames: {
      currentAbility: "habilidade atual",
      potentialAbility: "habilidade potencial",
      age: "idade",
      name: "nome",
      nation: "país",
      club: "clube",
    } satisfies Record<StaffSort, string>,
    /** The filters only the staff list has; the others are the player list's (`playerList.filters`). */
    filters: {
      job: "Função",
      /** The entry of the job select that is no filter. */
      anyJob: "Qualquer",
      unemployedOnly: "Só desempregados",
    },
  },

  /** The club profile: what the player and staff panels do not have. */
  clubProfile: {
    // Header
    womensClub: "Clube feminino",
    /** "Founded 1882", in the line under the name. */
    founded: (year: number) => `Fundado em ${year}`,
    reputationShort: "REP",
    reputationTitle: "Reputação",

    // The tabs under the header: what the club has, and its squad (see `squad`).
    /** The name of the tabs for assistive technology. */
    tabsLabel: "Seções do clube",
    tabs: { overview: "Visão geral", squad: "Elenco", staff: "Funcionários", stadium: "Estádio" },
    /** Hover text of the Squad tab while the club is edited: its values are on the Overview. */
    squadLocked: "Termine a edição para abrir o elenco",
    /** The same for the Staff tab (see `clubStaff`). */
    staffLocked: "Termine a edição para abrir os funcionários",

    facilities: "Instalações",

    // Supporters
    supporters: "Torcedores",
    supporterMix: "Perfil da torcida",
    /** A share of the supporters; `value` is already a percentage (35 for 35%). */
    percent: (value: number) => `${percents.format(value)}%`,
    /** Hover text of a segment of the supporter-mix bar. */
    mixTooltip: (kind: string, percent: string) => `${kind} · ${percent}`,

    // Finances
    finances: "Finanças",
    balance: "Saldo",
    transferBudget: "Orçamento de transferências",
    wageBudget: "Orçamento salarial (gasto)",
    totalWageBudget: "Orçamento salarial total",
    ticketPrice: "Preço médio do ingresso",
    /** Under the labels of the two wage budgets, which are amounts per week. */
    perWeek: "por semana",
    /** Clubs outside the leagues being played have no finance record in memory. */
    noFinances: "O FM guarda finanças apenas dos clubes das ligas que estão sendo jogadas.",
    /** Freezing the club's money, while the game can be written to, and what that does. */
    freeze: "Congelar dinheiro",
    freezeNote: "O saldo não diminui enquanto o app está aberto e conectado; as receitas continuam valendo",

    // Stadium
    stadium: "Estádio",
    capacity: "Capacidade",
    seating: "Sentados",
    used: "Em uso",
    /** The capacity in use when the game does not limit it (stored as 0). */
    usedAll: "Toda",
    usedTitle: "A parte da capacidade que o jogo permite usar enquanto a limita; 0 significa toda",
    expansion: "Pode crescer até",
    /** When the layout of this build does not know where the stadium is, or the club's stadium did not check out. */
    noStadium: "Não foi possível ler o estádio deste clube.",
    /** Its name, which can be changed in place: in the block the game gave the old one. */
    stadiumName: "Nome",
    rename: "Renomear",
    renameTitle: "Dá outro nome ao estádio; é gravado na hora",
    /** The (i) beside the name: how a new name lasts, and that the app has to stay open for it. */
    renameInfoLabel: "Como funciona a renomeação?",
    renameInfo:
      "O jogo não guarda nomes de estádios nos saves: ele os pega do banco de dados toda vez que carrega um save. Por isso " +
      "o FMLibreEditor lembra o novo nome para este save e o devolve em poucos segundos toda vez que o jogo o carrega, " +
      "desde que o app esteja aberto e conectado. Se o jogo carregar o save com o app fechado, ele mostra o próprio " +
      "nome até o app conectar de novo. Para voltar ao nome antigo, desfaça a renomeação em Alterações ou renomeie o " +
      "estádio de volta.",
    saveName: "Salvar",
    renaming: "Salvando…",
    cancelRename: "Cancelar",
    /** How long the name being typed is, in bytes of UTF-8, and how long it may be. */
    nameLength: (bytes: number, min: number, max: number) =>
      min <= 1
        ? `${bytes} de no máximo ${max} caracteres (uma letra acentuada conta como dois)`
        : `${bytes} caracteres: de ${min} a ${max}, para caber onde o jogo guarda o nome (uma letra acentuada conta como dois)`,
    /** Instead of Rename, when other things in the game hold the same name. */
    nameShared: (holders: number) =>
      `${holders} itens no jogo têm este nome, então ele não pode ser mudado só para o estádio`,

    // Club info
    info: "Informações do clube",
    seasonTickets: "Sócios-torcedores",
    socialMedia: "Seguidores nas redes sociais",
  },

  /**
   * The Staff tab of a club's profile: the club's staff, and Release all staff, which releases every one of them the
   * editor can (not you, not the board) after a dialog that asks first.
   */
  clubStaff: {
    loading: "Lendo os funcionários…",
    /** When the game keeps no staff for the club. */
    empty: "O jogo não guarda funcionários para este clube: clubes de ligas que não são jogadas neste save não têm.",
    /**
     * Above the table: how many staff the club has, and how many of them stay when the rest are released (0 when there
     * is nobody to release).
     */
    count: (total: number, staying: number) => {
      const all = total === 1 ? "1 funcionário" : `${format(total)} funcionários`;
      return staying === 0 ? all : `${all} · ${format(staying)} permanecem se os demais forem dispensados`;
    },

    // The action on the whole staff
    /** The name of the group of buttons for assistive technology. */
    actionsLabel: "Ações sobre todos os funcionários",
    /** `count` is how many of the club's staff it releases. */
    releaseAll: (count: number) => (count === 0 ? "Dispensar todos os funcionários" : `Dispensar todos os funcionários (${format(count)})`),
    releaseAllTitle: "Dispensa todos os funcionários do clube, menos você e a diretoria; pede confirmação antes",
    /** Hover text of Release all staff while none of the club's staff can be released. */
    releaseNone: "Nenhum funcionário deste clube pode ser dispensado",
    /** Beside the button: whom it leaves, and where undoing is. */
    hint: "Todos, menos você e a diretoria, saem do clube na hora. Também dá para desfazer na tela Alterações.",
    /** What Release all did, under the button; `count` is how many were released. */
    released: (count: number) =>
      count === 1 ? "1 funcionário dispensado" : `${format(count)} funcionários dispensados`,
    /** A release the game refused: `name` is the member of staff's, `reason` the game's answer. */
    refused: (name: string, reason: string) => `${name}: ${reason}`,
    undo: "Desfazer",
    undoTitle: "Traz de volta ao clube os funcionários dispensados, com os mesmos contratos",

    // The table
    /** The table's name for assistive technology. */
    tableLabel: "Funcionários do clube",
    /** The last column: why a member of staff stays when the rest are released (empty for one who leaves). */
    staysColumn: "Permanece",
    /** The reasons, short; the hover text has the game's answer in full. */
    stays: {
      you: "Você",
      board: "A diretoria",
      player: "Também é jogador",
      held: "Retido pelo clube",
      other: "Não pode ser dispensado",
    },

    // The dialog that asks first
    title: "Dispensar todos os funcionários",
    /** The club the staff leave. */
    from: "Clube",
    /** The headings over those who leave and over those who stay; `count` is how many. */
    leaving: (count: number) => (count === 1 ? "1 sai do clube" : `${format(count)} saem do clube`),
    staying: (count: number) => (count === 1 ? "1 permanece" : `${format(count)} permanecem`),
    /** After the names shown: how many more there are. */
    more: (count: number) => `e mais ${format(count)}`,
    doesHeading: "O que isso faz",
    /** What the release does to each one, one line each. */
    does: [
      "Cada um sai do quadro de funcionários na hora e o contrato termina: desempregados, como os funcionários sem clube do próprio jogo",
      "Ninguém recebe nenhum pagamento",
      "A vaga de treinador ou de diretor de futebol fica vazia, para o clube preencher",
      "Você, a diretoria e quem o editor não pode dispensar permanecem",
      "Listado em Alterações, onde um único desfazer traz todos de volta com os mesmos contratos",
    ],
    /** In the dialog's foot: nothing changes in the game until Release all. */
    dialogHint: "Nada muda no jogo até você clicar em Dispensar todos.",
    release: "Dispensar todos",
    releasing: "Dispensando…",
    cancel: "Cancelar",

    // Moving the whole staff to another club: a button beside Release all staff, and a dialog that asks for the club
    moveAll: "Mover todos os funcionários",
    moveAllTitle: "Move todos os funcionários do clube, menos você e a diretoria, para outro clube; pede confirmação antes",
    /** Hover text of Move all staff while none of the club's staff can be moved. */
    moveNone: "Nenhum funcionário deste clube pode ser movido",
    /** What Move all did, under the button; `count` is how many moved, `club` the club they joined. */
    moved: (count: number, club: string) =>
      count === 1 ? `1 funcionário movido para ${club}` : `${format(count)} funcionários movidos para ${club}`,
    undoMoveTitle: "Traz de volta a este clube os funcionários movidos, com os mesmos contratos",
    moveTitle: "Mover todos os funcionários",
    /** The name of the search box for the club the staff move to, for assistive technology. */
    moveSearch: "Buscar o clube para onde os funcionários vão",
    /** The line under the club in the dialog: before a club is picked, while the move is worked out, and then. */
    movePick: "Escolha o clube para onde os funcionários vão.",
    movePlanning: "Calculando quem pode ser movido…",
    movePlan: (count: number, club: string) =>
      count === 1 ? `1 funcionário vai para ${club}` : `${format(count)} funcionários vão para ${club}`,
    moveNobody: (club: string) => `Nenhum funcionário deste clube pode ir para ${club}.`,
    /**
     * Why one stays when the rest move, short, beyond the reasons a release has (see `stays`); `club` is the club they
     * move to. The hover text has the game's answer in full.
     */
    moveStays: {
      managerTaken: (club: string) => `${club} já tem treinador`,
      directorTaken: (club: string) => `${club} já tem diretor de futebol`,
      yourClub: (club: string) => `Você treina ${club}`,
      other: "Não pode ser movido",
    },
    /** What the move does to each one, one line each. */
    moveDoes: [
      "Cada um entra no novo clube onde fica a função: no departamento médico, de treinamento ou de observação",
      "Mesma função, salário e fim de contrato; cada contrato começa na data do jogo",
      "Um treinador ou diretor de futebol só entra se a vaga no novo clube estiver livre; a vaga deixada aqui fica " +
        "vazia, para o clube preencher",
      "Você, a diretoria e quem o editor não pode mover permanecem",
      "Listado em Alterações, onde um único desfazer traz todos de volta a este clube",
    ],
    /** In the dialog's foot: nothing changes in the game until Move all. */
    moveHint: "Nada muda no jogo até você clicar em Mover todos.",
    move: "Mover todos",
    moving: "Movendo…",
  },

  /** The club list, with the sidebar entry and the status-line count that go with it. */
  clubList: {
    /** The entry in the sidebar. */
    nav: "Clubes",
    /** In the status line, once connected. */
    count: (total: number) => `${format(total)} clubes`,
    search: "Buscar clubes por nome ou UID",
    summary: (total: number, shown: number) =>
      total > shown
        ? `${format(total)} clubes · mostrando os ${shown} primeiros por reputação`
        : `${format(total)} clubes`,
    /** The message under an empty table; `filtered` is whether a filter is in effect. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Nenhum clube corresponde a este filtro." : "Nenhum clube encontrado.";
      }
      return filtered ? `Nenhum clube corresponde a “${query}” com este filtro.` : `Nenhum clube corresponde a “${query}”.`;
    },
    /** The small tag on a women's club. */
    women: "Mulheres",
    columns: {
      name: "Nome",
      nation: "País",
      league: "Liga",
      reputation: "Reputação",
      founded: "Fundação",
      uid: "UID",
    },
    filters: {
      /** The label of the select of which clubs to show. */
      kind: "Clubes a mostrar",
      all: "Todos os clubes",
      men: "Clubes masculinos",
      women: "Clubes femininos",
      nation: "País",
      league: "Liga",
      /** The first entry of the league select. */
      anyLeague: "Qualquer liga",
      /** The hover text of the league select. */
      leagueTitle: "A liga em que o time principal joga nesta temporada",
      reputation: "Reputação",
      /** The hover text of the reputation range. */
      reputationTitle: "De 0 a 10.000, como o jogo guarda",
      /** The names of the two ends of the range, which have no labels of their own. */
      minReputation: "Reputação mínima",
      maxReputation: "Reputação máxima",
    },
  },
  /** The Clubs tab's national teams: each nation's men's and women's team, its senior team's squad and reputation. */
  national: {
    /** The button of the Clubs tab's switch that lists them, and the palette's command to go there. */
    nav: "Seleções",
    /** The name of the Clubs tab's switch between the clubs and the national teams, for assistive technology. */
    switchLabel: "Clubes ou seleções",
    search: "Buscar países por nome, código ou UID",
    summary: (total: number, shown: number) =>
      total > shown ? `${format(total)} seleções · mostrando as ${shown} primeiras por reputação` : `${format(total)} seleções`,
    /** The message under an empty table; `filtered` is whether a filter is in effect. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Nenhuma seleção corresponde a este filtro." : "Nenhuma seleção encontrada.";
      }
      return filtered ? `Nenhuma seleção corresponde a “${query}” com este filtro.` : `Nenhuma seleção corresponde a “${query}”.`;
    },
    /** The small tag on a women's team. */
    women: "Mulheres",
    columns: {
      name: "País",
      code: "Código",
      reputation: "Reputação",
      players: "Jogadores",
      uid: "UID",
    },
    filters: {
      /** The label of the select of which teams to show. */
      kind: "Seleções a mostrar",
      all: "Todas as seleções",
      men: "Seleções masculinas",
      women: "Seleções femininas",
    },
    /** In the header of a profile, by the name. */
    womensTeam: "Seleção feminina",
    mensTeam: "Seleção masculina",
    reputationShort: "REP",
    reputationTitle: "Reputação da seleção principal, de 0 a 10.000",
    youthRatingShort: "JUV",
    youthRatingTitle: "Avaliação da base do futebol desta seleção, de 0 a 200",
    settings: {
      heading: "País",
      note: "Lido do jogo. O fator econômico e o estado de desenvolvimento pertencem ao país, então as seleções masculina e feminina os compartilham.",
      gameImportance: {
        0: "Não definido",
        1: "Muito importante",
        2: "Importante",
        3: "Não muito importante",
        4: "Sem importância",
      } as Partial<Record<number, string>>,
      stateOfDevelopment: {
        0: "Não definido",
        1: "País desenvolvido",
        2: "País em desenvolvimento",
        3: "País menos desenvolvido",
      } as Partial<Record<number, string>>,
    },
    /**
     * The game's names of a nation's teams by the code of their kind, as its national team screens name them; a kind
     * missing here is named by `teamType`. Kind 0 is the senior team.
     */
    teamKinds: { 0: "Seleção principal", 9: "Sub-23", 10: "Sub-21", 18: "Sub-20", 11: "Sub-19", 12: "Sub-18" } as Partial<Record<number, string>>,
    /** A team of a kind the editor has no name for: the game's code for it. */
    teamType: (kind: number) => `Tipo ${kind}`,
    /** The name of the group of buttons that picks one of the nation's teams, for assistive technology. */
    teamsLabel: "Seleções deste país",
    /** The name of the reputation of a team other than the senior one, in the Changes view; `team` is its name. */
    teamReputation: (team: string) => `Reputação (${team})`,
    /** Hover text of the reputation of the team picked, other than the senior one. */
    teamReputationTitle: "Reputação desta seleção, de 0 a 10.000",
    /** Over the squad; `team` is the name of the team picked and `count` how many players it lists. */
    squadHeading: (team: string, count: number) => `${team}: ${format(count)} ${count === 1 ? "jogador" : "jogadores"}`,
    /** The name of the squad table for assistive technology; `team` is the name of the team picked. */
    squadLabel: (team: string) => `Jogadores da seleção: ${team}`,
    squadNote: "Os jogadores que o jogo lista para esta seleção, na ordem dele. Convocações, capitães e o contrato do treinador não são editados aqui.",
    /** What the profile shows of the nation and its federation, read from the game; the staff's heading has how many there are. */
    details: {
      nation: "País",
      founded: "Federação fundada em",
      continent: "Continente",
      staff: (count: number) => `Funcionários da federação (${format(count)})`,
      noStaff: "Nenhum funcionário da federação encontrado.",
      job: "Função na seleção",
      team: "Seleção",
      staffNote: "Lido do jogo; não é editado aqui. A função é a que cada um tem na federação, não em um clube.",
    },
    /** Beside Heal all, Inspire all and Refresh all, which the senior team has: whom they cover, and where undoing is. */
    actionsHint: "As ações valem para todos os jogadores que a seleção principal lista. Também dá para desfazer na tela Alterações.",
    /** For a nation the game keeps no team for. */
    noTeams: "O jogo não guarda seleções para este país, então não há elenco nem reputação para mostrar.",
    reading: "Lendo o elenco…",
    noPlayers: "O jogo não lista jogadores para esta seleção.",
    /** Where the tab cannot show national teams: why, for a version of the game the editor has not been checked with. */
    unavailableTitle: "As seleções não estão disponíveis nesta versão do jogo",
    unavailableBuild: "Ninguém descobriu ainda onde esta versão do jogo guarda as seleções, então o editor não mostra nenhuma para não ler a memória errada.",
    unavailableUnreadable: "O editor procurou as seleções onde espera encontrá-las nesta versão do jogo, mas o que achou não parece ser do jogo, então não mostra nenhuma.",
  },

  /**
   * The Prize money tab: the competitions whose stages pay prize money, what each pays by final position and per match.
   * It only reads; the amounts are kept in pounds and shown in the chosen currency.
   */
  leaguePrizes: {
    /** The heading of the group in a club's Overview, under its finances. */
    title: "Premiação da liga",
    /** Under the heading: the league and its nation. */
    league: (league: string) => `O que ${league} paga nesta temporada`,
    /** While the amounts are read: the editor reads all of the game's memory once. */
    reading: "Lendo a premiação da liga no jogo… Na primeira vez isso pode levar meio minuto ou mais.",
    readAgain: "Ler de novo",
    readAgainTitle: "Lê os valores do jogo de novo: uma fase que começou depois também pode pagar",
    /** When the club's league pays nothing the editor reads. */
    paysNothing: "A liga do clube não paga premiação por posição final nem por jogo nesta temporada.",
    /** The heading of one stage of the league. */
    stageStarted: "Fase em andamento",
    stageFuture: "Fase ainda não iniciada",
    /** Under a stage's heading, when several of its groups (or stages) pay the same. */
    alike: (count: number) => `Os mesmos valores em ${format(count)} grupos ou fases`,
    byPosition: "Por posição final",
    /** A row of the list by position. */
    place: (place: number) => `${format(place)}.`,
    perMatch: "Por jogo",
    win: "Por vitória",
    draw: "Por empate",
    loss: "Por derrota",
    noList: "Nada por posição final.",
    noPerMatch: "Nada por jogo.",
    /** Under the amounts. */
    note: "O que as fases eliminatórias pagam, como o campeão e o vice de uma final, e a taxa de participação de uma competição ainda não são lidos.",
    /** Where the app cannot show prize money: why. */
    unavailableBuild: "Ninguém verificou ainda onde esta versão do jogo guarda a premiação, então o editor não mostra nenhuma para não ler a memória errada.",
    unavailableUnreadable: "O editor procurou a premiação onde espera encontrá-la nesta versão do jogo, mas o que achou não parece ser do jogo, então não mostra nenhuma.",
    /** The button that turns a stage's amounts into inputs. */
    edit: "Alterar valores",
    editTitle: "Altera o que esta fase da liga paga, para todos os clubes dela",
    save: "Salvar valores",
    saving: "Salvando…",
    cancel: "Cancelar",
    /** Under the inputs, and in the (i) beside the button. */
    everyClub: (league: string) =>
      `Isto muda o que ${league} paga a todos os clubes dela, e não só a este. O jogo guarda isso no save, mas só nesta temporada: na próxima, ele define os valores dele de novo. Desfazer em Alterações devolve os valores antigos.`,
    infoLabel: "Por quanto tempo uma mudança na premiação dura",
    /** Under an input that does not hold an amount the editor writes. */
    invalid: (most: string) => `Digite um valor inteiro de 0 a ${most}.`,
    /** Under the inputs, when every amount of the stage would be nothing. */
    allNothing: "Uma fase que não paga nada deixa de ser listada: mantenha pelo menos um valor acima de zero.",
    /** What the Changes view calls a change of the amount for a final position. */
    placeField: (place: number) => `Premiação da liga para a ${format(place)}ª posição`,
    /** In the Changes view, under a change of the prize money: the league, and how many of its groups it changed. */
    changedIn: (league: string, groups: number) =>
      groups > 1 ? `Para todos os clubes de ${league}, em ${format(groups)} grupos` : `Para todos os clubes de ${league}`,
  },

  /**
   * A club's sponsorship deals, in its finances: each deal by the name the game's Sponsorship screen gives its kind, what
   * it pays per season and in all, its term and the change a relegation (or a promotion) brings. It only reads; the
   * amounts are kept in pounds and shown in the chosen currency.
   */
  sponsorships: {
    /** The heading of the group in a club's Overview, under its finances. */
    title: "Contratos de patrocínio",
    reading: "Lendo os contratos de patrocínio do clube…",
    /** When the club holds no deal. */
    none: "O clube não tem contratos de patrocínio.",
    perSeason: "Por temporada",
    total: "Valor total",
    term: "Duração",
    /** The length of a deal, as the game's screen counts it. */
    years: (count: number) => (count === 1 ? "1 ano" : `${format(count)} anos`),
    /** The name of a kind the game's screen is not known to name here. */
    unnamed: (kind: number) => `Tipo ${format(kind)}`,
    unnamedTitle: "Este tipo de contrato ainda não foi associado a um nome na tela do jogo",
    /** A badge on a deal that ended before the game's date. */
    ended: "Encerrado",
    endedTitle: "Encerrado antes da data do jogo: a tela de Patrocínio do jogo não o lista mais",
    /** What a deal's percentage does: on relegation, and for a kit manufacturer on promotion. */
    falls: (percent: number) => `Cai ${format(percent)}% em caso de rebaixamento`,
    rises: (percent: number) => `Sobe ${format(percent)}% em caso de acesso à primeira divisão`,
    /** Under the deals. */
    note: "Somente leitura. Estes são os valores que o jogo guarda para cada contrato. A tela de Patrocínio dele lista os contratos que não terminaram.",
    /** Where the app cannot show the deals: why. */
    unavailableBuild: "Ninguém verificou ainda onde esta versão do jogo guarda os contratos de patrocínio, então o editor não mostra nenhum para não ler a memória errada.",
    unavailableUnreadable: "O editor procurou os contratos de patrocínio onde espera encontrá-los nesta versão do jogo, mas o que achou não parece ser do jogo, então não mostra nenhum.",
  },

  /**
   * The Competitions tab: the competitions that have squad rules, and beside the list the rules of the one picked, this
   * season's and next season's in an area each: how many players of a kind a squad may register or a team may pick.
   * While the game can be written to, the counts can be changed.
   */
  competitions: {
    /** The tab in the masthead, and the palette's command to go there. */
    nav: "Competições",
    search: "Buscar competições por nome, país ou UID",
    summary: (total: number, shown: number) =>
      total > shown ? `${format(shown)} de ${format(total)} competições` : `${format(total)} competições`,
    /** The message under an empty table; `filtered` is whether a nation is picked. */
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Nenhuma competição deste país tem regras de elenco." : "Nenhuma competição com regras de elenco encontrada.";
      }
      return filtered ? `Nenhuma competição corresponde a “${query}” neste país.` : `Nenhuma competição corresponde a “${query}”.`;
    },
    /** While the rules are read: the editor reads all of the game's memory once. */
    reading: "Lendo as regras de elenco das competições no jogo… Isso leva alguns segundos.",
    readAgain: "Ler de novo",
    readAgainTitle: "Lê as regras do jogo de novo",
    /** Under the list. */
    listNote: "Só são listadas as competições disputadas neste save.",
    /** Where the app cannot show the rules: the heading, and why. */
    unavailableTitle: "Sem regras de elenco para mostrar",
    unavailableBuild: "Ninguém verificou ainda onde esta versão do jogo guarda as regras de elenco das competições, então o editor não mostra nenhuma para não ler a memória errada.",
    unavailableUnreadable: "O editor procurou as regras de elenco onde espera encontrá-las nesta versão do jogo, mas o que achou não parece ser do jogo, então não mostra nenhuma.",
    columns: {
      name: "Competição",
      nation: "País",
      level: "Nível",
      rules: "Regras",
      uid: "UID",
    },
    /** In the Level column: the top division is level 1. */
    level: (level: number) => format(level),
    /** In the Rules column: how many rules this season, and next season when its list differs in length. */
    rulesCount: (current: number, next: number | null) =>
      next === null || next === current ? format(current) : `${format(current)} · ${format(next)}`,
    rulesCountTitle: "Regras de elenco desta temporada e, onde há outra quantidade, da próxima",
    /** In the place of a nation, for a continent's competition, and in the filter. */
    international: "Internacional",
    filters: {
      nation: "País",
      allNations: "Todos os países",
    },
    /** The heading of the panel's body, and the line under it. */
    title: "Regras de elenco",
    intro: "Quantos jogadores de um tipo um elenco pode inscrever, ou um time pode escalar numa partida, nesta competição. Quem conta como estrangeiro ou formado no clube é definido pelo próprio jogo.",
    /** The headings of the two areas, and beside each the year the season begins in. */
    seasons: { current: "Esta temporada", next: "Próxima temporada" },
    began: (year: number) => `começou em ${year}`,
    begins: (year: number) => `começa em ${year}`,
    /** In an area with no rules, and in next season's when the game holds no list for it. */
    noRules: "Sem regras de elenco.",
    noNext: "O jogo não tem regras para a próxima temporada.",
    noneGiven: "O jogo não define nenhuma regra de elenco para esta competição, então não há nada para mudar aqui.",
    ruleColumns: {
      rule: "Regra",
      where: "Contado em",
      limit: "Limite",
      value: "Jogadores",
    },
    atMost: "No máximo",
    atLeast: "No mínimo",
    /** Where a rule counts players. */
    scopes: {
      squad: "Elenco",
      matchSquad: "Relacionados",
      eleven: "Onze",
      startingEleven: "Time titular",
      bench: "Banco",
    },
    /** Whom a rule counts, by the game's key for its kind; the ages a kind names are given. */
    who: {
      squadSize: "Jogadores no elenco",
      foreign: "Jogadores estrangeiros",
      foreignExceptAsian: "Jogadores estrangeiros, exceto asiáticos",
      foreignGoalkeepers: "Goleiros estrangeiros",
      nonEu: "Jogadores de fora da UE",
      domestic: "Jogadores nacionais",
      domesticGoalkeepers: "Goleiros nacionais",
      goalkeepers: "Goleiros",
      outfield: "Jogadores de linha",
      nonHomegrown: "Jogadores que não são formados no clube",
      youthContract: "Jogadores com contrato de base",
      fullTime: "Jogadores com contrato de tempo integral",
      amateur: "Jogadores amadores",
      youthOrAmateur: "Jogadores da base ou amadores",
      trialists: "Jogadores em teste",
      loans: "Jogadores emprestados",
      internationals: "Jogadores de seleção",
      otherTeam: "Jogadores inscritos em outro time",
      firstTeam: "Jogadores inscritos no time principal",
      over: (age: number) => `Jogadores com mais de ${format(age)} anos`,
      under: (age: number) => `Jogadores com menos de ${format(age)} anos`,
      domesticUnder: (age: number) => `Jogadores nacionais com menos de ${format(age)} anos`,
      foreignOver: (age: number) => `Jogadores estrangeiros com mais de ${format(age)} anos`,
      goalkeepersOver: (age: number) => `Goleiros com mais de ${format(age)} anos`,
      outfieldOver: (age: number) => `Jogadores de linha com mais de ${format(age)} anos`,
      /** Trained at the club, in the nation, or at either, between two ages. */
      homegrown: (from: "club" | "nation" | "clubOrNation", fromAge: number, toAge: number) => {
        const ages = `formados entre ${format(fromAge)} e ${format(toAge)} anos`;
        if (from === "club") {
          return `Formado no clube (${ages})`;
        }
        return from === "nation" ? `Formado no país (${ages})` : `Formado no clube ou no país (${ages})`;
      },
      /** The same in the nation, for players under an age. */
      homegrownUnder: (age: number, fromAge: number, toAge: number) =>
        `Sub-${format(age)} formados no país (formados entre ${format(fromAge)} e ${format(toAge)} anos)`,
    },
    /** A rule of a kind the game gives no name. */
    unnamedKind: (kind: number) => `Regra do tipo ${format(kind)}`,
    /** The hover text of a rule's name: the game's own key for the kind. */
    gameKey: (key: string) => `Nome desta regra no jogo: ${key}`,
    /** The small tag under a rule that holds for some teams, or under a condition of the game's. */
    teamsFrom: (competition: string) => `Times de ${competition}`,
    teamsFromUnknown: "Times de outra divisão",
    condition: (code: string) => `Condicional (${code})`,
    conditionTitle: "O jogo aplica esta regra sob uma condição própria, que o editor ainda não explica.",
    /** The years the nation's rules give a rule, where they give any. */
    years: (from: number | null, to: number | null) => {
      if (from !== null && to !== null) {
        return from === to ? `${from}` : `${from}–${to}`;
      }
      return from !== null ? `a partir de ${from}` : `até ${to}`;
    },
    yearsTitle: "As temporadas para as quais as regras do país dão esta regra, pelo ano em que a temporada começa",
    /** In the place of an input, for a rule the editor leaves alone, and why. */
    leftAlone: "Mantido",
    notSavedTitle:
      "O save não guarda essa regra, então uma mudança sumiria ao carregá-lo: o editor a mantém como está",
    notACountTitle: "Um valor em dinheiro, não uma contagem de jogadores: o editor o mantém como está.",
    /** Over the areas, when the editor changes none of the competition's rules: why, and that no date changes it. */
    noneChangeable: "Estas regras ainda não podem ser alteradas, em nenhuma data: o editor só muda uma regra onde a encontra nas regras que o save guarda, para que a mudança continue lá quando o save for carregado, e ele não achou as desta competição. Por enquanto isso vale para as ligas femininas, a Major League Soccer e algumas copas.",
    /**
     * In the place of `lasts`, for a competition whose rules the game keeps in no record (UEFA's Champions League): the
     * editor holds a change of them. The small tag under a rule it holds, and the tag's hover text with the game's own
     * count.
     */
    unsavedNote: "O jogo não guarda as regras desta competição em nenhum save: ele as monta sozinho a cada vez que carrega um e de novo a cada nova temporada. Por isso o editor retém a mudança aqui: grava no jogo em execução, lembra dela nesta carreira e grava de novo sempre que conecta ou lê os dados outra vez. Depois de carregar um save, conecte o editor (ou clique em Recarregar dados) uma vez para a mudança voltar. Desfazer em Alterações a solta.",
    heldTag: "Retido",
    heldTitle: (original: number) =>
      `O editor retém esta contagem e a grava de novo quando lê o jogo; a do próprio jogo é ${format(original)}`,
    /** Under a rule whose count in the save's rules is another than the list's. */
    savedDiffers: (value: number) => `As regras do save indicam ${format(value)}`,
    savedDiffersTitle:
      "O jogo joga pela lista e a monta a partir das regras do save ao carregar; uma mudança aqui altera as duas",
    /** The button that turns the counts into inputs, and the ones under them. */
    edit: "Alterar regras",
    editTitle: "Altera as contagens das regras de elenco desta competição",
    save: "Salvar regras",
    saving: "Salvando…",
    cancel: "Cancelar",
    /** Under an input that does not hold a count the editor writes. */
    invalid: (most: number) => `Digite um número inteiro de 0 a ${format(most)}.`,
    /** Over the areas, when other competitions are played under the same lists: their names. */
    shared: (names: string) => `Estas regras também são as de ${names}: uma mudança vale para elas também.`,
    /**
     * Under each area: how long a change of it holds, and when the game shows it. `turn` is the day the nation's seasons
     * turn on ("20 June") where its rules give one. Seen over a turn of the season: this season's change is gone with
     * it, next season's becomes this season's and stays, unless the nation has another rule (the Süper Lig's on
     * foreign players over 24 from 2028) or another file of rules (England's from 2028) for a later season.
     */
    currentNote: (turn: string | null) =>
      `Uma mudança aqui vale pelo resto desta temporada${turn === null ? "" : `, que vira em ${turn}`}. O jogo passa a contar os elencos por ela na hora; as telas dele a mostram depois que um dia passar.`,
    nextNote: (turn: string | null) =>
      `Uma mudança aqui vira a regra desta temporada quando a temporada vira${turn === null ? "" : ` em ${turn}`}, e vale para as seguintes, a menos que o jogo tenha regras próprias para uma posterior. A página Próxima Temporada do jogo a mostra na hora.`,
    /** Under the areas, and in the (i) beside the button. */
    lasts: "Uma mudança é gravada na lista pela qual o jogo joga e nas regras do país que o save guarda, então volta quando o save é carregado. Uma mudança na regra desta temporada termina quando a temporada vira: as regras da próxima ocupam o lugar. Desfazer em Alterações devolve a contagem antiga.",
    infoLabel: "Por quanto tempo uma mudança em uma regra de elenco dura",
    /** What the Changes view calls a change of a rule: the season, and the rule. */
    ruleField: (season: string, rule: string) => `Regra de elenco, ${season.toLowerCase()}: ${rule}`,
    /** In the Changes view, under a change of a rule: how many other competitions it is for too. */
    alsoFor: (count: number) =>
      count === 1 ? "Vale também para outra competição com as mesmas regras" : `Vale também para outras ${format(count)} competições com as mesmas regras`,
  },

  /** The app around the lists: the sidebar, the status line and the connect panel. */
  app: {
    /** The small line under the name in the sidebar. */
    stage: "beta",
    /** The settings menu at the right of the masthead: its name, and the headings of its two lists. */
    settingsLabel: "Configurações",
    languageLabel: "Idioma",
    currencyLabel: "Moeda",

    // The note at the foot of the sidebar; which one shows depends on the connection (see `ConnectionInfo.editable`).
    /** Connected, and the game was opened for writing. */
    noteEditable: "As edições só chegam ao jogo quando você as aplica. Faça backup do seu save antes.",
    /** Connected, but Windows did not allow writing. */
    noteReadOnly: "Somente leitura: o Windows não permitiu que o FMLibreEditor gravasse no jogo.",
    /** Read-only because the game is a version FMLibreEditor was not checked with (see `compatibility`). */
    noteUnknownBuild: "Somente leitura: esta versão do jogo é nova para o FMLibreEditor.",
    noteNotConnected: "Nada muda no jogo até você editar e aplicar.",

    // The status line and the busy texts beside it
    notConnected: "Desconectado",
    /** Beside the status line in a plain browser, where fixtures stand in for the game. */
    previewTag: "prévia no navegador · dados de exemplo",
    /** In place of the game's date when it could not be read, and the note it shows on hover. */
    noDate: "Sem data no jogo",
    noDateTitle:
      "Não foi possível ler a data do jogo: as idades não são mostradas e os filtros de idade não encontram ninguém. Verifique se há atualizações.",
    /** The button that reads the game again, once connected. */
    reload: "Recarregar dados",
    /** The button that looks for the game again, while not connected. */
    refresh: "Atualizar",
    detecting: "Procurando o Football Manager…",
    connecting: "Lendo jogadores, funcionários e clubes…",
    reloading: "Recarregando jogadores, funcionários e clubes…",

    /**
     * The notice under the masthead once the game has loaded a save, or gone back to its main menu, since the data was
     * read (`SaveChangedNotice`), beside a Reload data button.
     */
    saveChanged: {
      title: "O save do jogo mudou",
      text:
        "O jogo carregou um save, ou voltou ao menu principal, desde que o FMLibreEditor o leu. Até você recarregar os " +
        "dados, ele não altera nada no jogo e não mantém nada congelado: o que ele mostra pode ser de outro save.",
    },

    /** The notice after connecting to a save in which something was frozen before (`FrozenNotice`). */
    refrozen: {
      title: "Congelado de novo, como da última vez",
      /** When nothing could be frozen again. */
      waitingTitle: "O que estava congelado fica em espera por ora",
      /** `names` are the players' names, set apart by commas. */
      players: (names: string) => `Atributos: ${names}`,
      staff: (names: string) => `Atributos de funcionários: ${names}`,
      clubs: (names: string) => `Dinheiro: ${names}`,
      fitness: (names: string) => `Energia e ritmo de jogo: ${names}`,
      positions: (names: string) => `Posições: ${names}`,
      /** `names` are the stadiums' new names, given again. */
      stadiums: (names: string) => `Nomes de estádios: ${names}`,
      /** After the first few names. */
      more: (count: number) => `e mais ${format(count)}`,
      /** What was left for later: an update of the game, say. */
      waiting: (count: number) =>
        `${count === 1 ? "1 item está lembrado" : `${format(count)} itens estão lembrados`}, mas não ${count === 1 ? "congelado" : "congelados"} agora: o FMLibreEditor ainda não consegue gravar ` +
        "nesta versão do jogo.",
      dismiss: "Fechar",
    },

    /** The (i) beside every box that freezes something: how freezing works, and that the app has to stay open. */
    freezeInfo: {
      label: "Como funciona o congelamento?",
      note:
        "Congelar não muda o jogo para sempre: a cada 2 segundos, o FMLibreEditor recoloca o que o jogo tirou. Por isso " +
        "só funciona enquanto o app está aberto e conectado; feche-o e o jogo volta a alterar esses valores. O app lembra " +
        "o que está congelado neste save e congela de novo na próxima vez que se conectar a ele.",
    },

    /** The panel shown while not connected. */
    connect: {
      title: "Conectar ao Football Manager 27",
      intro: "O FMLibreEditor lê a memória do jogo enquanto ele roda. Abra o jogo e carregue um save; depois conecte.",
      notRunning: "O Football Manager 27 não está em execução.",
      /** `error` is the answer of the Rust side, which stays in English. */
      openFailed: (error: string) => `Não foi possível abrir o jogo: ${error}`,
      game: "Jogo",
      gameData: "Dados do jogo",
      loaded: "Carregados",
      stillLoading: "Ainda carregando; espere o menu principal",
      process: "Processo",
      pid: (pid: number) => `pid ${pid}`,
      several: "Há várias cópias do jogo em execução; a primeira é usada.",
      button: "Conectar e ler jogadores, funcionários e clubes",

      /** macOS: the bridge FM27 has to load before the app can reach it, and setting it up. */
      bridge: {
        title: "A ponte (macOS)",
        intro:
          "O macOS não deixa nenhum app entrar na memória de outro, então o FM27 precisa entregar a própria memória. Ele faz isso quando " +
          "carrega a ponte do FMLibreEditor: uma pequena biblioteca que não intercepta nem altera nada no jogo e entrega a memória " +
          "somente a este app. Uma opção de inicialização na Steam faz o FM27 carregá-la.",
        library: "Ponte",
        installed: "Instalada",
        missing: "Não instalada",
        launchOption: "Opção de inicialização",
        set: "Definida na Steam",
        notSet: "Não definida",
        ready: "Configurada. Inicie o FM27 pela Steam (feche e abra de novo se estiver em execução), carregue um save e conecte.",
        steamRunning:
          "A Steam está aberta e mantém as opções de inicialização enquanto isso. Feche a Steam para que a opção seja definida " +
          "para você, ou digite-a você mesmo na Steam.",
        setUp: "Configurar a ponte",
        remove: "Remover a ponte",
        manual: "Ou, na Steam, clique com o botão direito em Football Manager 27 › Propriedades › Geral › Opções de Inicialização e digite:",
        copy: "Copiar",
        copied: "Copiado",
      },
    },
  },

  /** The graphics packs the pictures (club logos, faces, flags) come from: their status at the foot of the sidebar. */
  graphics: {
    /** While the app is still reading the packs, which takes a moment after it starts. */
    reading: "Lendo pacotes gráficos…",
    /** What the packs hold: "Graphics: 68,131 club logos · 250 flags · 0 faces". */
    summary: ({ clubLogos, flags, faces }: Pick<GraphicsCounts, "clubLogos" | "flags" | "faces">) =>
      `Gráficos: ${format(clubLogos)} ${clubLogos === 1 ? "escudo" : "escudos"} · ` +
      `${format(flags)} ${flags === 1 ? "bandeira" : "bandeiras"} · ${format(faces)} ${faces === 1 ? "rosto" : "rostos"}`,
    /** When the app found no pack, and under it where packs go. The folder itself is the hover text of both lines. */
    none: "Nenhum pacote gráfico encontrado",
    noneHint: "Pacotes de escudos e rostos vão na pasta de gráficos do FM27.",
  },

  /**
   * The notice under the masthead when the game is a version FMLibreEditor has no profile for, or some of the checks
   * it makes before writing did not pass (`CompatibilityNotice`).
   */
  compatibility: {
    /** The headline for a version without a profile; `game` as the status line names it. */
    unknownBuild: (game: string) => `O FMLibreEditor ainda não foi verificado com ${game}`,
    unknownBuildText:
      "O jogo provavelmente foi atualizado. O FMLibreEditor encontrou os dados do jogo e os conferiu, mas não " +
      "grava em uma versão com a qual não foi testado até você permitir. Uma nova versão do FMLibreEditor costuma sair em poucos dias.",
    /** The headline when checks did not pass on a version the editor knows or may edit, and what may help. */
    failedTitle: "Alguns dados do jogo não conferiram",
    reloadHint: "Se um save ainda estava carregando, Recarregar dados confere de novo.",
    /** The in-game date did not check out: shown apart, as it leaves nothing read-only. */
    noDate: "A data do jogo não conferiu, então nenhuma idade é mostrada.",
    /** The other checks that did not pass, joined (see `join`), each as `failedCheck` words it. */
    failed: (names: string) => `Mantido somente leitura: ${names}.`,
    /** A check that did not pass: its name (see `checks`), and how many of the people or clubs it sampled fit. */
    failedCheck: (name: string, fit: number, sampled: number) => `${name} (${format(fit)} de ${format(sampled)} conferem)`,
    /** Joins the names of the checks that did not pass. */
    join: (names: string[]) =>
      names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`,
    allow: "Editar mesmo assim",
    allowTitle: "Liga a edição até o app ser fechado ou conectar de novo. Faça backup do seu save antes.",
  },

  /**
   * Copy diagnostics, at the foot of the window and in the notice under the masthead: copies a report of what the app
   * found in the game, in English whatever the language, to paste into a bug report (`CopyDiagnostics`).
   */
  diagnostics: {
    copy: "Copiar diagnóstico",
    copyTitle: "Copia o que o app encontrou no jogo, para um relato de erro; não contém nomes nem caminhos",
    /** Said by the button for a moment once the report is on the clipboard. */
    copied: "Copiado",
    failed: (reason: string) => `Não foi possível copiar o diagnóstico: ${reason}`,
  },

  /** What each check is about (`CheckKey`), as the notice lists the ones that did not pass and the errors name them. */
  checks: {
    gameDate: "a data do jogo",
    players: "dados dos jogadores",
    positions: "posições",
    attributes: "atributos",
    personality: "personalidade",
    liveValues: "energia, ritmo de jogo, cansaço acumulado e moral",
    contracts: "contratos",
    teams: "times",
    staff: "funcionários",
    clubs: "clubes",
    cohesion: "entrosamento com os clubes",
    tactics: "familiaridade tática",
  } satisfies Record<CheckKey, string>,

  /** New versions: the notice under the masthead, and the version and Check for updates at the foot of the window. */
  update: {
    /** The notice's headline, and what a check by hand found. */
    available: (version: string) => `O FMLibreEditor ${version} está disponível`,
    youHave: (version: string) => `Você está com a ${version}.`,
    /** Opens the release's page in the browser. */
    download: "Baixar",
    /** Downloads the new version's installer and runs it, where the app can update itself (see `can_self_update`). */
    install: "Atualizar",
    installTitle: "Baixa e instala a nova versão; o app fecha e abre de novo com ela",
    preparing: "Preparando…",
    /** `percent` is null while the size of the download is not known. */
    downloading: (percent: number | null) => (percent === null ? "Baixando…" : `Baixando… ${percent}%`),
    installing: "Instalando: o FMLibreEditor fecha e abre de novo com a nova versão.",
    installFailed: (reason: string) => `Não foi possível atualizar: ${reason}. Baixe-a na página dela.`,
    notInstallable: "Esta versão não pode ser instalada daqui. Baixe-a na página dela.",
    /** Hides the notice until the app starts again. */
    later: "Depois",
    check: "Verificar atualizações",
    checking: "Verificando atualizações…",
    upToDate: "Você está com a versão mais recente.",
    failed: "Não foi possível verificar atualizações.",
  },

  /** Once, after a few starts: the note in the top right corner that asks for a star on GitHub (see `StarRequest`). */
  star: {
    title: "Gostando do FMLibreEditor?",
    text: "Uma estrela no GitHub ajuda o projeto a chegar a mais jogadores e crescer mais rápido.",
    /** Opens the project's page on GitHub, where the star is; the note does not come back. */
    star: "Dar estrela no GitHub",
    /** Puts the note away for good. */
    dismiss: "Não, obrigado",
  },

  /** Editing a person or a club: the Edit button, the inputs, and the footer under the profile. */
  edit: {
    /** A nation field's value whose name the app has not read: one no one in the lists belongs to. */
    unknownNation: "País desconhecido",
    unknownCity: "Cidade desconhecida",
    /** The button in the header of a profile that can be edited. */
    edit: "Editar",
    editTitle: "Altera os valores deste perfil no jogo",
    /** Why editing did not start: the field table or the values could not be read. */
    startFailed: (reason: string) => `Não foi possível iniciar a edição: ${reason}`,
    /** The name of a position's field, e.g. "ST rating"; `position` is its entry in `positions`. */
    positionRating: (position: string) => `Avaliação de ${position}`,
    /** Hover text of a changed input: the value it started from, as shown. */
    was: (value: string) => `era ${value}`,
    /** Hover text of an input that cannot be applied; `min` and `max` are the values it takes, as shown. */
    invalid: (min: number, max: number) => `Digite um número inteiro de ${min} a ${max}`,
    /** The same for a date input; `from` and `to` are the earliest and the latest date it takes, as dates are shown. */
    invalidDate: (from: string, to: string) => `Digite uma data de ${from} a ${to}`,
    /**
     * The same for an amount of money, in whole units of the chosen currency; `from` and `to` are the least and the
     * most it takes, as amounts are shown.
     */
    invalidMoney: (from: string, to: string) => `Digite um valor inteiro de ${from} a ${to}`,
    /** The same for a percentage, in whole percent; `from` and `to` are the least and the most it takes, as shown. */
    invalidPercentage: (from: string, to: string) => `Digite uma porcentagem inteira de ${from} a ${to}`,
    /** After the input of a percentage: the game shows energy and match sharpness as 0–100%. */
    percent: "%",
    /** The two values of a yes-or-no field, as the lists of changes and the hover text of its checkbox say them. */
    yes: "Sim",
    no: "Não",
    /**
     * What an input that may be left empty reads as then, in its hint, the hover text and the lists of changes:
     * "Squad number 20 → none". The profile itself shows a dash for it (`profile.none`).
     */
    none: "nenhum",

    // The footer
    footer: "Editando",
    changes: changeCount,
    /** After the number of changes, while some inputs hold values that cannot be applied. */
    invalidCount: (count: number) => (count === 1 ? "1 inválido" : `${count} inválidos`),
    /** Opens the list of the changes Apply would write. */
    review: "Revisar",
    reviewList: "Alterações a aplicar",
    /** Puts the inputs back to the values the game has. */
    discard: "Descartar",
    apply: "Aplicar",
    applying: "Aplicando…",
    /** Hover text of Apply while an input holds a value that cannot be written. */
    applyBlocked: "Corrija antes os valores inválidos",
    /** Leaves edit mode. */
    done: "Concluir",
    /** Takes the place of the buttons when leaving (Done, close, another row) would lose `count` changes. */
    confirmDiscard: (count: number) => `Descartar ${changeCount(count)}?`,
    keepEditing: "Continuar editando",

    // After Apply
    applied: (count: number) => `Aplicado: ${changeCount(count)}`,
    /** Every value asked for was the game's already. */
    nothingToChange: "Nada a alterar: o jogo já tem esses valores.",
    /** A change the game refused; `label` is the field's name (see `fieldLabel`) and `reason` the game's answer. */
    refused: (label: string, reason: string) => `${label}: ${reason}`,
    rereadFailed: (reason: string) => `Não foi possível reler os valores: ${reason}`,
    dismiss: "Fechar",
  },

  /** The Changes view: what was written to the game this session. */
  changes: {
    /** The entry in the sidebar. */
    nav: "Alterações",
    title: "Alterações",
    hint: "Mais recentes primeiro. O app guarda as alterações de cada carreira, então elas aparecem de novo após reiniciar. Uma alteração só pode ser desfeita enquanto o jogo ainda mantém o valor que ela gravou.",
    /** Under the hint, when the list holds changes from earlier sessions: how many, and how many of them the game did not hold. */
    earlierNote: (count: number, missing: number) =>
      `${changeCount(count)} de sessões anteriores` +
      (missing > 0 ? `, ${format(missing)} delas fora do jogo quando os dados foram lidos` : "") +
      ". Transferências, curas, vínculos, cláusulas e nomes entre elas ficam como histórico, sem Desfazer.",
    /** The small tag after the name of an earlier change, and its hover text. */
    earlierTag: "Anterior",
    earlierTitle: "Gravada antes da última conexão do app e mantida no histórico desta carreira",
    /** Under the status of an earlier change: whether the game held its value when the data was last read. */
    inGame: "No jogo",
    inGameTitle: "O jogo tinha este valor quando os dados foram lidos pela última vez",
    notInGame: "Fora do jogo",
    notInGameTitle:
      "Fora do jogo na última leitura dos dados: não foi salva após a alteração ou foi mudada pelo jogo depois",
    /** In the place of Undo for an earlier change that cannot be undone from here, and its hover text. */
    historyOnly: "Histórico",
    historyOnlyTitle: "Feita antes da última conexão do app: desfazê-la exigiria a memória do jogo como estava naquele momento",
    /** Under a mass edit: how many of its earlier changes the game did not hold. */
    batchNotInGame: (count: number) => `${format(count)} fora do jogo`,
    /** Empties the list and the history of the career; the question that asks first, and its two answers. */
    clearHistory: "Limpar histórico",
    clearHistoryTitle: "Esvazia esta lista e esquece o histórico desta carreira; as alterações continuam no jogo",
    confirmClear: "Limpar o histórico desta carreira? As alterações continuam no jogo, mas não poderão mais ser desfeitas por aqui.",
    keepHistory: "Manter",
    clearConfirm: "Limpar",
    /** Under the hint: a change shows in the game only after it has moved on once. */
    continueHint: "O jogo mostra uma alteração depois que avança: clique em Continuar no jogo.",
    /** Under a move to another club that was a swap: the player who went the other way. */
    swappedWith: (name: string) => `Trocado com ${name}`,
    /** Under a move that released a player of the new club to make room: that player. */
    released: (name: string) => `${name} dispensado`,
    /** Under a transfer that had a fee: the amount, written out. */
    fee: (amount: string) => `Valor: ${amount}`,
    /** Under a transfer arranged for the game to make: the day it moves him (and pays the fee). */
    arranged: (date: string) => `O jogo faz a transferência em ${date}`,
    /** Under a loan arranged for the game to make: the day it sends him there, and the loan's last day. */
    arrangedLoan: (day: string, until: string) => `O jogo faz o empréstimo em ${day}, até ${until}`,
    /** Under a recall from loan that took the loan's option to buy away, which its undo writes back. */
    optionRemoved: (amount: string) => `Opção de compra (${amount}) removida`,
    /** What a heal changed, in the place of its values: `count` is how many injuries the player had. */
    healed: (count: number) => (count === 1 ? "1 lesão curada" : `${format(count)} lesões curadas`),
    /** The same for lifting bans: `count` is how many bans the player had. */
    lifted: (count: number) => (count === 1 ? "1 suspensão cancelada" : `${format(count)} suspensões canceladas`),
    /** What keeping a player from retiring changed: the date he was to retire on, or none when only his traits changed. */
    keptPlaying: (date: string | null) => (date === null ? "Continuará jogando" : `Aposentadoria em ${date} impedida`),
    /** The line beside the title; `undone` of the `total` changes were undone. */
    count: (total: number, undone: number) => {
      const count = changeCount(total);
      return undone === 0 ? count : `${count} · ${undone === 1 ? "1 desfeita" : `${undone} desfeitas`}`;
    },
    empty: "Nenhuma alteração ainda. Abra um jogador, um funcionário ou um clube e escolha Editar, ou use Edição em massa em uma lista.",
    columns: {
      time: "Hora",
      /** The player, member of staff or club the change was made to. */
      name: "Nome",
      field: "Campo",
      change: "Alteração",
      status: "Status",
    },
    /** The small tag after a name. */
    kinds: {
      player: "Jogador",
      staff: "Funcionário",
      club: "Clube",
      nationalTeam: "Seleção",
      competition: "Competição",
    } satisfies Record<EditEntity, string>,
    /** Hover text of a change of an attribute: the values as stored; `change` is from `valueChange`. */
    stored: (change: string) => `armazenado ${change}`,
    undone: (time: string) => `Desfeita às ${time}`,
    undo: "Desfazer",
    /** Hover text of Undo; `label` is the field's name. */
    undoTitle: (label: string) => `Grava de volta no jogo o valor antigo de ${label}`,
    /** The small tag after the fields a mass edit changed: a mass edit is one row of the list. */
    batch: "Edição em massa",
    /** Under those fields: how many changes the mass edit made, and how many of them are not undone. */
    batchCount: (total: number, remaining: number) =>
      remaining === 0
        ? `${changeCount(total)} · todas desfeitas`
        : `${changeCount(total)} · ${format(remaining)} não desfeitas`,
    /** Opens the list of the changes of a mass edit under its row, and closes it again. */
    showChanges: "Mostrar alterações",
    hideChanges: "Ocultar alterações",
    /** Undoes the whole mass edit. */
    undoBatch: "Desfazer edição em massa",
    /** Hover text of Undo mass edit; `remaining` is how many of its changes are not undone yet. */
    undoBatchTitle: (remaining: number) =>
      `Grava de volta no jogo os valores antigos desta edição em massa (${format(remaining)} ainda em vigor)`,

    // Pages: the list, and the changes of a mass edit that is open, are shown a page at a time.
    /** The names of the two groups of buttons for assistive technology. */
    pages: "Páginas da lista",
    batchPages: "Páginas das alterações desta edição em massa",
    previous: "Anterior",
    next: "Próxima",
    /** Between the buttons: the rows on show and how many there are, e.g. "101–200 of 450". */
    range: (first: number, last: number, total: number) => `${format(first)}–${format(last)} de ${format(total)}`,

    // Search and filters
    /** The search box: what it looks through. Its name for assistive technology is the same. */
    searchPlaceholder: "Buscar alterações por nome, UID, campo ou clube",
    /** The name of the three buttons that choose which sessions' changes are listed, for assistive technology. */
    sessionGroup: "Sessão",
    sessions: { all: "Todas", this: "Esta sessão", earlier: "Sessões anteriores" } satisfies Record<SessionChoice, string>,
    /** The check boxes: only changes still in place, and only earlier ones the game did not hold; their hover text. */
    notUndone: "Não desfeitas",
    notUndoneTitle: "Só as alterações que ainda estão em vigor",
    notInGameFilterTitle: "Só as alterações anteriores que o jogo não tinha na última leitura dos dados",
    /** Takes the search text and every choice away. */
    clearFilter: "Limpar filtro",
    /** The line beside the title while a search or a filter is on: `matching` of the `total` changes, `undone` of those undone. */
    filteredCount: (matching: number, total: number, undone: number) => {
      const count = `${format(matching)} de ${changeCount(total)}`;
      return undone === 0 ? count : `${count} · ${undone === 1 ? "1 desfeita" : `${format(undone)} desfeitas`}`;
    },
    /** Under a mass edit while a search or a filter is on: how many of its changes they leave. */
    batchMatching: (matching: number, total: number) => `${format(matching)} de ${format(total)} correspondem`,
    /** In the place of the list when the search and the filters leave no change. */
    noMatches: "Nenhuma alteração corresponde à busca e aos filtros.",
  },

  /** Exporting players or clubs to a file: the button in the toolbar of the player and club lists and its dialog. */
  export: {
    button: "Exportar",
    buttonTitle: {
      player: "Grava os jogadores exibidos na lista em um arquivo CSV ou JSON",
      staff: "Grava os funcionários exibidos na lista em um arquivo CSV ou JSON",
      club: "Grava os clubes exibidos na lista em um arquivo CSV ou JSON",
    } satisfies Record<ExportEntity, string>,
    title: { player: "Exportar jogadores", staff: "Exportar funcionários", club: "Exportar clubes" } satisfies Record<
      ExportEntity,
      string
    >,
    /** What the export covers: everything the list's search and filters select, in its order. */
    scope: (entity: ExportEntity, count: number) =>
      count === 0
        ? `Nenhum ${({ player: "jogador", staff: "funcionário", club: "clube" } as const)[entity]} corresponde à busca e aos filtros.`
        : `${entityCount[entity](count)}: o que a busca e os filtros da lista selecionam, na ordem dela.`,
    formatLabel: "Formato",
    formats: {
      csv: "CSV, separado por vírgulas",
      csvSemicolon: "CSV, separado por ponto e vírgula",
      json: "JSON",
    } satisfies Record<ExportFormat, string>,
    formatHints: {
      csv: "Para a maioria das planilhas e scripts",
      csvSemicolon: "Para o Excel em que os decimais são escritos com vírgula, como em português, espanhol ou alemão",
      json: {
        player: "Para scripts: posições, atributos e personalidade como objetos próprios",
        staff: "Para scripts: atributos, personalidade e contrato como objetos próprios",
        club: "Para scripts: torcida, instalações, estádio e finanças como objetos próprios",
      } satisfies Record<ExportEntity, string>,
    },
    contents: {
      player:
        "Habilidades, posições e avaliações de posição de cada jogador, atributos na escala de 1 a 20 (inclusive os ocultos), " +
        "personalidade, reputação, jogos pela seleção e contrato com as cláusulas, com a data do jogo. O dinheiro está em " +
        "libras, como o jogo guarda. Nada muda no jogo.",
      staff:
        "Função e empregador de cada funcionário, habilidades, atributos na escala de 1 a 20, personalidade, reputação " +
        "e contrato (salário e datas), com a data do jogo. O dinheiro está em libras, como o jogo guarda. Nada " +
        "muda no jogo.",
      club:
        "País, liga, reputação, ano de fundação, sócios-torcedores, seguidores nas redes sociais, perfil e traços da " +
        "torcida, " +
        "instalações, estádio e finanças de cada clube: saldo, orçamento de transferências, gasto semanal com salários e orçamento salarial, e preço " +
        "do ingresso, com a data do jogo. O FM guarda finanças apenas dos clubes das ligas que estão sendo jogadas. O dinheiro está em " +
        "libras, como o jogo guarda. Nada muda no jogo.",
    } satisfies Record<ExportEntity, string>,
    export: "Exportar",
    exporting: "Exportando…",
    /** After the export: what was written, and where. */
    done: (entity: ExportEntity, count: number, file: string) => `Exportado: ${entityCount[entity](count)} em ${file}`,
    folder: (folder: string) => `em ${folder}`,
    skipped: (entity: ExportEntity, count: number) => {
      const changedWord = count === 1 ? "mudou" : "mudaram";
      return (
        `${entityCount[entity](count)} ${changedWord} no jogo durante a leitura e ` +
        `${count === 1 ? "ficou" : "ficaram"} de fora.`
      );
    },
    open: "Abrir",
    openTitle: "Abre o arquivo no app com que o sistema o abre",
    show: "Mostrar na pasta",
    showTitle: "Mostra o arquivo na pasta dele",
    close: "Fechar",

    /** The export of the Changes view: a CSV file of the changes its search and filters show. */
    changes: {
      buttonTitle: "Grava as alterações exibidas na lista em um arquivo CSV",
      title: "Exportar alterações",
      /** What the export covers: everything the list's search and filters select, or, with none on, the whole history. */
      scope: (count: number, filtering: boolean) =>
        count === 0
          ? "Nenhuma alteração corresponde à busca e aos filtros."
          : filtering
            ? `${changeCount(count)}: o que a busca e os filtros selecionam, mais recentes primeiro.`
            : `${changeCount(count)}: todo o histórico desta carreira, mais recentes primeiro.`,
      contents:
        "Hora de cada alteração (local, com o desvio em relação ao UTC), nome e UID, o campo, os valores antigo e novo como " +
        "o jogo os guarda e como aparecem aqui, o que a lista diz sob eles, a edição em massa de que fez parte, quando " +
        "foi desfeita e se é de uma sessão anterior e está no jogo. Nada muda no jogo.",
      done: (count: number, file: string) => `Exportado: ${changeCount(count)} em ${file}`,
    },
  },

  /** Mass editing: the button in the toolbar of a list and the dialog it opens. */
  massEdit: {
    /** The button in the toolbar of the player, staff and club lists. */
    button: "Edição em massa",
    buttonTitle: "Altera valores de tudo o que a lista mostra, com uma prévia antes",
    title: {
      player: "Edição em massa de jogadores",
      staff: "Edição em massa de funcionários",
      club: "Edição em massa de clubes",
    } satisfies Record<Entity, string>,

    // What it applies to
    /** `total` is the list's: the search and the filters of the list select them. */
    scope: (entity: Entity, total: number) =>
      `${entityCount[entity](total)} exibidos agora na lista (busca e filtros)`,
    /** After the scope, when the list shows only the first `shown` rows of its `total`. */
    scopeAll: (shown: number) => `São todas as correspondências, não só as ${format(shown)} primeiras linhas na tela.`,
    scopeNone: (entity: Entity) =>
      `Não há ${entityNouns[entity]} que correspondam à busca e aos filtros, então não há nada a alterar.`,
    /** `limit` is the most one mass edit takes. */
    scopeTooMany: (entity: Entity, total: number, limit: number) =>
      `${entityCount[entity](total)} exibidos na lista são mais do que uma edição em massa aceita (${format(limit)}). ` +
      "Restrinja antes a busca ou os filtros.",
    loadingFields: "Lendo os campos…",
    fieldsFailed: (reason: string) => `Não foi possível ler os campos: ${reason}`,

    // The fields to change
    /** The groups of the field select, in the order the dialog lists them. */
    groups: {
      ability: "Habilidade",
      technical: "Atributos técnicos",
      mental: "Atributos mentais",
      physical: "Atributos físicos",
      goalkeeping: "Atributos de goleiro",
      hidden: "Atributos ocultos",
      feet: "Pés",
      coaching: "Atributos de treinamento",
      knowledge: "Atributos de conhecimento",
      medical: "Atributos médicos",
      positions: "Posições",
      personality: "Personalidade",
      reputation: "Reputação",
      international: "Seleção",
      contract: "Contrato",
      facilities: "Instalações",
      finances: "Finanças",
      stadium: "Estádio",
      traits: "Traços",
      /** A player's energy, match sharpness and morale: the Medical group of his profile. */
      health: "Médico",
      /** Whatever the other groups do not have, e.g. a player's height. */
      other: "Outros",
    },
    fieldsLabel: "Campos a alterar",
    /** The name of a row of the dialog for assistive technology; `position` counts from 1. */
    row: (position: number) => `Alteração ${position}`,
    field: "Campo",
    operation: "Operação",
    operations: { set: "Definir como", add: "Somar", scale: "Escalar para %", addYears: "Somar anos" } satisfies Record<
      MassOperationKind["op"],
      string
    >,
    /** The name of the value input, by operation. */
    values: { set: "Valor", add: "Quantia", scale: "Porcentagem", addYears: "Anos" } satisfies Record<
      MassOperationKind["op"],
      string
    >,
    /** Hover text of the amount of an Add. */
    addTitle: "Somada a cada valor como mostrado; um número negativo subtrai",
    /** The same for a percentage: the amount is in percentage points, not a percent of the value (that is Scale). */
    addPointsTitle: "Pontos percentuais somados a cada valor (70% mais 10 dá 80%); um número negativo subtrai",
    /** The hint in an empty value input: what it takes. */
    rangeHint: (min: number, max: number) => `${format(min)}–${format(max)}`,
    /** The same for an amount, which may be negative: up to `max` either way. */
    amountHint: (max: number) => `±${format(max)}`,
    /** After the input of a Scale: the number is a percent of the value the game has now. */
    ofCurrent: "% do atual",
    percentTitle: "Uma porcentagem do valor atual: 100 mantém, 110 aumenta em um décimo, 50 reduz pela metade",
    /** Hover text of the years of an Add years, and the word after its input. */
    addYearsTitle: "Anos somados a cada data; um número negativo volta a data, e 29 de fevereiro pode virar 28",
    years: "anos",
    /** Hover text of an amount that cannot be applied; `min` and `max` are what it takes. */
    invalidAdd: (min: number, max: number) => `Digite um número inteiro de ${format(min)} a ${format(max)}`,
    invalidPercent: (min: number, max: number) => `Digite uma porcentagem inteira de ${min} a ${max}`,
    invalidYears: (min: number, max: number) => `Digite um número inteiro de anos de ${format(min)} a ${format(max)}`,
    /** A date cannot be added to or scaled, only set or moved by years; and nothing else is moved by years. */
    dateSetOnly: "Uma data só pode ser definida ou movida em anos",
    yearsDateOnly: "Só uma data pode ser movida em anos",
    addField: "Adicionar um campo",
    /** Hover text of Add a field when the rows are full; `max` is how many fields one mass edit changes. */
    addFieldFull: (max: number) => `Uma edição em massa altera até ${max} campos`,
    remove: "Remover este campo",
    /** Hover text of Remove on the only row. */
    removeLast: "Uma edição em massa precisa de pelo menos um campo",

    // The preview
    preview: "Prévia",
    previewing: "Gerando prévia…",
    /** Beside Preview while it cannot be pressed. */
    previewBlocked: "Preencha todos os campos com um valor válido para ver a prévia",
    /** "312 changes for 140 of 237 players · 97 already have these values · 12 values left alone". */
    summary: (entity: Entity, preview: MassPreview) =>
      [
        preview.changes === 0
          ? "Nenhuma alteração"
          : `${changeCount(preview.changes)} para ${format(preview.targets - preview.unchanged)} de ` +
            entityCount[entity](preview.targets),
        preview.unchanged > 0 &&
          (preview.unchanged === 1
            ? "1 já tem estes valores"
            : `${format(preview.unchanged)} já têm estes valores`),
        preview.skippedCount > 0 && valuesLeftAlone(preview.skippedCount),
      ]
        .filter(Boolean)
        .join(" · "),
    tableLabel: "Alterações que a edição em massa faria",
    columns: { name: "Nome", field: "Campo", change: "Alteração", reason: "Motivo" },
    /** Under a table or a list that shows only the first rows; `count` is how many more there are. */
    more: (count: number) => `e mais ${format(count)}`,
    /** The line that opens the list of the values left alone. */
    skippedHeading: valuesLeftAlone,
    skippedLabel: "Valores que a edição em massa mantém",

    // Apply and undo
    apply: "Aplicar",
    applying: "Aplicando…",
    /** Hover text of Apply; `changes` is how many values it writes. */
    applyTitle: (changes: number) => `Grava no jogo: ${changeCount(changes)}`,
    applyFirst: "Veja antes a prévia da edição em massa",
    applyNothing: "A prévia não tem alterações para gravar",
    /** Nothing changes in the game until Apply. */
    hint: "Nada muda no jogo até você aplicar.",
    applied: (count: number) => (count === 0 ? "Nenhuma alteração foi gravada" : `Aplicado: ${changeCount(count)}`),
    /** A change the game refused: who, which field (see `fieldLabel`) and the game's answer. */
    failure: (name: string, label: string, reason: string) => `${name} · ${label}: ${reason}`,
    undo: "Desfazer esta edição em massa",
    undoing: "Desfazendo…",
    undoTitle: "Grava de volta no jogo os valores antigos desta edição em massa",
    undone: (count: number) => (count === 0 ? "Nada foi desfeito" : `Desfeito: ${changeCount(count)}`),
    /** A change an undo could not take back: `who` names the person and the field, or the change by its number. */
    undoFailure: (who: string, reason: string) => `${who}: ${reason}`,
    changeNumber: (id: number) => `Alteração ${id}`,
    close: "Fechar",
  },

  /** Comparing players: the button in a player's profile, the tray under the player list and the dialog. */
  comparison: {
    /** The button in the header of a player's profile. */
    compare: "Comparar",
    /** Hover text of that button while the player is not in the comparison, and while they are. */
    add: "Adicionar à comparação",
    remove: "Remover da comparação",
    /** Hover text of the button while the comparison is full and cannot take this player; `max` is its size. */
    full: (max: number) => `Uma comparação aceita até ${max} jogadores. Remova um para adicionar este jogador.`,

    // The tray under the player list
    trayLabel: "Jogadores para comparar",
    /** The name and hover text of the × on a player's chip. */
    removePlayer: (name: string) => `Remover da comparação: ${name}`,
    clear: "Limpar",
    /** The button that opens the dialog; `count` is how many players are picked. */
    open: (count: number) => `Comparar (${count})`,

    // The dialog
    title: "Comparação",
    /** Under the title: what the highlight in the table means. */
    hint: "O melhor valor de cada linha fica destacado: o mais alto, ou o mais baixo onde menor é melhor.",
    /** What the dialog says when fewer than two players are picked. */
    tooFew: "Adicione pelo menos dois jogadores para compará-los.",
    loading: "Carregando os jogadores…",
    tableLabel: "Valores dos jogadores comparados",
    /** Said after the highlighted value of a row, for assistive technology. */
    highest: "mais alto",
    lowest: "mais baixo",
    /** The heading of the rows with the positions, height, reputation and contract. */
    profile: "Perfil",
    close: "Fechar",
  },

  /**
   * Moving a player to another club, or swapping him with a player of another club: the button in his profile and the
   * dialog it opens.
   */
  move: {
    button: "Transferir",
    buttonTitle: "Transfere este jogador para outro clube no jogo, com valor se você quiser",

    // The dialog
    title: "Transferir",
    from: "De",
    to: "Para",

    modeLabel: "Transferir, emprestar, mover agora ou trocar",
    modeArrange: "Transferir",
    modeMove: "Mover agora",
    modeSwap: "Trocar com um jogador",
    arrangeNote:
      "O jogo faz a transferência no dia seguinte, como faz as dele: o histórico do jogador mantém as partidas desta temporada " +
      "pelo clube antigo, lista o novo clube com o valor, e o jogo paga o valor.",
    moveNote:
      "O editor o move na hora. O histórico do jogo não registra isso: esta temporada aparece no novo clube, " +
      "sem valor.",
    arrangeUnavailable:
      "Esta versão do jogo, ou este sistema, não deixa o editor agendar uma transferência para o jogo fazer: " +
      "“Mover agora” o move na hora.",

    // A transfer the game makes the next day
    arrangeChecking: "Verificando a transferência… na primeira vez, achar as transferências do jogo leva alguns segundos.",
    movesOn: (date: string) => `O jogo faz a transferência em ${date}`,
    arrangeFee: (amount: string) => `Valor ${amount}, pago pelo jogo no dia`,
    arrangeContract: (wage: string, expires: string) => `Contrato: ${wage} por semana, até ${expires}`,
    arrangeDoes: [
      "Combinado agora: o jogo faz a transferência quando chegar ao dia seguinte",
      "O histórico dele mantém as partidas desta temporada pelo clube antigo e lista o novo clube com o valor",
      "O jogo paga o valor no dia, como paga as próprias transferências",
      "Contrato com o novo clube a partir desse dia; salário e fim do contrato só mudam se você definir novos",
      "Listado em Alterações, onde um desfazer cancela a transferência até o dia",
    ],
    arrangeButton: "Agendar transferência",

    // A loan the game makes the next day
    modeLoan: "Empréstimo",
    loanNote: "O jogo faz o empréstimo no dia seguinte, como faz os dele; depois dele, o jogador volta ao seu clube.",
    loanChecking: "Verificando o empréstimo…",
    loanOn: (date: string) => `O jogo faz o empréstimo em ${date}`,
    loanUntil: (date: string) => `O empréstimo dura até ${date}`,
    loanWage: (money: string, share: number) => `O clube paga ${money} por semana (${format(share)}% do salário dele)`,
    loanMonthlyFee: (money: string) => `Taxa mensal ${money}`,
    loanOption: (money: string) => `Opção de compra por ${money}`,
    loanDoes: [
      "Combinado agora: o jogo faz o empréstimo quando chegar ao dia seguinte",
      "O histórico dele lista o empréstimo, e ele volta ao próprio clube no dia depois do último dia",
      "O clube paga a parte dele no salário e a taxa mensal, se você definir uma",
      "Com opção, o clube que o recebe pode contratá-lo pelo valor dela quando o empréstimo terminar",
    ],
    loanDoesHeading: "O que o empréstimo faz",
    loanHint: "Nada muda no jogo até você clicar em Agendar empréstimo.",
    loanButton: "Agendar empréstimo",
    loanLastDay: "Último dia do empréstimo",
    loanLastDayHint: "No dia seguinte ele volta ao próprio clube",
    loanShare: "Parte do salário paga",
    loanShareHint: "O que o clube que o recebe paga; o clube dele paga o resto",
    loanShareInvalid: "Digite um número inteiro de 0 a 100",
    loanMonthly: "Taxa mensal",
    loanOptionFee: "Opção de compra",
    loanOptionFeeHint: "O clube que o recebe pode contratá-lo por este valor quando o empréstimo terminar; vazio para nenhuma",

    // Choosing the club
    searchLabel: "Buscar o clube para onde transferir",
    resultsLabel: "Clubes encontrados",
    searching: "Buscando clubes…",
    searchFailed: (reason: string) => `Não foi possível buscar os clubes: ${reason}`,
    more: (count: number) => `e mais ${format(count)}; digite para refinar a busca`,
    change: "Escolher outro clube",

    // The fee
    feeHeading: "Valor",
    fee: "Valor da transferência",
    feeHint: "Deixe vazio para uma transferência gratuita",
    feeInvalid: (max: string) => `Digite um valor inteiro, de 0 a ${max}`,
    pays: (club: string, fee: string, balance: string, budget: string | null) =>
      `${club} paga ${fee}: saldo ${balance}${budget === null ? "" : `, orçamento de transferências ${budget}`}`,
    receives: (club: string, fee: string, balance: string) => `${club} recebe ${fee}: saldo ${balance}`,
    noFinances: (club: string) => `${club} não tem finanças no jogo: o dinheiro dele continua como está`,

    // The contract
    wageInvalid: "Digite um valor inteiro, 0 ou mais",
    expiresInvalid: "Digite uma data",

    // What the dialog says about the move itself
    chooseClub: "Escolha o clube para onde transferir o jogador.",
    fixTerms: "Corrija antes o valor ou os dados do contrato.",
    checking: "Verificando a transferência…",
    route: (from: string, to: string) => `${from} → ${to}`,
    doesHeading: "O que a transferência faz",
    does: [
      "Entra no time principal do novo clube",
      "Contrato a partir da data do jogo; número da camisa removido",
      "Sai das listas de transferências e de empréstimos",
      "Salário e fim do contrato só mudam se você definir novos",
      "O valor sai do saldo e do orçamento de transferências do clube comprador e entra no saldo do clube vendedor",
      "Qualquer braçadeira de capitão no clube antigo fica vaga",
      "O histórico de transferências do jogo ainda não a registra",
      "Listado em Alterações, onde um desfazer cancela a transferência e o valor",
    ],

    // A club whose squad list is full
    noRoom: (club: string) => `${club} não tem vaga no elenco.`,
    noRoomInfoLabel: "Por quê?",
    noRoomInfo:
      "O editor aumenta uma lista de elenco cheia quando consegue, mas não consegue aumentar esta: um jogador precisa " +
      "sair para abrir vaga.",
    noRoomNeed: (player: string, club: string) => `Para ${player} entrar, um jogador precisa sair de ${club}.`,
    releaseChoice: "Dispensar:",
    releasePickLabel: "Jogador a dispensar",
    releaseOutcome: "→ fica sem clube",
    injuredTag: "lesionado",
    captainTag: "capitão",
    swapChoice: "Fazer uma troca:",
    swapChoiceOutcome: (club: string) => `este jogador vai para ${club}`,
    moveAndRelease: (name: string) => `Transferir e dispensar ${name}`,
    makeRoomDoes: [
      "Entra no time principal do novo clube, no lugar do jogador dispensado",
      "O jogador dispensado sai de todos os times desse clube e o contrato dele termina: fica sem clube",
      "Contrato a partir da data do jogo; número da camisa removido",
      "Sai das listas de transferências e de empréstimos",
      "Salário e fim do contrato só mudam se você definir novos",
      "O valor sai do saldo e do orçamento de transferências do clube comprador e entra no saldo do clube vendedor",
      "Qualquer braçadeira de capitão que um deles tinha no clube que deixa fica vaga",
      "O histórico de transferências do jogo ainda não a registra",
      "Listado em Alterações como uma única alteração, onde um desfazer cancela a transferência, a dispensa e o valor",
    ],

    // Swapping with a player of the club instead
    swapTitle: "Trocar com um jogador",
    swapWith: "Trocar com",
    playerSearchLabel: "Buscar o jogador para trocar",
    playerSearch: "Buscar jogadores deste clube pelo nome",
    playersLabel: "Jogadores encontrados",
    playersSearching: "Buscando jogadores…",
    playersSearchFailed: (reason: string) => `Não foi possível buscar os jogadores: ${reason}`,
    playersEmpty: (query: string) =>
      query === "" ? "Este clube não tem jogadores." : `Nenhum jogador deste clube corresponde a “${query}”.`,
    changePlayer: "Escolher outro jogador",

    // What the dialog says about the swap
    swapContract: "Cada jogador mantém o próprio contrato; salários e fins de contrato não mudam.",
    // Moving a member of staff
    staffButtonTitle: "Move este funcionário para outro clube no jogo",
    staffChooseClub: "Escolha o clube para onde mover este funcionário.",
    staffContract: "Mantém a função, o salário e o fim do contrato; o contrato começa na data do jogo.",
    staffJob: "Função",
    staffJobChoose: "Escolha uma função…",
    staffJobKept: (job: string) => `${job} (mantém)`,
    staffNewJob: "Assume a nova função e mantém o salário e o fim do contrato; o contrato começa na data do jogo.",
    staffDoes: [
      "Entra no novo clube onde fica a função: no departamento médico, de treinamento ou de observação, ou como diretor de " +
        "futebol ou treinador, o que um clube que já tem um não aceita",
      "Mesmo salário e fim de contrato; o contrato começa na data do jogo",
      "Um treinador que deixa um time deixa a vaga aberta, para o clube preencher; a diretoria fica a cargo do jogo",
      "Listado em Alterações, onde pode ser desfeito",
    ],
    // Signing a member of staff who has no club
    staffSignButtonTitle: "Contrata este funcionário, que está sem clube, para um clube no jogo",
    staffSignTitle: "Contratar um funcionário",
    staffSignChooseClub: "Escolha o clube para o qual contratá-lo.",
    staffSignChooseJob: "Escolha a função que a pessoa assume no clube.",
    staffSignTerms:
      "Deixe vazio para usar o salário do funcionário do clube cuja função é mais parecida com a dela e um contrato até " +
      "o fim da próxima temporada.",
    staffSignRoute: (to: string) => `Sem clube → ${to}`,
    staffSignContract: (wage: string, expires: string) => `Novo contrato: ${wage} por semana até ${expires}`,
    staffSignDoes: [
      "Entra no clube onde fica a função: no departamento, que é ampliado se estiver cheio, ou como diretor de futebol ou " +
        "treinador, quando não há um",
      "Um novo contrato a partir da data do jogo, em um dos espaços livres de contrato do próprio jogo, como o jogo faz",
      "Modelado no contrato do funcionário do clube com a mesma função (senão do mesmo departamento, senão qualquer um) " +
        "mais próximo da habilidade dela",
      "O salário e o fim de contrato que você definir, ou o salário daquele contrato e o fim da próxima temporada; sem cláusulas nem bônus",
      "Listado em Alterações, onde um desfazer cancela tudo",
    ],
    swapChooseClub: "Escolha o clube do jogador para trocar.",
    swapChoosePlayer: "Escolha o jogador para trocar.",
    swapChecking: "Verificando a troca…",
    swapRoute: (player: string, from: string, to: string, other: string) =>
      `${player}: ${from} → ${to}\n${other}: ${to} → ${from}`,
    swapDoesHeading: "O que a troca faz",
    swapDoes: [
      "Cada um entra no time principal do clube do outro",
      "Contratos a partir da data do jogo; números de camisa removidos",
      "Ambos saem das listas de transferências e de empréstimos",
      "Qualquer braçadeira de capitão nos clubes antigos fica vaga",
      "Nenhum valor é pago; o histórico de carreira não é atualizado",
      "Listado em Alterações como uma única alteração, que desfaz as duas transferências",
    ],

    // Signing a free agent
    signButtonTitle: "Contrata este jogador, que está sem clube, para um clube no jogo",
    signTitle: "Contratar um jogador sem clube",
    signChooseClub: "Escolha o clube para o qual contratar o jogador.",
    signChecking: "Verificando a contratação…",
    signTerms:
      "Deixe vazio para usar o salário do jogador do clube mais próximo da habilidade dele e um contrato até o fim da " +
      "próxima temporada.",
    signRoute: (to: string) => `Sem clube → ${to}`,
    signContract: (wage: string, expires: string, status: string) =>
      `Novo contrato: ${wage} por semana até ${expires}, ${status}`,
    signDoesHeading: "O que a contratação faz",
    signDoes: [
      "Entra no time principal do clube; uma lista de elenco cheia é ampliada",
      "Um novo contrato a partir da data do jogo, em um dos espaços livres de contrato do próprio jogo, como o jogo faz",
      "Modelado no contrato do jogador do clube mais próximo da habilidade dele: o mesmo tipo de contrato e status no elenco",
      "O salário e o fim de contrato que você definir, ou o salário daquele jogador e o fim da próxima temporada",
      "Sem número de camisa, bônus de lealdade, cláusulas ou bônus",
      "O histórico de transferências do jogo ainda não a registra",
      "Listado em Alterações, onde um desfazer cancela tudo",
    ],
    signHint: "Nada muda no jogo até você clicar em Contratar.",
    sign: "Contratar",
    signing: "Contratando…",

    // The foot
    hint: "Nada muda no jogo até você clicar em Transferir.",
    arrangeHint: "Nada muda no jogo até você clicar em Agendar transferência.",
    moveNowHint: "Nada muda no jogo até você clicar em Mover agora.",
    move: "Transferir",
    moving: "Transferindo…",
    cancel: "Cancelar",
    swapHint: "Nada muda no jogo até você clicar em Trocar.",
    swap: "Trocar",
    swapping: "Trocando…",
  },

  /**
   * A player's ties to nations and clubs: their secondary nationalities, and the nations and clubs they were trained
   * in, which decide whether they count as homegrown under a competition's rules. The group in the profile and its
   * dialog.
   */
  ties: {
    heading: "Nacionalidade e formação no país",
    nationalities: "Nacionalidades secundárias",
    trainedInNation: "Formado no país",
    trainedAtClub: "Formado no clube",
    workPermit: "Sem necessidade de permissão de trabalho em",
    none: "Nenhuma",
    rules: {
      1: "Formado no país 15-21",
      2: "Formado no país 0-21",
      5: "Formado no país 15-21 (exceto empréstimos)",
      10: "Formado no país 0-19 (1 ano)",
    } as Readonly<Record<number, string>>,
    rule: (code: number) => `Regra de formação ${format(code)}`,

    change: "Alterar",
    changeTitle: "Altera as nacionalidades secundárias e a condição de formado no país deste jogador, no jogo",
    title: "Nacionalidade e formação no país",
    hint: "Cada alteração é gravada no jogo na hora e listada em Alterações, onde pode ser desfeita.",
    full:
      "O jogo deixou a lista deste jogador do tamanho exato do que ela guarda: uma nacionalidade ou uma formação pode ser " +
      "alterada ou removida, mas não adicionada.",
    nationOf: (name: string) => `País no lugar de ${name}`,
    ruleOf: (name: string) => `Regra de formação para ${name}`,
    remove: "Remover",
    removeTitle: (name: string) => `Remover ${name}`,
    addNationality: "Adicionar uma nacionalidade…",
    addNation: "Adicionar um país…",
    addPermit: "Adicionar um país sem necessidade de permissão…",
    daysLeft: (days: number) => `${format(days)} dias restantes`,
    permitInfoLabel: "O que isso faz?",
    permitInfo:
      "O jogo deixa jogadores da União Europeia que estavam na Inglaterra ou na Escócia antes do Brexit jogarem lá sem " +
      "permissão de trabalho, por um número de dias. Um jogador com isso também não precisa de permissão para jogar nesse país, " +
      "pelo número de dias que os dados dele ainda têm (dez anos onde ninguém no save tem).",
    newRule: "Regra de formação do novo país",
    add: "Adicionar",
    changeClub: "Trocar clube",
    changeClubTitle: (name: string) => `Faz ele ser formado em outro clube em vez de ${name}`,
    clubInsteadOf: (name: string) => `Clube no lugar de ${name}`,
    addClub: "Adicionar um clube…",
    addClubTitle: "Faz ele ser formado em mais um clube",
    newClub: "Novo clube",
    pickAnother: "Escolher outro",
    newClubRule: "Regra de formação do novo clube",
    cancel: "Cancelar",
    working: "Gravando no jogo…",
    close: "Fechar",
  },

  /** Changing a contract's bonuses and clauses: the button under them in the profile, and the dialog it opens. */
  clauses: {
    change: "Alterar",
    changeTitle: "Altera os bônus e as cláusulas deste jogador, no jogo",
    title: "Bônus e cláusulas",
    hint: "Cada alteração é gravada no jogo na hora e listada em Alterações, onde pode ser desfeita.",
    full:
      "O jogo deixou a lista deste contrato do tamanho exato do que ela guarda: um bônus ou uma cláusula pode ser alterado ou " +
      "removido, mas uma cláusula de rescisão não pode ser adicionada.",
    amountOf: (name: string) => `Valor de ${name}`,
    conditionOf: (name: string) => `Condição de ${name}`,
    save: "Salvar",
    remove: "Remover",
    removeTitle: (name: string) => `Remover ${name}`,
    addRelease: "Adicionar uma cláusula de rescisão",
    releaseAmount: "Valor da nova cláusula de rescisão",
    add: "Adicionar",
    outOfRange: (max: string) => `Digite um número inteiro de 0 a ${max}.`,
    working: "Gravando no jogo…",
    close: "Fechar",
  },

  /** Releasing a player from their club, which leaves them a free agent: the button beside Transfer and its dialog. */
  release: {
    button: "Dispensar",
    buttonTitle: "Dispensa este jogador do clube no jogo: ele fica sem clube",
    staffButtonTitle: "Dispensa este funcionário do clube no jogo: ele fica sem clube",

    title: "Dispensar",
    from: "Sai de",
    checking: "Verificando a dispensa…",
    ready: (club: string) => `${club} → sem clube`,
    staffReady: (club: string) => `${club} → desempregado`,
    doesHeading: "O que a dispensa faz",
    does: [
      "Sai de todos os times do clube e o contrato termina: um jogador sem clube que qualquer clube pode contratar",
      "Ninguém recebe nenhum pagamento",
      "Qualquer braçadeira de capitão no clube fica vaga",
      "O histórico de transferências do jogo não a registra",
      "Listado em Alterações, onde um desfazer traz o jogador de volta com o mesmo contrato",
    ],
    staffDoes: [
      "Sai do quadro de funcionários do clube na hora e o contrato termina: desempregado, como os funcionários sem clube do próprio jogo",
      "Ninguém recebe nenhum pagamento",
      "A vaga de treinador ou de diretor de futebol fica vazia, para o clube preencher",
      "Listado em Alterações, onde um desfazer traz a pessoa de volta com o mesmo contrato",
    ],

    hint: "Nada muda no jogo até você clicar em Dispensar.",
    release: "Dispensar",
    releasing: "Dispensando…",
    cancel: "Cancelar",
  },

  /** Changing a player's names: the button beside Release and its dialog. */
  rename: {
    button: "Renomear",
    buttonTitle: "Altera os nomes deste jogador no jogo",

    title: "Renomear",
    loading: "Lendo os nomes…",
    first: "Nome",
    last: "Sobrenome",
    common: "Nome popular",
    commonHint:
      "O nome que o jogo mostra no lugar do nome e do sobrenome, como em Pedri ou Vinícius Júnior. Deixe vazio para nenhum",
    full: "Nome completo",
    fullHint: "O nome por extenso, como o perfil o mostra. Deixe vazio para nenhum",
    none: "Nenhum",
    required: "Não pode ficar vazio",
    tooLong: (max: number) => `Longo demais: no máximo ${max} bytes`,
    noRoom:
      "O jogo não tem espaço para mais um nome novo deste tipo agora: salve o jogo, carregue o save de novo e tente outra vez",
    unavailable: "O editor não consegue alterar nomes nesta versão do jogo",
    doesHeading: "O que isso faz",
    does: [
      "O jogo mostra o novo nome depois que você clica em Continuar nele",
      "O nome permanece quando você salva o jogo",
      "Um novo nome, sobrenome ou nome popular entra nas tabelas de nomes do jogo, onde o jogo o usa só para este jogador",
      "Listado em Alterações, uma linha por nome, onde Desfazer recoloca o nome antigo",
    ],

    hint: "Nada muda no jogo até você clicar em Renomear.",
    rename: "Renomear",
    renaming: "Renomeando…",
    cancel: "Cancelar",
  },

  /** Making a player's loan permanent: the dialog the Make permanent button of the Loan part of his profile opens. */
  permanent: {
    title: "Tornar o empréstimo definitivo",
    stays: "Fica em",
    leaves: "Sai de",
    checking: "Verificando…",
    doesHeading: "O que isso faz",
    does: [
      "Ele fica onde joga, agora com contrato com esse clube a partir de hoje, nas condições acima",
      "Ele mantém o número da camisa e o status no elenco que tem lá",
      "Ele sai de todos os times do próprio clube, e o empréstimo termina",
      "O histórico de transferências do jogo não a registra",
      "Listado em Alterações como uma transferência, onde um desfazer recoloca o empréstimo",
    ],
    optionFee: (money: string) => `Preenchido a partir da opção de compra do empréstimo: ${money}`,
    hint: "Nada muda no jogo até você clicar em Tornar definitivo.",
    confirm: "Tornar definitivo",
    confirming: "Tornando definitivo…",
    cancel: "Cancelar",
  },

  /** Recalling a player from his loan: the dialog the Recall button of the Loan part of his profile opens. */
  recall: {
    title: "Chamar de volta do empréstimo",
    from: "Emprestado a",
    to: "Volta para",
    doesHeading: "O que o retorno faz",
    does: (parent: string) => [
      "Hoje passa a ser o último dia do empréstimo: quando o dia acabar, o próprio jogo encerra o empréstimo",
      `Avance um dia no jogo e ele volta para ${parent}`,
      "Até lá fica listado em Alterações, onde um desfazer recoloca o fim antigo do empréstimo",
    ],
    termsHeading: "No jogo",
    notRecallable: (parent: string) => `O empréstimo não deixa ${parent} chamá-lo de volta`,
    notTerminable: "O empréstimo não pode ser encerrado antes",
    worksAnyway: "O retorno aqui funciona do mesmo jeito: ele não passa pelo retorno do jogo, apenas move o último dia do empréstimo",
    dropsOption: (club: string, amount: string) =>
      `A opção de compra de ${club} por ${amount} é removida: senão, quando o empréstimo terminar, o jogo pode vendê-lo a ${club}`,
    hint: "Nada muda no jogo até você clicar em Chamar de volta.",
    confirm: "Chamar de volta",
    confirming: "Chamando de volta…",
    cancel: "Cancelar",
  },

  /** Batch traits: the dialog of a club's Squad tab that adds or removes traits for every player of a team. */
  batchTraits: {
    title: "Traços em lote do time",
    addMode: "+ Adicionar ao elenco",
    removeMode: "- Remover do elenco",
    addHint: "Aplica os traços selecionados aos jogadores deste time que não os têm. Os traços existentes são mantidos.",
    removeHint: "Remove os traços selecionados dos jogadores deste time que os têm. Os outros traços não são tocados.",
    noneSelected: "Nenhum traço selecionado neste modo",
    selectedCount: (count: number) => (count === 1 ? "1 traço selecionado" : `${format(count)} traços selecionados`),
    deselectAll: "Desmarcar todos",
    oppositeModeNote: "Selecionado no modo oposto",
    applyNote: (players: number) => `Vale para ${format(players)} jogadores · Pode ser desfeito com 1 clique`,
    emptySquad: (players: number) => `Elenco de ${format(players)} jogadores`,
    cancel: "Cancelar",
    apply: "Aplicar",
    applying: "Aplicando…",
  },

  /**
   * A club's squad: the tab of the club profile that lists the players of each of its teams, with the actions on a
   * whole team and the captains.
   */
  squad: {
    // The switch between the club's teams
    teamsLabel: "Time",
    teams: {
      first: "Time principal",
      b: "Time B",
      age: (limit: number) => `Sub-${limit}`,
      other: (place: number) => `Time ${place}`,
    },
    noTeams: "Este clube não tem times.",
    loading: "Lendo o elenco…",
    empty: "Nenhum jogador neste time.",

    // Above the table
    players: (count: number) => (count === 1 ? "1 jogador" : `${format(count)} jogadores`),
    averageAge: (age: string) => `idade média ${age}`,
    captains: (captain: string, viceCaptain: string) => `Capitão: ${captain} · Vice-capitão: ${viceCaptain}`,

    // The actions on the whole team
    actionsLabel: "Ações sobre o time todo",
    healAll: (injured: number) => (injured === 0 ? "Curar todos" : `Curar todos (${format(injured)} lesionados)`),
    healAllTitle: "Cura todas as lesões de todos os jogadores deste time",
    healNone: "Ninguém neste time está lesionado",
    liftAll: (banned: number) => (banned === 0 ? "Cancelar suspensões" : `Cancelar suspensões (${format(banned)} suspensos)`),
    liftAllTitle: "Cancela todas as suspensões de todos os jogadores deste time",
    liftNone: "Ninguém neste time está suspenso",
    inspireAll: "Motivar todos",
    inspireAllTitle: "Coloca a moral de todos os jogadores em 20, o máximo, e remove os motivos de insatisfação deles",
    maxCohesion: "Entrosamento máximo",
    maxCohesionTitle:
      "Coloca o entrosamento de todos os jogadores com o clube em 100, o máximo; o jogo o mostra depois que avançar",
    cohesionNone: "Não dá para ler: esta versão do jogo não foi verificada para isso, ou nenhum jogador tem registro no clube",
    cohesionWithout: (count: number) =>
      count === 1
        ? "1 jogador ainda não tem entrosamento com o clube"
        : `${format(count)} jogadores ainda não têm entrosamento com o clube`,
    maxTactics: "Táticas no máximo",
    maxTacticsTitle:
      "Faz todos os jogadores conhecerem a tática do time no nível máximo; isso diminui em cerca de seis semanas, como o treino",
    tacticsNone: "Não dá para ler: esta versão do jogo não foi verificada para isso, ou o time não joga com uma tática que você escolhe",
    tacticsUntrained: (count: number) =>
      count === 1
        ? "1 jogador não treina (como quando lesionado): o histórico de treino dele fica como está"
        : `${format(count)} jogadores não treinam (como quando lesionados): o histórico de treino deles fica como está`,
    refreshAll: "Recuperar todos",
    refreshAllTitle: "Coloca a energia e o ritmo de jogo de todos os jogadores em 100% e os descansa totalmente (cansaço acumulado -500)",
    batchTraits: "Traços em lote",
    batchTraitsTitle: "Adiciona ou remove movimentos preferidos dos jogadores deste time",
    maxAll: "Maximizar atributos",
    maxAllTitle: "Coloca todos os atributos de todos os jogadores no máximo: 20, e 1 para propensão a lesões e jogo sujo",
    atItsBest: "Time no auge",
    atItsBestTitle:
      "Curar todos, Motivar todos, Recuperar todos, Entrosamento máximo e Táticas no máximo com um clique; um Desfazer reverte tudo",
    atItsBestSkipped: (step: string, reason: string) => `${step} ignorado: ${reason}`,
    destroy: "Destruir",
    destroyTitle: "Leva a moral, a forma física, o entrosamento e o conhecimento tático de todos os jogadores ao pior nível; pede confirmação antes",
    destroySteps: {
      demoralize: "Moral e felicidade",
      exhaust: "Energia e ritmo de jogo",
      minCohesion: "Entrosamento",
      minTactics: "Táticas",
    },
    moreActions: "Mais ações",
    moreActionsTitle: "As ações sobre o time todo, uma de cada vez",
    destroyDialog: {
      title: "Destruir este time?",
      doesHeading: "Para todos os jogadores da lista, inclusive os emprestados",
      does: [
        "Moral em 1, o mínimo; felicidade e felicidade com o tempo de jogo em -100",
        "Energia em 0%, ritmo de jogo em 35% e cansaço acumulado em 1000",
        "Entrosamento com o clube em 1, para quem o tem",
        "O quanto ele conhece a tática no mínimo, onde você escolhe a tática do time",
      ],
      keeps: "Nenhum valor é melhorado. Atributos, lesões e suspensões ficam como estão.",
      ownClub: "Este é um time do seu próprio clube.",
      hint: "Um Desfazer reverte tudo, antes de o jogo avançar.",
      cancel: "Cancelar",
    },
    hint: "As ações valem para todos os jogadores da lista, inclusive os emprestados. Também dá para desfazer na tela Alterações.",

    // Freezing the whole team, under the actions
    freezeLabel: "Congelar o time todo",
    freezeAttributes: "Congelar atributos",
    freezeAttributesTitle:
      "Os atributos de todos os jogadores deste time não pioram enquanto o app está aberto e conectado",
    freezeFitness: "Congelar energia e ritmo de jogo",
    freezeFitnessTitle:
      "A energia e o ritmo de jogo de todos os jogadores continuam altos enquanto o app está conectado; use Recuperar todos antes para 100%",
    freezePositions: "Congelar posições",
    freezePositionsTitle:
      "As avaliações de posição de todos os jogadores deste time ficam como estão enquanto o app está aberto e conectado",
    frozenCount: (frozen: number, total: number) => `${format(frozen)} de ${format(total)}`,
    freezeHint:
      "Congelar vale para todos os jogadores da lista e acompanha cada um para onde ele for. O app lembra disso para " +
      "este save.",
    frozeAttributes: (count: number) =>
      count === 0 ? "Os atributos deles já estavam congelados" : `Atributos congelados: ${playerCount(count)}`,
    unfrozeAttributes: (count: number) => `Atributos descongelados: ${playerCount(count)}`,
    frozeFitness: (count: number) =>
      count === 0
        ? "A energia e o ritmo de jogo deles já estavam congelados"
        : `Energia e ritmo de jogo congelados: ${playerCount(count)}`,
    unfrozeFitness: (count: number) => `Energia e ritmo de jogo descongelados: ${playerCount(count)}`,
    frozePositions: (count: number) =>
      count === 0 ? "As posições deles já estavam congeladas" : `Posições congeladas: ${playerCount(count)}`,
    unfrozePositions: (count: number) => `Posições descongeladas: ${playerCount(count)}`,

    // What an action did, under the buttons
    written: (count: number) => `Gravado: ${changeCount(count)}`,
    refused: (name: string, reason: string) => `${name}: ${reason}`,
    undo: "Desfazer",
    undoTitle: "Grava de volta no jogo os valores antigos destas alterações",

    // Captains
    captainShort: "C",
    viceCaptainShort: "VC",
    menuLabel: (name: string) => `Capitania de ${name}`,
    menuTitle: "Capitania",
    makeCaptain: "Tornar capitão",
    makeViceCaptain: "Tornar vice-capitão",
    nowCaptain: (name: string) => `${name} agora é o capitão`,
    nowViceCaptain: (name: string) => `${name} agora é o vice-capitão`,
    noCaptain: "Ninguém é capitão agora",
    noViceCaptain: "Ninguém é vice-capitão agora",

    // The table
    tableLabel: (team: string) => `Jogadores de ${team}`,
    openProfile: "Abrir o perfil do jogador",
    columns: {
      name: "Nome",
      position: "Pos",
      age: "Idade",
      currentAbility: "HA",
      potentialAbility: "POT",
      condition: "Energia",
      matchSharpness: "Ritmo",
      jadedness: "Cansaço",
      morale: "Moral",
      cohesion: "Entrosamento",
      tactics: "Táticas",
      actions: "Capitania",
    } satisfies Record<SquadSort | "actions", string>,
    sortBy: (by: string) => `Ordenar por ${by}`,
    sortNames: {
      name: "nome",
      position: "posição",
      age: "idade",
      currentAbility: "habilidade atual",
      potentialAbility: "habilidade potencial",
      condition: "energia",
      matchSharpness: "ritmo de jogo",
      jadedness: "cansaço acumulado",
      morale: "moral",
      cohesion: "entrosamento",
      tactics: "familiaridade tática",
    } satisfies Record<SquadSort, string>,

    // The tags after a name, with what each means as hover text
    injured: "Lesionado",
    injuredTitle: (count: number) => (count === 1 ? "1 lesão" : `${format(count)} lesões`),
    banned: "Suspenso",
    bannedTitle: (count: number) => (count === 1 ? "1 suspensão" : `${format(count)} suspensões`),
    unrest: "Insatisfação",
    unrestTitle: (count: number) =>
      count === 1
        ? "1 companheiro está insatisfeito com ele; “Remover todos”, no perfil dele, resolve depois que o jogo avançar"
        : `${format(count)} companheiros estão insatisfeitos com ele; “Remover todos”, no perfil dele, resolve depois que o jogo avançar`,
    onLoan: "Emprestado",
    onLoanTitle: "Emprestado a outro clube",
    loanee: "Por empréstimo",
    loaneeTitle: "Está aqui por empréstimo de outro clube",
    elsewhere: "Em outro time",
    elsewhereTitle: "Joga em outro time do clube",
    frozen: "Congelado",
    frozenTitle: (attributes: boolean, fitness: boolean, positions: boolean): string => {
      const frozen = [
        ...(attributes ? ["atributos"] : []),
        ...(fitness ? ["energia", "ritmo de jogo"] : []),
        ...(positions ? ["posições"] : []),
      ];
      const last = frozen.pop() ?? "";
      const listed = frozen.length > 0 ? `${frozen.join(", ")} e ${last}` : last;
      return `Congelados: ${listed}`;
    },
  },

  /** The game, as `describeGame` in `format.ts` names it. */
  game: {
    name: "Football Manager",
    storefronts: {
      gamePass: "Game Pass",
      steam: "Steam",
      epic: "Epic Games",
      unknown: "Loja desconhecida",
    } satisfies Record<Storefront, string>,
    steamBuild: (id: string) => `build ${id}`,
  },

  /** The Scouting tab: an assistant scout who advises on signings, the squad's depth and who could go. */
  scouting: {
    nav: "Observação",
    reading: "Lendo o seu clube…",
    refresh: "Atualizar",
    refreshTitle: "Lê o clube do jogo de novo",
    searching: "Buscando…",
    none: "—",
    perWeek: "/sem",
    openProfile: "Abrir o perfil",
    freeAgent: "Sem clube",
    loan: "Empréstimo",
    header: {
      transferBudget: "Orçamento de transferências",
      wageRoom: "Margem salarial",
      wageBudget: "Orçamento salarial",
      squad: "Elenco",
      averageAge: "Idade média",
      players: (count: number) => (count === 1 ? "1 jogador" : `${format(count)} jogadores`),
    },
    tabs: {
      label: "Seções da observação",
      recommend: "Conselho de contratação",
      opportunities: "Oportunidades",
      similar: "Jogadores parecidos",
      depth: "Profundidade do elenco",
      departures: "Jogadores para liberar",
      youth: "Revelações da base",
    },
    status: {
      missing: "Faltando",
      thin: "Curto",
      fine: "Bom",
      crowded: "Cheio",
    },
    lines: {
      goalkeeper: "Goleiro",
      centreBack: "Zagueiro",
      fullBack: "Lateral",
      wingBack: "Ala",
      defensiveMidfield: "Volante",
      centralMidfield: "Meio-campista central",
      attackingMidfield: "Meia atacante",
      wide: "Ponta",
      striker: "Atacante",
    },
    depthLines: {
      gk: "Goleiros",
      dc: "Zagueiros",
      rightBack: "Laterais direitos",
      leftBack: "Laterais esquerdos",
      dm: "Volantes",
      mc: "Meio-campistas centrais",
      rightWing: "Pontas direitas",
      leftWing: "Pontas esquerdas",
      amc: "Meias atacantes",
      st: "Atacantes",
    } as Record<string, string>,
    positionTip: (line: string, count: number, target: number, status: string) =>
      `${line}: ${format(count)} no elenco (normalmente ${format(target)}) — ${status}`,
    brief: {
      heading: "O que você procura?",
      pitch: "Posição",
      legend: "Os pontos mostram como o elenco está em cada linha.",
      inPossession: "Com a bola",
      outOfPossession: "Sem a bola",
      anyRole: "Qualquer — melhor função para cada jogador",
      purpose: "Para",
      filters: "Filtros",
      minAge: "Idade mín.",
      maxAge: "Idade máx.",
      maxFee: "Valor máx.",
      minProbability: "Probabilidade",
      anyProbability: "Qualquer",
      noFreeAgents: "Sem jogadores sem clube",
    },
    purposes: {
      firstTeam: "Time principal",
      rotation: "Rodízio",
      future: "Futuro",
      any: "Todos",
    },
    purposeTips: {
      firstTeam: "Melhor que o seu melhor jogador nesta posição",
      rotation: "Tão bom quanto a sua segunda opção, por um preço razoável",
      future: "21 anos ou menos, com espaço para crescer",
      any: "Todos que se encaixam",
    },
    ask: {
      before: "Conselho para ",
      after: "",
      anyRole: "melhor função por jogador",
    },
    own: {
      heading: "No seu elenco",
      empty: "Ninguém do seu elenco joga aqui.",
      position: "Posição",
    },
    summary: (candidates: number, eligible: number, shown: number, purpose: string) =>
      `${format(candidates)} jogadores podem jogar aqui · ${format(eligible)} atendem a “${purpose}” · ${format(shown)} recomendados`,
    how: {
      label: "Como esta lista é feita?",
      note: (rule: string, count: string) =>
        `Jogadores avaliados com 10 ou mais nesta posição (que não sejam seus nem de outros treinadores humanos) que ${rule}. Os ${count} melhores aparecem por encaixe (70%) e probabilidade (30%); “Rodízio” pesa os dois igualmente e “Futuro” conta também o potencial. Clique no título de uma coluna para ordenar.`,
    },
    purposeRules: {
      firstTeam: "se encaixam na posição melhor que o seu melhor jogador ali",
      rotation: "se encaixam pelo menos tão bem quanto a sua segunda opção",
      future: "têm 21 anos ou menos e espaço para crescer (potencial pelo menos 15 acima da habilidade)",
      any: "se encaixam de algum jeito",
    },
    sortBy: (by: string) => `Ordenar por ${by}`,
    sortNames: {
      rank: "a ordem do olheiro",
      name: "nome",
      age: "idade",
      ca: "habilidade atual",
      pa: "habilidade potencial",
      fit: "encaixe",
      probability: "probabilidade",
      fee: "valor",
      similarity: "semelhança",
    },
    backToScoutOrder: "Voltar à ordem do olheiro",
    showMore: (count: number) => `Mostrar mais ${format(count)}`,
    playsFor: (club: string) => `joga em ${club}`,
    empty: "Nenhum conselho para esta posição com estas configurações. Tente o objetivo “Todos” ou filtros mais soltos.",
    columns: {
      rank: "#",
      ca: "HA",
      pa: "POT",
      player: "Jogador",
      age: "Idade",
      fit: "Encaixe",
      role: "Função",
      probability: "Probabilidade",
      fee: "Valor est.",
      wage: "Salário",
      note: "Nota do olheiro",
      money: "Valor",
      value: "Valor de mercado",
    },
    probabilityInfo:
      "Qual a chance de o jogador entrar no seu clube — uma estimativa a partir do valor, do contrato, do clube e da reputação dele.",
    probabilityInfoLabel: "O que é a probabilidade?",
    fitTitle: (inPossession: string | null, outOfPossession: string | null, position: string) =>
      [
        inPossession !== null && `Com a bola: ${inPossession}`,
        outOfPossession !== null && `Sem a bola: ${outOfPossession}`,
        `Posição: ${position}`,
      ]
        .filter(Boolean)
        .join("\n"),
    note: "O encaixe usa os pesos de atributos do próprio editor para cada função; valores, salários e probabilidades são estimativas.",
    depth: {
      summary: (size: number, age: string | null, level: string) =>
        `${format(size)} jogadores${age === null ? "" : ` · idade média ${age}`} · habilidade média dos onze melhores ${level}`,
      weak: "Abaixo do nível do elenco",
      ageing: "Envelhecendo",
      cover: (names: string) => `Também podem jogar aqui: ${names}`,
      advice: "Pedir conselho",
      adviceTitle: "Conselho de contratação para esta linha",
      empty: "Ninguém",
      ability: "Habilidade atual",
      more: (count: number) => `+${format(count)}`,
      columns: {
        line: "Linha",
        status: "Status",
        count: "Jogadores",
        players: "Melhores primeiro (habilidade)",
        cover: "Também podem jogar aqui",
        age: "Idade média",
      },
      countTitle: (count: number, target: number) =>
        `${format(count)} jogadores cuja melhor posição é nesta linha; um elenco costuma ter ${format(target)}`,
      statusHelp: {
        missing: "Ninguém joga aqui.",
        thin: "Menos do que um elenco costuma ter; jogadores que podem cobrir contam como meio.",
        fine: "Mais ou menos o que um elenco costuma ter.",
        crowded: "Dois ou mais jogadores além do que um elenco costuma ter.",
      },
      attention: "Merece atenção:",
      allFine: "Todas as linhas parecem equilibradas.",
      views: { label: "Mostrar o elenco como", pitch: "Campo", table: "Tabela" },
      pitchLabel: "O elenco no campo, linha por linha",
      coverCount: (count: number) => `${format(count)} podem cobrir`,
      adviceFor: (position: string) => `Conselho de contratação para ${position}`,
    },
    departures: {
      intro: "Jogadores que o seu olheiro liberaria, os mais urgentes primeiro.",
      filter: "Conselho",
      all: "Todos",
      empty: "O seu olheiro não liberaria ninguém agora.",
      sortNames: {
        rank: "a ordem do olheiro",
        name: "nome",
        age: "idade",
        ca: "habilidade atual",
        pa: "habilidade potencial",
        value: "valor",
        wage: "salário",
        contract: "fim do contrato",
      },
      columns: {
        player: "Jogador",
        age: "Idade",
        ability: "Habilidade",
        value: "Valor",
        wage: "Salário",
        contract: "Contrato até",
        advice: "Conselho",
        reasons: "Motivos",
      },
      actions: { sell: "Vender", loan: "Emprestar", release: "Dispensar" },
      rank: (line: string, rank: number) => `${line} · ${rank}º`,
    },
    actions: {
      column: "Ações",
      compare: "Comparar com o seu elenco",
      compareLabel: (name: string) => `Comparar ${name} com o seu elenco`,
      similar: "Achar jogadores parecidos",
      similarLabel: (name: string) => `Achar jogadores parecidos com ${name}`,
      report: "Relatório do olheiro",
      reportLabel: (name: string) => `Relatório do olheiro sobre ${name}`,
      replacement: "Achar um substituto",
      replacementLabel: (name: string) => `Achar um substituto para ${name}`,
      replacementTitle: "Jogadores parecidos com ele, que poderiam ocupar o lugar dele",
    },
    why: {
      freeAgent: () => "Sem clube",
      expiring: (value: string) => `Contrato termina em ${value} dias`,
      releaseClause: (value: string, against: string | null) =>
        against === null ? `Cláusula de rescisão ${value}` : `Cláusula de rescisão ${value} (valor ${against})`,
      unhappy: (value: string) => (value === "1" ? "Insatisfeito no clube" : `Insatisfeito no clube (${value} motivos)`),
      inTheRed: (value: string) => `O clube dele está no vermelho (${value})`,
      listed: () => "Na lista de transferências",
      loanListed: () => "Disponível para empréstimo",
      wonderkid: (value: string) => `Potencial ${value}`,
    } as Record<string, (value: string, against: string | null) => string>,
    verdicts: {
      better: "Melhor que o seu nº 1",
      close: "Perto do seu nº 1",
      below: "Abaixo do seu nº 1",
      none: "Ninguém do seu elenco joga aqui",
    },
    chances: { likely: "Provável de chegar", possible: "Poderia chegar", hard: "Difícil de contratar" },
    opportunities: {
      kindsLabel: "Listas de oportunidades",
      kinds: {
        bosman: "Bosman",
        releaseClause: "Cláusulas de rescisão",
        unhappy: "Insatisfeitos",
        inTheRed: "Clubes no vermelho",
        listed: "Lista de transferências",
        loanListed: "Lista de empréstimos",
        wonderkid: "Joias da base",
      } satisfies Record<OpportunityKind, string>,
      hints: {
        bosman: "Jogadores sem clube e contratos que terminam em até seis meses",
        releaseClause: "Uma cláusula de rescisão abaixo do valor dele",
        unhappy: "Insatisfeito no clube",
        inTheRed: "O clube dele precisa do dinheiro",
        listed: "O clube dele o venderia",
        loanListed: "O clube dele o emprestaria",
        wonderkid: "19 anos ou menos, com um grande futuro",
      } satisfies Record<OpportunityKind, string>,
      countLabel: "Jogadores nesta lista",
      count: (count: number, more: boolean) => (more ? `${format(count)}+` : format(count)),
      position: "Posição",
      anyPosition: "Qualquer posição",
      maxAge: "Idade máx.",
      maxFee: "Valor máx.",
      betterOnly: "Melhor que o meu nº 1",
      betterOnlyTitle: "Só jogadores que se encaixam na posição melhor que o seu melhor jogador ali",
      summary: (kind: string, lowest: string, highest: string, pool: string) =>
        `${kind} · jogadores de habilidade ${lowest}–${highest}, perto do nível do seu elenco · ${pool} analisados`,
      how: {
        label: "Como estas listas são feitas?",
        note: "Jogadores perto do nível dos seus onze melhores (de 30 abaixo a 45 acima), que não sejam seus nem de outros treinadores humanos, cada um medido na melhor posição dele ou na que você escolher. Cada lista é ordenada por encaixe e probabilidade juntos.",
      },
      empty: "Ninguém nesta lista com estes filtros.",
      emptyWonderkids: "Nenhuma joia da base com estes filtros.",
      better: "Melhor que o seu nº 1 aqui",
      columns: { position: "Pos", why: "Por quê" },
    },
    similar: {
      intro: "Escolha um jogador para achar outros parecidos: os atributos são comparados onde a posição dele os exige.",
      search: "Jogador para comparar",
      searchPlaceholder: "Buscar um jogador pelo nome…",
      noMatch: "Nenhum jogador com esse nome.",
      quickPicks: "Ou comece por um dos seus jogadores:",
      change: "Escolher outro jogador",
      reference: "Jogadores parecidos com",
      position: "Comparar como",
      cheaper: "Mais baratos",
      cheaperTitle: "Só jogadores que valem menos que ele",
      younger: "Mais jovens",
      youngerTitle: "Só jogadores mais jovens que ele",
      maxFee: "Valor máx.",
      value: "Valor",
      notForSale: "Não está à venda",
      doesNotPlay: (position: string) => `Ele não joga como ${position}: só os atributos são comparados.`,
      summary: (candidates: string, shown: string, position: string) =>
        `${candidates} jogadores atuam como ${position} · os ${shown} mais parecidos`,
      how: {
        label: "Como a semelhança é medida?",
        note: "O olheiro compara os atributos de que as funções da posição dependem, principalmente os principais. Onde o jogador é forte e onde é fraco pesa mais do que o nível dele, então um jogador mais barato ou mais jovem ainda pode ser muito parecido.",
      },
      empty: "Ninguém parecido com estas configurações.",
      columns: { similarity: "Semelhança", value: "Valor" },
      similarityTitle: (value: number) => `${format(value)}% parecido`,
    },
    compare: {
      title: "Comparar com o seu elenco",
      hint: (position: string, name: string) =>
        `Em relação a ${name}, o seu melhor jogador como ${position}. Os atributos principais da função vêm primeiro.`,
      noStarter: "Ninguém do seu elenco joga nesta posição.",
      starter: "Seu nº 1",
      candidate: "Candidato",
      inPossession: "Com a bola",
      outOfPossession: "Sem a bola",
      add: "Adicionar um jogador",
      addNone: "Escolha na lista…",
      remove: (name: string) => `Tirar ${name} da comparação`,
      removeShort: "Remover",
      scoutView: "Visão do olheiro",
      rows: {
        fit: "Encaixe",
        position: (position: string) => `Como ${position}`,
        roleRating: (role: string) => `Como ${role}`,
        probability: "Probabilidade",
        fee: "Valor est.",
        wage: "Salário",
        contract: "Contrato até",
        verdict: "Veredito",
      },
      ownPlayer: "Seu jogador",
      roleAttributes: (roles: string) => `Atributos da função: ${roles}`,
      keyAttribute: "Um atributo principal da função",
      versus: (difference: string) => `${difference} em relação ao seu nº 1`,
      best: "o melhor",
      age: (age: number) => `${format(age)} anos`,
      allAttributes: "Todos os atributos",
      loading: "Lendo os jogadores…",
      close: "Fechar",
    },
    report: {
      title: (name: string) => `Relatório do olheiro: ${name}`,
      hint: "Salve como imagem ou copie para compartilhar.",
      making: "Escrevendo o relatório…",
      failed: (reason: string) => `Não foi possível fazer o relatório: ${reason}`,
      alt: (name: string) => `O relatório do olheiro sobre ${name}`,
      save: "Salvar como imagem",
      savePdf: "Salvar como PDF",
      saving: "Salvando…",
      copy: "Copiar imagem",
      copied: "Copiado para a área de transferência.",
      copyFailed: (reason: string) => `Não foi possível copiar a imagem: ${reason}`,
      similar: "Achar jogadores parecidos",
      saved: (file: string) => `Salvo como ${file}.`,
      open: "Abrir",
      show: "Mostrar na pasta",
      close: "Fechar",
      heading: "Relatório do olheiro",
      age: (age: number) => `${format(age)} anos`,
      freeAgent: "Sem clube",
      contract: "contrato até",
      fit: "Encaixe",
      probability: "Probabilidade",
      fee: "Valor est.",
      abilities: "HA / POT",
      value: "Valor",
      role: "Função",
      strengths: "Pontos fortes",
      weaknesses: "Pontos fracos",
      profile: "Perfil",
      note: "Nota do olheiro",
      similarity: (value: number) => `${format(value)}% parecido`,
      footer: "Relatório do olheiro do FMLibreEditor · valores, salários e probabilidades são estimativas",
      traits: {
        consistent: "Regular",
        inconsistent: "Irregular",
        bigGames: "Decide em jogos grandes",
        nervous: "Nervoso em jogos grandes",
        injuryProne: "Propenso a lesões",
        robust: "Raramente se lesiona",
        versatile: "Versátil",
        professional: "Profissional exemplar",
        ambitious: "Ambicioso",
        loyal: "Leal",
        hotHeaded: "Esquentado",
      },
    },
    youth: {
      intro: "Os jogadores que o jogo criou nas revelações da base do clube e que ainda estão lá, pelo dia em que entraram.",
      otherClub: "Ver outro clube",
      searchLabel: "Clube a ver",
      mine: "Voltar ao meu clube",
      intakesLabel: "Revelações da base",
      noDay: "Dia desconhecido",
      summary: (count: number, average: string, best: string) =>
        `${count === 1 ? "1 jogador" : `${format(count)} jogadores`} · potencial médio ${average} · melhor: ${best}`,
      lent: (count: number) => (count === 1 ? "1 emprestado" : `${format(count)} emprestados`),
      how: {
        label: "Como esta lista é feita?",
        note: "Jogadores criados pelo jogo que entraram neste clube com 17 anos ou menos e não se formaram em nenhum outro clube, pelo dia em que entraram. Os emprestados aparecem; os vendidos ou liberados, não.",
      },
      unmarked:
        "O editor não sabe como esta versão do jogo marca os jogadores que cria: os jovens do próprio clube vindos do banco de dados do jogo também aparecem na lista.",
      empty: (club: string) => `${club} não tem jogadores de revelação da base no momento.`,
      emptyHint: "Os jogadores de uma revelação aparecem aqui enquanto estão no clube. Veja outro clube para conhecer a base dele.",
      columns: {
        player: "Jogador",
        position: "Pos",
        born: "Nascimento",
        nation: "Nacionalidade",
        city: "Cidade de nascimento",
        ca: "HA",
        pa: "POT",
        actions: "Editar",
      },
      age: (age: number) => `${format(age)} anos`,
      joinedAt: (age: number) => `entrou com ${format(age)}`,
      onLoan: (club: string) => `Emprestado a ${club}`,
      youthContract: "Contrato de base",
      edit: (name: string) => `Editar ${name}`,
      editor: {
        label: (name: string) => `Editando ${name}`,
        reading: "Lendo os valores dele…",
        dateOfBirth: "Data de nascimento",
        nation: "Nacionalidade",
        city: "Cidade de nascimento",
        noCity: "Nenhuma no jogo",
        cityHint: "Cidades em que nasceram pessoas deste save",
        ca: "Habilidade atual",
        pa: "Habilidade potencial",
        save: "Salvar",
        saving: "Salvando…",
        cancel: "Cancelar",
        profile: "Perfil completo",
        profileTitle: "Posições, atributos e o resto, no perfil do jogador",
        nothing: "Nada a salvar: nenhum valor foi alterado.",
        saved: (count: number) => (count === 1 ? "1 alteração salva." : `${format(count)} alterações salvas.`),
        failed: (field: string, reason: string) => `${field}: ${reason}`,
        invalid: (field: string) => `${field}: não é um valor que ele aceita.`,
      },
      loading: "Lendo as revelações da base…",
      failed: (reason: string) => `Não foi possível ler as revelações da base: ${reason}`,
    },
    roles: {
      bgk: "Goleiro Construtor",
      ngk: "Goleiro Direto",
      sk: "Goleiro Líbero",
      lhk: "Goleiro de Linha",
      cb: "Zagueiro",
      bcb: "Zagueiro Construtor",
      ncb: "Zagueiro Direto",
      acb: "Zagueiro Avançado",
      ocb: "Zagueiro com Apoio",
      scb: "Zagueiro de Contenção",
      ccb: "Zagueiro de Cobertura",
      wcb: "Zagueiro Aberto",
      fb: "Lateral",
      ifb: "Lateral Invertido",
      pfb: "Lateral de Pressão",
      hfb: "Lateral de Contenção",
      wb: "Ala",
      iwb: "Ala Invertido",
      pwb: "Ala Armador",
      awb: "Ala Avançado",
      hwb: "Ala de Contenção",
      dm: "Volante",
      hb: "Volante de Contenção",
      ddm: "Volante Recuado",
      pdm: "Volante de Pressão",
      bbm: "Meio-campista de Área a Área",
      bbp: "Armador de Área a Área",
      cm: "Meio-campista Central",
      pcm: "Meio-campista de Pressão",
      scm: "Meio-campista de Proteção",
      chm: "Meio-campista de Corredor",
      wcm: "Meio-campista Aberto",
      ap: "Armador Ofensivo",
      am: "Meia Atacante",
      oam: "Meia Atacante de Referência",
      w: "Ponta",
      if: "Ponta Invertido",
      pw: "Ponta Armador",
      wfd: "Atacante Aberto",
      tw: "Ponta de Acompanhamento",
      iow: "Ponta Invertido de Referência",
      cfd: "Centroavante",
      dlf: "Atacante Recuado",
      p: "Oportunista",
      tcf: "Centroavante de Acompanhamento",
      ocf: "Centroavante de Referência",
    } as Record<string, string>,
    reasons: {
      listed: () => "Na lista de transferências",
      freeAgent: () => "Sem clube",
      expiring: (value: string) => `Contrato termina em ${value} dias`,
      releaseClause: (value: string) => `Cláusula de rescisão ${value}`,
      fringe: () => "Não é titular no clube dele",
      keyPlayer: () => "Jogador-chave no clube dele",
      unwanted: () => "Fora dos planos no clube dele",
      overBudget: (value: string) => `${value} acima do seu orçamento`,
      stretch: (value: string) => `Um pouco acima do orçamento (+${value})`,
      wageHigh: (value: string) => `Salário ${value}/sem acima da sua margem`,
      biggerClub: () => "Joga em um clube maior",
      smallerClub: () => "Joga em um clube menor",
      reputationGap: () => "Nome grande demais para o seu clube",
      ambitious: () => "Ambicioso: aceitaria bem o passo adiante",
      notForSale: () => "Não está à venda",
    } as Record<string, (value: string) => string>,
    departureReasons: {
      surplus: (value: string) => `Linha cheia (${value} jogadores)`,
      belowLevel: () => "Abaixo do nível do elenco",
      ageing: (value: string) => `Envelhecendo (${value})`,
      expiring: (value: string) => `Contrato termina em ${value} dias`,
      highWage: (value: string) => `Salário alto para a função (${value}/sem)`,
      unhappy: () => "Insatisfeito",
      lowMorale: () => "Moral baixa",
      blocked: () => "Precisa de jogos para crescer",
      unwanted: () => "Status no elenco: fora dos planos",
      listed: () => "Já está na lista de transferências",
    } as Record<string, (value: string) => string>,
  },

  /** "My club" (`MyClub`): the page the app opens on, about the club the user manages in the save. */
  home: {
    nav: "Meu clube",
    loading: "Procurando o seu clube…",
    failed: (reason: string) => `Não foi possível procurar o seu clube: ${reason}`,
    manager: (name: string) => `Treinador: ${name}`,
    following: "Um clube que você acompanha",
    clubsLabel: "Seus clubes",
    openProfile: "Perfil do clube",
    openProfileTitle: "Abre este clube na aba Clubes: instalações, finanças, estádio e mais",
    noClubTitle: "Você não treina nenhum clube neste save",
    noClubText: "Escolha aqui um clube para acompanhar: o elenco, quem merece atenção e as ações sobre o time todo.",
    chooseAnother: "Escolher outro clube",
    searchLabel: "Clube a acompanhar",
    squad: "Elenco",
    cards: {
      label: "Quem merece atenção",
      lowMorale: "Moral baixa",
      tired: "Cansados",
      contracts: "Contratos acabando",
      injuredHint: "Jogadores com uma lesão",
      bannedHint: "Jogadores com uma suspensão",
      lowMoraleHint: (below: string) => `Jogadores com moral abaixo de ${below}`,
      tiredHint: (below: string) => `Jogadores com energia abaixo de ${below}`,
      unrestHint: "Jogadores com quem alguns companheiros estão insatisfeitos",
      contractsHint: (months: number) => `Jogadores cujos contratos terminam em até ${months} meses`,
      none: "Nenhum",
      more: (count: number) => `e mais ${format(count)}`,
    },
  },

  /**
   * Recipes (`RecipeMenu`): ready-made sets of changes to one player or one club. The Recipes button opens a menu of
   * them; the dialog of the one picked lists what it would write, like the preview of a mass edit, whose words for
   * Apply, the columns and the outcome it shares.
   */
  recipes: {
    button: "Receitas",
    buttonTitle: "Conjuntos prontos de alterações, com prévia antes",
    names: {
      wonderkid: "Criar uma joia",
      injuryProof: "À prova de lesões",
      longCareer: "Estender a carreira",
      richClub: "Deixar o clube rico",
      topFacilities: "Instalações de ponta",
    },
    notes: {
      wonderkid:
        "21 anos ou menos: habilidade potencial de pelo menos 180, habilidade e atributos de acordo com a idade. Valores " +
        "mais altos permanecem.",
      injuryProof: "Propensão a lesões 1, condição física natural 20, resistência de pelo menos 15, lesões curadas.",
      longCareer:
        "Sem aposentadoria planejada, mais três anos de contrato, condição física natural 20, profissionalismo de pelo menos 18.",
      richClub: "Saldo, orçamento de transferências e orçamentos salariais até o nível dos clubes mais ricos.",
      topFacilities: "As cinco instalações em 20.",
    },
    tooOld: (oldest: number) => `Para jogadores de ${oldest} anos ou menos`,
    command: (recipe: string) => `Receita: ${recipe}`,
    working: "Calculando as alterações…",
    summary: (changes: number, kept: number, left: number) =>
      [
        changeCount(changes),
        kept > 0 && (kept === 1 ? "1 valor já é igual ou melhor" : `${format(kept)} valores já são iguais ou melhores`),
        left > 0 && valuesLeftAlone(left),
      ]
        .filter(Boolean)
        .join(" · "),
    tableLabel: "Alterações que a receita faria",
    keptHeading: (count: number) =>
      count === 1 ? "1 valor permanece como está: já é igual ou melhor" : `${format(count)} valores permanecem como estão: já são iguais ou melhores`,
    keptLabel: "Valores que já são iguais ou melhores",
    valueColumn: "Valor",
    leftLabel: "O que a receita mantém",
    undo: "Desfazer esta receita",
    undoTitle: "Grava de volta no jogo tudo o que esta receita alterou",
  },

  /**
   * A player's development, from the records the app keeps of a career (`PlayerProgress`): the Development tab of his
   * profile, the note under his abilities in its header, and the change beside an ability in a squad's table.
   */
  progress: {
    tabsLabel: "Seções do perfil do jogador",
    tabs: { overview: "Perfil", progress: "Evolução" },
    lockedWhileEdited: "Termine a edição para abrir esta aba",
    openTab: "Abrir a aba Evolução",
    loading: "Lendo os registros…",
    failed: (reason: string) => `Não foi possível ler os registros: ${reason}`,
    since: (date: string) => `desde ${date}`,
    change: (from: string, to: string, date: string) => `${from} → ${to} desde ${date}`,
    rangeLabel: "Período",
    ranges: { quarter: "3 meses", year: "1 ano", all: "Tudo" },
    recorded: (count: number, first: string) => `Registros: ${count} · o primeiro em ${first}`,
    abilityTitle: "Habilidade",
    valueTitle: "Valor",
    attributesTitle: "Atributos que mudaram",
    noAttributeChanges: (date: string) => `Nenhum atributo mudou desde ${date}.`,
    emptyTitle: "Nada para comparar ainda",
    emptyText:
      "O app anota as habilidades, o valor e os atributos de cada jogador cerca de uma vez por semana do tempo do jogo, sempre que lê os dados do jogo. Continue jogando, leia os dados de novo e a evolução deste jogador aparece aqui.",
    offTitle: "Sem registros para este save",
    offText:
      "O app guarda registros de um save com um treinador seu, em uma versão do jogo cujos dados passam nas verificações dele.",
  },

  /**
   * The command palette (`CommandPalette`): one box that finds players, staff, clubs and the app's commands. The
   * keyboard shortcuts (`shortcuts.ts`) take their key names from here.
   */
  palette: {
    button: "Buscar",
    title: "Buscar ou executar um comando",
    placeholder: "Buscar jogadores, funcionários, clubes e comandos",
    placeholderCommands: "Buscar comandos",
    commands: "Comandos",
    goTo: (list: string) => `Ir para ${list}`,
    searchList: "Buscar nesta lista",
    editProfile: "Editar este perfil",
    doneEditing: "Concluir a edição deste perfil",
    applyChanges: "Aplicar as alterações a este perfil",
    showAll: (count: number, list: string) => `Mostrar todos os ${format(count)} em ${list}`,
    searching: "Buscando…",
    empty: (query: string) => `Nada corresponde a “${query}”.`,
    notConnected: "Conecte-se ao jogo para buscar jogadores, funcionários e clubes dele.",
    failed: (reason: string) => `A busca falhou: ${reason}`,
    hintMove: "Mover",
    hintOpen: "Abrir",
    hintClose: "Fechar",
    keys: { ctrl: "Ctrl", shift: "Shift", enter: "Enter", escape: "Esc" },
  },

  /**
   * What's new (`WhatsNewDialog`): what a version brings. It opens by itself the first time the app starts after an
   * update, and from the foot of the window or the palette when asked.
   */
  whatsNew: {
    title: (version: string) => `Novidades da ${version}`,
    updated: "O FMLibreEditor foi atualizado.",
    version: (version: string) => `Versão ${version}`,
    thanks: (names: string) => `Obrigado a ${names}.`,
    allChanges: "Todas as alterações",
    allChangesTitle: "Abre as notas completas desta versão no GitHub",
    close: "Entendi",
    link: "Novidades",
    command: "Novidades desta versão",
    versions: {
      "0.5.5": [
        {
          title: "FM 27.1.1.",
          text: "A atualização de 24 de novembro é reconhecida no Game Pass, na Steam e no Mac, e tudo funciona nela como antes. Quando sair uma atualização futura, o app continua lendo as finanças dos clubes e a tática em uso até que uma versão que a reconheça chegue.",
        },
        {
          title: "Aba Competições.",
          text: "Veja e altere as regras de elenco de cada competição, como quantos jogadores estrangeiros um elenco pode inscrever, para esta temporada e a próxima separadamente. No Windows e em Macs com chip Apple.",
        },
        {
          title: "Empréstimos.",
          text: "O novo Empréstimo do diálogo Transferir agenda um empréstimo para o dia seguinte do jogo, dentro ou fora de uma janela de transferências. Você define o último dia, a parte do salário que o outro clube paga, uma taxa mensal e, se quiser, uma opção de compra. No Windows e em Macs com chip Apple.",
        },
        {
          title: "Receitas.",
          text: "Conjuntos prontos de alterações para um jogador ou um clube: Criar uma joia, À prova de lesões, Estender a carreira, Deixar o clube rico e Instalações de ponta. Cada uma mostra o que vai mudar antes de gravar qualquer coisa, e um Desfazer reverte tudo.",
        },
        {
          title: "Evolução.",
          text: "O app guarda um registro semanal de cada jogador conforme lê o jogo, e o perfil do jogador o mostra em uma nova aba Evolução: habilidade, potencial, valor e atributos ao longo da sua carreira.",
        },
        {
          title: "Times B.",
          text: "A aba Elenco de um clube mostra os times B depois dos times principais, como o Castilla do Real Madrid, e as ações de time funcionam neles também.",
        },
        {
          title: "Avisos mais curtos.",
          text: "As notas dos botões têm uma linha cada, em uma caixa pequena em vez de uma faixa longa na janela.",
        },
      ],
      "0.5.4": [
        {
          title: "Transferências no histórico do jogador.",
          text: "Transferir, agora a primeira opção ao mover um jogador, agenda a transferência para o dia seguinte do jogo. O jogo a faz como uma das dele: paga o valor e guarda a transferência no histórico de carreira, com as partidas desta temporada no clube antigo em uma linha própria. “Mover agora” ainda move o jogador na hora.",
        },
        {
          title: "Time no auge e Destruir.",
          text: "Na aba Elenco de um clube, um clique cura, motiva e recupera o time todo e leva o entrosamento e a tática ao máximo; Destruir, depois de uma pergunta, faz o oposto. Um Desfazer reverte qualquer um dos dois, e as ações individuais estão em Mais ações.",
        },
        {
          title: "Traços em lote.",
          text: "Em Mais ações, na aba Elenco de um clube, Traços em lote dá a todos os jogadores do time os traços que você escolher, ou os remove, e deixa os outros traços como estão. Um Desfazer reverte tudo.",
        },
        {
          title: "Mover todos os funcionários.",
          text: "A aba Funcionários de um clube move todos os funcionários para outro clube de uma vez, cada um na mesma função, e um Desfazer traz todos de volta.",
        },
        {
          title: "Seleções.",
          text: "O elenco principal de uma seleção ganha Curar todos, Motivar todos e Recuperar todos, e a tabela mostra energia, ritmo de jogo e moral.",
        },
        {
          title: "Contratos de patrocínio.",
          text: "As finanças de um clube listam os contratos de patrocínio, somente leitura: quanto cada um paga por temporada e no total, a duração e o que um rebaixamento muda. Por enquanto no Game Pass 0.9.2524.0.",
        },
        {
          title: "Correção.",
          text: "Em algumas carreiras a verificação dos funcionários falhava mesmo com a leitura certa, o que deixava os funcionários somente leitura e recusava Curar, Entrosamento máximo e Táticas no máximo. Agora ela passa.",
        },
      ],
      "0.5.3": [
        {
          title: "A atualização do FM27 de 17 de novembro.",
          text: "No Windows e no macOS, o Game Pass 0.9.2524.0 e a build 26620374 da Steam são versões reconhecidas, e as finanças dos clubes e a tática que o seu time joga voltam a ser lidas onde a atualização as moveu.",
        },
        {
          title: "Seleções.",
          text: "O seletor acima da lista de clubes mostra as seleções masculina e feminina de cada país: o elenco de uma seleção, as categorias de base (Sub-21, Sub-20 e outras) com os respectivos elencos, e a reputação de cada uma, que você pode editar.",
        },
        {
          title: "Premiação das ligas.",
          text: "A visão geral de um clube mostra o que a liga dele paga nesta temporada, por posição final e por jogo, e os valores podem ser alterados para todos os clubes da liga até o fim da temporada.",
        },
        {
          title: "Correção.",
          text: "Um save cujos jogadores da base nasceram depois de 2020 não falha mais na verificação que o editor faz antes de gravar.",
        },
      ],
      "0.5.2": [
        {
          title: "Meu clube.",
          text: "O app abre no clube que você treina: quem merece atenção, o dinheiro e as ações do elenco, em um só lugar. Sem um clube seu, você pode acompanhar um.",
        },
        {
          title: "Paleta de comandos.",
          text: "Ctrl+K (⌘K no Mac) encontra um jogador, um funcionário, um clube ou um comando, e atalhos movem entre as abas.",
        },
        {
          title: "Observação.",
          text: "Oportunidades no mercado, jogadores parecidos com um que você liberaria, uma comparação com o seu nº 1 na posição dele, relatórios do olheiro para salvar como imagem ou PDF, o elenco em um campo e as revelações da base.",
        },
        {
          title: "Renomear um jogador.",
          text: "Nome, sobrenome, nome popular e nome completo. O jogo guarda o novo nome nos saves.",
        },
        {
          title: "Contratos e funcionários.",
          text: "Estenda um contrato por cinco anos com um clique, ou some anos a vários em uma edição em massa. Dispense um funcionário, ou todos os de um clube, e traga-os de volta com um Desfazer.",
        },
        {
          title: "Táticas no máximo.",
          text: "Na aba Elenco de um clube, leva a familiaridade tática do time ao máximo. Os motivos de insatisfação agora usam as palavras do próprio jogo.",
        },
        {
          title: "Suas alterações, guardadas.",
          text: "As alterações de cada carreira ficam na aba Alterações depois de reiniciar, e você pode buscá-las, filtrá-las e exportá-las.",
        },
        {
          title: "Filtros de clubes.",
          text: "País, liga e reputação; Edição em massa e Exportar usam os clubes que a lista mostra.",
        },
        {
          title: "Russo e japonês.",
          text: "Mais dois idiomas. A atualização da Steam de 12 de novembro também é uma versão reconhecida.",
        },
      ],
    } as Record<string, { title: string; text: string }[]>,
  },

  errors,
};

