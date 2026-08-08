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

        return await firestore.runTransaction(async transaction => {

          const slotDoc = await transaction.get(slotRef);

          // Se o horário já existe, interrompe a transação.
          if(slotDoc.exists){
            const error = new Error('SLOT_ALREADY_BOOKED');
            error.code = 'SLOT_ALREADY_BOOKED';
            throw error;
          }

          // Busca o contador atual.
          const counterDoc = await transaction.get(counterRef);

          let ticketNum = 101;

          if(counterDoc.exists){

            const currentValue =
              parseInt(counterDoc.data().value, 10);

            if(!isNaN(currentValue)){
              ticketNum = currentValue + 1;
            }

          }

          // Coloca o ticket dentro do payload.
          const finalPayload = {
            ...payload,
            ticket: ticketNum
          };

          // Cria o horário.
          transaction.create(slotRef, {
            value: JSON.stringify(finalPayload)
          });

          // Atualiza o contador.
          transaction.set(counterRef, {
            value: String(ticketNum)
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
            k.slice(PREFIX.length)
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