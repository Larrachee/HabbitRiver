function initApp() {
    updateSoundButton();
    applyTheme();
    updateProfileUI();
    renderHabits();
    updateChart();
    renderLeaderboard();
    updateStats();
    renderAchievements();
    renderYearHeatmap();
    checkAchievements();
}

function bindAllUI() {
    bindThemeUI();
    bindSoundUI();
    bindAuthUI();
    bindAdminUI();
    bindHabitsUI();
    bindHabitModalUI();
    bindDataActions();
    bindShortcuts();
}

async function boot() {
    await ensureAdmin();
    bindAllUI();

    if (isAuthed()) {
        const username = getCurrentUsername();
        const users = getUsers();
        const user = users[username.toLowerCase()] || users[username];

        if (!user) {
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY);
            showAuthScreen();
            return;
        }

        currentUser = user.name;
        currentUserRole = user.role;

        if (user.role === 'admin') {
            showAdminScreen();
        } else {
            loadUserData(user.name);
            showAppScreen();
        }
    } else {
        showAuthScreen();
    }
}

boot();