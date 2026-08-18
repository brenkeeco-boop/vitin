// ---------------- ETAPAS DO AGENDAMENTO ----------------
const STEP_LABELS = ['Serviço','Data','Horário','Seus dados'];

let state = {
  step: 1,
  service: null,
  barber: BARBERS[0].id,
  date: '',
  time: null,
  name: '',
  phone: '',
};

let bookedSlotsCache = {};
let confirmedTicket = null;
let stopSlotWatch = null;

function money(n){ return 'R$ ' + n.toFixed(2).replace('.', ','); }

function renderServiceGrid(){
  const grid = document.getElementById('serviceGrid');
  grid.innerHTML = SERVICES.map((s,i) => `
    <div class="service-card">
      <div class="num">${String(i+1).padStart(2,'0')}</div>
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
      <div class="price-row">
        <span class="price">${money(s.price)}</span>
        <span class="dur">${s.duration} min</span>
      </div>
    </div>
  `).join('');
}

function renderBarberGrid(){
  const grid = document.getElementById('barberGrid');
  grid.innerHTML = BARBERS.map(b => `
    <div class="barber-card">
      <div class="barber-avatar">${b.initials}</div>
      <h3>${b.name}</h3>
      <div class="role">${b.role}</div>
      <p>${b.desc}</p>
    </div>
  `).join('');
}

function renderSteps(){
  const track = document.getElementById('stepsTrack');
  track.innerHTML = STEP_LABELS.map((label, idx) => {
    const n = idx + 1;
    let cls = '';
    if(n < state.step) cls = 'done';
    if(n === state.step) cls = 'active';
    return `<div class="step-dot ${cls}">
      <div class="circle">${n < state.step ? '✓' : n}</div>
      <span class="label">${label}</span>
    </div>`;
  }).join('');
}

function renderTicketCard(){
  const card = document.getElementById('ticketCard');

  if(confirmedTicket){
    renderConfirmation(card);
    return;
  }

  let html = '';

  if(state.step === 1){
    html = `
      <h3>Escolha o serviço</h3>
      <p class="step-sub">Selecione o que você quer fazer hoje.</p>
      <div class="option-grid">
        ${SERVICES.map(s => `
          <button type="button" class="option-card ${state.service===s.id?'selected':''}" data-service="${s.id}">
            <div class="oc-title">${s.name}</div>
            <div class="oc-sub">${money(s.price)} · ${s.duration} min</div>
          </button>
        `).join('')}
      </div>
      <div class="ticket-nav">
        <span></span>
        <button class="btn-primary" id="nextBtn" ${state.service ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'}>Avançar →</button>
      </div>
    `;
  } else if(state.step === 2){
    html = `
      <h3>Escolha a data</h3>
      <p class="step-sub">Atendemos todos os dias da semana. Deslize para ver mais dias.</p>
      <div class="date-chip-row" id="dateChipRow">${renderDateChips()}</div>
      <div class="ticket-nav">
        <button class="btn-ghost" id="backBtn">← Voltar</button>
        <button class="btn-primary" id="nextBtn" ${state.date ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'}>Avançar →</button>
      </div>
    `;
  } else if(state.step === 3){
    html = `
      <h3>Escolha o horário</h3>
      <p class="step-sub">Horários já reservados ficam indisponíveis automaticamente.</p>
      <div id="timeArea"><p class="loading-msg">Carregando horários…</p></div>
      <div class="ticket-nav">
        <button class="btn-ghost" id="backBtn">← Voltar</button>
        <button class="btn-primary" id="nextBtn" ${state.time ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'}>Avançar →</button>
      </div>
    `;
  } else if(state.step === 4){
    const service = SERVICES.find(s => s.id === state.service);
    const barber = BARBERS.find(b => b.id === state.barber);

    html = `
      <h3>Seus dados</h3>
      <p class="step-sub">Só para confirmar o seu horário.</p>
      <div class="summary-box">
        <div class="row"><span>Serviço</span><b>${service.name} · ${money(service.price)}</b></div>
        <div class="row"><span>Barbeiro</span><b>${barber.name}</b></div>
        <div class="row"><span>Data</span><b>${formatDate(state.date)}</b></div>
        <div class="row"><span>Horário</span><b>${state.time}</b></div>
      </div>
      <div class="field">
        <label for="nameInput">Nome completo</label>
        <input type="text" id="nameInput" value="${escapeHtml(state.name)}" placeholder="Como podemos te chamar">
      </div>
      <div class="field">
        <label for="phoneInput">Telefone / WhatsApp</label>
        <input type="tel" id="phoneInput" value="${escapeHtml(state.phone)}" placeholder="(11) 90000-0000">
      </div>
      <p class="error-msg" id="formError" style="display:none;"></p>
      <div class="ticket-nav">
        <button class="btn-ghost" id="backBtn">← Voltar</button>
        <button class="btn-primary" id="confirmBtn">Confirmar agendamento</button>
      </div>
    `;
  }

  card.innerHTML = html;
  attachStepHandlers();
}

function escapeHtml(value){
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}

function formatDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const WEEKDAY_ABBR = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
const MONTH_ABBR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function toISODate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Gera os próximos dias corridos disponíveis para agendamento (a barbearia
// atende todos os dias da semana).
function getAvailableDates(daysAhead = 21){
  const dates = [];
  const today = new Date();
  today.setHours(0,0,0,0);

  for(let i = 0; i < daysAhead; i++){
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function renderDateChips(){
  const dates = getAvailableDates();
  return dates.map(d => {
    const iso = toISODate(d);
    const isSelected = state.date === iso;
    const isToday = iso === toISODate(new Date());
    return `<button
      type="button"
      class="date-chip ${isSelected ? 'selected' : ''}"
      data-date="${iso}"
    >
      <span class="dc-weekday">${isToday ? 'HOJE' : WEEKDAY_ABBR[d.getDay()]}</span>
      <span class="dc-day">${d.getDate()}</span>
      <span class="dc-month">${MONTH_ABBR[d.getMonth()]}</span>
    </button>`;
  }).join('');
}

function attachStepHandlers(){
  const backBtn = document.getElementById('backBtn');
  if(backBtn){
    backBtn.onclick = () => {
      stopWatchingSlots();
      state.step -= 1;
      renderAll();
    };
  }

  const nextBtn = document.getElementById('nextBtn');
  if(nextBtn){
    nextBtn.onclick = () => {
      state.step += 1;
      renderAll();
    };
  }

  if(state.step === 1){
    document.querySelectorAll('[data-service]').forEach(el => {
      el.onclick = () => {
        state.service = el.dataset.service;
        renderAll();
      };
    });
  }

  if(state.step === 2){
    document.querySelectorAll('.date-chip').forEach(chip => {
      chip.onclick = () => {
        state.date = chip.dataset.date;
        state.time = null;
        renderAll();
      };
    });
  }

  if(state.step === 3){
    loadAndWatchTimeSlots();
  }

  if(state.step === 4){
    const nameInput = document.getElementById('nameInput');
    const phoneInput = document.getElementById('phoneInput');

    nameInput.oninput = () => { state.name = nameInput.value; };
    phoneInput.oninput = () => { state.phone = phoneInput.value; };

    document.getElementById('confirmBtn').onclick = submitBooking;
  }
}

function stopWatchingSlots(){
  if(typeof stopSlotWatch === 'function'){
    try{ stopSlotWatch(); }catch(e){}
  }
  stopSlotWatch = null;
}

async function loadAndWatchTimeSlots(){
  stopWatchingSlots();

  const area = document.getElementById('timeArea');
  const prefix = `slot:${state.barber}:${state.date}:`;

  const renderSlots = result => {
    const booked = (result && result.keys ? result.keys : []);

    // Se o horário selecionado acabou de ser reservado por outra pessoa,
    // remove a seleção imediatamente.
    if(state.time && booked.includes(state.time)){
      state.time = null;
    }

    area.innerHTML = `<div class="time-grid">
      ${TIME_SLOTS.map(t => {
        const isBooked = booked.includes(t);
        const isSelected = state.time === t;

        return `<button
          type="button"
          class="time-slot ${isSelected?'selected':''} ${isBooked?'booked':''}"
          data-time="${t}"
          ${isBooked?'disabled':''}
          aria-disabled="${isBooked?'true':'false'}"
        >${isBooked ? `<span class="ts-time">${t}</span><span class="ts-x" aria-hidden="true">✕</span>` : t}</button>`;
      }).join('')}
    </div>`;

    const nextBtn = document.getElementById('nextBtn');
    if(nextBtn){
      nextBtn.disabled = !state.time;
      nextBtn.style.opacity = state.time ? '1' : '0.4';
      nextBtn.style.cursor = state.time ? 'pointer' : 'not-allowed';
    }

    document.querySelectorAll('.time-slot:not(:disabled)').forEach(el => {
      el.onclick = () => {
        state.time = el.dataset.time;
        renderAll();
      };
    });
  };

  try{
    // Carrega imediatamente.
    const initial = await db.list(prefix);
    renderSlots(initial);

    // Depois mantém sincronizado em tempo real.
    if(typeof db.watch === 'function'){
      stopSlotWatch = db.watch(prefix, renderSlots);
    }
  } catch(err){
    area.innerHTML = `<p class="error-msg">Não foi possível carregar os horários agora. Tente novamente.</p>`;
    console.error('Erro ao carregar horários', err);
  }
}

async function submitBooking(){
  const errEl = document.getElementById('formError');
  errEl.style.display = 'none';

  if(!state.name.trim() || !state.phone.trim()){
    errEl.textContent = 'Preencha nome e telefone para confirmar.';
    errEl.style.display = 'block';
    return;
  }

  if(!state.date || !state.time){
    errEl.textContent = 'Escolha uma data e um horário.';
    errEl.style.display = 'block';
    return;
  }

  const confirmBtn = document.getElementById('confirmBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Confirmando…';

  try{
    const service = SERVICES.find(s => s.id === state.service);
    const barber = BARBERS.find(b => b.id === state.barber);

    if(!service || !barber){
      throw new Error('Serviço ou barbeiro não encontrado.');
    }

    const slotKey = `slot:${state.barber}:${state.date}:${state.time}`;

    const payload = {
      service: service.name,
      price: service.price,
      barber: barber.name,
      date: state.date,
      time: state.time,
      name: state.name.trim(),
      phone: state.phone.trim(),
      createdAt: new Date().toISOString(),
    };

    // Reserva atômica: o horário e o próximo ticket são definidos
    // dentro da mesma transação do Firestore.
    const finalPayload = await db.reserveSlot(slotKey, payload);

    confirmedTicket = finalPayload;
    stopWatchingSlots();
    renderAll();

  } catch(err){
    console.error('Erro ao confirmar agendamento', err);

    const code = err && err.code ? String(err.code) : '';
    const message = err && err.message ? String(err.message) : '';

    if(code === 'SLOT_ALREADY_BOOKED' || code === 'SLOT_TAKEN' ||
       message === 'SLOT_ALREADY_BOOKED' || message === 'SLOT_TAKEN'){
      errEl.textContent = 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.';
      errEl.style.display = 'block';

      stopWatchingSlots();
      state.time = null;
      state.step = 3;
      renderAll();
      return;
    }

    // Mostra uma mensagem amigável, sem expor detalhes internos.
    errEl.textContent = 'Não foi possível confirmar agora. Atualize a página e tente novamente.';
    errEl.style.display = 'block';
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirmar agendamento';
  }
}

function renderConfirmation(card){
  document.getElementById('stepsTrack').style.display = 'none';

  card.innerHTML = `
    <div class="confirm-ticket">
      <div class="ticket-label">Seu horário está reservado</div>
      <div class="ticket-num">Nº ${String(confirmedTicket.ticket).padStart(3,'0')}</div>
      <hr>
      <div class="ct-row"><span>Serviço</span><span>${escapeHtml(confirmedTicket.service)}</span></div>
      <div class="ct-row"><span>Barbeiro</span><span>${escapeHtml(confirmedTicket.barber)}</span></div>
      <div class="ct-row"><span>Data</span><span>${formatDate(confirmedTicket.date)}</span></div>
      <div class="ct-row"><span>Horário</span><span>${escapeHtml(confirmedTicket.time)}</span></div>
      <div class="ct-row"><span>Valor</span><span>${money(confirmedTicket.price)}</span></div>
      <hr>
      <p style="font-size:13px; color:var(--text-dim); margin-bottom:20px;">Guarde seu ticket. Para cancelar pelo site, use o número do ticket, seu nome e telefone.</p>
      <div class="confirmation-actions">
        <button class="btn-danger-outline" id="cancelMyBookingBtn" type="button">Cancelar este horário</button>
        <button class="btn-primary" id="newBookingBtn" type="button">Agendar outro horário</button>
      </div>
    </div>
  `;

  document.getElementById('cancelMyBookingBtn').onclick = () => {
    document.getElementById('cancelTicketInput').value = String(confirmedTicket.ticket).padStart(3,'0');
    document.getElementById('cancelNameInput').value = confirmedTicket.name || '';
    document.getElementById('cancelPhoneInput').value = confirmedTicket.phone || '';
    document.getElementById('cancelResult').textContent = '';
    document.getElementById('cancelResult').className = 'cancel-result';
    document.getElementById('cancelar').scrollIntoView({behavior:'smooth'});
  };

  document.getElementById('newBookingBtn').onclick = () => {
    confirmedTicket = null;
    state = {
      step:1,
      service:null,
      barber:BARBERS[0].id,
      date:'',
      time:null,
      name:'',
      phone:''
    };
    document.getElementById('stepsTrack').style.display = 'flex';
    renderAll();
    document.getElementById('agendar').scrollIntoView({behavior:'smooth'});
  };
}

function normalizeName(value){
  return String(value || '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
}

function normalizePhone(value){
  return String(value || '').replace(/\D/g,'');
}

async function findBookingForCancellation(ticket, name, phone){
  const wantedTicket = String(ticket || '').replace(/\D/g,'').replace(/^0+/, '') || '0';
  const wantedName = normalizeName(name);
  const wantedPhone = normalizePhone(phone);

  if(!wantedTicket || !wantedName || !wantedPhone){
    return null;
  }

  const result = await db.list('slot:');
  const keys = result && result.keys ? result.keys : [];

  for(const suffix of keys){
    const key = `slot:${suffix}`;

    try{
      const record = await db.get(key);
      const data = JSON.parse(record.value || '{}');

      const savedTicket = String(data.ticket ?? '').replace(/\D/g,'').replace(/^0+/, '') || '0';

      if(
        savedTicket === wantedTicket &&
        normalizeName(data.name) === wantedName &&
        normalizePhone(data.phone) === wantedPhone
      ){
        return { key, data };
      }
    }catch(e){
      // Um agendamento pode ser removido enquanto a busca está acontecendo.
    }
  }

  return null;
}

async function cancelMyBooking(){
  const btn = document.getElementById('cancelSubmitBtn');
  const resultEl = document.getElementById('cancelResult');

  const ticket = document.getElementById('cancelTicketInput').value;
  const name = document.getElementById('cancelNameInput').value;
  const phone = document.getElementById('cancelPhoneInput').value;

  resultEl.className = 'cancel-result';
  resultEl.textContent = 'Localizando seu agendamento…';
  btn.disabled = true;

  try{
    const booking = await findBookingForCancellation(ticket, name, phone);

    if(!booking){
      resultEl.className = 'cancel-result error';
      resultEl.textContent = 'Não encontramos um agendamento com esses dados. Confira ticket, nome e telefone.';
      return;
    }

    const confirmed = window.confirm(
      `Cancelar o horário de ${booking.data.time} do dia ${formatDate(booking.data.date)}?`
    );

    if(!confirmed){
      resultEl.className = 'cancel-result';
      resultEl.textContent = 'Cancelamento interrompido.';
      return;
    }

    await db.delete(booking.key);

    resultEl.className = 'cancel-result success';
    resultEl.textContent = `Agendamento Nº ${String(booking.data.ticket).padStart(3,'0')} cancelado. O horário ${booking.data.time} já está disponível novamente.`;

    if(
      confirmedTicket &&
      String(confirmedTicket.ticket) === String(booking.data.ticket) &&
      normalizePhone(confirmedTicket.phone) === normalizePhone(phone)
    ){
      confirmedTicket = null;
      document.getElementById('stepsTrack').style.display = 'flex';
      state = {
        step:1,
        service:null,
        barber:BARBERS[0].id,
        date:'',
        time:null,
        name:'',
        phone:''
      };
      renderAll();
    }

    // Limpa os campos depois do sucesso.
    document.getElementById('cancelTicketInput').value = '';
    document.getElementById('cancelNameInput').value = '';
    document.getElementById('cancelPhoneInput').value = '';

  }catch(err){
    console.error('Erro ao cancelar agendamento', err);
    resultEl.className = 'cancel-result error';
    resultEl.textContent = 'Não foi possível cancelar agora. Tente novamente.';
  }finally{
    btn.disabled = false;
  }
}

function setupCancellationForm(){
  const form = document.getElementById('cancelForm');
  if(!form) return;

  form.addEventListener('submit', event => {
    event.preventDefault();
    cancelMyBooking();
  });
}

function renderAll(){
  renderSteps();
  renderTicketCard();
}

renderServiceGrid();
renderBarberGrid();
setupCancellationForm();
renderAll();
