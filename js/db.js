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
    return {
      get: (...args) => window.storage.get(...args),
      set: (...args) => window.storage.set(...args),
      delete: (...args) => window.storage.delete(...args),
      list: (...args) => window.storage.list(...args),

      // window.storage não tem "watch" nativo — simulamos com polling.
      watch(prefix, callback){
        let last = '';
        const refresh = async () => {
          const result = await window.storage.list(prefix, true);
          const signature = JSON.stringify((result && result.keys) || []);
          if(signature !== last){
            last = signature;
            callback(result || { keys: [] });
          }
        };
        refresh();
        const timer = setInterval(refresh, 1500);
        return () => clearInterval(timer);
      },

      async reserveSlot(slotKey, payload){
        let existing = null;
        try{ existing = await window.storage.get(slotKey, true); } catch(e){ existing = null; }

        if(existing){
          const error = new Error('SLOT_ALREADY_BOOKED');
          error.code = 'SLOT_ALREADY_BOOKED';
          throw error;
        }

        let ticketNum = 101;
        try{
          const counterRes = await window.storage.get('ticket-counter', true);
          const n = counterRes && parseInt(counterRes.value, 10);
          if(Number.isFinite(n)) ticketNum = n + 1;
        } catch(e){ /* contador ainda não existe — começa em 101 */ }

        const finalPayload = { ...payload, ticket: ticketNum };
        await window.storage.set(slotKey, JSON.stringify(finalPayload), true);
        await window.storage.set('ticket-counter', String(ticketNum), true);
        return finalPayload;
      },

      async blockSlot(slotKey, payload){
        let existing = null;
        try{ existing = await window.storage.get(slotKey, true); } catch(e){ existing = null; }

        if(existing){
          const error = new Error('SLOT_ALREADY_BOOKED');
          error.code = 'SLOT_ALREADY_BOOKED';
          throw error;
        }

        const finalPayload = { ...payload, blocked: true };
        await window.storage.set(slotKey, JSON.stringify(finalPayload), true);
        return finalPayload;
      }
    };
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
      // RESERVA ATÔMICA
      // ------------------------------------------------
      //
      // Essa função é a parte mais importante.
      //
      // Ela verifica e cria o horário dentro da MESMA
      // transação do Firestore.
      //
      // Portanto:
      //
      // Cliente A -> consegue criar
      // Cliente B -> recebe horário ocupado
      //
      // mesmo que os dois cliquem praticamente juntos.
      //

      async reserveSlot(slotKey, payload){

        const slotRef = col.doc(encodeKey(slotKey));
        const counterRef = col.doc('ticket-counter');

        // Se ainda não existe contador, descobrimos o maior ticket
        // já existente para continuar a sequência sem repetir números.
        let initialCounter = 0;

        try{
          const existingCounter = await counterRef.get();

          if(existingCounter.exists){
            const n = parseInt(existingCounter.data().value, 10);
            if(Number.isFinite(n)) initialCounter = n;
          } else {
            const prefix = encodeKey('slot:');
            const snap = await col
              .where(firebase.firestore.FieldPath.documentId(), '>=', prefix)
              .where(firebase.firestore.FieldPath.documentId(), '<', prefix + '\uf8ff')
              .get();

            for(const doc of snap.docs){
              try{
                const raw = doc.data().value;
                const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                const n = parseInt(data && data.ticket, 10);
                if(Number.isFinite(n) && n > initialCounter){
                  initialCounter = n;
                }
              }catch(e){}
            }
          }
        }catch(e){
          // O contador será inicializado em 0 dentro da transação.
          // Se as regras não permitirem a leitura, o erro real da
          // transação será retornado ao chamador.
        }

        return await firestore.runTransaction(async transaction => {

          // Todas as leituras acontecem antes das escritas.
          const slotDoc = await transaction.get(slotRef);
          const counterDoc = await transaction.get(counterRef);

          if(slotDoc.exists){
            const error = new Error('SLOT_ALREADY_BOOKED');
            error.code = 'SLOT_ALREADY_BOOKED';
            throw error;
          }

          let currentTicket = initialCounter;

          if(counterDoc.exists){
            const stored = parseInt(counterDoc.data().value, 10);
            if(Number.isFinite(stored)){
              currentTicket = stored;
            }
          }

          const ticketNum = currentTicket + 1;

          const finalPayload = {
            ...payload,
            ticket: ticketNum
          };

          // IMPORTANTE: usamos set(), que é suportado pelo SDK Web/compat.
          // Como verificamos a existência dentro da mesma transação,
          // somente uma tentativa consegue ocupar o horário.
          transaction.set(slotRef, {
            value: JSON.stringify(finalPayload)
          });

          transaction.set(counterRef, {
            value: String(ticketNum)
          });

          return finalPayload;
        });
      },

      // ------------------------------------------------
      // BLOQUEIO DE HORÁRIO (usado pelo painel do barbeiro)
      // ------------------------------------------------
      // Mesma proteção contra corrida do reserveSlot, mas não
      // consome número de ticket — bloqueios não são agendamentos.
      async blockSlot(slotKey, payload){

        const slotRef = col.doc(encodeKey(slotKey));

        return await firestore.runTransaction(async transaction => {
          const slotDoc = await transaction.get(slotRef);

          if(slotDoc.exists){
            const error = new Error('SLOT_ALREADY_BOOKED');
            error.code = 'SLOT_ALREADY_BOOKED';
            throw error;
          }

          const finalPayload = { ...payload, blocked: true };

          transaction.set(slotRef, {
            value: JSON.stringify(finalPayload)
          });

          return finalPayload;
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
        throw new Error(
          'Chave não encontrada: ' + key
        );
      }

      return {
        key,
        value: raw,
        shared: true
      };
    },

    async set(key, value){

      localStorage.setItem(
        PREFIX + key,
        value
      );

      return {
        key,
        value,
        shared: true
      };
    },

    async delete(key){

      localStorage.removeItem(
        PREFIX + key
      );

      return {
        key,
        deleted: true,
        shared: true
      };
    },

    async list(prefix){

      const keys = [];

      const search =
        PREFIX + (prefix || '');

      for(
        let i = 0;
        i < localStorage.length;
        i++
      ){

        const k = localStorage.key(i);

        if(
          k &&
          k.startsWith(search)
        ){

          keys.push(
            k.slice(search.length)
          );

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

    // Fallback para o caso do Firebase não estar disponível.
    async reserveSlot(slotKey, payload){

      const existing =
        localStorage.getItem(
          PREFIX + slotKey
        );

      if(existing){

        const error =
          new Error('SLOT_ALREADY_BOOKED');

        error.code =
          'SLOT_ALREADY_BOOKED';

        throw error;

      }

      const counterRaw =
        localStorage.getItem(
          PREFIX + 'ticket-counter'
        );

      let ticketNum = 101;

      if(counterRaw){

        const current =
          parseInt(counterRaw, 10);

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

    // Bloqueio de horário — usado pelo painel do barbeiro.
    async blockSlot(slotKey, payload){

      const existing =
        localStorage.getItem(
          PREFIX + slotKey
        );

      if(existing){
        const error =
          new Error('SLOT_ALREADY_BOOKED');
        error.code =
          'SLOT_ALREADY_BOOKED';
        throw error;
      }

      const finalPayload = {
        ...payload,
        blocked: true
      };

      localStorage.setItem(
        PREFIX + slotKey,
        JSON.stringify(finalPayload)
      );

      return finalPayload;

    }

  };

})();


// Firestore doc IDs não podem conter "/".
function encodeKey(key){
  return (key || '').replace(/\//g, '__');
}

function decodeKey(key){
  return (key || '').replace(/__/g, '/');
}