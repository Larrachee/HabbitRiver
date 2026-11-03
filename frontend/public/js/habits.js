function filterHabits(category) {
    currentFilter = category;
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === category);
    });
    renderHabits();
}

function bindHabitsUI() {
    const habitForm = document.getElementById('habit-form');
    const habitSearch = document.getElementById('habit-search');
    const completeAllBtn = document.getElementById('complete-all');
    const habitNameInput = document.getElementById('habit-name');

    // filter buttons
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', () => filterHabits(btn.dataset.filter));
    });

    // search
    habitSearch.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim().toLowerCase();
        renderHabits();
    });

    // form submit
    habitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = habitNameInput.value.trim();
        const category = document.getElementById('habit-category').value;
        if (!name) return;

        habits.push({ id: Date.now().toString(), name, category, history: {} });
        saveAndRender();
        habitNameInput.value = '';
        habitNameInput.focus();
        showToast(`Habit "${name}" added`, 'success');
        playSound('complete');
    });

    // complete all
    completeAllBtn.addEventListener('click', () => {
        const today = getTodayStr();
        const visible = habits.filter(h => {
            if (currentFilter !== 'All' && h.category !== currentFilter) return false;
            if (currentSearch && !h.name.toLowerCase().includes(currentSearch)) return false;
            return true;
        });
        const pending = visible.filter(h => !h.history[today]);

        if (!pending.length) {
            showToast('Nothing left to complete here', 'error');
            return;
        }

        pending.forEach(h => { h.history[today] = true; });
        addXP(pending.length * 15);
        playSound('complete');
        fireConfetti();
        showToast(`${pending.length} habit${pending.length > 1 ? 's' : ''} completed · +${pending.length * 15} XP`, 'success');
        saveAndRender();
    });
}

function saveAndRender() {
    saveUserData(currentUser);
    renderHabits();
    updateChart();
    renderLeaderboard();
    updateStats();
    updateProfileUI();
    renderYearHeatmap();
    checkAchievements();
}

function renderHabits() {
    const habitList = document.getElementById('habit-list');
    const completeAllBtn = document.getElementById('complete-all');
    habitList.innerHTML = '';

    const pastDays = getPastSevenDays();
    const todayStr = getTodayStr();

    const filtered = habits.filter(habit => {
        if (currentFilter !== 'All' && habit.category !== currentFilter) return false;
        if (currentSearch && !habit.name.toLowerCase().includes(currentSearch)) return false;
        return true;
    });

    const pendingToday = filtered.filter(h => !h.history[todayStr]).length;
    completeAllBtn.disabled = pendingToday === 0;

    if (filtered.length === 0) {
        habitList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>${currentSearch ? 'No habits match your search.' : 'No habits in this category yet.'}</p>
                <p style="margin-top:6px;">${currentSearch ? 'Try a different keyword.' : 'Add one to start building your river.'}</p>
            </div>
        `;
        return;
    }

    filtered.forEach(habit => {
        const card = document.createElement('div');
        card.classList.add('habit-card');

        const isDoneToday = !!habit.history[todayStr];
        const streak = calculateStreak(habit.history);
        const hasNoteToday = !!(habitNotes[habit.id] && habitNotes[habit.id][todayStr]);

        card.innerHTML = `
            <div class="habit-header">
                <div class="habit-title-area">
                    <h3 data-habit-id="${escapeHtml(habit.id)}" title="Open details">
                        ${escapeHtml(habit.name)}${hasNoteToday ? '<span class="habit-note-dot" title="Note today"></span>' : ''}
                    </h3>
                    <span class="category-tag">${escapeHtml(habit.category || '📦 General')}</span>
                    <span class="streak-badge">🔥 ${streak}d</span>
                </div>
                <div class="habit-actions">
                    <button type="button" class="btn-done ${isDoneToday ? 'undo' : ''}">
                        <i class="fas ${isDoneToday ? 'fa-undo' : 'fa-check'}"></i>
                        ${isDoneToday ? 'Undo' : 'Done +15'}
                    </button>
                    <button type="button" class="btn-delete" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="grid-container"></div>
        `;

        card.querySelector('h3').addEventListener('click', () => openHabitModal(habit.id));
        card.querySelector('.btn-done').addEventListener('click', () => toggleHabit(habit.id, todayStr));
        card.querySelector('.btn-delete').addEventListener('click', () => deleteHabit(habit.id));

        habitList.appendChild(card);

        const gridContainer = card.querySelector('.grid-container');
        pastDays.forEach(day => {
            const wrap = document.createElement('div');
            wrap.classList.add('grid-day');

            const cube = document.createElement('div');
            cube.classList.add('cube');
            if (habit.history[day.dateStr]) cube.classList.add('completed');
            if (day.dateStr === todayStr) cube.classList.add('today');
            cube.title = `Toggle ${day.dateStr}`;
            cube.addEventListener('click', () => toggleHabit(habit.id, day.dateStr));

            const label = document.createElement('span');
            label.textContent = day.label;

            wrap.appendChild(cube);
            wrap.appendChild(label);
            gridContainer.appendChild(wrap);
        });
    });
}

function toggleHabit(id, dateStr) {
    const isPast = dateStr !== getTodayStr();
    habits = habits.map(habit => {
        if (habit.id !== id) return habit;
        if (habit.history[dateStr]) {
            delete habit.history[dateStr];
            addXP(-15);
            playSound('undo');
            showToast(`${isPast ? 'Backfill removed' : 'Habit undone'} · -15 XP`, 'error');
        } else {
            habit.history[dateStr] = true;
            addXP(15);
            playSound('complete');
            if (!isPast) fireConfetti();
            showToast(`Habit completed${isPast ? ' (backfill)' : ''} · +15 XP`, 'success');
        }
        return habit;
    });
    saveAndRender();
}

function deleteHabit(id) {
    const idx = habits.findIndex(h => h.id === id);
    if (idx === -1) return;

    const removed = habits[idx];
    const removedNotes = habitNotes[id];
    lastDeleted = { habit: removed, index: idx, notes: removedNotes };

    habits.splice(idx, 1);
    delete habitNotes[id];

    saveAndRender();
    showToast(`"${removed.name}" deleted`, 'error', 6000, {
        label: 'Undo',
        onClick: () => {
            if (!lastDeleted) return;
            habits.splice(lastDeleted.index, 0, lastDeleted.habit);
            if (lastDeleted.notes) habitNotes[lastDeleted.habit.id] = lastDeleted.notes;
            lastDeleted = null;
            saveAndRender();
            showToast('Habit restored', 'success');
        }
    });
}

// ---------- export / import / reset ----------
function bindDataActions() {
    document.getElementById('reset-data').addEventListener('click', () => {
        if (confirm(`Reset all habit data for "${currentUser}"? This cannot be undone.`)) {
            habits = [];
            userProfile = { xp: 0, level: 1 };
            unlockedAchievements = [];
            habitNotes = {};
            saveUserData(currentUser);
            showToast('Your data has been reset', 'error');
            saveAndRender();
        }
    });

    document.getElementById('export-data').addEventListener('click', () => {
        const data = { habits, userProfile, unlockedAchievements, habitNotes, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `habitriver-${currentUser}-${getTodayStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported successfully', 'success');
    });

    const importFile = document.getElementById('import-file');
    document.getElementById('import-data').addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!data.habits || !Array.isArray(data.habits)) throw new Error('Invalid format');

                habits = data.habits;
                userProfile = data.userProfile || { xp: 0, level: 1 };
                unlockedAchievements = data.unlockedAchievements || [];
                habitNotes = data.habitNotes || {};

                saveUserData(currentUser);
                saveAndRender();
                showToast('Data imported successfully', 'success');
            } catch {
                showToast('Failed to import file', 'error');
            }
        };
        reader.readAsText(file);
        importFile.value = '';
    });
}