const ACHIEVEMENTS = [
    { id: 'first_habit',   icon: '🌱', name: 'First Step',   desc: 'Create your first habit',             check: () => habits.length >= 1 },
    { id: 'first_done',    icon: '✅', name: 'Beginner',     desc: 'Complete a habit for the first time', check: () => habits.some(h => Object.keys(h.history).length >= 1) },
    { id: 'streak_3',      icon: '🔥', name: 'On Fire',      desc: 'Reach a 3-day streak',                check: () => habits.some(h => getBestStreak(h.history) >= 3) },
    { id: 'streak_7',      icon: '⚡', name: 'Week Warrior', desc: 'Reach a 7-day streak',                check: () => habits.some(h => getBestStreak(h.history) >= 7) },
    { id: 'streak_30',     icon: '💪', name: 'Unstoppable',  desc: 'Reach a 30-day streak',               check: () => habits.some(h => getBestStreak(h.history) >= 30) },
    { id: 'five_habits',   icon: '📊', name: 'Multi-tasker', desc: 'Track 5 habits at once',              check: () => habits.length >= 5 },
    { id: 'perfect_day',   icon: '🌟', name: 'Perfect Day',  desc: 'Complete ALL habits in one day',      check: () => { const t = getTodayStr(); return habits.length > 0 && habits.every(h => h.history[t]); } },
    { id: 'level_5',       icon: '⭐', name: 'Rising Star',  desc: 'Reach Level 5',                       check: () => userProfile.level >= 5 },
    { id: 'level_10',      icon: '👑', name: 'Legend',       desc: 'Reach Level 10',                      check: () => userProfile.level >= 10 },
    { id: 'xp_500',        icon: '💎', name: 'Collector',    desc: 'Earn 500 total XP',                   check: () => getTotalXp() >= 500 },
    { id: 'note_written',  icon: '📝', name: 'Reflective',   desc: 'Write a note on any habit day',       check: () => Object.values(habitNotes).some(d => d && Object.keys(d).length > 0) }
];

function checkAchievements() {
    const newUnlocks = [];
    ACHIEVEMENTS.forEach(ach => {
        if (!unlockedAchievements.includes(ach.id) && ach.check()) {
            unlockedAchievements.push(ach.id);
            newUnlocks.push(ach);
        }
    });
    if (newUnlocks.length) {
        localStorage.setItem(`achievements_${currentUser}`, JSON.stringify(unlockedAchievements));
        newUnlocks.forEach(a => showToast(`Achievement unlocked — ${a.name}`, 'achievement', 4000));
        playSound('achievement');
        renderAchievements();
    }
}

function renderAchievements() {
    const c = document.getElementById('achievements-list');
    c.innerHTML = '';
    ACHIEVEMENTS.forEach(ach => {
        const unlocked = unlockedAchievements.includes(ach.id);
        const card = document.createElement('div');
        card.className = `achievement-card ${unlocked ? 'unlocked' : ''}`;
        card.title = `${ach.name} — ${ach.desc}`;
        card.innerHTML = `<span class="ach-icon">${ach.icon}</span><span class="ach-name">${escapeHtml(ach.name)}</span>`;
        c.appendChild(card);
    });
}