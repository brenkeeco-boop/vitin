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

  document.getElementById('blockDayBtn').addEventListener('click', () => blockWholeDay(dateInput.value));
  document.getElementById('unblockDayBtn').addEventListener('click', () => unblockWholeDay(dateInput.value));

  fillManualServiceSelect();
  document.getElementById('manualBookingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    submitManualBooking(dateInput.value);
  });
}

async function blockWholeDay(date){
  const msg = document.getElementById('dayActionMsg');
  if(!confirm(`Bloquear TODOS os horários livres do dia ${formatDateBR(date)}? Agendamentos já confirmados não são afetados.`)) return;

  const btn = document.getElementById('blockDayBtn');
  btn.disabled = true;
  msg.textContent = 'Bloqueando…';

  try{
    const result = await db.list(`slot:${BARBER_ID}:${date}:`, true);
    const taken = (result && result.keys ? result.keys : []);
    const free = TIME_SLOTS.filter(t => !taken.includes(t));

    let blockedCount = 0;
    for(const t of free){
      try{
        await db.blockSlot(`slot:${BARBER_ID}:${date}:${t}`, {
          barber: BARBER_ID,
          date,
          time: t,
          reason: 'Dia bloqueado pelo barbeiro',
          createdAt: new Date().toISOString(),
        });
        blockedCount++;
      } catch(e){ /* alguém pode ter reservado esse horário nesse meio-tempo — segue pros próximos */ }
    }

    msg.textContent = blockedCount > 0
      ? `${blockedCount} horário(s) bloqueado(s).`
      : 'Não havia horários livres para bloquear.';
    loadDay(date);
  } catch(err){
    console.error('Erro ao bloquear o dia', err);
    msg.textContent = 'Não foi possível bloquear o dia. Tente novamente.';
  } finally {
    btn.disabled = false;
  }
}

async function unblockWholeDay(date){
  const msg = document.getElementById('dayActionMsg');
  if(!confirm(`Remover todos os bloqueios do dia ${formatDateBR(date)}? Agendamentos de clientes não são afetados.`)) return;

  const btn = document.getElementById('unblockDayBtn');
  btn.disabled = true;
  msg.textContent = 'Desbloqueando…';

  try{
    const result = await db.list(`slot:${BARBER_ID}:${date}:`, true);
    const times = (result && result.keys ? result.keys : []);

    let unblockedCount = 0;
    for(const t of times){
      try{
        const rec = await db.get(`slot:${BARBER_ID}:${date}:${t}`, true);
        const data = JSON.parse(rec.value);
        if(data.blocked){
          await db.delete(`slot:${BARBER_ID}:${date}:${t}`, true);
          unblockedCount++;
        }
      } catch(e){ /* ignora e segue */ }
    }

    msg.textContent = unblockedCount > 0
      ? `${unblockedCount} horário(s) desbloqueado(s).`
      : 'Não havia bloqueios nesse dia.';
    loadDay(date);
  } catch(err){
    console.error('Erro ao desbloquear o dia', err);
    msg.textContent = 'Não foi possível desbloquear o dia. Tente novamente.';
  } finally {
    btn.disabled = false;
  }
}

function formatDateBR(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ---------------- AGENDAMENTO MANUAL ----------------
function fillManualServiceSelect(){
  const select = document.getElementById('manualServiceSelect');
  select.innerHTML = SERVICES.map(s => `<option value="${s.id}">${s.name} · ${money(s.price)}</option>`).join('');
}

function fillManualTimeSelect(freeTimes){
  const select = document.getElementById('manualTimeSelect');
  if(!select) return;
  select.innerHTML = freeTimes.length === 0
    ? '<option value="">Nenhum horário livre</option>'
    : freeTimes.map(t => `<option value="${t}">${t}</option>`).join('');
}

async function submitManualBooking(date){
  const errEl = document.getElementById('manualFormError');
  errEl.style.display = 'none';

  const time = document.getElementById('manualTimeSelect').value;
  const serviceId = document.getElementById('manualServiceSelect').value;
  const name = document.getElementById('manualNameInput').value.trim();
  const phone = document.getElementById('manualPhoneInput').value.trim();

  if(!time){
    errEl.textContent = 'Não há horário livre selecionado.';
    errEl.style.display = 'block';
    return;
  }
  if(!name || !phone){
    errEl.textContent = 'Preencha nome e telefone do cliente.';
    errEl.style.display = 'block';
    return;
  }

  const service = SERVICES.find(s => s.id === serviceId);
  const submitBtn = document.getElementById('manualSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Adicionando…';

  try{
    await db.reserveSlot(`slot:${BARBER_ID}:${date}:${time}`, {
      service: service.name,
      price: service.price,
      barber: BARBER_ID,
      date,
      time,
      name,
      phone,
      addedByBarber: true,
      createdAt: new Date().toISOString(),
    });

    document.getElementById('manualBookingForm').reset();
    loadDay(date);
  } catch(err){
    if(err && (err.code === 'SLOT_ALREADY_BOOKED' || err.message === 'SLOT_ALREADY_BOOKED')){
      errEl.textContent = 'Esse horário acabou de ser ocupado. Escolha outro.';
    } else {
      console.error('Erro ao adicionar agendamento manual', err);
      errEl.textContent = 'Não foi possível adicionar agora. Tente novamente.';
    }
    errEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Adicionar agendamento';
  }
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

    const entries = [];
    for(const t of times){
      try{
        const rec = await db.get(`slot:${BARBER_ID}:${date}:${t}`, true);
        entries.push({ time: t, data: JSON.parse(rec.value) });
      } catch(e){ /* slot pode ter sido removido entre a listagem e a leitura */ }
    }
    entries.sort((a,b) => a.time.localeCompare(b.time));

    const bookings = entries.filter(e => !e.data.blocked);
    const blocked = entries.filter(e => e.data.blocked);

    const parts = [];
    if(bookings.length) parts.push(`${bookings.length} agendamento${bookings.length > 1 ? 's' : ''}`);
    if(blocked.length) parts.push(`${blocked.length} horário${blocked.length > 1 ? 's' : ''} bloqueado${blocked.length > 1 ? 's' : ''}`);
    bookedCountLabel.textContent = parts.length ? parts.join(' · ') + '.' : 'Nada marcado para este dia ainda.';

    bookedList.innerHTML = entries.length === 0
      ? '<p class="empty-state">Nada marcado para este dia ainda.</p>'
      : entries.map(e => {
        if(e.data.blocked){
          return `
            <div class="booked-item booked-item-blocked" data-time="${e.time}">
              <span class="bi-time">${e.time}</span>
              <div class="bi-info">
                <div class="bi-name">Horário bloqueado</div>
                <div class="bi-meta">${escapeHtml(e.data.reason || 'Indisponível')}</div>
              </div>
              <button type="button" class="bi-cancel" data-unblock="${e.time}">Desbloquear</button>
            </div>
          `;
        }
        return `
          <div class="booked-item" data-time="${e.time}">
            <span class="bi-time">${e.time}</span>
            <div class="bi-info">
              <div class="bi-name">${escapeHtml(e.data.name)} · Ticket ${String(e.data.ticket ?? '').padStart(3,'0')}</div>
              <div class="bi-meta">${escapeHtml(e.data.service)} · ${money(e.data.price)} · <a href="https://wa.me/55${onlyDigits(e.data.phone)}" target="_blank" rel="noopener noreferrer">${escapeHtml(e.data.phone)}</a></div>
            </div>
            <button type="button" class="bi-cancel" data-cancel="${e.time}">Cancelar</button>
          </div>
        `;
      }).join('');

    document.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.onclick = () => cancelBooking(date, btn.dataset.cancel);
    });
    document.querySelectorAll('[data-unblock]').forEach(btn => {
      btn.onclick = () => unblockSlot(date, btn.dataset.unblock);
    });

    const takenTimes = entries.map(e => e.time);
    const free = TIME_SLOTS.filter(t => !takenTimes.includes(t));
    freeCountLabel.textContent = `${free.length} de ${TIME_SLOTS.length} horários livres.`;
    freeList.innerHTML = free.length === 0
      ? '<p class="empty-state">Agenda cheia neste dia.</p>'
      : free.map(t => `<button type="button" class="free-slot-badge" data-block="${t}" title="Bloquear este horário">${t}</button>`).join('');

    document.querySelectorAll('[data-block]').forEach(btn => {
      btn.onclick = () => blockSingleSlot(date, btn.dataset.block);
    });

    fillManualTimeSelect(free);

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

async function unblockSlot(date, time){
  try{
    await db.delete(`slot:${BARBER_ID}:${date}:${time}`, true);
    loadDay(date);
  } catch(err){
    console.error('Erro ao desbloquear horário', err);
    alert('Não foi possível desbloquear. Tente novamente.');
  }
}

async function blockSingleSlot(date, time){
  try{
    await db.blockSlot(`slot:${BARBER_ID}:${date}:${time}`, {
      barber: BARBER_ID,
      date,
      time,
      reason: 'Bloqueado pelo barbeiro',
      createdAt: new Date().toISOString(),
    });
    loadDay(date);
  } catch(err){
    if(err && (err.code === 'SLOT_ALREADY_BOOKED' || err.message === 'SLOT_ALREADY_BOOKED')){
      alert('Esse horário acabou de ser ocupado. Atualizando a lista…');
      loadDay(date);
      return;
    }
    console.error('Erro ao bloquear horário', err);
    alert('Não foi possível bloquear esse horário. Tente novamente.');
  }
}

// ---------------- BLOQUEAR / DESBLOQUEAR O DIA INTEIRO ----------------
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function onlyDigits(str){
  return (str || '').replace(/\D/g, '');
}
