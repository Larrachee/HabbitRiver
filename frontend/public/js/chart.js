function updateChart() {
    const days = getPastSevenDays();
    const labels = days.map(d => d.label);
    const values = days.map(d => habits.filter(h => h.history[d.dateStr]).length);

    if (progressChart) { progressChart.destroy(); progressChart = null; }

    const s = getComputedStyle(document.documentElement);
    const accent = s.getPropertyValue('--secondary-color').trim() || '#e2622f';
    const muted  = s.getPropertyValue('--text-muted').trim()      || '#85806f';
    const border = s.getPropertyValue('--border-color').trim()    || '#2c2b26';

    const ctx = document.getElementById('progressChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, hexToRgba(accent, 0.22));
    gradient.addColorStop(1, hexToRgba(accent, 0));

    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Habits Completed', data: values,
                borderColor: accent, backgroundColor: gradient, borderWidth: 2,
                tension: 0.35, fill: true,
                pointBackgroundColor: accent, pointBorderColor: accent,
                pointBorderWidth: 0, pointRadius: 4, pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    titleFont: { family: 'IBM Plex Mono', size: 11 },
                    bodyFont:  { family: 'IBM Plex Mono', size: 11 },
                    padding: 10, cornerRadius: 2, displayColors: false
                }
            },
            scales: {
                y: { beginAtZero: true,
                     ticks: { stepSize: 1, color: muted, font: { family: 'IBM Plex Mono', size: 10 } },
                     grid: { color: border, drawTicks: false }, border: { display: false } },
                x: { grid: { display: false },
                     ticks: { color: muted, font: { family: 'IBM Plex Mono', size: 10 } },
                     border: { display: false } }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}