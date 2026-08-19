// ---------------- DADOS COMPARTILHADOS ----------------
// Usados tanto pelo site público (js/app.js) quanto pelo painel do barbeiro (admin/admin.js).
// Alterar serviços, o barbeiro ou os horários de atendimento aqui reflete nos dois lugares.

const SERVICES = [
  { id:'corte-degrade', name:'Corte degradê', desc:'Fade bem definido, acabamento na navalha.', price:30, duration:40 },
  { id:'corte-social', name:'Corte social', desc:'Corte clássico, alinhado e discreto.', price:25, duration:30 },
  { id:'maquina-geral', name:'Máquina geral', desc:'Acabamento uniforme, direto na máquina.', price:20, duration:20 },
  { id:'sobrancelha', name:'Sobrancelha', desc:'Alinhamento na navalha.', price:10, duration:10 },
  { id:'barba-desenhada', name:'Barba desenhada', desc:'Toalha quente, navalha e óleo pós-barba.', price:20, duration:20 },
  { id:'pigmentacao', name:'Pigmentação', desc:'Disfarça falhas e uniformiza a cor.', price:20, duration:30 },
  { id:'luzes', name:'Luzes', desc:'Mechas e luzes personalizadas.', price:80, duration:90 },
  { id:'nevou', name:'Nevou', desc:'Descoloração completa, efeito nevado.', price:100, duration:120 },
  { id:'selagem-progressiva', name:'Selagem/progressiva', desc:'Alinhamento e redução de volume.', price:60, duration:90 },
];

const BARBERS = [
  { id:'vitin', name:'Vitin', role:'Fundador da barbearia', desc:'Cuida de cada corte e barba pessoalmente, do clássico ao moderno.', initials:'V' },
];

const TIME_SLOTS = ['09:00','09:40','10:20','11:00','11:40','13:00','13:40','14:20','15:00','15:40','16:20','17:00','17:40','18:20'];
