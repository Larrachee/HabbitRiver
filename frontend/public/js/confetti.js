function fireConfetti() {
    if (typeof confetti !== 'function') return;
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 },
        colors: ['#e2622f', '#c9a227', '#ece7dc', '#63a07d'] });
}

function fireLevelUpConfetti() {
    if (typeof confetti !== 'function') return;
    const duration = 2000, end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 4, angle: 60,  spread: 55, origin: { x: 0 }, colors: ['#e2622f', '#c9a227'] });
        confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ece7dc', '#63a07d'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    })();
}