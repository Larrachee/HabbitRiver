function openHabitModal(id) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    openModalHabitId = id;

    const modalTitle = document.getElementById('modal-title');
    const modalCategory = document.getElementById('modal-category');
    const modalSub = document.getElementById('modal-sub');
    const modalStats = document.getElementById('modal-stats');
    const modalHeatmap = document.getElementById('modal-heatmap');
    const modalNote = document.getElementById('modal-note');
    const modalNoteStatus = document.getElementById('modal-note-status');
    const modal = document.getElementById('habit-modal');

    modalTitle.textContent = habit.name;
    modalCategory.textContent = habit.category || '📦 General';

    const totalDone = Object.keys(habit.history).length;
    const current = calculateStreak(habit.history);
    const best = getBestStreak(habit.history);

    const created = new Date(parseInt(id, 10));
    modalSub.textContent = isNaN(created) ? '—'
        : `Created ${created.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    let hit = 0, span = 30;
    const now = new Date();
    for (let i = 0; i < span; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        if (habit.history[d.toISOString().split('T')[0]]) hit++;
    }
    const rate = Math.round((hit / span) * 100);

    modalStats.innerHTML = `
        <div class="modal-stat"><div class="ms-value">${totalDone}</div><span class="ms-label">Total</span></div>
        <div class="modal-stat"><div class="ms-value">${current}</div><span class="ms-label">Current</span></div>
        <div class="modal-stat"><div class="ms-value">${best}</div><span class="ms-label">Best</span></div>
        <div class="modal-stat"><div class="ms-value">${rate}%</div><span class="ms-label">30d rate</span></div>
    `;

    modalHeatmap.innerHTML = '';
    const miniStart = new Date(now);
    miniStart.setHours(0, 0, 0, 0);
    miniStart.setDate(miniStart.getDate() - 83);
    miniStart.setDate(miniStart.getDate() - miniStart.getDay());

    const cursor = new Date(miniStart);
    while (cursor <= now) {
        const dateStr = cursor.toISOString().split('T')[0];
        const done = !!habit.history[dateStr];
        const c = document.createElement('div');
        c.className = 'heatmap-cell';
        if (done) c.dataset.level = 4;
        c.title = `${dateStr}${done ? ' · done' : ''}`;
        modalHeatmap.appendChild(c);
        cursor.setDate(cursor.getDate() + 1);
    }

    const today = getTodayStr();
    modalNote.value = (habitNotes[id] && habitNotes[id][today]) || '';
    modalNoteStatus.textContent = '';
    modalNoteStatus.classList.remove('show');

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
    const modal = document.getElementById('habit-modal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    openModalHabitId = null;
}

function bindHabitModalUI() {
    const modal = document.getElementById('habit-modal');
    const modalNote = document.getElementById('modal-note');
    const modalNoteSave = document.getElementById('modal-note-save');
    const modalNoteStatus = document.getElementById('modal-note-status');

    modal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));

    modalNoteSave.addEventListener('click', () => {
        if (!openModalHabitId) return;
        const today = getTodayStr();
        const text = modalNote.value.trim();

        if (!habitNotes[openModalHabitId]) habitNotes[openModalHabitId] = {};
        if (text) habitNotes[openModalHabitId][today] = text;
        else delete habitNotes[openModalHabitId][today];

        saveUserData(currentUser);
        renderHabits();
        checkAchievements();

        modalNoteStatus.textContent = 'Saved';
        modalNoteStatus.classList.add('show');
        setTimeout(() => modalNoteStatus.classList.remove('show'), 1400);
    });
}