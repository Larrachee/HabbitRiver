function initApp() {
    updateSoundButton();
    applyTheme();
    updateProfileUI();
    renderHabits();
    updateChart();
    refreshLeaderboard();
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
    bindAllUI();

    if (isAuthed() && await restoreSession()) {
        if (currentUserRole === 'admin') showAdminScreen();
        else showAppScreen();
    } else {
        showAuthScreen();
    }
}

// simpan perubahan yang masih tertunda sebelum halaman ditutup / di-refresh
window.addEventListener('beforeunload', () => { flushUserData(); });

boot();
