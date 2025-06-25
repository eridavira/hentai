document.addEventListener('DOMContentLoaded', () => {
    const movieItem = document.querySelector('.movie-item'); // Hanya satu item sekarang
    const movieModal = document.getElementById('movieModal');
    const closeButton = document.querySelector('.close-button');
    const modalBody = document.querySelector('.modal-body');

    // Function to open the modal with the video
    function openModal(videoSrc) {
        // Create an iframe for the Google Drive video
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', videoSrc);
        iframe.setAttribute('allowfullscreen', ''); // Allow fullscreen
        iframe.setAttribute('frameborder', '0'); // No border

        modalBody.innerHTML = ''; // Clear previous content
        modalBody.appendChild(iframe); // Add the iframe

        movieModal.style.display = 'flex'; // Show the modal
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    // Function to close the modal
    function closeModal() {
        movieModal.style.display = 'none'; // Hide the modal
        document.body.style.overflow = 'auto'; // Re-enable background scrolling
        modalBody.innerHTML = 'Memuat video...'; // Reset content for next open
    }

    // Event listener for the single movie item
    if (movieItem) {
        movieItem.addEventListener('click', () => {
            const videoSrc = movieItem.dataset.videoSrc; // Get the video source from data attribute
            openModal(videoSrc);
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