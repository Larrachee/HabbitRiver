function renderYearHeatmap() {
    const yearHeatmap = document.getElementById('year-heatmap');
    yearHeatmap.innerHTML = '';

    const counts = {};
    habits.forEach(h => Object.keys(h.history).forEach(d => { counts[d] = (counts[d] || 0) + 1; }));

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    start.setDate(start.getDate() - start.getDay());

    const cursor = new Date(start);
    while (cursor <= today) {
        const dateStr = cursor.toISOString().split('T')[0];
        const count = counts[dateStr] || 0;
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        if (count > 0) cell.dataset.level = Math.min(count, 4);
        cell.title = `${dateStr} · ${count} habit${count === 1 ? '' : 's'}`;
        yearHeatmap.appendChild(cell);
        cursor.setDate(cursor.getDate() + 1);
    }
}