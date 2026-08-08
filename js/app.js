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
    const today = new Date();
    const minDate = today.toISOString().split('T')[0];

    html = `
      <h3>Escolha a data</h3>
      <p class="step-sub">Atendemos de terça a sábado.</p>
      <div class="field">
        <label for="dateInput">Data</label>
        <input type="date" id="dateInput" min="${minDate}" value="${state.date}">
        <small id="dateError" class="error-msg" style="display:none;">Fechado às segundas e domingos — escolha outro dia.</small>
      </div>
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
    const dateInput = document.getElementById('dateInput');

    dateInput.onchange = () => {
      const val = dateInput.value;
      const day = new Date(val + 'T12:00:00').getDay();
      const err = document.getElementById('dateError');

      if(day === 0 || day === 1){
        err.style.display = 'block';
        state.date = '';
      } else {
        err.style.display = 'none';
        state.date = val;
        state.time = null;
      }

      renderAll();
    };
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

    // A operação precisa ser atômica no Firestore.
    // Se alguém ocupar o horário antes desta transação, ela falha.
    let finalPayload;

    if(typeof db.reserveSlot === 'function'){
      finalPayload = await db.reserveSlot(slotKey, payload);
    } else {
      // Compatibilidade com adapters antigos.
      const existing = await db.get(slotKey, true).catch(() => null);
      if(existing){
        const conflict = new Error('SLOT_TAKEN');
        conflict.code = 'SLOT_TAKEN';
        throw conflict;
      }

      let ticketNum = 101;
      const counter = await db.get('ticket-counter', true).catch(() => null);
      if(counter && counter.value){
        const current = parseInt(counter.value, 10);
        if(Number.isFinite(current)) ticketNum = current + 1;
      }

      finalPayload = {...payload, ticket: ticketNum};
      await db.set('ticket-counter', String(ticketNum), true);
      await db.set(slotKey, JSON.stringify(finalPayload), true);
    }

    confirmedTicket = finalPayload;
    stopWatchingSlots();
    renderAll();

  } catch(err){
    console.error('Erro ao confirmar agendamento', err);

    if(err && (err.code === 'SLOT_TAKEN' || err.message === 'SLOT_TAKEN')){
      errEl.textContent = 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.';
      errEl.style.display = 'block';

      stopWatchingSlots();
      state.time = null;
      state.step = 3;
      renderAll();
      return;
    }

    errEl.textContent = 'Algo deu errado ao confirmar. Tente novamente.';
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
      <div class="ticket-num">Nº ${String(confirmedTicket.ticket).padStart(3, '0')}</div>
      <hr>
      <div class="ct-row"><span>Serviço</span><span>${escapeHtml(confirmedTicket.service)}</span></div>
      <div class="ct-row"><span>Barbeiro</span><span>${escapeHtml(confirmedTicket.barber)}</span></div>
      <div class="ct-row"><span>Data</span><span>${formatDate(confirmedTicket.date)}</span></div>
      <div class="ct-row"><span>Horário</span><span>${escapeHtml(confirmedTicket.time)}</span></div>
      <div class="ct-row"><span>Valor</span><span>${money(confirmedTicket.price)}</span></div>
      <hr>
      <p style="font-size:13px; color:var(--text-dim); margin-bottom:20px;">Guarde o número da sua senha. Chegue com 5 minutos de antecedência.</p>
      <div class="confirm-actions">
        <button class="btn-primary" id="newBookingBtn">Agendar outro horário</button>
        <button class="btn-cancel" id="cancelThisBookingBtn" type="button">Cancelar este horário</button>
      </div>
    </div>
  `;

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

  document.getElementById('cancelThisBookingBtn').onclick = () => {
    const ticketInput = document.getElementById('cancelTicket');
    const nameInput = document.getElementById('cancelName');
    const phoneInput = document.getElementById('cancelPhone');

    if(ticketInput) ticketInput.value = confirmedTicket.ticket;
    if(nameInput) nameInput.value = confirmedTicket.name || state.name || '';
    if(phoneInput) phoneInput.value = confirmedTicket.phone || state.phone || '';

    document.getElementById('cancelError').style.display = 'none';
    document.getElementById('cancelSuccess').style.display = 'none';
    document.getElementById('cancelPreview').style.display = 'none';

    document.getElementById('cancelar').scrollIntoView({behavior:'smooth'});
  };
}

async function handleCancellationSubmit(event){
  event.preventDefault();

  const ticket = document.getElementById('cancelTicket').value.trim();
  const name = document.getElementById('cancelName').value.trim();
  const phone = document.getElementById('cancelPhone').value.trim();

  const errorEl = document.getElementById('cancelError');
  const successEl = document.getElementById('cancelSuccess');
  const preview = document.getElementById('cancelPreview');
  const btn = document.getElementById('findCancelBtn');

  errorEl.style.display = 'none';
  successEl.style.display = 'none';
  preview.style.display = 'none';

  if(!ticket || !name || !phone){
    errorEl.textContent = 'Preencha ticket, nome e telefone.';
    errorEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Consultando…';

  try{

    const found = await db.findBooking(ticket, name, phone);

    if(!found){
      errorEl.textContent = 'Não encontramos um agendamento com esses três dados. Confira o ticket, o nome e o telefone.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Consultar agendamento';
      return;
    }

    const booking = found.data;

    preview.innerHTML = `
      <div class="cancel-preview-title">Agendamento encontrado</div>
      <div class="cancel-preview-grid">
        <div><span>Ticket</span><b>${escapeHtml(String(booking.ticket))}</b></div>
        <div><span>Nome</span><b>${escapeHtml(booking.name)}</b></div>
        <div><span>Serviço</span><b>${escapeHtml(booking.service)}</b></div>
        <div><span>Data</span><b>${formatDate(booking.date)}</b></div>
        <div><span>Horário</span><b>${escapeHtml(booking.time)}</b></div>
      </div>
      <p>Ao confirmar, o horário <strong>${escapeHtml(booking.time)}</strong> ficará disponível novamente para outros clientes.</p>
      <button type="button" class="btn-cancel" id="confirmCancelBtn">Sim, cancelar meu horário</button>
    `;

    preview.style.display = 'block';

    document.getElementById('confirmCancelBtn').onclick = async () => {

      const confirmBtn = document.getElementById('confirmCancelBtn');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Cancelando…';

      try{

        await db.cancelBooking(found.key);

        // Libera imediatamente a seleção atual se o cliente
        // estiver com a agenda aberta em outra parte da página.
        if(
          state.date === booking.date &&
          state.time === booking.time
        ){
          state.time = null;
        }

        confirmedTicket = null;

        successEl.textContent =
          `✅ Horário das ${booking.time} do dia ${formatDate(booking.date)} cancelado com sucesso. O horário já está disponível novamente.`;

        successEl.style.display = 'block';

        preview.style.display = 'none';

        document.getElementById('cancelForm').reset();

        btn.disabled = false;
        btn.textContent = 'Consultar agendamento';

        // Se o usuário ainda estiver no fluxo de agendamento,
        // atualiza a lista de horários.
        if(state.step === 3){
          setTimeout(() => loadAndWatchTimeSlots(), 100);
        }

      }catch(err){

        console.error('Erro ao cancelar agendamento:', err);

        if(err && err.code === 'BOOKING_NOT_FOUND'){
          errorEl.textContent =
            'Esse agendamento não está mais disponível. Talvez já tenha sido cancelado.';
        }else{
          errorEl.textContent =
            'Não foi possível cancelar o agendamento agora. Tente novamente.';
        }

        errorEl.style.display = 'block';

        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Sim, cancelar meu horário';

      }

    };

  }catch(err){

    console.error('Erro ao consultar agendamento:', err);

    errorEl.textContent =
      'Não foi possível consultar o agendamento agora. Tente novamente.';

    errorEl.style.display = 'block';

  }finally{

    if(btn.textContent === 'Consultando…'){
      btn.disabled = false;
      btn.textContent = 'Consultar agendamento';
    }

  }

}

function initCancellation(){

  const form = document.getElementById('cancelForm');

  if(form){
    form.addEventListener('submit', handleCancellationSubmit);
  }

}

function renderAll(){
  renderSteps();
  renderTicketCard();
}

renderServiceGrid();
renderBarberGrid();
initCancellation();
renderAll();
