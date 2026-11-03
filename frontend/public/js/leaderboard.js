let leaderboardCache = [];
let leaderboardTimer = null;

async function refreshLeaderboard() {
    try { leaderboardCache = await api('/leaderboard'); } catch {}
    renderLeaderboard();
    if (!leaderboardTimer) leaderboardTimer = setInterval(refreshLeaderboard, 60000);
}

function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '';

    // data diri sendiri memakai nilai lokal agar langsung terbarui
    const boardData = [
        { name: currentUser || 'You', totalXp: getTotalXp(), level: userProfile.level, isUser: true },
        ...leaderboardCache.filter(p => p.name !== currentUser).map(p => ({ ...p, isUser: false }))
    ].sort((a, b) => b.totalXp - a.totalXp).slice(0, 10);

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
