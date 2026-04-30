import { db, ref, get, remove, set } from "./firebase.js";

export async function openPostDetail(postId, postData, myUser) {
    const modal = document.getElementById('img-modal');
    const modalContent = modal.querySelector('.modal-content');

    const authorSnap = await get(ref(db, `users/${postData.author}/profile`));
    const authorData = authorSnap.val() || {};
    const avatarUrl = authorData.avatar || `https://ui-avatars.com/api/?name=${postData.author}`;

    const likesCount = postData.likes ? Object.keys(postData.likes).length : 0;
    const isLiked = postData.likes && postData.likes[myUser];

    // Struktur Detail Lengkap (ID, Bio, Likes, Avatar)
    modalContent.innerHTML = `
        <div class="post-detail-container" onclick="event.stopPropagation()">
            <div class="detail-img-side">
                <img src="${postData.url}">
            </div>
            <div class="detail-info-side">
                <div class="detail-header">
                    <img src="${avatarUrl}" class="detail-avatar">
                    <div class="detail-user-info">
                        <b>@${postData.author}</b>
                        <small>ID: ${postId}</small>
                    </div>
                </div>
                <div class="detail-body">
                    <p class="detail-caption">${postData.caption || ''}</p>
                    <small class="detail-time">${new Date(postData.time).toLocaleString()}</small>
                </div>
                <div class="detail-footer">
                    <button id="modal-like-btn" class="like-btn-big">
                        ${isLiked ? '❤️' : '🤍'}
                    </button>
                    <span id="modal-like-count"><b>${likesCount}</b> Suka</span>
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    // Handle Like dalam Modal
    const modalLikeBtn = document.getElementById('modal-like-btn');
    modalLikeBtn.onclick = async () => {
        const gLikeRef = ref(db, `global_posts/${postId}/likes/${myUser}`);
        const uLikeRef = ref(db, `users/${postData.author}/posts/${postId}/likes/${myUser}`);
        const countEl = document.getElementById('modal-like-count');
        const snap = await get(gLikeRef);
        let current = parseInt(countEl.innerText);

        if (snap.exists()) {
            await remove(gLikeRef); await remove(uLikeRef);
            modalLikeBtn.innerText = '🤍';
            countEl.innerHTML = `<b>${current - 1}</b> Suka`;
        } else {
            await set(gLikeRef, true); await set(uLikeRef, true);
            modalLikeBtn.innerText = '❤️';
            countEl.innerHTML = `<b>${current + 1}</b> Suka`;
        }
    };
}