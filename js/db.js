// ---------------- FIREBASE CONFIG ----------------

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA-OVzR1sYfl4ElpjQEJi35sI6jt7-idX0",
  authDomain: "barbearia-do-vitin.firebaseapp.com",
  projectId: "barbearia-do-vitin",
  storageBucket: "barbearia-do-vitin.firebasestorage.app",
  messagingSenderId: "681571921817",
  appId: "1:681571921817:web:3149a832b78b13622f2d08",
};

// ---------------- STORAGE ADAPTER ----------------

const db = (function(){

  const hasNativeStorage =
    typeof window.storage === 'object' &&
    window.storage !== null &&
    typeof window.storage.get === 'function';

  if(hasNativeStorage){
    return window.storage;
  }

  const firebaseReady =
    typeof firebase !== 'undefined' &&
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.apiKey !== 'COLE_AQUI';

  if(firebaseReady){

    if(!firebase.apps.length){
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    const firestore = firebase.firestore();
    const col = firestore.collection('agendamentos');

    return {

      async get(key){
        const doc = await col.doc(encodeKey(key)).get();

        if(!doc.exists){
          throw new Error('Chave não encontrada: ' + key);
        }

        return {
          key,
          value: doc.data().value
        };
      },

      async set(key, value){
        await col.doc(encodeKey(key)).set({ value });

        return {
          key,
          value
        };
      },

      async delete(key){
        await col.doc(encodeKey(key)).delete();

        return {
          key,
          deleted: true
        };
      },

      async list(prefix){

        const encPrefix = encodeKey(prefix);

        const snap = await col
          .where(
            firebase.firestore.FieldPath.documentId(),
            '>=',
            encPrefix
          )
          .where(
            firebase.firestore.FieldPath.documentId(),
            '<',
            encPrefix + '\uf8ff'
          )
          .get();

        const keys = snap.docs.map(d =>
          decodeKey(d.id).slice(prefix.length)
        );

        return {
          keys
        };
      },

      watch(prefix, callback){

        const encPrefix = encodeKey(prefix);

        const query = col
          .where(firebase.firestore.FieldPath.documentId(), '>=', encPrefix)
          .where(firebase.firestore.FieldPath.documentId(), '<', encPrefix + '\uf8ff');

        return query.onSnapshot(
          snap => {
            const keys = snap.docs.map(d =>
              decodeKey(d.id).slice(prefix.length)
            );
            callback({ keys });
          },
          error => console.error('Erro ao acompanhar horários:', error)
        );
      },

      // ------------------------------------------------
      // RESERVA ATÔMICA + TICKET SEQUENCIAL
      // ------------------------------------------------

      async reserveSlot(slotKey, payload){

        const slotRef = col.doc(encodeKey(slotKey));
        const counterRef = col.doc('ticket-counter');

        // Descobre o maior ticket já existente. Isso corrige uma
        // numeração antiga que tenha ficado fora de ordem.
        const allSlots = await col
          .where(firebase.firestore.FieldPath.documentId(), '>=', 'slot:')
          .where(firebase.firestore.FieldPath.documentId(), '<', 'slot:\uf8ff')
          .get();

        let highestExistingTicket = 0;

        allSlots.docs.forEach(doc => {
          try{
            const raw = doc.data().value;
            const booking = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const n = parseInt(booking && booking.ticket, 10);
            if(Number.isFinite(n) && n > highestExistingTicket){
              highestExistingTicket = n;
            }
          }catch(e){}
        });

        return await firestore.runTransaction(async transaction => {

          const slotDoc = await transaction.get(slotRef);

          if(slotDoc.exists){
            const error = new Error('SLOT_ALREADY_BOOKED');
            error.code = 'SLOT_ALREADY_BOOKED';
            throw error;
          }

          const counterDoc = await transaction.get(counterRef);

          let currentCounter = 0;

          if(counterDoc.exists){
            const currentValue =
              parseInt(counterDoc.data().value, 10);

            if(!isNaN(currentValue)){
              currentCounter = currentValue;
            }
          }

          // Sempre usa o maior número já encontrado + 1.
          // Assim a sequência não volta para trás.
          const ticketNum =
            Math.max(currentCounter, highestExistingTicket) + 1;

          const finalPayload = {
            ...payload,
            ticket: ticketNum
          };

          transaction.create(slotRef, {
            value: JSON.stringify(finalPayload)
          });

          transaction.set(counterRef, {
            value: String(ticketNum)
          });

          return finalPayload;

        });

      },

      // ------------------------------------------------
      // LOCALIZA AGENDAMENTO PARA CANCELAMENTO
      // Valida ticket + nome + telefone.
      // ------------------------------------------------

      async findBooking(ticket, name, phone){

        const snap = await col
          .where(
            firebase.firestore.FieldPath.documentId(),
            '>=',
            'slot:'
          )
          .where(
            firebase.firestore.FieldPath.documentId(),
            '<',
            'slot:\uf8ff'
          )
          .get();

        const normalizedTicket = String(ticket || '').trim();
        const normalizedName = normalizeText(name);
        const normalizedPhone = onlyDigits(phone);

        for(const doc of snap.docs){

          try{

            const raw = doc.data().value;
            const booking = typeof raw === 'string'
              ? JSON.parse(raw)
              : raw;

            if(!booking || !booking.ticket) continue;

            const sameTicket =
              String(booking.ticket) === normalizedTicket;

            const sameName =
              normalizeText(booking.name) === normalizedName;

            const samePhone =
              onlyDigits(booking.phone) === normalizedPhone;

            if(sameTicket && sameName && samePhone){

              return {
                key: decodeKey(doc.id),
                data: booking
              };

            }

          }catch(e){
            console.warn('Agendamento inválido ignorado:', doc.id);
          }

        }

        return null;
      },

      // ------------------------------------------------
      // CANCELAMENTO ATÔMICO
      // Exclui a reserva e libera o horário.
      // ------------------------------------------------

      async cancelBooking(slotKey){

        const slotRef = col.doc(encodeKey(slotKey));

        return await firestore.runTransaction(async transaction => {

          const slotDoc = await transaction.get(slotRef);

          if(!slotDoc.exists){
            const error = new Error('BOOKING_NOT_FOUND');
            error.code = 'BOOKING_NOT_FOUND';
            throw error;
          }

          transaction.delete(slotRef);

          return {
            cancelled: true
          };

        });

      }

    };

  }

  // ------------------------------------------------
  // FALLBACK LOCALSTORAGE
  // ------------------------------------------------

  console.warn(
    'Firebase não configurado — usando localStorage. ' +
    'Os agendamentos ficarão isolados por navegador.'
  );

  const PREFIX = 'barbearia_cn_';

  return {

    async get(key){

      const raw =
        localStorage.getItem(PREFIX + key);

      if(raw === null){
        throw new Error('Chave não encontrada: ' + key);
      }

      return {
        key,
        value: raw,
        shared: true
      };
    },

    async set(key, value){

      localStorage.setItem(PREFIX + key, value);

      return {
        key,
        value,
        shared: true
      };
    },

    async delete(key){

      localStorage.removeItem(PREFIX + key);

      return {
        key,
        deleted: true,
        shared: true
      };
    },

    async list(prefix){

      const keys = [];
      const search = PREFIX + (prefix || '');

      for(let i = 0; i < localStorage.length; i++){

        const k = localStorage.key(i);

        if(k && k.startsWith(search)){
          keys.push(k.slice(PREFIX.length));
        }

      }

      return {
        keys,
        prefix,
        shared: true
      };
    },

    watch(prefix, callback){

      let last = '';

      const refresh = async () => {

        const result = await this.list(prefix);
        const signature = JSON.stringify(result.keys || []);

        if(signature !== last){
          last = signature;
          callback(result);
        }

      };

      refresh();

      const timer = setInterval(refresh, 1000);

      return () => clearInterval(timer);
    },

    async reserveSlot(slotKey, payload){

      const existing =
        localStorage.getItem(PREFIX + slotKey);

      if(existing){

        const error = new Error('SLOT_ALREADY_BOOKED');
        error.code = 'SLOT_ALREADY_BOOKED';
        throw error;

      }

      const counterRaw =
        localStorage.getItem(PREFIX + 'ticket-counter');

      let ticketNum = 1;

      if(counterRaw){

        const current = parseInt(counterRaw, 10);

        if(!isNaN(current)){
          ticketNum = current + 1;
        }

      }

      const finalPayload = {
        ...payload,
        ticket: ticketNum
      };

      localStorage.setItem(
        PREFIX + slotKey,
        JSON.stringify(finalPayload)
      );

      localStorage.setItem(
        PREFIX + 'ticket-counter',
        String(ticketNum)
      );

      return finalPayload;
    },

    async findBooking(ticket, name, phone){

      const normalizedTicket = String(ticket || '').trim();
      const normalizedName = normalizeText(name);
      const normalizedPhone = onlyDigits(phone);

      const result = await this.list('slot:');

      for(const suffix of result.keys || []){

        const key = 'slot:' + suffix;

        try{

          const rec = await this.get(key);

          const booking = JSON.parse(rec.value);

          if(
            String(booking.ticket) === normalizedTicket &&
            normalizeText(booking.name) === normalizedName &&
            onlyDigits(booking.phone) === normalizedPhone
          ){

            return {
              key,
              data: booking
            };

          }

        }catch(e){}

      }

      return null;
    },

    async cancelBooking(slotKey){

      const existing =
        localStorage.getItem(PREFIX + slotKey);

      if(!existing){

        const error = new Error('BOOKING_NOT_FOUND');
        error.code = 'BOOKING_NOT_FOUND';
        throw error;

      }

      localStorage.removeItem(PREFIX + slotKey);

      return {
        cancelled: true
      };
    }

  };

})();

function normalizeText(value){
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function onlyDigits(value){
  return String(value || '').replace(/\D/g, '');
}

// Firestore doc IDs não podem conter "/".
function encodeKey(key){
  return (key || '').replace(/\//g, '__');
}

function decodeKey(key){
  return (key || '').replace(/__/g, '/');
}
