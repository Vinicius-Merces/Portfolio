// Scroll suave
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if(target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

// Efeito navbar
window.addEventListener('scroll', () => {
    document.querySelector('.navbar').classList.toggle('scrolled', window.scrollY > 50);
});

// Inicializar carrossel
const carouselElement = document.querySelector('#portfolioCarousel');
if (carouselElement) {
    const carousel = new bootstrap.Carousel(carouselElement, {
        interval: 5000,
        wrap: true
    });
}
