const competitors = [
    { name: 'HabitMaster',  baseXp: 450, level: 4 },
    { name: 'CodeSamurai',  baseXp: 280, level: 3 },
    { name: 'KeepRunning',  baseXp: 120, level: 2 },
    { name: 'BookWorm',     baseXp: 50,  level: 1 },
    { name: 'CreativeMind', baseXp: 180, level: 2 },
    { name: 'ZenMaster',    baseXp: 90,  level: 1 }
];

function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';

    const boardData = [
        { name: currentUser || 'You', totalXp: getTotalXp(), level: userProfile.level, isUser: true },
        ...competitors.map(c => ({ name: c.name, totalXp: c.baseXp + (c.level - 1) * 100, level: c.level, isUser: false }))
    ].sort((a, b) => b.totalXp - a.totalXp);

    boardData.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-item' + (p.isUser ? ' user-row' : '');
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        row.innerHTML = `
            <span class="rank ${rankClass}">#${i + 1}</span>
            <span class="player-name">${escapeHtml(p.name)}</span>
            <span class="player-score">Lv.${p.level} · ${p.totalXp} XP</span>
        `;
        list.appendChild(row);
    });
}