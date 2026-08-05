// ---------------- DATA ----------------
const SERVICES = [
  { id:'corte', name:'Corte tradicional', desc:'Tesoura e máquina, acabamento na navalha.', price:45, duration:30 },
  { id:'barba', name:'Barba desenhada', desc:'Toalha quente, navalha e óleo pós-barba.', price:35, duration:20 },
  { id:'combo', name:'Corte + Barba', desc:'O combo completo, com desconto.', price:70, duration:50 },
  { id:'sobrancelha', name:'Sobrancelha', desc:'Alinhamento na navalha.', price:15, duration:10 },
  { id:'pezinho', name:'Acabamento (pezinho)', desc:'Manutenção rápida de contorno.', price:20, duration:10 },
];

const BARBERS = [
  { id:'marcos', name:'Marcos Silva', role:'Cortes clássicos', desc:'20 anos de navalha. Especialista em cortes sociais e barba desenhada.', initials:'MS' },
  { id:'rafael', name:'Rafael Costa', role:'Estilos modernos', desc:'Fade, degradê e design de barba. Referência entre os mais jovens.', initials:'RC' },
  { id:'diego', name:'Diego Almeida', role:'Barba & navalha', desc:'Foco em barboterapia e acabamento na navalha reta.', initials:'DA' },
];

const TIME_SLOTS = ['09:00','09:40','10:20','11:00','11:40','13:00','13:40','14:20','15:00','15:40','16:20','17:00','17:40','18:20'];

const STEP_LABELS = ['Serviço','Barbeiro','Data','Horário','Seus dados'];

// ---------------- STATE ----------------
let state = {
  step: 1,
  service: null,
  barber: null,
  date: '',
  time: null,
  name: '',
  phone: '',
};

let bookedSlotsCache = {}; // key: barber+date -> array of booked times
let confirmedTicket = null;

// ---------------- RENDER: static grids ----------------
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

// ---------------- STEP INDICATOR ----------------
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

// ---------------- STEP CONTENT ----------------
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
      <h3>Escolha o barbeiro</h3>
      <p class="step-sub">Quem vai cuidar do corte hoje?</p>
      <div class="option-grid">
        ${BARBERS.map(b => `
          <button type="button" class="option-card ${state.barber===b.id?'selected':''}" data-barber="${b.id}">
            <div class="oc-title">${b.name}</div>
            <div class="oc-sub">${b.role}</div>
          </button>
        `).join('')}
      </div>
      <div class="ticket-nav">
        <button class="btn-ghost" id="backBtn">← Voltar</button>
        <button class="btn-primary" id="nextBtn" ${state.barber ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'}>Avançar →</button>
      </div>
    `;
  } else if(state.step === 3){
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
  } else if(state.step === 4){
    html = `
      <h3>Escolha o horário</h3>
      <p class="step-sub">Horários em cinza já estão reservados para este barbeiro nesta data.</p>
      <div id="timeArea"><p class="loading-msg">Carregando horários…</p></div>
      <div class="ticket-nav">
        <button class="btn-ghost" id="backBtn">← Voltar</button>
        <button class="btn-primary" id="nextBtn" ${state.time ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'}>Avançar →</button>
      </div>
    `;
  } else if(state.step === 5){
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
        <input type="text" id="nameInput" value="${state.name}" placeholder="Como podemos te chamar">
      </div>
      <div class="field">
        <label for="phoneInput">Telefone / WhatsApp</label>
        <input type="tel" id="phoneInput" value="${state.phone}" placeholder="(11) 90000-0000">
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

function formatDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function attachStepHandlers(){
  const backBtn = document.getElementById('backBtn');
  if(backBtn) backBtn.onclick = () => { state.step -= 1; renderAll(); };

  const nextBtn = document.getElementById('nextBtn');
  if(nextBtn) nextBtn.onclick = () => { state.step += 1; renderAll(); };

  if(state.step === 1){
    document.querySelectorAll('[data-service]').forEach(el => {
      el.onclick = () => { state.service = el.dataset.service; renderAll(); };
    });
  }

  if(state.step === 2){
    document.querySelectorAll('[data-barber]').forEach(el => {
      el.onclick = () => { state.barber = el.dataset.barber; renderAll(); };
    });
  }

  if(state.step === 3){
    const dateInput = document.getElementById('dateInput');
    dateInput.onchange = () => {
      const val = dateInput.value;
      const day = new Date(val + 'T12:00:00').getDay(); // 0=Sun,1=Mon
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

  if(state.step === 4){
    loadAndRenderTimeSlots();
  }

  if(state.step === 5){
    const nameInput = document.getElementById('nameInput');
    const phoneInput = document.getElementById('phoneInput');
    nameInput.oninput = () => { state.name = nameInput.value; };
    phoneInput.oninput = () => { state.phone = phoneInput.value; };
    document.getElementById('confirmBtn').onclick = submitBooking;
  }
}

async function loadAndRenderTimeSlots(){
  const area = document.getElementById('timeArea');
  const cacheKey = `${state.barber}__${state.date}`;
  try{
    let booked = bookedSlotsCache[cacheKey];
    if(!booked){
      const result = await db.list(`slot:${state.barber}:${state.date}:`, true);
      booked = (result && result.keys ? result.keys : []).map(k => k.split(':').pop());
      bookedSlotsCache[cacheKey] = booked;
    }
    area.innerHTML = `<div class="time-grid">
      ${TIME_SLOTS.map(t => {
        const isBooked = booked.includes(t);
        const isSelected = state.time === t;
        return `<button type="button" class="time-slot ${isSelected?'selected':''}" data-time="${t}" ${isBooked?'disabled':''}>${t}</button>`;
      }).join('')}
    </div>`;
    document.querySelectorAll('.time-slot:not(:disabled)').forEach(el => {
      el.onclick = () => {
        state.time = el.dataset.time;
        renderAll();
      };
    });
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

  const confirmBtn = document.getElementById('confirmBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Confirmando…';

  try{
    const slotKey = `slot:${state.barber}:${state.date}:${state.time}`;
    // check again right before writing, in case someone else took it
    let existing = null;
    try{ existing = await db.get(slotKey, true); } catch(e){ existing = null; }
    if(existing){
      errEl.textContent = 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.';
      errEl.style.display = 'block';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirmar agendamento';
      delete bookedSlotsCache[`${state.barber}__${state.date}`];
      state.step = 4;
      state.time = null;
      renderAll();
      return;
    }

    const service = SERVICES.find(s => s.id === state.service);
    const barber = BARBERS.find(b => b.id === state.barber);

    // ticket number
    let ticketNum = 101;
    try{
      const counterRes = await db.get('ticket-counter', true);
      ticketNum = counterRes && counterRes.value ? parseInt(counterRes.value, 10) + 1 : 101;
    } catch(e){ ticketNum = 100 + Math.floor(Math.random()*900); }
    await db.set('ticket-counter', String(ticketNum), true);

    const payload = {
      ticket: ticketNum,
      service: service.name,
      price: service.price,
      barber: barber.name,
      date: state.date,
      time: state.time,
      name: state.name.trim(),
      phone: state.phone.trim(),
      createdAt: new Date().toISOString(),
    };

    const result = await db.set(slotKey, JSON.stringify(payload), true);
    if(!result){
      throw new Error('Falha ao salvar o agendamento');
    }

    confirmedTicket = payload;
    renderAll();
  } catch(err){
    console.error('Erro ao confirmar agendamento', err);
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
      <div class="ticket-num">Nº ${confirmedTicket.ticket}</div>
      <hr>
      <div class="ct-row"><span>Serviço</span><span>${confirmedTicket.service}</span></div>
      <div class="ct-row"><span>Barbeiro</span><span>${confirmedTicket.barber}</span></div>
      <div class="ct-row"><span>Data</span><span>${formatDate(confirmedTicket.date)}</span></div>
      <div class="ct-row"><span>Horário</span><span>${confirmedTicket.time}</span></div>
      <div class="ct-row"><span>Valor</span><span>${money(confirmedTicket.price)}</span></div>
      <hr>
      <p style="font-size:13px; color:var(--text-dim); margin-bottom:20px;">Guarde o número da sua senha. Chegue com 5 minutos de antecedência.</p>
      <button class="btn-primary" id="newBookingBtn" style="width:100%;">Agendar outro horário</button>
    </div>
  `;
  document.getElementById('newBookingBtn').onclick = () => {
    confirmedTicket = null;
    state = { step:1, service:null, barber:null, date:'', time:null, name:'', phone:'' };
    bookedSlotsCache = {};
    document.getElementById('stepsTrack').style.display = 'flex';
    renderAll();
    document.getElementById('agendar').scrollIntoView({behavior:'smooth'});
  };
}

function renderAll(){
  renderSteps();
  renderTicketCard();
}

// ---------------- INIT ----------------
renderServiceGrid();
renderBarberGrid();
renderAll();
