import { db, ref, set, get } from "./firebase.js";
const DEFAULT_COVER_URL = "https://thumbs2.imgbox.com/84/5d/12r9Oc2Z_t.png";

const $ = (id) => document.getElementById(id);

$('btn-register').onclick = async () => {
    const u = $('reg-user').value.trim().toLowerCase();
    const p = $('reg-pass').value.trim();

    if (u.length < 3 || p.length < 6) {
        return alert("Username minimal 3 karakter & Password minimal 6 karakter!");
    }

    try {
        const uRef = ref(db, `users_auth/${u}`);
        const snap = await get(uRef);

        if (snap.exists()) {
            return alert("Username sudah digunakan, cari yang lain!");
        }

        // Simpan data Auth & Profil dasar
        await set(uRef, { pass: p });
        await set(ref(db, `users/${u}/profile`), { 
            name: u, 
            bio: "Halo, saya pengguna baru!", 
            avatar: "", 
            cover: DEFAULT_COVER_URL,
            coverPos: "50% 50%"
        });

        alert("Akun berhasil dibuat! Silakan login.");
        window.location.href = "index.html"; // Balik ke halaman login
    } catch (err) {
        console.error(err);
        alert("Terjadi kesalahan saat mendaftar.");
    }
};