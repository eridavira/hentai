let currentImageIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    loadGallery();
    setupLightbox();
});

function loadGallery() {
    const galleryContainer = document.getElementById('galleryContainer');
    
    galleryData.forEach((item, index) => {
        const galleryItem = document.createElement('div');
        galleryItem.className = "gallery-item";
        galleryItem.dataset.index = index;
        
        galleryItem.innerHTML = `
            <img src="${item.thumbnail}" alt="${item.title}" loading="lazy">
            <div class="title">${item.title}</div>
        `;
        
        galleryItem.addEventListener('click', () => openLightbox(index));
        galleryContainer.appendChild(galleryItem);
    });
}

function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.getElementById('closeBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // Close lightbox
    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
    
    // Navigation
    prevBtn.addEventListener('click', showPrevImage);
    nextBtn.addEventListener('click', showNextImage);
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (lightbox.style.display === 'flex') {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') showPrevImage();
            if (e.key === 'ArrowRight') showNextImage();
        }
    });
}

function openLightbox(index) {
    currentImageIndex = index;
    updateLightboxImage();
    document.getElementById('lightbox').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function updateLightboxImage() {
    const currentImage = galleryData[currentImageIndex];
    const lightboxImg = document.getElementById('lightboxImage');
    const imageTitle = document.getElementById('imageTitle');
    
    lightboxImg.src = currentImage.fullsize;
    imageTitle.textContent = currentImage.title;
    
    // Show/hide nav buttons based on position
    document.getElementById('prevBtn').style.display = 
        currentImageIndex === 0 ? 'none' : 'flex';
    document.getElementById('nextBtn').style.display = 
        currentImageIndex === galleryData.length - 1 ? 'none' : 'flex';
}

function showPrevImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        updateLightboxImage();
    }
}

function showNextImage() {
    if (currentImageIndex < galleryData.length - 1) {
        currentImageIndex++;
        updateLightboxImage();
    }
}