document.addEventListener('DOMContentLoaded', () => {
    const movieItem = document.querySelector('.movie-item');
    const movieModal = document.getElementById('movieModal');
    const closeButton = document.querySelector('.close-button');
    const modalBody = document.querySelector('.modal-body');

    // Function to open the modal by fetching content from a file
    function openModal(detailFilePath) {
        fetch(detailFilePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(htmlContent => {
                modalBody.innerHTML = htmlContent; // Insert fetched content
                movieModal.style.display = 'flex'; // Show the modal
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            })
            .catch(error => {
                console.error('Error loading video details:', error);
                modalBody.innerHTML = '<p>Gagal memuat detail video. Silakan coba lagi nanti.</p>';
                movieModal.style.display = 'flex'; // Still show the modal with error message
                document.body.style.overflow = 'hidden';
            });
    }

    // Function to close the modal
    function closeModal() {
        movieModal.style.display = 'none'; // Hide the modal
        document.body.style.overflow = 'auto'; // Re-enable background scrolling
        modalBody.innerHTML = 'Memuat detail video...'; // Reset content for next open
    }

    // Event listener for the single movie item
    if (movieItem) {
        movieItem.addEventListener('click', () => {
            const detailFilePath = movieItem.dataset.detailFile; // Get the detail file path
            openModal(detailFilePath);
        });
    }

    // Event listener for the close button
    closeButton.addEventListener('click', closeModal);

    // Close the modal if clicked outside of the modal content
    window.addEventListener('click', (event) => {
        if (event.target === movieModal) {
            closeModal();
        }
    });

    // Close the modal with the Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && movieModal.style.display === 'flex') {
            closeModal();
        }
    });
});