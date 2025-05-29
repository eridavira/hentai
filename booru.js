document.addEventListener('DOMContentLoaded', () => {
    const galleryContainer = document.getElementById('galleryContainer');
    const searchInput = document.getElementById('searchInput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const noResultsDiv = document.getElementById('noResults');

    const batchSize = 50;
    // allImageData kini menyimpan data {url: "...", name: "...", tags: ["...", "..."], fullUrl: "..."}
    let allImageData = [];
    let filteredImageData = [];
    let currentlyDisplayedImages = 0;
    let isLoading = false; // Flag untuk mencegah multiple load saat scroll cepat

    // Fungsi untuk membuat dan menampilkan item galeri
    function displayImages(imagesToDisplay) {
        const fragment = document.createDocumentFragment();
        imagesToDisplay.forEach(item => {
            // Membuat elemen anchor (link) untuk membungkus gambar
            const link = document.createElement('a');
            link.href = item.fullUrl || item.url;
            link.target = '_blank'; // Membuka di tab baru
            link.rel = 'noopener noreferrer'; // Praktik keamanan yang baik untuk _blank

            const galleryItem = document.createElement('div');
            galleryItem.classList.add('gallery-item');
            galleryItem.style.backgroundImage = `url('${item.url}')`; // Gambar thumbnail untuk display
            galleryItem.dataset.tags = item.tags.join(',').toLowerCase();

            // Membuat elemen untuk nama foto
            const photoName = document.createElement('div');
            photoName.classList.add('photo-name');
            photoName.textContent = item.name || 'Nama Foto'; // Menggunakan nama dari data, fallback jika tidak ada

            // Masukkan nama foto ke dalam galleryItem
            galleryItem.appendChild(photoName);

            // Masukkan div gallery-item ke dalam link
            link.appendChild(galleryItem);
            // Masukkan link ke dalam fragment
            fragment.appendChild(link);
        });
        galleryContainer.appendChild(fragment);
    }

    // Fungsi untuk memuat batch gambar berikutnya
    function loadMoreImages() {
        if (isLoading) return;
        isLoading = true;
        loadingIndicator.style.display = 'block';

        const imagesToLoad = filteredImageData.slice(currentlyDisplayedImages, currentlyDisplayedImages + batchSize);

        if (imagesToLoad.length > 0) {
            displayImages(imagesToLoad);
            currentlyDisplayedImages += imagesToLoad.length;
            noResultsDiv.style.display = 'none';
        } else if (currentlyDisplayedImages === 0 && filteredImageData.length === 0) {
            // Ini akan ditangani oleh filterImages jika tidak ada hasil sama sekali
        }

        loadingIndicator.style.display = 'none';
        isLoading = false;
    }

    // Fungsi untuk menyaring gambar berdasarkan input pencarian
    function filterImages() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        galleryContainer.innerHTML = ''; // Kosongkan galeri saat ini
        currentlyDisplayedImages = 0;
        noResultsDiv.style.display = 'none';

        if (!searchTerm) {
            filteredImageData = [...allImageData]; // Jika tidak ada pencarian, tampilkan semua
        } else {
            filteredImageData = allImageData.filter(item => {
                // Sekarang pencarian juga bisa melibatkan nama foto
                return item.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
                       (item.name && item.name.toLowerCase().includes(searchTerm));
            });
        }

        if (filteredImageData.length === 0 && searchTerm) {
            noResultsDiv.style.display = 'block';
        } else {
            noResultsDiv.style.display = 'none';
        }
        loadMoreImages(); // Muat batch pertama dari hasil filter (atau semua jika tidak ada filter)
    }

    // Fungsi untuk mengambil data JSON
    async function fetchAndInitializeGallery() {
        try {
            // Mengambil dari booru.json
            const response = await fetch('booru.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allImageData = await response.json();
            // Validasi format data: harus array of objects dengan 'url' dan 'tags'
            // 'fullUrl' dan 'name' opsional, jadi tidak divalidasi di sini secara ketat
            if (!Array.isArray(allImageData) || !allImageData.every(item => typeof item === 'object' && item.url && Array.isArray(item.tags))) {
                console.error("Format booru.json tidak valid. Harusnya array of objects dengan 'url' dan 'tags'.");
                galleryContainer.innerHTML = '<p style="color: #ff6b6b; text-align: center;">Format data gambar tidak valid.</p>';
                return;
            }
            filterImages(); // Panggil filter untuk memuat gambar awal (semua gambar)
        } catch (error) {
            console.error("Gagal memuat daftar gambar:", error);
            galleryContainer.innerHTML = '<p style="color: #ff6b6b; text-align: center;">Gagal memuat galeri. Pastikan file booru.json ada dan formatnya benar.</p>';
        }
    }

    // Fungsi untuk handle lazy loading saat scroll
    function handleScroll() {
        // Cek apakah pengguna sudah scroll mendekati bawah DAN masih ada gambar yang belum dimuat dari hasil filter
        if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 200) && !isLoading && currentlyDisplayedImages < filteredImageData.length) {
            loadMoreImages();
        }
    }

    // Event listener untuk input pencarian
    searchInput.addEventListener('input', () => {
        // Debounce search untuk performa lebih baik (opsional tapi direkomendasikan)
        // Saat ini, filter langsung dijalankan. Untuk debounce, Anda bisa menambahkan timeout di sini.
        filterImages();
    });

    // Panggil fungsi untuk mengambil gambar dan inisialisasi
    fetchAndInitializeGallery();

    // Tambahkan event listener untuk scroll
    window.addEventListener('scroll', handleScroll);
});