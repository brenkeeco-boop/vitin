// ---------------- FIREBASE CONFIG ----------------
// Preencha aqui com os dados do SEU projeto Firebase (gratuito) para que os
// agendamentos sejam compartilhados de verdade entre todos os visitantes do site.
//
// Como pegar esses dados (5 minutos, sem precisar programar):
// 1. Acesse https://console.firebase.google.com e crie um projeto (gratuito).
// 2. No menu lateral, clique em "Compilação" → "Firestore Database" → "Criar banco de dados".
//    Escolha "Iniciar no modo de teste" (você pode ajustar as regras de segurança depois).
// 3. No menu lateral, clique no ícone de engrenagem → "Configurações do projeto".
// 4. Role até "Seus apps", clique no ícone "</>" (Web) e registre um app (não precisa marcar
//    Hosting). O Firebase vai te mostrar um objeto "firebaseConfig" — copie os valores dele
//    para dentro do objeto abaixo.
const FIREBASE_CONFIG = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI",
};

// ---------------- STORAGE ADAPTER ----------------
// 1) Dentro do claude.ai: usa window.storage (já é compartilhado nativamente).
// 2) Fora do claude.ai, com o Firebase configurado acima: usa o Firestore, que é
//    compartilhado de verdade entre todos os visitantes do site.
// 3) Fora do claude.ai, sem o Firebase configurado: cai para localStorage só para
//    não quebrar o site — mas nesse modo cada visitante tem sua própria agenda isolada.
const db = (function(){
  const hasNativeStorage = typeof window.storage === 'object'
    && window.storage !== null
    && typeof window.storage.get === 'function';

  if(hasNativeStorage){
    return window.storage;
  }

  const firebaseReady = typeof firebase !== 'undefined'
    && FIREBASE_CONFIG.apiKey
    && FIREBASE_CONFIG.apiKey !== 'COLE_AQUI';

  if(firebaseReady){
    firebase.initializeApp(FIREBASE_CONFIG);
    const firestore = firebase.firestore();
    const col = firestore.collection('agendamentos');

    return {
      async get(key){
        const doc = await col.doc(encodeKey(key)).get();
        if(!doc.exists) throw new Error('Chave não encontrada: ' + key);
        return { key, value: doc.data().value };
      },
      async set(key, value){
        await col.doc(encodeKey(key)).set({ value });
        return { key, value };
      },
      async delete(key){
        await col.doc(encodeKey(key)).delete();
        return { key, deleted: true };
      },
      async list(prefix){
        const encPrefix = encodeKey(prefix);
        const snap = await col
          .where(firebase.firestore.FieldPath.documentId(), '>=', encPrefix)
          .where(firebase.firestore.FieldPath.documentId(), '<', encPrefix + '\uf8ff')
          .get();
        const keys = snap.docs.map(d => decodeKey(d.id).slice(prefix.length));
        return { keys };
      }
    };
  }

  console.warn('Firebase não configurado — usando localStorage. Os agendamentos ficarão isolados por navegador/dispositivo, não compartilhados entre visitantes. Preencha FIREBASE_CONFIG no topo do arquivo para corrigir isso.');
  const PREFIX = 'barbearia_cn_';

  return {
    async get(key){
      const raw = localStorage.getItem(PREFIX + key);
      if(raw === null) throw new Error('Chave não encontrada: ' + key);
      return { key, value: raw, shared: true };
    },
    async set(key, value){
      localStorage.setItem(PREFIX + key, value);
      return { key, value, shared: true };
    },
    async delete(key){
      localStorage.removeItem(PREFIX + key);
      return { key, deleted: true, shared: true };
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
      return { keys, prefix, shared: true };
    }
  };
})();

// Firestore doc IDs não podem conter "/". Nossas chaves usam ":", que é seguro,
// mas escapamos "/" só por segurança caso apareça em algum dado futuro.
function encodeKey(key){ return (key || '').replace(/\//g, '__'); }
function decodeKey(key){ return (key || '').replace(/__/g, '/'); }
