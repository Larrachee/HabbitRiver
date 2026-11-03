let saveTimer = null;

async function loadUserData() {
    const d = await api('/me/data');
    habits = d.habits || [];
    userProfile = d.userProfile || { xp: 0, level: 1 };
    unlockedAchievements = d.unlockedAchievements || [];
    habitNotes = d.habitNotes || {};
}

// Dipanggil di banyak tempat (signature lama dipertahankan); simpan ke server dengan jeda 0,5 detik
function saveUserData() {
    if (!currentUser || currentUserRole === 'admin') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushUserData, 500);
}

async function pushUserData() {
    saveTimer = null;
    try {
        await api('/me/data', {
            method: 'PUT',
            body: { habits, userProfile, unlockedAchievements, habitNotes }
        });
    } catch (e) {
        if (typeof showToast === 'function') showToast('Gagal menyimpan ke server', 'error');
    }
}

async function flushUserData() {
    if (saveTimer) { clearTimeout(saveTimer); await pushUserData(); }
}

// ---- Sementara: dipakai leaderboard.js & admin.js, akan diganti endpoint server ----
function getUserStats(username) {
    let userHabits = [];
    let profile = { xp: 0, level: 1 };
    try {
        userHabits = JSON.parse(localStorage.getItem(`habits_${username}`)) || [];
        profile = JSON.parse(localStorage.getItem(`userProfile_${username}`)) || { xp: 0, level: 1 };
    } catch {}
    const totalXp = profile.xp + (profile.level * (profile.level - 1) / 2) * 100;
    const bestStreak = userHabits.reduce((m, h) => Math.max(m, getBestStreak(h.history || {})), 0);
    const today = getTodayStr();
    const completedToday = userHabits.filter(h => h.history && h.history[today]).length;
    return { habits: userHabits, profile, totalXp, bestStreak, completedToday };
}

function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
    catch { return {}; }
}
function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
