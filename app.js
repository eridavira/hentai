import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- CONFIGURATION ---
const firebaseConfig = { databaseURL: "https://hentai-86b5f-default-rtdb.asia-southeast1.firebasedatabase.app/" };
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);
const IMGBB_API_KEY = "c0e6f15eb26082b61ce8c39cf8b3ccdd";

// --- STATE MANAGEMENT ---
let isDragging = false, startY = 0, currentPos = 50;
let currentFeedPath = '', isLoading = false, displayedCount = 0, allPostKeys = [];
let isEditingBio = false;
let allUsersDirectory = [];
let currentSortType = 'newest';
let currentFeedData = {};
let pendingUploadImage = null;
const POSTS_PER_BATCH = 5;
let hasTriggeredNearBottom = false;
const DEFAULT_COVER_URL = "https://images2.imgbox.com/73/0d/9Z6A6C9Z_o.jpg";

document.addEventListener('DOMContentLoaded', () => {
    const myUser = localStorage.getItem("active_user");
    const urlParams = new URLSearchParams(window.location.search);
    const targetUser = urlParams.get('u');
    initMobileDrawer();
    
    if (!myUser) {
        showAuth();
    } else {
        showApp(myUser, targetUser);
        initInfiniteScroll();
        initViewToggle();
        initSortingControl(myUser);
    }
});

function initMobileDrawer() {
    const menuBtn = $('btn-mobile-menu');
    const drawer = $('mobile-drawer');
    const backdrop = $('mobile-drawer-backdrop');
    if (!menuBtn || !drawer || !backdrop) return;

    const closeDrawer = () => {
        drawer.classList.remove('open');
        backdrop.classList.add('hidden');
        document.body.classList.remove('drawer-open');
    };

    menuBtn.onclick = () => {
        const isOpen = drawer.classList.contains('open');
        if (isOpen) {
            closeDrawer();
            return;
        }
        drawer.classList.add('open');
        backdrop.classList.remove('hidden');
        document.body.classList.add('drawer-open');
    };

    backdrop.onclick = closeDrawer;
    window.addEventListener('resize', () => {
        if (window.innerWidth > 850) closeDrawer();
    });
}

// --- AUTHENTICATION ---
function showAuth() {
    $('auth-overlay').classList.remove('hidden');
    $('btn-auth-submit').onclick = async () => {
        const u = $('auth-user').value.trim().toLowerCase();
        const p = $('auth-pass').value.trim();
        if (!u || !p) return alert("Lengkapi data!");
        const snap = await get(ref(db, `users_auth/${u}`));
        if (snap.exists() && snap.val().pass === p) {
            localStorage.setItem("active_user", u);
            location.reload();
        } else alert("Gagal login!");
    };
    $('toggle-auth').onclick = () => location.href = 'register.html';
}

// --- UI: GRID/LIST TOGGLE ---
function initViewToggle() {
    const btnList = $('btn-view-list');
    const btnGrid = $('btn-view-grid');
    const mainList = $('main-list');
    if (!btnList || !btnGrid) return;

    btnList.onclick = () => {
        mainList.classList.remove('grid-mode');
        btnList.classList.add('active');
        btnGrid.classList.remove('active');
    };
    btnGrid.onclick = () => {
        mainList.classList.add('grid-mode');
        btnGrid.classList.add('active');
        btnList.classList.remove('active');
    };
}

// --- CORE APP ---
function showApp(myUser, targetUser) {
    $('app-content').classList.remove('hidden');
    $('nav-name').innerText = `@${myUser}`;
    $('nav-name').onclick = () => location.href = `index.html?u=${myUser}`;
    initUserDirectory();

    if (targetUser) {
        $('home-wall-card').classList.add('hidden');
        $('feed-toolbar').classList.remove('hidden');
        handleProfile(targetUser, myUser);
    } else {
        initHomeWall();
        $('feed-toolbar').classList.remove('hidden');
        $('profile-view').classList.add('hidden');
        $('editor-box').classList.remove('hidden');
        loadFeed('global_posts', myUser);
    }
}

function initHomeWall() {
    const card = $('home-wall-card');
    const coverEl = $('home-cover');
    if (!card || !coverEl) return;

    card.classList.remove('hidden');
    coverEl.style.cursor = 'default';
    coverEl.onclick = null;

    onValue(ref(db, 'site_config'), (snap) => {
        const cfg = snap.val() || {};
        const url = String(cfg.home_cover || '').trim();
        const pos = Number(cfg.home_cover_pos);
        const normalizedPos = Number.isFinite(pos) ? Math.max(0, Math.min(100, pos)) : 50;
        coverEl.src = url || DEFAULT_COVER_URL;
        coverEl.style.objectPosition = `50% ${normalizedPos}%`;
    });
}

function initSortingControl(myUser) {
    const sortSelect = $('sort-posts');
    if (!sortSelect) return;
    sortSelect.onchange = () => {
        currentSortType = sortSelect.value;
        applyFeedSorting();
        displayedCount = 0;
        hasTriggeredNearBottom = false;
        $('main-list').innerHTML = '';
        renderMorePosts(myUser);
    };
}

function getLikesCount(post = {}) {
    return post.likes ? Object.keys(post.likes).length : 0;
}

function applyFeedSorting() {
    const entries = Object.entries(currentFeedData);
    entries.sort((a, b) => {
        const postA = a[1] || {};
        const postB = b[1] || {};
        const timeA = postA.time || 0;
        const timeB = postB.time || 0;

        if (currentSortType === 'most_liked') {
            const likesA = getLikesCount(postA);
            const likesB = getLikesCount(postB);
            if (likesA !== likesB) return likesB - likesA;
        }

        return timeB - timeA;
    });
    allPostKeys = entries.map(([key]) => key);
}

// --- PROFILE & EDITING (FIXED) ---
async function handleProfile(user, myUser) {
    $('profile-view').classList.remove('hidden');
    $('editor-box').classList.add('hidden');
    const isOwner = (user === myUser);
    const bioEl = $('view-bio');
    const editBioBtn = $('btn-edit-bio');
    const saveBioBtn = $('btn-save-bio');

    if (isOwner) {
        // Klik Avatar untuk ganti foto profil
        $('view-avatar').style.cursor = 'pointer';
        $('view-avatar').onclick = () => triggerUpload('avatar', user);
        
        // Klik Cover untuk ganti foto dinding
        $('view-cover').style.cursor = 'pointer';
        $('view-cover').onclick = (e) => {
            if (confirm("Ingin mengganti foto dinding?")) {
                triggerUpload('cover', user);
            }
        };
        
        // Geser Cover (Drag)
        $('view-cover').onmousedown = startDrag;

        // Edit Bio
        editBioBtn.classList.remove('hidden');
        saveBioBtn.classList.add('hidden');
        bioEl.contentEditable = "false";

        editBioBtn.onclick = () => {
            isEditingBio = true;
            bioEl.contentEditable = "true";
            bioEl.focus();
            editBioBtn.classList.add('hidden');
            saveBioBtn.classList.remove('hidden');
        };

        saveBioBtn.onclick = async () => {
            const newBio = bioEl.innerText.trim().slice(0, 200);
            await update(ref(db, `users/${user}/profile`), { bio: newBio });
            isEditingBio = false;
            bioEl.contentEditable = "false";
            editBioBtn.classList.remove('hidden');
            saveBioBtn.classList.add('hidden');
        };
    } else {
        isEditingBio = false;
        bioEl.contentEditable = "false";
        editBioBtn.classList.add('hidden');
        saveBioBtn.classList.add('hidden');
        $('view-cover').onmousedown = null;
    }

    onValue(ref(db, `users/${user}/profile`), (s) => {
        const d = s.val() || {};
        $('view-name').innerText = d.name || user;
        if (!isEditingBio) {
            bioEl.innerText = d.bio || "Halo! Saya menggunakan Utsukushii.";
        }
        $('view-avatar').src = d.avatar || `https://ui-avatars.com/api/?name=${user}`;
        $('view-cover').src = d.cover || DEFAULT_COVER_URL;
        if (d.coverPos) $('view-cover').style.objectPosition = `50% ${d.coverPos}%`;
    });
    
    loadFeed(`users/${user}/posts`, myUser);
}

function ensureUploadProgressBadge() {
    let badge = $('upload-progress-badge');
    if (badge) return badge;
    badge = document.createElement('div');
    badge.id = 'upload-progress-badge';
    badge.style.position = 'fixed';
    badge.style.right = '16px';
    badge.style.bottom = '16px';
    badge.style.zIndex = '2000';
    badge.style.background = 'rgba(22, 27, 34, 0.95)';
    badge.style.border = '1px solid var(--brd)';
    badge.style.color = 'var(--text)';
    badge.style.padding = '10px 12px';
    badge.style.borderRadius = '8px';
    badge.style.fontSize = '0.8rem';
    badge.style.display = 'none';
    document.body.appendChild(badge);
    return badge;
}

function setUploadProgressBadge(text) {
    const badge = ensureUploadProgressBadge();
    badge.innerText = text;
    badge.style.display = 'block';
}

function hideUploadProgressBadge() {
    const badge = $('upload-progress-badge');
    if (!badge) return;
    badge.style.display = 'none';
}

async function triggerUpload(type, user) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadProgressBadge("Mengunggah gambar: 0%");
        const r = await uploadToImgBB(file, (percent) => {
            setUploadProgressBadge(`Mengunggah gambar: ${percent}%`);
        });
        hideUploadProgressBadge();
        if (r) {
            await update(ref(db, `users/${user}/profile`), { [type]: r.url });
            alert("Berhasil diperbarui!");
        } else {
            alert("Gagal mengunggah gambar.");
        }
    };
    i.click();
}

// --- POP-UP DETAIL (FIXED SOURCE) ---
function escHtml(s = '') {
    return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatTime(ts) {
    try { return new Date(ts).toLocaleString(); } catch { return ''; }
}

function computeCommentsCount(post = {}) {
    return post.comments ? Object.keys(post.comments).length : 0;
}

function getThumbUrl(post = {}) {
    return String(
        post.mediumUrl ||
        post.displayUrl ||
        post.thumbUrl ||
        post.thumbnailUrl ||
        post.url ||
        ''
    ).trim();
}

function getOriginalUrl(post = {}) {
    return String(post.originalUrl || post.fullUrl || post.url || '').trim();
}

const avatarCache = new Map();
async function getAvatarUrl(username) {
    const u = String(username || '').trim().toLowerCase();
    if (!u) return `https://ui-avatars.com/api/?name=unknown`;
    if (avatarCache.has(u)) return avatarCache.get(u);

    try {
        const pSnap = await get(ref(db, `users/${u}/profile`));
        const profile = pSnap.val() || {};
        const avatar = profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u)}`;
        avatarCache.set(u, avatar);
        return avatar;
    } catch {
        const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(u)}`;
        avatarCache.set(u, fallback);
        return fallback;
    }
}

async function addComment(postId, author, text) {
    const myUser = localStorage.getItem("active_user");
    const body = String(text || '').trim().slice(0, 500);
    if (!myUser) return alert("Silakan login dulu.");
    if (!body) return;

    const commentRef = push(ref(db, `global_posts/${postId}/comments`));
    const payload = { author: myUser, text: body, time: Date.now() };
    await set(commentRef, payload);

    // Mirror ke path postingan user agar konsisten dengan like
    await set(ref(db, `users/${author}/posts/${postId}/comments/${commentRef.key}`), payload);
}

function renderCommentsList(containerEl, commentsObj = {}) {
    const entries = Object.entries(commentsObj || {});
    entries.sort((a, b) => (a[1]?.time || 0) - (b[1]?.time || 0));

    if (entries.length === 0) {
        containerEl.innerHTML = `<div class="comment-empty">Belum ada komentar. Jadi yang pertama.</div>`;
        return;
    }

    containerEl.innerHTML = entries.map(([cid, c]) => {
        const authorRaw = String(c?.author || 'unknown').trim().toLowerCase();
        const author = escHtml(authorRaw || 'unknown');
        const text = escHtml(c?.text || '');
        const time = escHtml(formatTime(c?.time || 0));
        const profileHref = `index.html?u=${encodeURIComponent(authorRaw || 'unknown')}`;
        return `
            <div class="comment-item" data-cid="${escHtml(cid)}">
                <div class="comment-row">
                    <a class="comment-user-link" href="${profileHref}" onclick="event.stopPropagation()">
                        <img class="comment-avatar" data-user="${author}" alt="Avatar">
                    </a>
                    <div class="comment-main">
                        <div class="comment-meta">
                            <a class="comment-user-link" href="${profileHref}" onclick="event.stopPropagation()"><b>@${author}</b></a>
                            <small>${time}</small>
                        </div>
                        <div class="comment-text">${text}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Load avatars async (cached), then set src
    const avatarEls = containerEl.querySelectorAll('.comment-avatar[data-user]');
    const uniqueUsers = new Set(Array.from(avatarEls).map(el => el.getAttribute('data-user') || ''));
    uniqueUsers.forEach(async (u) => {
        const url = await getAvatarUrl(u);
        containerEl
            .querySelectorAll(`.comment-avatar[data-user="${CSS.escape(u)}"]`)
            .forEach((img) => { img.src = url; });
    });

    containerEl.scrollTop = containerEl.scrollHeight;
}

window.openPost = (postId, focusComment = false) => {
    const myUser = localStorage.getItem("active_user");
    const modal = $('img-modal');
    const modalBody = modal.querySelector('.modal-content');

    get(ref(db, `global_posts/${postId}`)).then(async (snap) => {
        if (!snap.exists()) return;
        const post = snap.val() || {};

        const uSnap = await get(ref(db, `users/${post.author}/profile`));
        const authorProfile = uSnap.val() || {};
        const avatar = authorProfile.avatar || `https://ui-avatars.com/api/?name=${post.author}`;

        modalBody.innerHTML = `
            <div class="post-detail-container" onclick="event.stopPropagation()">
                <div class="detail-img-side">
                    <img id="detail-img" src="${escHtml(getThumbUrl(post))}" alt="Post Content">
                </div>
                <div class="detail-info-side">
                    <div class="detail-header">
                        <img src="${escHtml(avatar)}" class="detail-avatar" alt="Avatar">
                        <div class="detail-user-info">
                            <b>@${escHtml(post.author || '')}</b>
                            <small>ID: ${escHtml(postId)}</small>
                        </div>
                        <span id="detail-close-btn" class="close-detail" role="button" aria-label="Tutup popup" tabindex="0">✕</span>
                    </div>

                    <div class="detail-body">
                        <p id="detail-caption" class="detail-caption">${escHtml(post.caption || '')}</p>
                        <small id="detail-time" class="detail-time">${escHtml(formatTime(post.time || 0))}</small>
                    </div>

                    <div class="detail-comments">
                        <div class="detail-comments-header">
                            <b>Komentar</b>
                            <span id="detail-comment-count" class="detail-comments-count"></span>
                        </div>
                        <div id="detail-comments-list" class="detail-comments-list"></div>
                        <div class="detail-comment-form">
                            <textarea id="detail-comment-input" rows="2" placeholder="Tulis komentar..."></textarea>
                            <button id="detail-comment-send" class="btn detail-comment-send">Kirim</button>
                        </div>
                    </div>

                    <div class="detail-footer">
                        <button id="modal-like-btn" class="like-action">${(post.likes && myUser && post.likes[myUser]) ? '❤️' : '🤍'}</button>
                        <span id="detail-like-count"><b>${getLikesCount(post)}</b> Suka</span>
                    </div>
                </div>
            </div>
        `;

        const input = $('detail-comment-input');
        const sendBtn = $('detail-comment-send');
        const closeBtn = $('detail-close-btn');
        const closeModal = () => modal.classList.add('hidden');

        if (closeBtn) {
            closeBtn.onclick = closeModal;
            closeBtn.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    closeModal();
                }
            };
        }

        sendBtn.onclick = async () => {
            sendBtn.disabled = true;
            try {
                await addComment(postId, post.author, input.value);
                input.value = '';
                input.focus();
            } finally {
                sendBtn.disabled = false;
            }
        };
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendBtn.click();
            }
        });

        $('modal-like-btn').onclick = () => window.toggleLike(postId, post.author);

        // Listener post (like/count + caption/time ringan)
        onValue(ref(db, `global_posts/${postId}`), (liveSnap) => {
            if (!liveSnap.exists()) return;
            const live = liveSnap.val() || {};
            const likesCount = getLikesCount(live);
            const isLiked = live.likes && myUser && live.likes[myUser];

            const likeBtn = $('modal-like-btn');
            const likeCountEl = $('detail-like-count');
            const capEl = $('detail-caption');
            const timeEl = $('detail-time');
            const imgEl = $('detail-img');
            const commentCountEl = $('detail-comment-count');

            if (likeBtn) likeBtn.innerText = isLiked ? '❤️' : '🤍';
            if (likeCountEl) likeCountEl.innerHTML = `<b>${likesCount}</b> Suka`;
            if (capEl) capEl.innerText = live.caption || '';
            if (timeEl) timeEl.innerText = formatTime(live.time || 0);
            const thumb = getThumbUrl(live);
            if (imgEl && thumb) imgEl.src = thumb;
            if (commentCountEl) commentCountEl.innerText = `(${computeCommentsCount(live)})`;
        });

        // Listener komentar
        onValue(ref(db, `global_posts/${postId}/comments`), (cSnap) => {
            const listEl = $('detail-comments-list');
            if (!listEl) return;
            renderCommentsList(listEl, cSnap.exists() ? cSnap.val() : {});
        });

        modal.classList.remove('hidden');
        if (focusComment && input) setTimeout(() => input.focus(), 0);
    });
};

window.openImg = (postId) => window.openPost(postId, false);

// --- FEED & REAL-TIME LIKE ---
async function loadFeed(path, myUser) {
    currentFeedPath = path;
    const snap = await get(ref(db, path));
    currentFeedData = snap.exists() ? snap.val() : {};
    applyFeedSorting();
    displayedCount = 0;
    hasTriggeredNearBottom = false;
    $('main-list').innerHTML = '';
    renderMorePosts(myUser);
}

function renderMorePosts(myUser) {
    if (isLoading || displayedCount >= allPostKeys.length) return;
    isLoading = true;
    const nextBatch = allPostKeys.slice(displayedCount, displayedCount + POSTS_PER_BATCH);
    if (nextBatch.length === 0) {
        isLoading = false;
        return;
    }

    nextBatch.forEach(key => {
        const postPath = currentFeedPath === 'global_posts' ? `global_posts/${key}` : `${currentFeedPath}/${key}`;
        
        onValue(ref(db, postPath), async (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                let existingCard = $(`post-${key}`);
                if (!existingCard) {
                    const uSnap = await get(ref(db, `users/${data.author}/profile`));
                    const avatar = uSnap.val()?.avatar || `https://ui-avatars.com/api/?name=${data.author}`;
                    $('main-list').appendChild(createCard(key, data, myUser, avatar));
                } else {
                    const likes = data.likes ? Object.keys(data.likes).length : 0;
                    const isLiked = data.likes && data.likes[myUser];
                    $(`like-btn-${key}`).innerText = isLiked ? '❤️' : '🤍';
                    $(`like-count-${key}`).innerText = `${likes} Suka`;
                    const commentCountEl = $(`comment-count-${key}`);
                    if (commentCountEl) commentCountEl.innerText = `${computeCommentsCount(data)} Komentar`;
                }
            }
        });
    });
    displayedCount += nextBatch.length;
    isLoading = false;
}

function createCard(id, data, myUser, avatar) {
    const div = document.createElement('div');
    div.className = 'card'; div.id = `post-${id}`;
    const likes = data.likes ? Object.keys(data.likes).length : 0;
    const isLiked = data.likes && data.likes[myUser];
    const commentsCount = computeCommentsCount(data);

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="location.href='index.html?u=${data.author}'">
                <img src="${avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                <b>@${data.author}</b>
            </div>
            ${data.author === myUser ? `
                <button onclick="window.deletePost('${id}')" class="btn-delete-modern" aria-label="Hapus postingan" title="Hapus postingan">
                    <span class="trash-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M4 7H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                            <path d="M9 7V5.5C9 4.67 9.67 4 10.5 4H13.5C14.33 4 15 4.67 15 5.5V7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                            <path d="M7.5 9.5L8.2 18.2C8.28 19.19 9.11 19.95 10.1 19.95H13.9C14.89 19.95 15.72 19.19 15.8 18.2L16.5 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                            <path d="M10 11.2V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                            <path d="M14 11.2V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        </svg>
                    </span>
                    <span>Hapus</span>
                </button>
            ` : ''}
        </div>
        <img src="${getThumbUrl(data)}" class="post-img" onclick="window.openImg('${id}')" style="cursor:pointer; width:100%; border-radius:4px;">
        <div style="margin-top:10px;">
            <p>${data.caption || ''}</p>
            <div class="post-actions" style="display:flex; align-items:center; gap:12px;">
                <button id="like-btn-${id}" onclick="window.toggleLike('${id}', '${data.author}')" style="background:none; border:none; cursor:pointer; font-size:1.2rem;">
                    ${isLiked ? '❤️' : '🤍'}
                </button>
                <span id="like-count-${id}" style="font-size:0.8rem; font-weight:bold;">${likes} Suka</span>
                <button id="comment-btn-${id}" onclick="window.openPost('${id}', true)" style="background:none; border:none; cursor:pointer; font-size:1.05rem;">
                    💬
                </button>
                <span id="comment-count-${id}" style="font-size:0.8rem; font-weight:bold;">${commentsCount} Komentar</span>
                <button onclick="window.openOriginal('${id}')" style="background:none; border:1px solid var(--brd); color:var(--p); border-radius:999px; padding:4px 10px; cursor:pointer; font-size:0.72rem; font-weight:700;">
                    Original
                </button>
            </div>
        </div>
    `;
    return div;
}

window.openOriginal = async (postId) => {
    const snap = await get(ref(db, `global_posts/${postId}`));
    if (!snap.exists()) return;
    const post = snap.val() || {};
    const url = getOriginalUrl(post);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
};

window.toggleLike = async (id, author) => {
    const myUser = localStorage.getItem("active_user");
    const gRef = ref(db, `global_posts/${id}/likes/${myUser}`);
    const uRef = ref(db, `users/${author}/posts/${id}/likes/${myUser}`);
    const snap = await get(gRef);
    if (snap.exists()) { await remove(gRef); await remove(uRef); }
    else { await set(gRef, true); await set(uRef, true); }
};

window.deletePost = async (id) => {
    const myUser = localStorage.getItem("active_user");
    if (!myUser) return;
    if (!confirm("Yakin ingin menghapus postingan ini?")) return;
    await remove(ref(db, `global_posts/${id}`));
    await remove(ref(db, `users/${myUser}/posts/${id}`));
};

// --- SIDEBAR ---
function initUserDirectory() {
    const searchInput = $('side-search-input');

    const renderDirectory = (keyword = '') => {
        const list = $('user-directory-list');
        const q = keyword.trim().toLowerCase();
        list.innerHTML = '';

        const filteredUsers = allUsersDirectory.filter((item) => item.username.includes(q));

        filteredUsers.forEach((item) => {
            const d = document.createElement('div');
            d.style = "display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer;";
            d.innerHTML = `<img src="${item.avatar}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"><span>@${item.username}</span>`;
            d.onclick = () => location.href = `index.html?u=${item.username}`;
            list.appendChild(d);
        });
    };

    searchInput.oninput = (e) => renderDirectory(e.target.value);

    onValue(ref(db, 'users'), async (s) => {
        allUsersDirectory = [];
        if (!s.exists()) {
            renderDirectory(searchInput.value);
            return;
        }

        const usernames = Object.keys(s.val());
        const usersWithProfile = await Promise.all(
            usernames.map(async (username) => {
                const pSnap = await get(ref(db, `users/${username}/profile`));
                const profile = pSnap.val() || {};
                return {
                    username,
                    avatar: profile.avatar || `https://ui-avatars.com/api/?name=${username}`
                };
            })
        );

        allUsersDirectory = usersWithProfile.sort((a, b) => a.username.localeCompare(b.username));
        renderDirectory(searchInput.value);
    });
}

// --- UTILS ---
async function uploadToImgBB(file, onProgress) {
    return new Promise((resolve) => {
        const formData = new FormData();
        formData.append("image", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, true);

        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable || typeof onProgress !== 'function') return;
            const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
            onProgress(percent);
        };

        xhr.onload = () => {
            try {
                const data = JSON.parse(xhr.responseText || '{}');
                resolve(data.success ? data.data : null);
            } catch {
                resolve(null);
            }
        };
        xhr.onerror = () => resolve(null);
        xhr.onabort = () => resolve(null);
        xhr.send(formData);
    });
}

function startDrag(e) {
    isDragging = true; startY = e.clientY;
    const move = (ev) => {
        if(!isDragging) return;
        const diff = ev.clientY - startY;
        currentPos = Math.max(0, Math.min(100, currentPos - (diff / 2)));
        $('view-cover').style.objectPosition = `50% ${currentPos}%`;
        startY = ev.clientY;
    };
    const stop = async () => {
        isDragging = false;
        await update(ref(db, `users/${localStorage.getItem("active_user")}/profile`), { coverPos: currentPos });
        window.removeEventListener('mousemove', move);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
}

function initInfiniteScroll() {
    window.onscroll = () => {
        const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 500);
        if (nearBottom && !hasTriggeredNearBottom) {
            hasTriggeredNearBottom = true;
            renderMorePosts(localStorage.getItem("active_user"));
        } else if (!nearBottom) {
            hasTriggeredNearBottom = false;
        }
    };
}

$('btn-upload-trigger').onclick = () => {
    const i = document.createElement('input'); i.type = 'file';
    i.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        $('upload-status').innerText = "Uploading... 0%";
        $('upload-status').classList.remove('hidden');
        const r = await uploadToImgBB(file, (percent) => {
            $('upload-status').innerText = `Uploading... ${percent}%`;
        });
        if (r) {
            const mediumUrl = String(r?.medium?.url || r?.url || '').trim();
            const thumbUrl = String(r?.thumb?.url || mediumUrl || r?.url || '').trim();
            const originalUrl = String(r?.image?.url || r?.url || '').trim();
            pendingUploadImage = {
                mediumUrl,
                thumbUrl,
                originalUrl
            };
            $('post-url').value = pendingUploadImage.mediumUrl || pendingUploadImage.thumbUrl || pendingUploadImage.originalUrl;
            $('upload-status').innerText = "Ready! 100%";
        } else {
            pendingUploadImage = null;
            $('upload-status').innerText = "Upload gagal.";
        }
    };
    i.click();
};

$('btn-post-submit').onclick = async () => {
    const u = localStorage.getItem("active_user");
    const fallbackUrl = String($('post-url').value || '').trim();
    const mediumUrl = String(pendingUploadImage?.mediumUrl || fallbackUrl).trim();
    const thumbUrl = String(pendingUploadImage?.thumbUrl || mediumUrl || fallbackUrl).trim();
    const originalUrl = String(pendingUploadImage?.originalUrl || mediumUrl || fallbackUrl).trim();
    if (!mediumUrl && !thumbUrl) return alert("Pilih foto!");
    const key = push(ref(db, 'global_posts')).key;
    const data = {
        author: u,
        url: mediumUrl || thumbUrl,
        mediumUrl,
        thumbUrl,
        originalUrl,
        caption: $('post-caption').value,
        time: Date.now()
    };
    await update(ref(db), { [`global_posts/${key}`]: data, [`users/${u}/posts/${key}`]: data });
    location.reload();
};