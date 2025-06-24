document.addEventListener('DOMContentLoaded', function() {
    // Ubah nilai ini sesuai dengan nomor part halaman saat ini
    // Misalnya, jika ini adalah file part_1.html, set 1. Jika part_2.html, set 2.
    const currentPart = 1;

    const partLinks = document.querySelectorAll('.part-navigation a');
    const body = document.body;

    // Inisialisasi posisi dan zoom background dari localStorage jika ada
    let bgPositionX = localStorage.getItem('bgPositionX') || 'center';
    let bgPositionY = localStorage.getItem('bgPositionY') || 'center';
    let bgSize = localStorage.getItem('bgSize') || 'cover';

    body.style.backgroundPosition = `${bgPositionX} ${bgPositionY}`;
    body.style.backgroundSize = bgSize;

    partLinks.forEach(link => {
        const linkPart = parseInt(link.dataset.part);
        if (linkPart === currentPart) {
            // Jika tautan adalah part saat ini, tambahkan kelas aktif
            link.classList.add('part-active');
        } else {
            // Pastikan tidak ada kelas aktif jika bukan part saat ini
            link.classList.remove('part-active');
        }
    });

    // Fungsi untuk menyesuaikan background
    document.addEventListener('keydown', function(event) {
        const currentBgPosition = body.style.backgroundPosition.split(' ');
        let x = currentBgPosition[0];
        let y = currentBgPosition[1];
        let size = body.style.backgroundSize;

        // Mengubah nilai string persen menjadi float untuk perhitungan
        if (x.includes('%')) x = parseFloat(x);
        if (y.includes('%')) y = parseFloat(y);

        const step = 5; // Langkah penyesuaian dalam persen
        const zoomStep = 10; // Langkah zoom dalam persen

        switch (event.key) {
            case 'ArrowUp':
                y = Math.max(0, y - step);
                break;
            case 'ArrowDown':
                y = Math.min(100, y + step);
                break;
            case 'ArrowLeft':
                x = Math.max(0, x - step);
                break;
            case 'ArrowRight':
                x = Math.min(100, x + step);
                break;
            case '+': // Zoom In
                if (size === 'cover' || size === 'contain') size = '100%';
                let currentSize = parseFloat(size);
                size = `${currentSize + zoomStep}%`;
                break;
            case '-': // Zoom Out
                if (size === 'cover' || size === 'contain') size = '100%';
                let currentSizeOut = parseFloat(size);
                size = `${Math.max(10, currentSizeOut - zoomStep)}%`; // Minimal 10%
                break;
            case 'r': // Reset
                x = 'center';
                y = 'center';
                size = 'cover';
                break;
            default:
                return;
        }

        // Mengembalikan nilai ke format persen jika sebelumnya berupa angka
        body.style.backgroundPosition = `${typeof x === 'number' ? x + '%' : x} ${typeof y === 'number' ? y + '%' : y}`;
        body.style.backgroundSize = size;

        // Simpan ke localStorage
        localStorage.setItem('bgPositionX', typeof x === 'number' ? x + '%' : x);
        localStorage.setItem('bgPositionY', typeof y === 'number' ? y + '%' : y);
        localStorage.setItem('bgSize', size);
    });
});