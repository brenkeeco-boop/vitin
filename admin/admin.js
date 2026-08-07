// ---------------- LOGIN ----------------
// Aviso: esta é uma trava simples no navegador, não uma autenticação de verdade.
// Qualquer pessoa que abrir o código-fonte (F12) consegue ver usuário e senha.
// Para uma barbearia pequena costuma ser suficiente, mas não trate como segurança real.
const ADMIN_USER = 'vitin';
const ADMIN_PASS = 'ducorte';
const SESSION_KEY = 'barbearia_vitin_admin_session';

const BARBER_ID = BARBERS[0].id;

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const logoutBtn = document.getElementById('logoutBtn');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

function isLoggedIn(){
  return localStorage.getItem(SESSION_KEY) === 'ok';
}

function showDashboard(){
  loginScreen.style.display = 'none';
  dashboard.style.display = 'block';
  logoutBtn.style.display = 'inline-block';
  initDashboard();
}

function showLogin(){
  loginScreen.style.display = 'flex';
  dashboard.style.display = 'none';
  logoutBtn.style.display = 'none';
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const user = document.getElementById('userInput').value.trim();
  const pass = document.getElementById('passInput').value;
  if(user === ADMIN_USER && pass === ADMIN_PASS){
    localStorage.setItem(SESSION_KEY, 'ok');
    loginError.style.display = 'none';
    showDashboard();
  } else {
    loginError.style.display = 'block';
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(SESSION_KEY);
  showLogin();
});

if(isLoggedIn()){
  showDashboard();
} else {
  showLogin();
}

// ---------------- DASHBOARD ----------------
function money(n){ return 'R$ ' + n.toFixed(2).replace('.', ','); }

function initDashboard(){
  const dateInput = document.getElementById('adminDateInput');
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
  loadDay(dateInput.value);
  dateInput.addEventListener('change', () => loadDay(dateInput.value));
}

async function loadDay(date){
  const bookedList = document.getElementById('bookedList');
  const freeList = document.getElementById('freeList');
  const bookedCountLabel = document.getElementById('bookedCountLabel');
  const freeCountLabel = document.getElementById('freeCountLabel');

  bookedList.innerHTML = '<p class="loading-msg">Carregando…</p>';
  freeList.innerHTML = '<p class="loading-msg">Carregando…</p>';

  try{
    const result = await db.list(`slot:${BARBER_ID}:${date}:`, true);
    const times = (result && result.keys ? result.keys : []);

    const bookings = [];
    for(const t of times){
      try{
        const rec = await db.get(`slot:${BARBER_ID}:${date}:${t}`, true);
        bookings.push({ time: t, data: JSON.parse(rec.value) });
      } catch(e){ /* slot pode ter sido cancelado entre a listagem e a leitura */ }
    }
    bookings.sort((a,b) => a.time.localeCompare(b.time));

    bookedCountLabel.textContent = bookings.length === 0
      ? 'Nenhum agendamento para este dia.'
      : `${bookings.length} agendamento${bookings.length > 1 ? 's' : ''}.`;

    bookedList.innerHTML = bookings.length === 0
      ? '<p class="empty-state">Nenhum cliente marcou horário neste dia ainda.</p>'
      : bookings.map(b => `
        <div class="booked-item" data-time="${b.time}">
          <span class="bi-time">${b.time}</span>
          <div class="bi-info">
            <div class="bi-name">${escapeHtml(b.data.name)}</div>
            <div class="bi-meta">${escapeHtml(b.data.service)} · ${money(b.data.price)} · <a href="https://wa.me/55${onlyDigits(b.data.phone)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.data.phone)}</a></div>
          </div>
          <button type="button" class="bi-cancel" data-cancel="${b.time}">Cancelar</button>
        </div>
      `).join('');

    document.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.onclick = () => cancelBooking(date, btn.dataset.cancel);
    });

    const bookedTimes = bookings.map(b => b.time);
    const free = TIME_SLOTS.filter(t => !bookedTimes.includes(t));
    freeCountLabel.textContent = `${free.length} de ${TIME_SLOTS.length} horários livres.`;
    freeList.innerHTML = free.length === 0
      ? '<p class="empty-state">Agenda cheia neste dia.</p>'
      : free.map(t => `<div class="free-slot-badge">${t}</div>`).join('');

  } catch(err){
    console.error('Erro ao carregar a agenda', err);
    bookedList.innerHTML = '<p class="error-msg">Não foi possível carregar os agendamentos. Tente novamente.</p>';
    freeList.innerHTML = '';
  }
}

async function cancelBooking(date, time){
  if(!confirm(`Cancelar o horário das ${time}?`)) return;
  try{
    await db.delete(`slot:${BARBER_ID}:${date}:${time}`, true);
    loadDay(date);
  } catch(err){
    console.error('Erro ao cancelar agendamento', err);
    alert('Não foi possível cancelar. Tente novamente.');
  }
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function onlyDigits(str){
  return (str || '').replace(/\D/g, '');
}
