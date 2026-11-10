function getTotalXp() {
    let total = userProfile.xp;
    for (let i = 1; i < userProfile.level; i++) total += i * 100;
    return total;
}

function addXP(amount) {
    userProfile.xp += amount;
    const nextLevelXp = userProfile.level * 100;
    let leveledUp = false;

    if (userProfile.xp >= nextLevelXp) {
        userProfile.xp -= nextLevelXp;
        userProfile.level += 1;
        leveledUp = true;
        showToast(`Level up — you reached Level ${userProfile.level}`, 'level-up', 4000);
    } else if (userProfile.xp < 0) {
        if (userProfile.level > 1) {
            userProfile.level -= 1;
            userProfile.xp = (userProfile.level * 100) + userProfile.xp;
        } else { userProfile.xp = 0; }
    }

    saveUserData(currentUser);

    if (leveledUp) { playSound('levelup'); fireLevelUpConfetti(); }

    updateProfileUI();
    renderLeaderboard();
    updateStats();
    checkAchievements();
}

function updateProfileUI() {
    const nextLevelXp = userProfile.level * 100;
    const pct = Math.min((userProfile.xp / nextLevelXp) * 100, 100);
    const names = ['Novice', 'Explorer', 'Champion', 'Master', 'Legend', 'Mythic'];
    const name = names[Math.min(userProfile.level - 1, names.length - 1)] || 'Mythic';

    document.getElementById('user-level').textContent = `Level ${userProfile.level} (${name})`;
    document.getElementById('xp-bar').style.width = `${pct}%`;
    document.getElementById('xp-text').textContent = `${Math.floor(userProfile.xp)} / ${nextLevelXp} XP`;
    document.getElementById('total-xp').textContent = getTotalXp();
}

function updateStats() {
    const today = getTodayStr();
    const total = habits.length;
    const completedToday = habits.filter(h => h.history[today]).length;
    const bestStreak = habits.reduce((m, h) => Math.max(m, getBestStreak(h.history)), 0);

    document.getElementById('total-habits').textContent = total;
    document.getElementById('completed-today').textContent = completedToday;
    document.getElementById('streak-count').textContent = bestStreak;
}