document.addEventListener('DOMContentLoaded', () => {
    // Menggunakan querySelectorAll untuk menangani banyak movie-item
    const movieItems = document.querySelectorAll('.movie-item');
    const movieModal = document.getElementById('movieModal');
    const closeButton = document.querySelector('.close-button');
    const modalBody = document.querySelector('.modal-body');

    // Function to open the modal by fetching content from a file
    function openModal(detailFilePath) {
        // Tampilkan dulu pesan "Memuat..."
        modalBody.innerHTML = 'Memuat detail video...';
        movieModal.style.display = 'flex'; // Tampilkan modal
        document.body.style.overflow = 'hidden'; // Nonaktifkan scrolling background

        fetch(detailFilePath)
            .then(response => {
                if (!response.ok) {
                    // Jika respons tidak OK (misal 404 Not Found), lempar error
                    throw new Error(`HTTP error! status: ${response.status} for ${detailFilePath}`);
                }
                return response.text();
            })
            .then(htmlContent => {
                modalBody.innerHTML = htmlContent; // Masukkan konten yang diambil
            })
            .catch(error => {
                console.error('Error loading video details:', error);
                modalBody.innerHTML = `<p>Gagal memuat detail video dari ${detailFilePath}. Pastikan file ada dan namanya benar.</p>`;
            });
    }

    // Function to close the modal
    function closeModal() {
        movieModal.style.display = 'none'; // Sembunyikan modal
        document.body.style.overflow = 'auto'; // Aktifkan kembali scrolling background
        modalBody.innerHTML = 'Memuat detail video...'; // Reset konten untuk pembukaan selanjutnya
    }

    // Event listeners untuk setiap movie item
    movieItems.forEach(item => {
        item.addEventListener('click', () => {
            const detailFilePath = item.dataset.detailFile; // Ambil path file detail dari data attribute
            openModal(detailFilePath);
        });
    });

    // Event listener untuk tombol tutup
    closeButton.addEventListener('click', closeModal);

    // Tutup modal jika diklik di luar area konten modal
    window.addEventListener('click', (event) => {
        if (event.target === movieModal) {
            closeModal();
        }
    });

    // Tutup modal dengan tombol Escape
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && movieModal.style.display === 'flex') {
            closeModal();
        }
    });
});