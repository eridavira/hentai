import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  push,
  update,
  remove,
  query,
  limitToLast
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  databaseURL:
    "https://hentai-86b5f-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(app);

export {
  db,
  ref,
  set,
  get,
  onValue,
  push,
  update,
  remove,
  query,
  limitToLast
};

