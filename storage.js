function loadUserData(username) {
    habits = JSON.parse(localStorage.getItem(`habits_${username}`)) || [];
    userProfile = JSON.parse(localStorage.getItem(`userProfile_${username}`)) || { xp: 0, level: 1 };
    unlockedAchievements = JSON.parse(localStorage.getItem(`achievements_${username}`)) || [];
    habitNotes = JSON.parse(localStorage.getItem(`habitNotes_${username}`)) || {};
}

function saveUserData(username) {
    if (!username) return;
    localStorage.setItem(`habits_${username}`, JSON.stringify(habits));
    localStorage.setItem(`userProfile_${username}`, JSON.stringify(userProfile));
    localStorage.setItem(`achievements_${username}`, JSON.stringify(unlockedAchievements));
    localStorage.setItem(`habitNotes_${username}`, JSON.stringify(habitNotes));
}

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