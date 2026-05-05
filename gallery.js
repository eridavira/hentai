import { db, ref, onValue } from "./firebase.js";

const $ = (id) => document.getElementById(id);

const PAGE_SIZE = 30;
const DEFAULT_COVER_URL = "https://images2.imgbox.com/73/0d/9Z6A6C9Z_o.jpg";

let sortedPhotoEntries = [];
let currentPageIndex = 0;
let galleryWallActiveGifUrl = "";
let galleryWallBlobUrl = "";
let modalPhotoIndex = -1;
let modalImageLoadId = 0;
let modalDisplayBlobUrl = "";

function escHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPageIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("page") || "").trim();
}

function getFromFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("from") || "").trim().toLowerCase();
}

function goBackFromGallery() {
  const from = getFromFromUrl();
  if (from === "galleries") {
    location.href = "galleries.html";
    return;
  }

  const ref = String(document.referrer || "");
  if (ref.includes("galleries.html")) {
    history.back();
    return;
  }

  if (window.history.length > 1) {
    history.back();
    return;
  }

  location.href = "index.html";
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function isGifUrl(url = "") {
  const clean = String(url || "")
    .trim()
    .toLowerCase()
    .split("?")[0]
    .split("#")[0];
  return clean.endsWith(".gif");
}

function loadImageBlobWithProgress(url, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "blob";

    xhr.onprogress = (event) => {
      if (typeof onProgress !== "function") return;
      if (event.lengthComputable && event.total > 0) {
        const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
        onProgress(percent);
      } else {
        onProgress(null);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        resolve(xhr.response);
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new Error("Aborted"));
    xhr.send();
  });
}

function imgBoxThumbToOriginalUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  const swappedDomain = u.replace(/\/\/thumbs(\d+)\.imgbox\.com\//i, (_m, n) => `//images${n}.imgbox.com/`);
  return swappedDomain.replace(/_t(\.[a-z0-9]+)(\?.*)?$/i, (_m, ext, qs = "") => `_o${ext}${qs}`);
}

function imgBoxAnyToThumbUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  const swappedDomain = u.replace(/\/\/images(\d+)\.imgbox\.com\//i, (_m, n) => `//thumbs${n}.imgbox.com/`);
  return swappedDomain.replace(/_(o|b|m)(\.[a-z0-9]+)(\?.*)?$/i, (_m, _k, ext, qs = "") => `_t${ext}${qs}`);
}

function normalizeOriginalUrl({ originalUrl, thumbUrl, fallbackUrl }) {
  const original = String(originalUrl || "").trim();
  const thumb = String(thumbUrl || "").trim();
  const fallback = String(fallbackUrl || "").trim();

  const candidate = original || fallback;
  if (!candidate) return "";

  const looksLikeImgBoxThumb =
    /\/\/thumbs\d+\.imgbox\.com\//i.test(candidate) || /_t(\.[a-z0-9]+)(\?.*)?$/i.test(candidate);
  const looksLikeImgBoxThumb2 =
    /\/\/thumbs\d+\.imgbox\.com\//i.test(thumb) || /_t(\.[a-z0-9]+)(\?.*)?$/i.test(thumb);

  if (looksLikeImgBoxThumb) return imgBoxThumbToOriginalUrl(candidate);
  if (!original && looksLikeImgBoxThumb2) return imgBoxThumbToOriginalUrl(thumb);

  return candidate;
}

function normalizeDisplayUrl({ displayUrl, thumbUrl, fallbackUrl }) {
  const display = String(displayUrl || "").trim();
  const thumb = String(thumbUrl || "").trim();
  const fallback = String(fallbackUrl || "").trim();

  const candidate = display || thumb || fallback;
  if (!candidate) return "";

  const looksLikeImgBox =
    /\/\/(thumbs|images)\d+\.imgbox\.com\//i.test(candidate) || /imgbox\.com/i.test(candidate);

  if (!looksLikeImgBox) return candidate;

  if (/\/\/thumbs\d+\.imgbox\.com\//i.test(thumb) || /_t(\.[a-z0-9]+)(\?.*)?$/i.test(thumb)) return thumb;

  return imgBoxAnyToThumbUrl(candidate);
}

function applyGalleryWall(page = {}) {
  const card = $("gallery-wall-card");
  const coverEl = $("gallery-wall-cover");
  if (!card || !coverEl) return;

  const previewUrl = String(page.wall_cover_preview || page.wall_cover || "").trim();
  const originalUrl = String(page.wall_cover_original || page.wall_cover || "").trim();
  const wallDisplayUrl = originalUrl || previewUrl;
  const autoplayGifUrl = originalUrl || previewUrl;
  const pos = Number(page.wall_cover_pos);
  const normalizedPos = Number.isFinite(pos) ? Math.max(0, Math.min(100, pos)) : 50;

  card.classList.remove("hidden");
  coverEl.style.objectPosition = `50% ${normalizedPos}%`;
  coverEl.src = wallDisplayUrl || DEFAULT_COVER_URL;

  if (!isGifUrl(autoplayGifUrl)) {
    galleryWallActiveGifUrl = "";
    if (galleryWallBlobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(galleryWallBlobUrl);
    }
    galleryWallBlobUrl = "";
    return;
  }

  if (galleryWallActiveGifUrl === autoplayGifUrl && galleryWallBlobUrl.startsWith("blob:")) {
    coverEl.src = galleryWallBlobUrl;
    return;
  }

  galleryWallActiveGifUrl = autoplayGifUrl;
  loadImageBlobWithProgress(autoplayGifUrl)
    .then((blob) => {
      if (galleryWallActiveGifUrl !== autoplayGifUrl) return;
      if (galleryWallBlobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(galleryWallBlobUrl);
      }
      galleryWallBlobUrl = URL.createObjectURL(blob);
      coverEl.src = galleryWallBlobUrl;
    })
    .catch(() => {
      if (galleryWallActiveGifUrl !== autoplayGifUrl) return;
      coverEl.src = autoplayGifUrl || previewUrl || DEFAULT_COVER_URL;
    });
}

function entryToModalUrls(entry) {
  const [pid, p] = entry;
  const rawThumb = String(p?.thumbUrl || p?.mediumUrl || p?.url || "").trim();
  const display = normalizeDisplayUrl({
    displayUrl: p?.mediumUrl || p?.url,
    thumbUrl: rawThumb,
    fallbackUrl: p?.url,
  });
  const original = normalizeOriginalUrl({
    originalUrl: p?.originalUrl,
    thumbUrl: rawThumb,
    fallbackUrl: p?.url,
  });
  return { display, original, pid: String(pid || "").trim() };
}

function revokeModalDisplayBlob() {
  if (modalDisplayBlobUrl.startsWith("blob:")) {
    URL.revokeObjectURL(modalDisplayBlobUrl);
  }
  modalDisplayBlobUrl = "";
}

function setModalDownloadLink(originalUrl) {
  const dl = $("modal-download-original");
  if (!dl) return;

  const original = String(originalUrl || "").trim();
  if (original) {
    dl.href = original;
    dl.target = "_blank";
    dl.rel = "noopener noreferrer";
    dl.removeAttribute("download");
    dl.style.pointerEvents = "";
    dl.style.opacity = "";
    dl.title = "Buka foto original di tab baru";
  } else {
    dl.href = "#";
    dl.removeAttribute("download");
    dl.removeAttribute("target");
    dl.removeAttribute("rel");
    dl.style.pointerEvents = "none";
    dl.style.opacity = "0.55";
    dl.title = "Foto original tidak tersedia";
  }
}

function setModalLoadingUi(visible, message = "") {
  const el = $("modal-img-loading");
  const img = $("modal-img");
  if (el) {
    if (visible && message) {
      el.classList.remove("hidden");
      el.textContent = message;
    } else {
      el.classList.add("hidden");
      el.textContent = "";
    }
  }
  if (img) img.style.opacity = visible ? "0.42" : "1";
}

async function loadModalDisplayImage(displayUrl, originalUrl, pid) {
  const myId = ++modalImageLoadId;
  const img = $("modal-img");
  const display = String(displayUrl || "").trim();
  if (!img || !display) {
    setModalLoadingUi(false);
    return;
  }

  setModalDownloadLink(originalUrl);
  setModalLoadingUi(true, "Memuat 0%");

  const finishOk = () => {
    if (myId !== modalImageLoadId) return;
    setModalLoadingUi(false);
  };

  const applyBlob = (blob) => {
    if (myId !== modalImageLoadId) return;
    revokeModalDisplayBlob();
    modalDisplayBlobUrl = URL.createObjectURL(blob);
    img.src = modalDisplayBlobUrl;
    if (pid) img.alt = `Foto ${pid}`;
    finishOk();
  };

  try {
    const blob = await loadImageBlobWithProgress(display, (percent) => {
      if (myId !== modalImageLoadId) return;
      if (percent === null) setModalLoadingUi(true, "Memuat…");
      else setModalLoadingUi(true, `Memuat ${percent}%`);
    });
    if (myId !== modalImageLoadId) return;
    applyBlob(blob);
  } catch {
    if (myId !== modalImageLoadId) return;
    revokeModalDisplayBlob();
    setModalLoadingUi(true, "Memuat…");
    img.alt = pid ? `Foto ${pid}` : "Preview";

    const done = () => {
      img.onload = null;
      img.onerror = null;
      finishOk();
    };

    img.onload = done;
    img.onerror = done;
    img.src = display;

    const tryDecode = typeof img.decode === "function" ? img.decode() : null;
    if (tryDecode && typeof tryDecode.then === "function") {
      tryDecode.then(done).catch(done);
    } else if (img.complete) {
      done();
    }

    setTimeout(() => {
      if (myId !== modalImageLoadId) return;
      finishOk();
    }, 20000);
  }
}

function refreshModalNav() {
  const prev = $("modal-nav-prev");
  const next = $("modal-nav-next");
  const counter = $("modal-photo-counter");
  const n = sortedPhotoEntries.length;
  if (!prev || !next) return;

  if (modalPhotoIndex < 0 || n === 0) {
    if (counter) counter.textContent = "";
    prev.style.visibility = "hidden";
    next.style.visibility = "hidden";
    prev.disabled = true;
    next.disabled = true;
    return;
  }

  const sole = n <= 1;
  if (counter) counter.textContent = sole ? "" : `${modalPhotoIndex + 1} / ${n}`;

  if (sole) {
    prev.style.visibility = "hidden";
    next.style.visibility = "hidden";
    prev.disabled = true;
    next.disabled = true;
    return;
  }

  prev.style.visibility = "visible";
  next.style.visibility = "visible";
  prev.disabled = modalPhotoIndex <= 0;
  next.disabled = modalPhotoIndex >= n - 1;
  prev.style.opacity = prev.disabled ? "0.35" : "1";
  next.style.opacity = next.disabled ? "0.35" : "1";
}

function openModalAtIndex(index) {
  const modal = $("img-modal");
  if (!modal || index < 0 || index >= sortedPhotoEntries.length) return;

  modalPhotoIndex = index;
  const { display, original, pid } = entryToModalUrls(sortedPhotoEntries[index]);
  if (!display) return;

  refreshModalNav();
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  loadModalDisplayImage(display, original, pid);
}

function stepModal(delta) {
  const n = sortedPhotoEntries.length;
  if (n === 0 || modalPhotoIndex < 0) return;
  const next = modalPhotoIndex + delta;
  if (next < 0 || next >= n) return;
  openModalAtIndex(next);
}

function closeModal() {
  const modal = $("img-modal");
  if (!modal) return;
  modalImageLoadId++;
  revokeModalDisplayBlob();
  const img = $("modal-img");
  if (img) {
    img.removeAttribute("src");
    img.style.opacity = "1";
  }
  setModalLoadingUi(false);
  modalPhotoIndex = -1;
  refreshModalNav();
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function getTotalPages() {
  const n = sortedPhotoEntries.length;
  return n === 0 ? 1 : Math.ceil(n / PAGE_SIZE);
}

function clampPageIndex() {
  const total = getTotalPages();
  currentPageIndex = Math.max(0, Math.min(currentPageIndex, total - 1));
}

function updatePaginationUi() {
  const wrap = $("gallery-pagination");
  const prev = $("gallery-page-prev");
  const next = $("gallery-page-next");
  const info = $("gallery-page-info");
  if (!wrap || !prev || !next || !info) return;

  const total = sortedPhotoEntries.length;
  const totalPages = getTotalPages();

  if (total === 0) {
    wrap.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");
  const pageNum = currentPageIndex + 1;
  const start = currentPageIndex * PAGE_SIZE + 1;
  const end = Math.min(total, (currentPageIndex + 1) * PAGE_SIZE);
  info.textContent = `Halaman ${pageNum} / ${totalPages} · ${start}–${end} dari ${total}`;
  prev.disabled = currentPageIndex <= 0;
  next.disabled = currentPageIndex >= totalPages - 1;
  prev.style.opacity = prev.disabled ? "0.45" : "";
  next.style.opacity = next.disabled ? "0.45" : "";
}

function renderGridPage() {
  const grid = $("gallery-grid");
  const empty = $("gallery-empty");
  if (!grid || !empty) return;

  clampPageIndex();

  if (sortedPhotoEntries.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    $("gallery-count").innerText = "";
    updatePaginationUi();
    return;
  }

  empty.classList.add("hidden");
  $("gallery-count").innerText = `${sortedPhotoEntries.length} foto`;

  const slice = sortedPhotoEntries.slice(currentPageIndex * PAGE_SIZE, currentPageIndex * PAGE_SIZE + PAGE_SIZE);
  const sliceBase = currentPageIndex * PAGE_SIZE;

  grid.innerHTML = slice
    .map(([pid, p], i) => {
      const globalIndex = sliceBase + i;
      const rawThumb = String(p?.thumbUrl || p?.mediumUrl || p?.url || "").trim();
      const rawDisplay = normalizeDisplayUrl({
        displayUrl: p?.mediumUrl || p?.url,
        thumbUrl: rawThumb,
        fallbackUrl: p?.url,
      });
      const rawOriginal = normalizeOriginalUrl({
        originalUrl: p?.originalUrl,
        thumbUrl: rawThumb,
        fallbackUrl: p?.url,
      });

      const thumb = escHtml(rawThumb);
      const display = escHtml(rawDisplay);
      const original = escHtml(rawOriginal);
      const time = escHtml(formatTime(p?.time || 0));
      return `
        <button class="gallery-item" type="button" data-global-index="${globalIndex}" data-display="${display}" data-original="${original}" data-name="${escHtml(pid)}" title="${time}">
          <img src="${thumb}" loading="lazy" decoding="async" alt="Foto ${escHtml(pid)}">
        </button>
      `;
    })
    .join("");

  grid.querySelectorAll(".gallery-item[data-global-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-global-index"));
      if (!Number.isFinite(idx)) return;
      openModalAtIndex(idx);
    });
  });

  updatePaginationUi();
}

function bindPagination() {
  const prev = $("gallery-page-prev");
  const next = $("gallery-page-next");
  if (prev) {
    prev.onclick = () => {
      if (currentPageIndex <= 0) return;
      currentPageIndex--;
      renderGridPage();
    };
  }
  if (next) {
    next.onclick = () => {
      if (currentPageIndex >= getTotalPages() - 1) return;
      currentPageIndex++;
      renderGridPage();
    };
  }
}

function setGalleryNotFound() {
  document.title = "Gallery";
  $("gallery-name").innerText = "Gallery tidak ditemukan";
  $("gallery-sub").innerText = "Halaman tidak ada.";
  $("gallery-wall-card")?.classList.add("hidden");
  sortedPhotoEntries = [];
  currentPageIndex = 0;
  renderGridPage();
}

async function init() {
  $("btn-back-home").onclick = goBackFromGallery;

  const pageId = getPageIdFromUrl();
  if (!pageId) {
    $("gallery-name").innerText = "Gallery tidak ditemukan";
    $("gallery-sub").innerText = "Parameter halaman tidak ada.";
    $("gallery-empty").classList.remove("hidden");
    $("gallery-wall-card")?.classList.add("hidden");
    return;
  }

  bindPagination();

  onValue(ref(db, `site_galleries/pages/${pageId}`), (pageSnap) => {
    if (!pageSnap.exists()) {
      setGalleryNotFound();
      return;
    }

    const page = pageSnap.val() || {};
    const pageName = String(page?.name || "").trim() || "Gallery";

    document.title = `Gallery - ${pageName}`;
    $("gallery-title").innerText = `/ ${pageName}`;
    $("gallery-name").innerText = pageName;
    $("gallery-sub").innerText = `ID: ${pageId}`;

    applyGalleryWall(page);
  });

  onValue(ref(db, `site_galleries/photos/${pageId}`), (snap) => {
    const photosObj = snap.exists() ? snap.val() : {};
    sortedPhotoEntries = Object.entries(photosObj || {}).sort((a, b) => (b[1]?.time || 0) - (a[1]?.time || 0));

    const totalPages = getTotalPages();
    if (currentPageIndex > totalPages - 1) {
      currentPageIndex = Math.max(0, totalPages - 1);
    }

    if (modalPhotoIndex >= sortedPhotoEntries.length) {
      closeModal();
    } else if (modalPhotoIndex >= 0 && !$("img-modal")?.classList.contains("hidden")) {
      openModalAtIndex(modalPhotoIndex);
    }

    renderGridPage();
  });

  const modal = $("img-modal");
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }
  const closeBtn = $("modal-close");
  if (closeBtn) closeBtn.onclick = closeModal;

  const navPrev = $("modal-nav-prev");
  const navNext = $("modal-nav-next");
  if (navPrev) {
    navPrev.onclick = (e) => {
      e.stopPropagation();
      stepModal(-1);
    };
  }
  if (navNext) {
    navNext.onclick = (e) => {
      e.stopPropagation();
      stepModal(1);
    };
  }

  document.addEventListener("keydown", (e) => {
    const m = $("img-modal");
    const open = m && !m.classList.contains("hidden");
    if (e.key === "Escape" && open) {
      closeModal();
      return;
    }
    if (!open || modalPhotoIndex < 0) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepModal(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      stepModal(1);
    }
  });
}

init();
