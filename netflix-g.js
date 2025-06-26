// (Kode netflix.js Anda yang terakhir, tidak perlu perubahan di sini)
document.addEventListener('DOMContentLoaded', () => {
    const movieItems = document.querySelectorAll('.movie-item');
    const movieModal = document.getElementById('movieModal');
    const closeButton = document.querySelector('.close-button');
    const modalBody = document.querySelector('.modal-body');

    function openModal(detailFilePath) {
        modalBody.innerHTML = 'Memuat galeri foto...'; // Update pesan
        movieModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        fetch(detailFilePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${detailFilePath}`);
                }
                return response.text();
            })
            .then(htmlContent => {
                modalBody.innerHTML = htmlContent;
            })
            .catch(error => {
                console.error('Error loading gallery details:', error);
                modalBody.innerHTML = `<p>Gagal memuat detail galeri dari ${detailFilePath}. Pastikan file ada dan namanya benar.</p>`;
            });
    }

    function closeModal() {
        movieModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        modalBody.innerHTML = 'Memuat galeri foto...'; // Reset pesan
    }

    movieItems.forEach(item => {
        item.addEventListener('click', () => {
            const detailFilePath = item.dataset.detailFile;
            openModal(detailFilePath);
        });
    });

    closeButton.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target === movieModal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && movieModal.style.display === 'flex') {
            closeModal();
        }
    });
});