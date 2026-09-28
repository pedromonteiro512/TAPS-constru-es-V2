/* ==========================================================================
   TAPS CONSTRUÇÕES — script.js
   Lógica do lado do cliente: cadastro, catálogo, busca, filtros,
   carrinho, cálculos e pagamento PIX (padrão EMV/BR Code).

   ------------------------------------------------------------------
   PONTOS DE INTEGRAÇÃO FUTURA COM BACKEND (identificados no código):
   1) cadastrarCliente()  -> substituir validação local por
                             POST /api/clientes (HTTPS) + sessão/token.
   2) gerarPagamentoPix() -> substituir o PIX estático local por
                             POST /api/pedidos, com BR Code dinâmico
                             gerado por um provedor de pagamentos e
                             confirmação real via webhook.
   Nenhuma credencial/segredo deve morar neste arquivo. A chave PIX
   abaixo é pública por natureza (recebimento), por isso pode ficar aqui.
   ------------------------------------------------------------------
   ========================================================================== */

'use strict';

/* ==========================================================================
   1. CONFIGURAÇÃO DE PAGAMENTO
   ========================================================================== */
const PIX = {
  // Chave informada pelo responsável do projeto: 069 080 012 50 (tipo telefone).
  // No BR Code, chave telefone usa formato internacional com DDI:
  chave: '+556908001250',
  chaveExibicao: '069 080 012 50',
  nomeRecebedor: 'TAPS CONSTRUCOES', // sem acentos, máx. 25 caracteres (padrão EMV)
  cidade: 'PORTO VELHO'              // máx. 15 caracteres
};

/* ==========================================================================
   2. CATÁLOGO — fonte única de preços e dados (facilita manutenção)
   ========================================================================== */
const CATEGORIAS = [
  { id: 'todos',       rotulo: 'Todos' },
  { id: 'materiais',   rotulo: 'Materiais' },
  { id: 'ferramentas', rotulo: 'Ferramentas' },
  { id: 'maquinas',    rotulo: 'Máquinas' },
  { id: 'eletrica',    rotulo: 'Elétrica' },
  { id: 'hidraulica',  rotulo: 'Hidráulica' },
  { id: 'epis',        rotulo: 'EPIs' },
  { id: 'outros',      rotulo: 'Outros' }
];

const PRODUTOS = [
  { id: 1,  nome: 'Cimento CP-II 32',            cat: 'materiais',   preco: 35.90,   un: 'saco 50 kg',   icone: 'cimento',   desc: 'Cimento Portland composto para estruturas, alvenaria e contrapiso.', specs: ['CP-II-E-32', 'Saco de 50 kg', 'ABNT NBR 11578'] },
  { id: 2,  nome: 'Tijolo cerâmico 9 furos',     cat: 'materiais',   preco: 1.20,    un: 'unidade',      icone: 'tijolo',    desc: 'Tijolo furado para alvenaria de vedação e elevação de paredes.', specs: ['25 × 12,5 × 6,5 cm', '9 furos', 'Resistência média'] },
  { id: 3,  nome: 'Bloco estrutural 14×19×39',   cat: 'materiais',   preco: 4.50,    un: 'unidade',      icone: 'bloco',     desc: 'Bloco de concreto para alvenaria estrutural e muros.', specs: ['14 × 19 × 39 cm', 'Concreto', 'Alta resistência'] },
  { id: 4,  nome: 'Argamassa colante AC-II',     cat: 'materiais',   preco: 24.90,   un: 'saco 20 kg',   icone: 'cimento',   desc: 'Argamassa colante para assentamento de cerâmicas e porcelanatos.', specs: ['AC-II', 'Saco de 20 kg', 'Interior e exterior'] },
  { id: 5,  nome: 'Cal hidratada CH-III',        cat: 'materiais',   preco: 18.50,   un: 'saco 20 kg',   icone: 'cimento',   desc: 'Cal para argamassas de assentamento, reboco e assentamento de blocos.', specs: ['CH-III', 'Saco de 20 kg', 'ABNT NBR 7175'] },
  { id: 6,  nome: 'Areia média lavada',          cat: 'materiais',   preco: 120.00,  un: 'm³',           icone: 'areia',     desc: 'Areia natural lavada para argamassa, concreto e contrapiso.', specs: ['Granulometria média', 'Lavada', 'Entrega por volume'] },
  { id: 7,  nome: 'Brita 1',                     cat: 'materiais',   preco: 135.00,  un: 'm³',           icone: 'brita',     desc: 'Pedra britada para concreto, drenagem e base de pisos.', specs: ['Fração 1 (9,5 a 19 mm)', 'Granito', 'Entrega por volume'] },
  { id: 8,  nome: 'Massa corrida PVA',           cat: 'materiais',   preco: 45.90,   un: 'lata 18 L',    icone: 'balde',     desc: 'Massa para nivelamento de paredes internas antes da pintura.', specs: ['Base PVA', 'Lata de 18 L', 'Uso interno'] },
  { id: 9,  nome: 'Vergalhão CA-50 10 mm',       cat: 'materiais',   preco: 46.90,   un: 'barra 12 m',   icone: 'vergalhao', desc: 'Aço CA-50 para armaduras de concreto armado.', specs: ['Ø 10 mm', 'Barra de 12 m', 'CA-50'] },
  { id: 10, nome: 'Prego 18×27',                 cat: 'materiais',   preco: 14.90,   un: 'kg',           icone: 'prego',     desc: 'Prego comum para estruturas de madeira, fôrmas e andaimes.', specs: ['18 × 27 mm', 'Vendido por kg', 'Aco galvanizado leve'] },
  { id: 11, nome: 'Parafuso sextavado c/ bucha', cat: 'outros',      preco: 29.90,   un: 'cento',        icone: 'parafuso',  desc: 'Kit de fixação para montagem de estruturas e fixações em concreto.', specs: ['8 × 60 mm', 'Pacote com 100 un', 'Aço zinrado'] },
  { id: 12, nome: 'Lona plástica 200 micras',    cat: 'outros',      preco: 79.90,   un: 'rolo 3×50 m',  icone: 'lona',      desc: 'Lona para proteção de telhados, concretagens e coberturas de obra.', specs: ['200 micras', 'Rolo 3 × 50 m', 'Cor preta'] },
  { id: 13, nome: 'Cabo flexível 2,5 mm²',       cat: 'eletrica',    preco: 189.00,  un: 'rolo 100 m',   icone: 'fio',       desc: 'Cabo flexível para circuitos de tomadas e iluminação.', specs: ['2,5 mm²', 'Rolo de 100 m', '750 V'] },
  { id: 14, nome: 'Disjuntor DR 40A',            cat: 'eletrica',    preco: 89.90,   un: 'unidade',      icone: 'eletrica',  desc: 'Disjuntor dreda residual para proteção de pessoas contra choques.', specs: ['40 A', 'Bipolar', 'Sensibilidade 30 mA'] },
  { id: 15, nome: 'Caixa de passagem 4"×2"',     cat: 'eletrica',    preco: 3.90,    un: 'unidade',      icone: 'bloco',     desc: 'Caixa de passagem para instalações elétricas embutidas.', specs: ['4 × 2 polegadas', 'PVC rígido', 'Com tampa'] },
  { id: 16, nome: 'Tubo PVC soldável 25 mm',     cat: 'hidraulica',  preco: 32.90,   un: 'barra 6 m',    icone: 'tubo',      desc: 'Tubo para água fria em instalações hidráulicas residenciais.', specs: ['Ø 25 mm', 'Barra de 6 m', 'Soldável'] },
  { id: 17, nome: 'Joelho PVC 25 mm',            cat: 'hidraulica',  preco: 1.90,    un: 'unidade',      icone: 'conexao',   desc: 'Conexão de 90° para mudança de direção em tubos de PVC.', specs: ['Ø 25 mm', '90°', 'Soldável'] },
  { id: 18, nome: "Caixa d'água 1.000 L",        cat: 'hidraulica',  preco: 389.00,  un: 'unidade',      icone: 'tanque',    desc: 'Reservatório de polietileno para armazenamento de água da obra.', specs: ['1.000 litros', 'Polietileno', 'Com tampa'] },
  { id: 19, nome: 'Capacete de segurança',       cat: 'epis',        preco: 24.90,   un: 'unidade',      icone: 'capacete',  desc: 'Proteção de cabeça com jugular, norma CA aprovada.', specs: ['Classe B', 'Ajuste de tamanho', 'CA aprovado'] },
  { id: 20, nome: 'Luva de raspa',               cat: 'epis',        preco: 9.90,    un: 'par',          icone: 'luva',      desc: 'Luva de couro para proteção mecânica no manuseio de materiais.', specs: ['Couro raspa', 'Punho longo', 'CA aprovado'] },
  { id: 21, nome: 'Bota c/ biqueira de aço',     cat: 'epis',        preco: 89.90,   un: 'par',          icone: 'bota',      desc: 'Calçado de segurança com proteção contra impactos e perfuração.', specs: ['Biqueira de aço', 'Solado antiderrapante', 'CA aprovado'] },
  { id: 22, nome: 'Óculos de proteção',          cat: 'epis',        preco: 12.90,   un: 'unidade',      icone: 'oculos',    desc: 'Óculos contra impacto de partículas em corte, lixamento e perfuração.', specs: ['Lente policarbonato', 'Anti-embaçante', 'Ajustável'] },
  { id: 23, nome: 'Furadeira de impacto 550 W',  cat: 'ferramentas', preco: 189.00,  un: 'unidade',      icone: 'furadeira', desc: 'Furadeira para concreto, madeira e metal com função impacto.', specs: ['550 W', 'Mandril 13 mm', 'Função impacto'] },
  { id: 24, nome: 'Parafusadeira a bateria',     cat: 'ferramentas', preco: 159.00,  un: 'unidade',      icone: 'furadeira', desc: 'Parafusadeira compacta para montagens e fixações rápidas.', specs: ['12 V', 'Bateria de lítio', 'Maleta completa'] },
  { id: 25, nome: 'Martelo de carpinteiro',      cat: 'ferramentas', preco: 32.90,   un: 'unidade',      icone: 'martelo',   desc: 'Martelo com garras para extração de pregos e carpintaria geral.', specs: ['Cabeça 27 mm', 'Cabo de aço', 'Empunhadura emborrachada'] },
  { id: 26, nome: 'Marreta 2 kg',                cat: 'ferramentas', preco: 45.90,   un: 'unidade',      icone: 'marreta',   desc: 'Marreta para demolições leves, estacas e trabalhos com cinzéis.', specs: ['2 kg', 'Cabo de madeira', 'Cabeça forjada'] },
  { id: 27, nome: 'Jogo de chaves 6 peças',      cat: 'ferramentas', preco: 29.90,   un: 'jogo',         icone: 'chavefenda', desc: 'Chaves de fenda e Phillips para montagens e manutenção.', specs: ['6 peças', 'Ponta magnetizada', 'Cabo isolado'] },
  { id: 28, nome: 'Alicate universal 8"',        cat: 'ferramentas', preco: 24.90,   un: 'unidade',      icone: 'alicate',   desc: 'Alicate para corte, prender e torcer fios e materiais leves.', specs: ['8 polegadas', 'Aço forjado', 'Isolado 1000 V'] },
  { id: 29, nome: 'Serra circular 7¼"',          cat: 'ferramentas', preco: 289.00,  un: 'unidade',      icone: 'serra',     desc: 'Serra circular para cortes retos em madeira, compensado e drywall.', specs: ['Disco 7¼"', '1400 W', 'Corte ajustável'] },
  { id: 30, nome: 'Trena 5 m',                   cat: 'ferramentas', preco: 12.90,   un: 'unidade',      icone: 'trena',     desc: 'Fita métrica com travamento para medições na obra.', specs: ['5 metros', 'Fita de aço', 'Trava de segurança'] },
  { id: 31, nome: 'Nível de alumínio 60 cm',     cat: 'ferramentas', preco: 34.90,   un: 'unidade',      icone: 'nivel',     desc: 'Nível para conferência de prumo e esquadro em alvenaria.', specs: ['60 cm', '3 bolhas', 'Alumínio'] },
  { id: 32, nome: 'Betoneira 120 L',             cat: 'ferramentas', preco: 1490.00, un: 'unidade',      icone: 'betoneira', desc: 'Betoneira compacta para pequenas obras e reformas — para venda.', specs: ['120 litros', 'Motor 1/2 CV', 'Estrutura em aço'] }
];

const MAQUINAS = [
  { id: 101, nome: 'Betoneira 400 L',            preco: 85.00,  un: 'diária', icone: 'betoneira',   disponivel: true,  desc: 'Betoneira de grande capacidade para concretagens e argamassas.', specs: ['400 litros', 'Motor 2 CV', 'Ideal para obras médias'] },
  { id: 102, nome: 'Compactador de solo (sapo)', preco: 120.00, un: 'diária', icone: 'compactador', disponivel: true,  desc: 'Compactação de solo e base para pisos e calçadas.', specs: ['Força de impacto 13 kN', 'Tanque de água', 'Ideal para valas'] },
  { id: 103, nome: 'Placa vibratória',           preco: 95.00,  un: 'diária', icone: 'compactador', disponivel: true,  desc: 'Compactação de superfícies em áreas abertas e pavimentos.', specs: ['Placa 50 × 40 cm', 'Avanço 24 m/min', 'Leve e transportável'] },
  { id: 104, nome: 'Andaime (módulo)',           preco: 12.00,  un: 'diária', icone: 'andaime',     disponivel: true,  desc: 'Módulo de andaime tubular para serviços em altura e fachadas.', specs: ['Módulo 1 × 1 m', 'Aço pintado', 'Sob medida por altura'] },
  { id: 105, nome: 'Cortadora de piso 14"',      preco: 150.00, un: 'diária', icone: 'cortadora',   disponivel: true,  desc: 'Corte de pisos, cerâmicas e concreto com disco diamantado.', specs: ['Disco 14 polegadas', 'Motor 5 CV', 'Com carrinho'] },
  { id: 106, nome: 'Gerador 5 kVA',              preco: 180.00, un: 'diária', icone: 'gerador',     disponivel: true,  desc: 'Energia de emergência para ferramentas e iluminação na obra.', specs: ['5 kVA', 'A gasolina', 'Partida manual'] },
  { id: 107, nome: 'Martelete SDS Plus',         preco: 65.00,  un: 'diária', icone: 'martelete',   disponivel: true,  desc: 'Perfuração de concreto, alvenaria e instalação de fixações.', specs: ['SDS Plus', '800 W', 'Com maleta e brocas'] },
  { id: 108, nome: 'Rompedor SDS Max',           preco: 90.00,  un: 'diária', icone: 'martelete',   disponivel: true,  desc: 'Demolição de concreto, remoção de reboco e pisos.', specs: ['SDS Max', '1500 W', 'Alta força de impacto'] },
  { id: 109, nome: 'Vibrador de concreto 2,2 cv', preco: 55.00, un: 'diária', icone: 'vibrador',    disponivel: false, desc: 'Adensamento de concreto em vigas, pilares e lajes.', specs: ['Agulha 45 mm', 'Motor 2,2 cv', 'Mangueira 5 m'] },
  { id: 110, nome: 'Retroescavadeira 4×2',       preco: 650.00, un: 'diária', icone: 'retro',       disponivel: true,  desc: 'Escavação, demolição e movimentação de terra com operador.', specs: ['Caçamba e balde', 'Com operador', 'Sujeita à agenda'] },
  { id: 111, nome: 'Escavadeira hidráulica 20 t', preco: 980.00, un: 'diária', icone: 'escavadeira', disponivel: false, desc: 'Escavações pesadas e movimento de grande volume de terra.', specs: ['20 toneladas', 'Com operador', 'Reserva sob consulta'] }
];

/* ==========================================================================
   3. ILUSTRAÇÕES TÉCNICAS DOS PRODUTOS (SVG autoral)
      Cada item referencia um desenho; para usar fotos reais no futuro,
      basta trocar `icone` por `foto` apontando para assets/images/.
   ========================================================================== */
const ICONES = {
  cimento:    '<path d="M30 26h36l7 46H23z"/><path d="M30 26l-6-9h48l-6 9"/><path class="l" d="M34 47h28"/>',
  tijolo:     '<rect x="14" y="24" width="30" height="14"/><rect x="48" y="24" width="34" height="14"/><rect x="14" y="42" width="68" height="14"/><rect x="14" y="60" width="34" height="14"/><rect x="52" y="60" width="30" height="14"/>',
  bloco:      '<rect x="27" y="24" width="42" height="48"/><rect x="35" y="33" width="10" height="30"/><rect x="51" y="33" width="10" height="30"/>',
  areia:      '<path d="M12 70L38 36l12 14 10-12 24 32z"/><path class="l" d="M44 70h14"/>',
  brita:      '<path d="M22 42l10-8 12 6-2 12-14 4z"/><path d="M50 30l14-4 10 10-6 12-16-2z"/><path d="M36 58l14-4 12 8-8 12-16-4z"/>',
  vergalhao:  '<path d="M20 76L72 24"/><path d="M44 44l8 8" class="l"/><path d="M32 82L84 30"/><path d="M54 52l8 8" class="l"/><path d="M12 64L64 12"/><path d="M34 34l8 8" class="l"/>',
  fio:        '<circle cx="42" cy="48" r="26"/><circle cx="42" cy="48" r="11"/><path class="l" d="M68 48c12 2 10 22-4 24"/>',
  eletrica:   '<rect x="31" y="20" width="34" height="56"/><path d="M39 20v-8M57 20v-8M39 76v8M57 76v8"/><path d="M39 34h18M48 34v12"/><rect class="f" x="39" y="58" width="18" height="10"/>',
  tubo:       '<path d="M14 38h56v16a10 10 0 01-10 10H40" stroke-width="12"/><path class="l" d="M38 30v16M62 30v16" stroke-width="5"/>',
  conexao:    '<path d="M36 18h24v16H36z"/><path d="M18 40h60v16H18z"/><path d="M41 56h14v22H41z"/>',
  parafuso:   '<path d="M48 10l15 9v12l-15 9-15-9V19z"/><path d="M48 40v36"/><path class="l" d="M41 48h14M41 56h14M41 64h14M41 72h14" stroke-width="2.5"/>',
  capacete:   '<path d="M22 60a26 26 0 0152 0"/><path d="M12 60h72"/><path class="l" d="M48 34v-9" stroke-width="5"/>',
  furadeira:  '<rect x="14" y="30" width="42" height="17"/><path d="M56 34h8v9h-8z"/><path class="l" d="M64 38.5h18"/><path d="M24 47v13h12v-13"/><path class="l" d="M28 60v6"/><path d="M14 30v-6h10"/>',
  martelo:    '<path d="M24 22h30v14H24z"/><path d="M54 22l16 7-16 7z"/><path d="M32 36L52 82"/>',
  marreta:    '<rect x="20" y="20" width="46" height="20" rx="4"/><path class="l" d="M28 30h30" stroke-width="4"/><path d="M38 40l14 44"/>',
  chavefenda: '<rect class="f" x="40" y="12" width="16" height="24" rx="7"/><path d="M48 36v32"/><path d="M43 68l5 14 5-14"/>',
  alicate:    '<path d="M41 12l14 30M55 12L41 42"/><path d="M41 42L28 82M55 42l13 40"/><circle class="f" cx="48" cy="44" r="4"/>',
  serra:      '<circle cx="48" cy="42" r="25"/><circle cx="48" cy="42" r="7"/><path d="M12 80h72"/><path class="l" d="M27 60a25 25 0 0042 0"/>',
  trena:      '<rect x="14" y="42" width="30" height="30"/><circle cx="29" cy="57" r="5"/><path d="M44 54h22l16-14"/><path class="l" d="M58 54h8"/><path d="M82 40v-8"/>',
  nivel:      '<rect x="10" y="38" width="76" height="20"/><rect x="38" y="43" width="20" height="10"/><path class="l" d="M48 40v16" stroke-dasharray="3 3"/>',
  betoneira:  '<ellipse cx="40" cy="36" rx="24" ry="17" transform="rotate(-24 40 36)"/><circle class="l" cx="40" cy="36" r="8"/><path d="M26 50l-8 30h56l-9-27"/><rect x="58" y="60" width="18" height="14"/><circle cx="30" cy="82" r="4"/><circle cx="60" cy="82" r="4"/>',
  compactador:'<rect x="18" y="66" width="50" height="10"/><path d="M34 66V42h26v24"/><rect x="26" y="22" width="38" height="20"/><path class="l" d="M64 40l16 28"/><path d="M56 22v-8"/>',
  andaime:    '<path d="M22 14v68M74 14v68"/><path d="M22 30h52M22 50h52M22 70h52"/><path class="l" d="M22 30l52 20"/>',
  cortadora:  '<circle cx="54" cy="38" r="22"/><circle cx="54" cy="38" r="6"/><path d="M12 68h64"/><rect x="28" y="56" width="18" height="12"/><path class="l" d="M32 14l44 12"/>',
  gerador:    '<rect x="14" y="34" width="66" height="38"/><path d="M22 48h18M22 56h18M22 64h18"/><rect x="50" y="44" width="20" height="16"/><path class="l" d="M70 34V20h10"/>',
  martelete:  '<rect x="36" y="18" width="24" height="32" rx="3"/><path d="M48 50v26"/><path class="l" d="M60 26h16"/><path d="M36 30h-8M40 50h16"/>',
  vibrador:   '<rect x="38" y="14" width="20" height="28" rx="3"/><path d="M48 42c2 14-8 16-8 28"/><ellipse class="l" cx="40" cy="76" rx="9" ry="7"/>',
  retro:      '<rect x="20" y="46" width="38" height="18"/><path d="M28 46V34h12v12"/><circle cx="30" cy="70" r="8"/><circle cx="54" cy="70" r="8"/><path d="M58 50l16 8"/><path d="M74 58v10h10"/><path d="M20 46l-9-13m0 0l-4 8"/>',
  escavadeira:'<rect x="18" y="52" width="36" height="16"/><path d="M26 52V40h12v12"/><rect x="14" y="70" width="46" height="10"/><path d="M54 54l16-14 10 12"/><path class="l" d="M80 52l-12 2 5 10z"/><path class="l" d="M36 46v-4"/>',
  bota:       '<path d="M32 18h20v26c0 7 7 9 15 11 8 2 13 6 13 13v4H32z"/><path class="l" d="M28 72h56" stroke-width="5"/>',
  luva:       '<path d="M32 44V22a5 5 0 0110 0v16m0-18a5 5 0 0110 0v18m0-14a5 5 0 0110 0v22"/><path d="M32 44v22c0 10 7 16 16 16s14-6 14-16"/><path class="l" d="M36 66h22" stroke-width="4"/>',
  oculos:     '<circle cx="32" cy="50" r="13"/><circle cx="64" cy="50" r="13"/><path d="M45 50h6"/><path d="M19 48H8M77 48h11"/>',
  balde:      '<path d="M28 32h40l-5 40H33z"/><path d="M30 32c2-12 34-12 36 0"/><path class="l" d="M31 46h34"/>',
  lona:       '<rect x="24" y="24" width="48" height="40"/><path d="M28 64l6 8 6-8 6 8 6-8 6 8 6-8"/><path class="l" d="M24 36h48"/>',
  prego:      '<path d="M34 14h28"/><path d="M48 14v52"/><path class="f" d="M42 66h12l-6 14z"/>',
  tanque:     '<rect x="24" y="30" width="48" height="42" rx="5"/><rect x="36" y="20" width="24" height="10"/><path class="l" d="M24 50h48"/>'
};

/** Monta o SVG técnico de um item. */
function iconeSVG(nome, alt) {
  const corpo = ICONES[nome] || ICONES.cimento;
  return `<svg class="prod-img" viewBox="0 0 96 96" role="img" aria-label="${alt}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`;
}

/* ==========================================================================
   4. ESTADO E UTILITÁRIOS
   ========================================================================== */
const estado = { busca: '', filtro: 'todos' };
let carrinho = [];          // [{ id, tipo: 'produto'|'maquina', qtd }]
let pedidoAtual = null;     // { numero, total } do checkout em andamento
let estadoDetalhe = null;   // item aberto no modal de detalhes

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Remove acentos e deixa minúsculo — para buscas. */
const normalizar = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Busca um item do catálogo pelo id+tipo (preços NUNCA vêm do storage). */
function buscarItem(id, tipo) {
  const lista = tipo === 'maquina' ? MAQUINAS : PRODUTOS;
  return lista.find((p) => p.id === Number(id));
}

/** Converte qualquer entrada em quantidade inteira segura (1..max). */
function quantidadeSegura(valor, max = 999) {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, max);
}

/* ==========================================================================
   5. VALIDAÇÕES DO CADASTRO
   ========================================================================== */

/** Valida CPF pelos dígitos verificadores. */
function validarCPF(valor) {
  const cpf = valor.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
  if ((soma * 10) % 11 % 10 !== Number(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
  return (soma * 10) % 11 % 10 === Number(cpf[10]);
}

/** Valida RG (formatos alfanuméricos usados por órgãos emissores brasileiros). */
function validarRG(valor) {
  const rg = valor.trim().toUpperCase();
  if (!/^[0-9A-Z.\-\s]{5,14}$/.test(rg)) return false;
  const limpo = rg.replace(/[^0-9A-Z]/g, '');
  return limpo.length >= 5 && /\d/.test(limpo);
}

/** Exige nome + sobrenome com apenas letras. */
function validarNome(valor) {
  const partes = valor.trim().split(/\s+/);
  if (partes.length < 2) return false;
  return partes.every((p) => /^[A-Za-zÀ-ÖØ-öø-ÿ']{2,}$/.test(p));
}

/** Telefone brasileiro com DDD (10 ou 11 dígitos). */
function validarTelefone(valor) {
  const tel = valor.replace(/\D/g, '');
  return /^[1-9]\d(?:(?:9\d{8})|(?:[2-5]\d{7}))$/.test(tel);
}

const validarTextoLivre = (v) => v.trim().length >= 2;

const CAMPOS_FORM = [
  { input: '#fcpf',    erro: '#err-cpf',    validar: validarCPF,             msg: 'Informe um CPF válido.' },
  { input: '#frg',     erro: '#err-rg',     validar: validarRG,              msg: 'Informe um RG válido (apenas letras, números, pontos e traço).' },
  { input: '#fnome',   erro: '#err-nome',   validar: validarNome,            msg: 'Preencha seu nome completo (nome e sobrenome).' },
  { input: '#fbairro', erro: '#err-bairro', validar: validarTextoLivre,      msg: 'Informe seu bairro.' },
  { input: '#fcidade', erro: '#err-cidade', validar: validarTextoLivre,      msg: 'Informe sua cidade.' },
  { input: '#ftel',    erro: '#err-tel',    validar: validarTelefone,        msg: 'Informe um número de telefone válido com DDD.' }
];

/** Marca/desmarca o erro de um campo. */
function definirErro(campo, msg) {
  const input = $(campo.input);
  const saida = $(campo.erro);
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  saida.textContent = msg || '';
  return !msg;
}

/** Limpa os erros do formulário. */
function limparErros() {
  CAMPOS_FORM.forEach((c) => definirErro(c, ''));
}

/** Valida todo o cadastro; devolve true se estiver tudo certo. */
function validarCadastro() {
  let primeiroInvalido = null;
  CAMPOS_FORM.forEach((campo) => {
    const input = $(campo.input);
    const ok = input.value.trim() !== '' && campo.validar(input.value);
    if (!ok && !primeiroInvalido) primeiroInvalido = input;
    definirErro(campo, ok ? '' : campo.msg);
  });
  if (primeiroInvalido) primeiroInvalido.focus();
  return !primeiroInvalido;
}

/* ==========================================================================
   6. MÁSCARAS DE ENTRADA
   ========================================================================== */
function aplicarMascaras() {
  // Telefone: (69) 90000-0000
  $('#ftel').addEventListener('input', (e) => {
    let d = e.target.value.replace(/\D/g, '').slice(0, 11);
    let out = '';
    if (d.length > 0) out = '(' + d.slice(0, 2);
    if (d.length >= 3) out += ') ' + d.slice(2, d.length > 10 ? 7 : 6);
    if (d.length > (d.length > 10 ? 7 : 6)) out += '-' + d.slice(d.length > 10 ? 7 : 6);
    e.target.value = out;
  });

  // CPF: 000.000.000-00
  $('#fcpf').addEventListener('input', (e) => {
    let d = e.target.value.replace(/\D/g, '').slice(0, 11);
    e.target.value = d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  });

  // Limpa erro ao digitar
  CAMPOS_FORM.forEach((campo) => {
    $(campo.input).addEventListener('input', () => definirErro(campo, ''));
  });
}

/* ==========================================================================
   7. SESSÃO E ENTRADA NO SITE
   ========================================================================== */

/**
 * Registra o cliente e libera o catálogo.
 * SEGURANÇA: CPF e RG NÃO são persistidos — usados apenas para a validação
 * em memória. Em produção, o envio deve ser feito por HTTPS a um backend.
 */
function entrarNoSite(dados) {
  localStorage.setItem('taps_cliente', JSON.stringify({
    nome: dados.nome, bairro: dados.bairro, cidade: dados.cidade
  }));
  fecharGate();
  mostrarNotificacao(`Bem-vindo(a), ${dados.nome.split(' ')[0]}! Boas compras.`);
}

function fecharGate() {
  $('#gate').classList.add('oculto');
  $('#site').classList.remove('oculto');
  document.body.classList.remove('travado');
  atualizarPerfil();
  carregarProdutos();
}

function abrirGate() {
  $('#gate').classList.remove('oculto');
  $('#site').classList.add('oculto');
  document.body.classList.add('travado');
  $('#fcpf').focus();
}

function atualizarPerfil() {
  try {
    const dados = JSON.parse(localStorage.getItem('taps_cliente'));
    $('#perfilNome').textContent = dados ? dados.nome.split(' ')[0] : '';
  } catch { $('#perfilNome').textContent = ''; }
}

function sair() {
  localStorage.removeItem('taps_cliente');
  localStorage.removeItem('taps_carrinho');
  carrinho = [];
  atualizarBadge();
  abrirGate();
}

/* ==========================================================================
   8. RENDERIZAÇÃO DO CATÁLOGO
   ========================================================================== */

/** Monteiro do card de PRODUTO (venda). */
function criarCardProduto(p) {
  return `
  <article class="card" data-id="${p.id}" data-tipo="produto">
    <button class="card-img" data-acao="detalhe" aria-label="Ver detalhes de ${p.nome}">
      ${iconeSVG(p.icone, `Ilustração técnica de ${p.nome}`)}
      <span class="card-tag">${rotuloCategoria(p.cat)}</span>
    </button>
    <div class="card-corpo">
      <button class="card-nome link-detalhe" data-acao="detalhe" style="all:unset;cursor:pointer">${p.nome}</button>
      <p class="card-desc">${p.desc}</p>
      <div class="card-preco">
        <strong>${brl(p.preco)}</strong><span>/ ${p.un}</span>
      </div>
      <div class="card-linha">
        <div class="stepper compacto" aria-label="Quantidade de ${p.nome}">
          <button type="button" data-acao="card-step" data-dir="-1" aria-label="Diminuir quantidade"><svg><use href="#i-minus"/></svg></button>
          <output data-saida="1">1</output>
          <button type="button" data-acao="card-step" data-dir="1" aria-label="Aumentar quantidade"><svg><use href="#i-plus"/></svg></button>
        </div>
        <span class="card-total">Total <b>${brl(p.preco)}</b></span>
      </div>
      <div class="card-botoes">
        <button class="btn btn-menor" data-acao="comprar">Comprar</button>
        <button class="btn-icone" data-acao="add" aria-label="Adicionar ${p.nome} ao carrinho">
          <svg aria-hidden="true"><use href="#i-cart"/></svg>
        </button>
      </div>
    </div>
  </article>`;
}

/** Monteiro do card de MÁQUINA (locação). */
function criarCardMaquina(m) {
  const status = m.disponivel
    ? '<span class="card-status disponivel">Disponível</span>'
    : '<span class="card-status indisponivel">Indisponível</span>';
  return `
  <article class="card ${m.disponivel ? '' : 'indisponivel'}" data-id="${m.id}" data-tipo="maquina">
    <button class="card-img" data-acao="detalhe" aria-label="Ver detalhes de ${m.nome}">
      ${iconeSVG(m.icone, `Ilustração técnica de ${m.nome}`)}
      <span class="card-tag">Locação</span>
      ${status}
    </button>
    <div class="card-corpo">
      <button class="card-nome link-detalhe" data-acao="detalhe" style="all:unset;cursor:pointer">${m.nome}</button>
      <p class="card-desc">${m.desc}</p>
      <div class="card-preco">
        <strong>${brl(m.preco)}</strong><span>/ diária</span>
      </div>
      ${m.disponivel ? `
      <div class="card-linha">
        <div class="stepper compacto" aria-label="Dias de locação de ${m.nome}">
          <button type="button" data-acao="card-step" data-dir="-1" data-max="30" aria-label="Menos dias"><svg><use href="#i-minus"/></svg></button>
          <output data-saida="1">1</output>
          <button type="button" data-acao="card-step" data-dir="1" data-max="30" aria-label="Mais dias"><svg><use href="#i-plus"/></svg></button>
        </div>
        <span class="card-total">Total <b>${brl(m.preco)}</b></span>
      </div>
      <div class="card-botoes">
        <button class="btn btn-menor" data-acao="loc-solicitar">Solicitar locação</button>
      </div>` : `
      <div class="card-linha"><span class="card-total">Consulte a agenda da frota.</span></div>
      <div class="card-botoes">
        <button class="btn btn-menor" disabled>Solicitar locação</button>
      </div>`}
    </div>
  </article>`;
}

const rotuloCategoria = (id) =>
  (CATEGORIAS.find((c) => c.id === id) || { rotulo: 'Item' }).rotulo;

/** Carrega/renderiza todo o catálogo (produtos + máquinas). */
function carregarProdutos() {
  renderizarProdutos();
  renderizarMaquinas();
}

/** Renderiza a grade de produtos conforme filtro + busca. */
function renderizarProdutos() {
  const grid = $('#gridProdutos');
  const termo = normalizar(estado.busca);

  let lista = estado.filtro === 'maquinas'
    ? MAQUINAS
    : PRODUTOS.filter((p) => estado.filtro === 'todos' || p.cat === estado.filtro);

  if (termo) lista = lista.filter((p) => normalizar(p.nome).includes(termo));

  grid.innerHTML = lista.map((p) =>
    p.cat === undefined ? criarCardMaquina(p) : criarCardProduto(p)
  ).join('');

  $('#contagemCatalogo').textContent = lista.length
    ? `${lista.length} ${lista.length === 1 ? 'item encontrado' : 'itens encontrados'}`
    : '';
  $('#vazioCatalogo').classList.toggle('oculto', lista.length > 0);
}

/** Renderiza a seção de máquinas (filtrada pela busca). */
function renderizarMaquinas() {
  const grid = $('#gridMaquinas');
  const termo = normalizar(estado.busca);
  const lista = termo
    ? MAQUINAS.filter((m) => normalizar(m.nome).includes(termo))
    : MAQUINAS;

  grid.innerHTML = lista.map(criarCardMaquina).join('');
  $('#vazioMaquinas').classList.toggle('oculto', lista.length > 0);
}

/** Aplica um filtro de categoria e re-renderiza. */
function filtrarProdutos(cat) {
  estado.filtro = cat;
  $$('#filtrosChips .chip').forEach((chip) =>
    chip.classList.toggle('ativo', chip.dataset.filtro === cat));
  renderizarProdutos();
}

/** Pesquisa em tempo real por nome. */
function pesquisarProdutos(termo) {
  estado.busca = termo;
  renderizarProdutos();
  renderizarMaquinas();
}

/* ==========================================================================
   9. MODAL DE DETALHE DO ITEM
   ========================================================================== */
function abrirDetalhe(id, tipo) {
  const item = buscarItem(id, tipo);
  if (!item) { mostrarNotificacao('Produto não encontrado.', 'erro'); return; }

  estadoDetalhe = { id: item.id, tipo, qtd: 1 };
  $('#corpoDetalhe').innerHTML = montarDetalhe(item);
  abrirModal('#modalDetalhe');
}

function montarDetalhe(item) {
  const ehMaquina = item.disponivel !== undefined;
  const status = ehMaquina
    ? (item.disponivel
        ? '<span class="card-status disponivel" style="position:static">Disponível</span>'
        : '<span class="card-status indisponivel" style="position:static">Indisponível</span>')
    : `<span class="card-status" style="position:static;color:var(--laranja);border:1px solid var(--laranja-esc)">${rotuloCategoria(item.cat)}</span>`;

  const rotuloQtd = ehMaquina ? 'dias de locação' : 'quantidade';
  const precoLinha = ehMaquina
    ? `<small>por diária</small><strong>${brl(item.preco)}</strong>`
    : `<small>por ${item.un}</small><strong>${brl(item.preco)}</strong>`;

  const subtotais = ehMaquina || true; // ambos têm subtotal ao vivo

  const acoes = !ehMaquina
    ? `<button class="btn" data-acao="det-comprar">Comprar agora</button>
       <button class="btn btn-fantasma" data-acao="det-add">Adicionar ao carrinho</button>`
    : (item.disponivel
        ? `<button class="btn btn-cheio" data-acao="det-loc">Solicitar locação</button>`
        : `<button class="btn btn-cheio" disabled>Equipamento indisponível</button>`);

  return `
  <h2 class="det-nome" id="detalheTitulo">${item.nome}</h2>
  <div class="det-grid" style="margin-top:16px">
    <div class="det-figura">${iconeSVG(item.icone, `Ilustração técnica de ${item.nome}`)}</div>
    <div>
      ${status}
      <p class="det-desc">${item.desc}</p>
      <ul class="det-specs">${item.specs.map((s) => `<li>${s}</li>`).join('')}</ul>
      <div class="det-linha">
        <div class="det-preco">${precoLinha}</div>
        <div class="det-qtd">
          <label class="ck-codigo-rotulo" for="detStepper">${rotuloQtd}</label>
          <div class="stepper" id="detStepper" aria-label="${rotuloQtd}">
            <button type="button" data-acao="det-step" data-dir="-1" aria-label="Diminuir"><svg><use href="#i-minus"/></svg></button>
            <output>${estadoDetalhe.qtd}</output>
            <button type="button" data-acao="det-step" data-dir="1" aria-label="Aumentar"><svg><use href="#i-plus"/></svg></button>
          </div>
        </div>
      </div>
      ${subtotais ? `<p class="card-total" style="margin-top:10px">Subtotal: <b class="det-subtotal">${brl(item.preco * estadoDetalhe.qtd)}</b></p>` : ''}
      <div class="det-botoes">${acoes}</div>
    </div>
  </div>`;
}

/** Atualiza quantidade no modal de detalhe sem recarregar tudo. */
function detalheAlterarQtd(dir) {
  if (!estadoDetalhe) return;
  const max = estadoDetalhe.tipo === 'maquina' ? 30 : 999;
  estadoDetalhe.qtd = quantidadeSegura(estadoDetalhe.qtd + dir, max);
  const item = buscarItem(estadoDetalhe.id, estadoDetalhe.tipo);
  const modal = $('#corpoDetalhe');
  modal.querySelector('.stepper output').textContent = estadoDetalhe.qtd;
  modal.querySelector('.det-subtotal').textContent = brl(item.preco * estadoDetalhe.qtd);
}

/* ==========================================================================
   10. CARRINHO
   ========================================================================== */

/** Adiciona item (soma quantidade se já existir). Valida existência e valores. */
function adicionarCarrinho(id, tipo, qtd = 1) {
  const item = buscarItem(id, tipo);
  if (!item) { mostrarNotificacao('Item não encontrado no catálogo.', 'erro'); return false; }

  if (tipo === 'maquina' && !item.disponivel) {
    mostrarNotificacao('Equipamento indisponível no momento.', 'erro');
    return false;
  }

  const max = tipo === 'maquina' ? 30 : 999;
  const qtdSegura = quantidadeSegura(qtd, max);
  const existente = carrinho.find((c) => c.id === item.id && c.tipo === tipo);

  if (existente) {
    existente.qtd = Math.min(existente.qtd + qtdSegura, max);
  } else {
    carrinho.push({ id: item.id, tipo, qtd: qtdSegura });
  }

  salvarCarrinho();
  renderizarCarrinho();
  atualizarBadge(true);
  mostrarNotificacao(
    tipo === 'maquina'
      ? `Locação de ${item.nome} adicionada ao carrinho.`
      : 'Produto adicionado ao carrinho.'
  );
  return true;
}

function removerCarrinho(id, tipo) {
  carrinho = carrinho.filter((c) => !(c.id === Number(id) && c.tipo === tipo));
  salvarCarrinho();
  renderizarCarrinho();
  atualizarBadge();
}

/** Aumenta/diminui a quantidade (nunca menor que 1). */
function alterarQuantidade(id, tipo, dir) {
  const item = carrinho.find((c) => c.id === Number(id) && c.tipo === tipo);
  if (!item) return;
  const max = tipo === 'maquina' ? 30 : 999;
  item.qtd = quantidadeSegura(item.qtd + dir, max);
  salvarCarrinho();
  renderizarCarrinho();
  atualizarBadge();
}

/** Calcula o total a partir dos preços do catálogo (fonte única). */
function calcularTotal() {
  return carrinho.reduce((total, c) => {
    const item = buscarItem(c.id, c.tipo);
    return item ? total + item.preco * c.qtd : total; // item inexistente é ignorado
  }, 0);
}

function salvarCarrinho() {
  // Só id/tipo/quantidade — preços sempre recalculados do código.
  localStorage.setItem('taps_carrinho', JSON.stringify(carrinho));
}

function restaurarCarrinho() {
  try {
    const salvo = JSON.parse(localStorage.getItem('taps_carrinho'));
    if (Array.isArray(salvo)) {
      carrinho = salvo.filter((c) => buscarItem(c.id, c.tipo)); // descarta ids inválidos
    }
  } catch { carrinho = []; }
}

function renderizarCarrinho() {
  const lista = $('#listaCarrinho');
  const total = calcularTotal();
  const qtdItens = carrinho.reduce((s, c) => s + c.qtd, 0);

  $('#drawerContagem').textContent = qtdItens ? `(${qtdItens})` : '';
  $('#vazioCarrinho').classList.toggle('oculto', carrinho.length > 0);
  $('#rodapeCarrinho').classList.toggle('oculto', carrinho.length === 0);

  lista.innerHTML = carrinho.map((c) => {
    const item = buscarItem(c.id, c.tipo);
    if (!item) return '';
    const rotulo = c.tipo === 'maquina' ? `${c.qtd} dia(s) × ${brl(item.preco)}/dia` : `${c.qtd} ${item.un} × ${brl(item.preco)}`;
    return `
    <div class="car-item" data-id="${c.id}" data-tipo="${c.tipo}">
      <p class="car-nome">${item.nome}</p>
      <p class="car-subtotal">${brl(item.preco * c.qtd)}</p>
      <p class="car-info">${c.tipo === 'maquina' ? 'Locação — ' : ''}${rotulo}</p>
      <div class="car-controles">
        <div class="stepper compacto" aria-label="Quantidade de ${item.nome}">
          <button type="button" data-acao="car-menos" aria-label="Diminuir quantidade de ${item.nome}"><svg><use href="#i-minus"/></svg></button>
          <output>${c.qtd}</output>
          <button type="button" data-acao="car-mais" aria-label="Aumentar quantidade de ${item.nome}"><svg><use href="#i-plus"/></svg></button>
        </div>
        <button class="car-remover" data-acao="car-remover" aria-label="Remover ${item.nome} do carrinho">
          <svg aria-hidden="true"><use href="#i-trash"/></svg> Remover
        </button>
      </div>
    </div>`;
  }).join('');

  $('#totalCarrinho').textContent = brl(total);
}

function atualizarBadge(pulsar = false) {
  const badge = $('#badgeCarrinho');
  const qtd = carrinho.reduce((s, c) => s + c.qtd, 0);
  badge.hidden = qtd === 0;
  badge.textContent = qtd;
  if (pulsar && qtd > 0) {
    badge.classList.remove('pulsando');
    void badge.offsetWidth; // reinicia a animação
    badge.classList.add('pulsando');
  }
}

/* ==========================================================================
   11. CHECKOUT + PAGAMENTO PIX (padrão EMV / BR Code)
   ========================================================================== */

function abrirCheckout() {
  if (carrinho.length === 0) {
    mostrarNotificacao('Seu carrinho está vazio.', 'erro');
    return;
  }
  fecharDrawer();
  $('#ckItens').innerHTML = carrinho.map((c) => {
    const item = buscarItem(c.id, c.tipo);
    if (!item) return '';
    const desc = c.tipo === 'maquina' ? `${c.qtd} diária(s) × ${brl(item.preco)}` : `${c.qtd} ${item.un} × ${brl(item.preco)}`;
    return `<li><div><b>${item.nome}</b><small>${desc}</small></div><span>${brl(item.preco * c.qtd)}</span></li>`;
  }).join('');
  $('#ckTotal1').textContent = brl(calcularTotal());
  irPassoCheckout(1);
  abrirModal('#modalCheckout');
}

function irPassoCheckout(n) {
  ['#ck1', '#ck2', '#ck3'].forEach((sel, i) =>
    $(sel).classList.toggle('oculto', i + 1 !== n));
  $$('#ckPassos li').forEach((li) => {
    const p = Number(li.dataset.passo);
    li.classList.toggle('atual', p === n);
    li.classList.toggle('feito', p < n);
  });
}

/** Gera o payload PIX e exibe QR + Copia e Cola. */
function gerarPagamentoPix() {
  const total = calcularTotal();
  if (total <= 0 || carrinho.length === 0) {
    mostrarNotificacao('Não há itens para pagar.', 'erro');
    return;
  }

  // Número sequencial do pedido (local). Em produção: criado pelo backend.
  const seq = (Number(localStorage.getItem('taps_seq')) || 0) + 1;
  localStorage.setItem('taps_seq', String(seq));
  pedidoAtual = { numero: `TAPS-${String(seq).padStart(4, '0')}`, total };

  const txid = 'TAPS' + String(seq).padStart(6, '0'); // [A-Za-z0-9], máx. 25
  const payload = montarPayloadPix({
    chave: PIX.chave, nome: PIX.nomeRecebedor,
    cidade: PIX.cidade, valor: total, txid
  });

  $('#ckValor').textContent = brl(total);
  $('#ckCodigo').value = payload;
  desenharQRCode(payload);
  irPassoCheckout(2);

  /* INTEGRAÇÃO FUTURA (BACKEND):
     POST /api/pedidos { itens, cliente } -> { pedidoId, brcodeDinamico }
     O BR Code dinâmico e a confirmação automática (webhook do provedor
     de pagamentos) devem ser implementados no servidor. */
}

/** Monta o payload EMV do PIX com CRC16-CCITT (CRC-16/CCITT-FALSE). */
function campoPix(id, valor) {
  return id + String(valor.length).padStart(2, '0') + valor;
}

function crc16(texto) {
  let crc = 0xFFFF;
  for (const ch of texto) {
    crc ^= ch.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function montarPayloadPix({ chave, nome, cidade, valor, txid }) {
  const infoRecebedor =
    campoPix('00', 'BR.GOV.BCB.PIX') +
    campoPix('01', chave);

  let p = '';
  p += campoPix('00', '01');              // versão do payload
  p += campoPix('01', '11');              // QR estático reutilizável
  p += campoPix('26', infoRecebedor);     // dados do recebedor PIX
  p += campoPix('52', '0000');            // categoria do comércio
  p += campoPix('53', '986');             // moeda: BRL
  p += campoPix('54', valor.toFixed(2));  // valor da transação
  p += campoPix('58', 'BR');              // país
  p += campoPix('59', nome.substring(0, 25));
  p += campoPix('60', cidade.substring(0, 15));
  p += campoPix('62', campoPix('05', txid)); // identificador do pedido
  p += '6304';                            // campo do CRC
  p += crc16(p);
  return p;
}

/** Desenha a matriz QR em canvas (módulos pretos sobre branco). */
function desenharQRCode(texto) {
  const wrap = $('#ckQrWrap');
  const falha = $('#ckQrFalha');
  const canvas = $('#ckQrCanvas');
  try {
    if (typeof qrcode !== 'function') throw new Error('Biblioteca do QR indisponível');
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    const cel = 8, margem = 4;
    canvas.width = (n + margem * 2) * cel;
    canvas.height = canvas.width;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#141414';
    for (let lin = 0; lin < n; lin++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(lin, col)) {
          ctx.fillRect((col + margem) * cel, (lin + margem) * cel, cel, cel);
        }
      }
    }
    wrap.classList.remove('oculto');
    falha.classList.add('oculto');
  } catch {
    wrap.classList.add('oculto');
    falha.classList.remove('oculto');
  }
}

/** Copia o código PIX para a área de transferência. */
async function copiarPix() {
  const codigo = $('#ckCodigo').value;
  if (!codigo) return;
  try {
    await navigator.clipboard.writeText(codigo);
  } catch {
    // Fallback para navegadores sem a Clipboard API
    const area = $('#ckCodigo');
    area.select();
    document.execCommand('copy');
  }
  mostrarNotificacao('Código PIX copiado!');
}

/** Conclui o pedido: mensagem clara de que a confirmação vem depois. */
function concluirPedido() {
  fecharModal('#modalCheckout');
  carrinho = [];
  salvarCarrinho();
  renderizarCarrinho();
  atualizarBadge();
  mostrarNotificacao(`Pedido ${pedidoAtual ? pedidoAtual.numero : ''} registrado. Aguardando confirmação do PIX.`);
  pedidoAtual = null;
}

/* ==========================================================================
   12. NOTIFICAÇÕES (toasts)
   ========================================================================== */
function mostrarNotificacao(msg, tipo = 'ok') {
  const toast = document.createElement('div');
  toast.className = `toast${tipo === 'erro' ? ' erro' : ''}`;
  toast.innerHTML = `<svg aria-hidden="true"><use href="#i-${tipo === 'erro' ? 'close' : 'check'}"/></svg><span>${msg}</span>`;
  $('#toasts').appendChild(toast);
  setTimeout(() => toast.classList.add('saindo'), 2800);
  setTimeout(() => toast.remove(), 3200);
}

/* ==========================================================================
   13. CONTROLE DE DRAWER / MODAIS
   ========================================================================== */
let ultimoFoco = null;

function abrirDrawer() {
  ultimoFoco = document.activeElement;
  $('#drawer').classList.add('aberto');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#overlayDrawer').classList.remove('oculto');
  requestAnimationFrame(() => $('#overlayDrawer').classList.add('aberto'));
  document.body.classList.add('travado');
  $('#fecharDrawer').focus();
}

function fecharDrawer() {
  $('#drawer').classList.remove('aberto');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#overlayDrawer').classList.add('aberto');
  $('#overlayDrawer').classList.add('oculto');
  $('#overlayDrawer').classList.remove('aberto');
  document.body.classList.remove('travado');
  if (ultimoFoco) ultimoFoco.focus();
}

function abrirModal(sel) {
  ultimoFoco = document.activeElement;
  fecharDrawer();
  $(sel).classList.remove('oculto');
  document.body.classList.add('travado');
  const focavel = $(sel).querySelector('button, input, textarea');
  if (focavel) focavel.focus();
}

function fecharModal(sel) {
  $(sel).classList.add('oculto');
  document.body.classList.remove('travado');
  if (ultimoFoco) ultimoFoco.focus();
}

/* ==========================================================================
   14. EVENTOS
   ========================================================================== */
function registrarEventos() {
  /* --- Cadastro --- */
  $('#formCadastro').addEventListener('submit', (e) => {
    e.preventDefault();
    if (validarCadastro()) {
      entrarNoSite({
        nome: $('#fnome').value.trim(),
        bairro: $('#fbairro').value.trim(),
        cidade: $('#fcidade').value.trim()
      });
    } else {
      mostrarNotificacao('Verifique os campos destacados.', 'erro');
    }
  });
  $('#btnSair').addEventListener('click', sair);

  /* --- Menu mobile --- */
  const btnMenu = $('#btnMenu');
  btnMenu.addEventListener('click', () => {
    const aberto = $('#menuNavegacao').classList.toggle('aberto');
    btnMenu.setAttribute('aria-expanded', String(aberto));
  });

  /* --- Navegação por filtros (menu + rodapé + índice) --- */
  $$('[data-filtro]').forEach((el) => {
    el.addEventListener('click', () => {
      filtrarProdutos(el.dataset.filtro);
      $('#menuNavegacao').classList.remove('aberto');
      btnMenu.setAttribute('aria-expanded', 'false');
    });
  });

  $$('.indice-linha').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.dataset.ir === 'maquinas') {
        document.querySelector('#maquinas').scrollIntoView({ behavior: 'smooth' });
      } else {
        filtrarProdutos(el.dataset.ir);
        document.querySelector('#produtos').scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  /* --- Busca em tempo real --- */
  $('#buscaInput').addEventListener('input', (e) => pesquisarProdutos(e.target.value));
  $$('[data-limpar-busca]').forEach((b) =>
    b.addEventListener('click', () => { $('#buscaInput').value = ''; pesquisarProdutos(''); }));

  /* --- Chips de filtro --- */
  $('#filtrosChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) filtrarProdutos(chip.dataset.filtro);
  });

  /* --- Abrir carrinho --- */
  $('#btnCarrinho').addEventListener('click', abrirDrawer);
  $('[data-abre-carrinho]').addEventListener('click', (e) => {
    e.preventDefault();
    abrirDrawer();
    $('#menuNavegacao').classList.remove('aberto');
  });
  $('#fecharDrawer').addEventListener('click', fecharDrawer);
  $('#overlayDrawer').addEventListener('click', fecharDrawer);

  /* --- Delegação: cards de catálogo --- */
  document.addEventListener('click', (e) => {
    const acao = e.target.closest('[data-acao]');
    if (!acao) return;
    const tipo = acao.dataset.acao;
    const card = acao.closest('.card');
    const modal = acao.closest('#corpoDetalhe');
    const lista = acao.closest('.car-item');

    if (tipo === 'detalhe' && card) {
      abrirDetalhe(card.dataset.id, card.dataset.tipo);
      return;
    }
    if (tipo === 'card-step' && card) {
      const saida = card.querySelector('[data-saida]');
      const max = Number(acao.dataset.max) || 999;
      const atual = quantidadeSegura(saida.textContent, max);
      saida.textContent = quantidadeSegura(atual + Number(acao.dataset.dir), max);
      const item = buscarItem(card.dataset.id, card.dataset.tipo);
      card.querySelector('.card-total b').textContent = brl(item.preco * Number(saida.textContent));
      return;
    }
    if (tipo === 'comprar' && card) {
      const qtd = Number(card.querySelector('[data-saida]').textContent);
      if (adicionarCarrinho(card.dataset.id, card.dataset.tipo, qtd)) abrirCheckout();
      return;
    }
    if (tipo === 'add' && card) {
      const qtd = Number(card.querySelector('[data-saida]').textContent);
      adicionarCarrinho(card.dataset.id, card.dataset.tipo, qtd);
      return;
    }
    if (tipo === 'loc-solicitar' && card) {
      const qtd = Number(card.querySelector('[data-saida]').textContent);
      if (adicionarCarrinho(card.dataset.id, 'maquina', qtd)) abrirCheckout();
      return;
    }

    /* Modal de detalhes */
    if (modal) {
      if (tipo === 'det-step') { detalheAlterarQtd(Number(acao.dataset.dir)); return; }
      if (!estadoDetalhe) return;
      if (tipo === 'det-add') {
        if (adicionarCarrinho(estadoDetalhe.id, estadoDetalhe.tipo, estadoDetalhe.qtd)) fecharModal('#modalDetalhe');
        return;
      }
      if (tipo === 'det-comprar' || tipo === 'det-loc') {
        if (adicionarCarrinho(estadoDetalhe.id, estadoDetalhe.tipo, estadoDetalhe.qtd)) {
          fecharModal('#modalDetalhe');
          abrirCheckout();
        }
        return;
      }
    }

    /* Itens do carrinho */
    if (lista) {
      if (tipo === 'car-mais')   alterarQuantidade(lista.dataset.id, lista.dataset.tipo, 1);
      if (tipo === 'car-menos')  alterarQuantidade(lista.dataset.id, lista.dataset.tipo, -1);
      if (tipo === 'car-remover') removerCarrinho(lista.dataset.id, lista.dataset.tipo);
    }
  });

  /* --- Checkout --- */
  $('#btnFinalizar').addEventListener('click', abrirCheckout);
  $('#btnGerarPix').addEventListener('click', gerarPagamentoPix);
  $('#btnCopiarPix').addEventListener('click', copiarPix);
  $('#btnConcluir').addEventListener('click', concluirPedido);
  $('#fecharCheckout').addEventListener('click', () => fecharModal('#modalCheckout'));
  $('#fecharDetalhe').addEventListener('click', () => fecharModal('#modalDetalhe'));

  /* Fecha modais clicando no fundo */
  ['#modalDetalhe', '#modalCheckout'].forEach((sel) => {
    $(sel).addEventListener('click', (e) => {
      if (e.target === $(sel)) fecharModal(sel);
    });
  });

  /* Teclado: ESC fecha camadas abertas */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#modalCheckout').classList.contains('oculto')) fecharModal('#modalCheckout');
    else if (!$('#modalDetalhe').classList.contains('oculto')) fecharModal('#modalDetalhe');
    else if ($('#drawer').classList.contains('aberto')) fecharDrawer();
  });

  /* Marca o link ativo do menu */
  $$('#menuNavegacao a').forEach((a) => {
    a.addEventListener('click', () => {
      $$('#menuNavegacao a').forEach((x) => x.classList.remove('ativo'));
      a.classList.add('ativo');
    });
  });
}

/* ==========================================================================
   15. INICIALIZAÇÃO
   ========================================================================== */
function iniciarRevelacao() {
  const alvos = $$('.revelar');
  if (!('IntersectionObserver' in window)) {
    alvos.forEach((el) => el.classList.add('visivel'));
    return;
  }
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('visivel');
        obs.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  alvos.forEach((el) => obs.observe(el));
}

function montarChips() {
  $('#filtrosChips').innerHTML = CATEGORIAS.map((c, i) =>
    `<button class="chip${i === 0 ? ' ativo' : ''}" data-filtro="${c.id}" aria-pressed="${i === 0}">${c.rotulo}</button>`
  ).join('');
}

function montarMarquee() {
  const itens = ['Cimento', 'Areia', 'Brita', 'Vergalhão', 'Betoneira', 'Compactador',
                 'Gerador', 'Andaime', 'Ferramentas', 'EPI', 'Tubos', 'Elétrica', 'Hidráulica'];
  const bloco = itens.map((i) => `<span>${i}</span><b>•</b>`).join('');
  $('#marqueeTrack').innerHTML = bloco + bloco; // duplicado para o loop contínuo
}

function init() {
  $('#ano').textContent = new Date().getFullYear();
  aplicarMascaras();
  montarChips();
  montarMarquee();
  registrarEventos();
  restaurarCarrinho();
  atualizarBadge();
  iniciarRevelacao();

  // O cadastro é sempre a porta de entrada; sessão leve apenas com nome/cidade.
  if (localStorage.getItem('taps_cliente')) {
    fecharGate();
  } else {
    abrirGate();
  }
}

document.addEventListener('DOMContentLoaded', init);