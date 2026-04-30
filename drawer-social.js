import {
  db,
  ref,
  set,
  get,
  onValue,
  push,
  query,
  limitToLast
} from "./firebase.js";

const $ = (id) => document.getElementById(id);

const PAGE_SIZE = 10;
const PINNED_DIRECTORY_USER = "utsukushii";

function openDrawer() {
  const drawer = $("mobile-drawer");
  const backdrop = $("mobile-drawer-backdrop");
  if (!drawer || !backdrop) return;
  drawer.classList.add("open");
  backdrop.classList.remove("hidden");
  document.body.classList.add("drawer-open");
}

function closeDrawer() {
  const drawer = $("mobile-drawer");
  const backdrop = $("mobile-drawer-backdrop");
  if (!drawer || !backdrop) return;
  drawer.classList.remove("open");
  backdrop.classList.add("hidden");
  document.body.classList.remove("drawer-open");
}

function setActiveDrawerPanel(panel) {
  const dirPanel = $("drawer-directory-panel");
  const chatPanel = $("drawer-globalchat-panel");
  const btnDir = $("btn-open-directory");
  const btnChat = $("btn-open-globalchat");

  if (dirPanel) dirPanel.classList.toggle("hidden", panel !== "directory");
  if (chatPanel) chatPanel.classList.toggle("hidden", panel !== "globalChat");

  if (btnDir) btnDir.classList.toggle("active", panel === "directory");
  if (btnChat) btnChat.classList.toggle("active", panel === "globalChat");
}

function normalizeUsername(text = "") {
  return String(text).replace(/^@+/, "").trim().toLowerCase();
}

function buildUserRow(item) {
  const d = document.createElement("div");
  d.className = "drawer-user-item";
  d.innerHTML = `
    <img src="${item.avatar}" alt="Avatar" class="drawer-user-avatar">
    <span class="drawer-user-name">@${item.username}</span>
  `;
  d.onclick = () => (location.href = `index.html?u=${item.username}`);

  const uname = normalizeUsername(item.username);
  if (uname === PINNED_DIRECTORY_USER) {
    const span = d.querySelector(".drawer-user-name");
    if (span) span.classList.add("special-nickname", "search-special-nickname");
  }
  return d;
}

function initDirectoryLazyList() {
  const searchInput = $("side-search-input");
  const list = $("user-directory-list");
  const sentinel = $("side-load-more");
  if (!searchInput || !list || !sentinel) return;

  let allUsersDirectory = [];
  let filtered = [];
  let rendered = 0;
  let observer = null;
  let isPaging = false;

  const computeFiltered = (keyword) => {
    const q = String(keyword || "").trim().toLowerCase();
    const result = allUsersDirectory
      .filter((item) => String(item.username || "").toLowerCase().includes(q))
      .sort((a, b) => {
        const aName = String(a.username || "").toLowerCase();
        const bName = String(b.username || "").toLowerCase();
        const aPinned = aName === PINNED_DIRECTORY_USER ? 0 : 1;
        const bPinned = bName === PINNED_DIRECTORY_USER ? 0 : 1;
        if (aPinned !== bPinned) return aPinned - bPinned;
        return aName.localeCompare(bName);
      });
    return result;
  };

  const renderNextPage = () => {
    if (rendered >= filtered.length) {
      sentinel.classList.add("hidden");
      return;
    }
    sentinel.classList.remove("hidden");
    sentinel.textContent = "Memuat...";

    const slice = filtered.slice(rendered, rendered + PAGE_SIZE);
    slice.forEach((item) => list.appendChild(buildUserRow(item)));
    rendered += slice.length;

    if (rendered >= filtered.length) {
      sentinel.textContent = "Sudah habis.";
      // tetap visible sebentar agar tidak “kedip”, tapi non-interaktif
      setTimeout(() => sentinel.classList.add("hidden"), 450);
      return;
    }
    sentinel.textContent = "Scroll untuk muat lagi...";
  };

  const resetAndRender = () => {
    list.innerHTML = "";
    rendered = 0;
    filtered = computeFiltered(searchInput.value);
    renderNextPage();
  };

  searchInput.oninput = () => resetAndRender();

  if ("IntersectionObserver" in window) {
    const drawerEl = $("mobile-drawer");
    const overflowY = drawerEl ? getComputedStyle(drawerEl).overflowY : "";
    const isScrollableRoot = drawerEl && (overflowY === "auto" || overflowY === "scroll");
    const rootEl = isScrollableRoot ? drawerEl : null;

    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        if (isPaging) return;
        isPaging = true;
        renderNextPage();
        // Hindari loop "langsung muat semua" saat sentinel tetap terlihat
        observer.unobserve(sentinel);
        setTimeout(() => {
          isPaging = false;
          observer.observe(sentinel);
        }, 120);
      },
      {
        root: rootEl,
        rootMargin: "250px 0px",
        threshold: 0.01
      }
    );
    observer.observe(sentinel);
  } else {
    // fallback: klik untuk muat lagi
    sentinel.onclick = () => renderNextPage();
  }

  onValue(ref(db, "users"), async (s) => {
    allUsersDirectory = [];
    if (!s.exists()) {
      resetAndRender();
      return;
    }

    const usernames = Object.keys(s.val() || {});
    const usersWithProfile = await Promise.all(
      usernames.map(async (username) => {
        try {
          const pSnap = await get(ref(db, `users/${username}/profile`));
          const profile = pSnap.val() || {};
          return {
            username,
            avatar: profile.avatar || `https://ui-avatars.com/api/?name=${username}`
          };
        } catch {
          return {
            username,
            avatar: `https://ui-avatars.com/api/?name=${username}`
          };
        }
      })
    );

    allUsersDirectory = usersWithProfile;
    resetAndRender();
  });
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function escHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initGlobalChat() {
  const listEl = $("global-chat-list");
  const inputEl = $("global-chat-input");
  const sendBtn = $("global-chat-send");
  if (!listEl || !inputEl || !sendBtn) return;

  const myUser = localStorage.getItem("active_user");
  if (!myUser) return;

  const chatRef = query(ref(db, "global_chat/messages"), limitToLast(60));

  onValue(chatRef, (snap) => {
    const data = snap.exists() ? snap.val() : {};
    const entries = Object.entries(data || {});
    entries.sort((a, b) => (a[1]?.time || 0) - (b[1]?.time || 0));

    if (entries.length === 0) {
      listEl.innerHTML = `<div class="chat-empty">Belum ada chat. Jadi yang pertama.</div>`;
      return;
    }

    listEl.innerHTML = entries
      .map(([id, m]) => {
        const author = escHtml(m?.author || "unknown");
        const text = escHtml(m?.text || "");
        const time = escHtml(formatTime(m?.time || 0));
        const isMe = String(m?.author || "").toLowerCase() === String(myUser || "").toLowerCase();
        return `
          <div class="chat-msg ${isMe ? "is-me" : ""}" data-id="${escHtml(id)}">
            <div class="chat-meta">
              <b class="chat-author">@${author}</b>
              <small class="chat-time">${time}</small>
            </div>
            <div class="chat-text">${text}</div>
          </div>
        `;
      })
      .join("");

    // auto-scroll ke bawah
    listEl.scrollTop = listEl.scrollHeight;
  });

  const send = async () => {
    const text = String(inputEl.value || "").trim().slice(0, 500);
    if (!text) return;
    inputEl.value = "";
    inputEl.focus();
    sendBtn.disabled = true;
    try {
      const msgRef = push(ref(db, "global_chat/messages"));
      await set(msgRef, {
        author: myUser,
        text,
        time: Date.now()
      });
    } finally {
      sendBtn.disabled = false;
    }
  };

  sendBtn.onclick = send;
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
}

function initDrawerToggles() {
  const btnDir = $("btn-open-directory");
  const btnChat = $("btn-open-globalchat");
  const backdrop = $("mobile-drawer-backdrop");

  if (btnDir) {
    btnDir.onclick = () => {
      openDrawer();
      setActiveDrawerPanel("directory");
    };
  }

  if (btnChat) {
    btnChat.onclick = () => {
      openDrawer();
      setActiveDrawerPanel("globalChat");
    };
  }

  if (backdrop) {
    backdrop.onclick = () => {
      closeDrawer();
      setActiveDrawerPanel(null);
    };
  }

  // Default: saat user login, panel global chat yang diutamakan
  setActiveDrawerPanel("globalChat");
}

function bootstrap() {
  // hanya aktif saat sudah login (app-content tampil)
  const myUser = localStorage.getItem("active_user");
  if (!myUser) return;

  initDrawerToggles();
  initDirectoryLazyList();
  initGlobalChat();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}

