// ---------------- DADOS COMPARTILHADOS ----------------
// Usados tanto pelo site público (js/app.js) quanto pelo painel do barbeiro (admin/admin.js).
// Alterar serviços, o barbeiro ou os horários de atendimento aqui reflete nos dois lugares.

const SERVICES = [
  { id:'corte', name:'Corte tradicional', desc:'Tesoura e máquina, acabamento na navalha.', price:45, duration:30 },
  { id:'barba', name:'Barba desenhada', desc:'Toalha quente, navalha e óleo pós-barba.', price:35, duration:20 },
  { id:'combo', name:'Corte + Barba', desc:'O combo completo, com desconto.', price:70, duration:50 },
  { id:'sobrancelha', name:'Sobrancelha', desc:'Alinhamento na navalha.', price:15, duration:10 },
  { id:'pezinho', name:'Acabamento (pezinho)', desc:'Manutenção rápida de contorno.', price:20, duration:10 },
];

const BARBERS = [
  { id:'vitin', name:'Vitin', role:'Fundador da barbearia', desc:'Cuida de cada corte e barba pessoalmente, do clássico ao moderno.', initials:'V' },
];

const TIME_SLOTS = ['09:00','09:40','10:20','11:00','11:40','13:00','13:40','14:20','15:00','15:40','16:20','17:00','17:40','18:20'];
