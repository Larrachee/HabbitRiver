function computeAdminStats() {
    const users = getUsers();
    const keys = Object.keys(users);
    let totalUsers = 0, totalAdmins = 0, totalHabits = 0, activeToday = 0;

    keys.forEach(u => {
        totalUsers++;
        if (users[u].role === 'admin') totalAdmins++;
        const stats = getUserStats(u);
        totalHabits += stats.habits.length;
        if (stats.completedToday > 0) activeToday++;
    });

    return { totalUsers, totalAdmins, totalHabits, activeToday };
}

function renderAdminStats() {
    const s = computeAdminStats();
    document.getElementById('admin-total-users').textContent   = s.totalUsers;
    document.getElementById('admin-total-admins').textContent  = s.totalAdmins;
    document.getElementById('admin-total-habits').textContent  = s.totalHabits;
    document.getElementById('admin-active-today').textContent  = s.activeToday;
}

function renderAdminUsers() {
    const tbody = document.getElementById('admin-users-body');
    const empty = document.getElementById('admin-empty');
    tbody.innerHTML = '';

    const users = getUsers();
    const filter = adminSearch;

    const rows = Object.keys(users).filter(username => {
        if (!filter) return true;
        return username.toLowerCase().includes(filter) || users[username].name.toLowerCase().includes(filter);
    }).sort((a, b) => (users[a].createdAt || '').localeCompare(users[b].createdAt || ''));

    if (rows.length === 0) {
        empty.hidden = false;
        return;
    }
    empty.hidden = true;

    rows.forEach(username => {
        const u = users[username];
        const stats = getUserStats(username);
        const tr = document.createElement('tr');
        const isSelf = username === currentUser;
        if (isSelf) tr.classList.add('is-self');

        tr.innerHTML = `
            <td>${escapeHtml(u.name)}${isSelf ? ' <span class="badge-role role-admin" style="margin-left:6px;">you</span>' : ''}</td>
            <td><span class="badge-role ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role}</span></td>
            <td class="mono">${formatDate(u.createdAt)}</td>
            <td class="mono">${formatDateTime(u.lastLogin)}</td>
            <td class="mono">${stats.habits.length}</td>
            <td class="mono">Lv.${stats.profile.level}</td>
            <td class="mono">${stats.totalXp}</td>
            <td class="mono">${stats.bestStreak}</td>
            <td class="col-actions">
                <button class="row-action" data-action="view" title="View details"><i class="fas fa-eye"></i></button>
                <button class="row-action" data-action="reset" title="Reset password"><i class="fas fa-key"></i></button>
                <button class="row-action" data-action="role" title="Toggle role" ${isSelf ? 'disabled' : ''}><i class="fas fa-user-shield"></i></button>
                <button class="row-action danger" data-action="delete" title="Delete user" ${isSelf ? 'disabled' : ''}><i class="fas fa-trash"></i></button>
            </td>
        `;

        tr.querySelectorAll('.row-action').forEach(btn => {
            btn.addEventListener('click', () => handleAdminAction(btn.dataset.action, username));
        });

        tbody.appendChild(tr);
    });
}

function handleAdminAction(action, username) {
    if (action === 'view')   return openAdminUserModal(username);
    if (action === 'reset')  return adminResetPassword(username);
    if (action === 'role')   return adminToggleRole(username);
    if (action === 'delete') return adminDeleteUser(username);
}

function openAdminUserModal(username) {
    const users = getUsers();
    const u = users[username];
    if (!u) return;

    adminModalUsername = username;
    const stats = getUserStats(username);

    document.getElementById('admin-modal-role').textContent  = u.role;
    document.getElementById('admin-modal-title').textContent = u.name;
    document.getElementById('admin-modal-sub').textContent   =
        `Registered ${formatDate(u.createdAt)} · Last login ${formatDateTime(u.lastLogin)}`;

    document.getElementById('admin-modal-stats').innerHTML = `
        <div class="modal-stat"><div class="ms-value">${stats.habits.length}</div><span class="ms-label">Habits</span></div>
        <div class="modal-stat"><div class="ms-value">${stats.profile.level}</div><span class="ms-label">Level</span></div>
        <div class="modal-stat"><div class="ms-value">${stats.totalXp}</div><span class="ms-label">Total XP</span></div>
        <div class="modal-stat"><div class="ms-value">${stats.bestStreak}</div><span class="ms-label">Best streak</span></div>
    `;

    const listEl = document.getElementById('admin-modal-habits');
    listEl.innerHTML = '';
    if (stats.habits.length === 0) {
        listEl.innerHTML = `<div class="empty-state" style="padding:24px 0;"><i class="fas fa-inbox"></i><p>No habits yet.</p></div>`;
    } else {
        stats.habits.forEach(h => {
            const row = document.createElement('div');
            row.className = 'admin-habit-row';
            const streak = getBestStreak(h.history || {});
            const total = Object.keys(h.history || {}).length;
            row.innerHTML = `
                <span class="ah-name">${escapeHtml(h.name)}</span>
                <span class="ah-meta">${escapeHtml(h.category || '📦')} · ${total} done · 🔥 ${streak}d</span>
            `;
            listEl.appendChild(row);
        });
    }

    const isSelf = username === currentUser;
    document.getElementById('admin-modal-toggle-role').disabled = isSelf;
    document.getElementById('admin-modal-delete').disabled = isSelf;

    const modal = document.getElementById('admin-user-modal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
}

function closeAdminModal() {
    const modal = document.getElementById('admin-user-modal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    adminModalUsername = null;
}

async function adminResetPassword(username) {
    const users = getUsers();
    if (!users[username]) return;
    const newPass = prompt(`New password for "${username}" (min 6 chars):`);
    if (newPass === null) return;
    if (newPass.length < 6) return alert('Password must be at least 6 characters.');

    users[username].hash = await hashPassword(newPass);
    saveUsers(users);
    showToast(`Password reset for "${username}"`, 'success');
    renderAdminUsers();
}

function adminToggleRole(username) {
    if (username === currentUser) {
        showToast('You cannot change your own role', 'error');
        return;
    }
    const users = getUsers();
    if (!users[username]) return;
    const newRole = users[username].role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change role of "${username}" to ${newRole}?`)) return;

    users[username].role = newRole;
    saveUsers(users);
    showToast(`"${username}" is now ${newRole}`, 'success');
    renderAdminUsers();
    if (adminModalUsername === username) openAdminUserModal(username);
}

function adminDeleteUser(username) {
    if (username === currentUser) {
        showToast('You cannot delete your own account', 'error');
        return;
    }
    if (!confirm(`Delete user "${username}" and ALL their data? This cannot be undone.`)) return;

    const users = getUsers();
    delete users[username];
    saveUsers(users);

    ['habits', 'userProfile', 'achievements', 'habitNotes'].forEach(prefix => {
        localStorage.removeItem(`${prefix}_${username}`);
    });

    showToast(`User "${username}" deleted`, 'error');
    closeAdminModal();
    renderAdminStats();
    renderAdminUsers();
}

function initAdmin() {
    renderAdminStats();
    renderAdminUsers();
}

function bindAdminUI() {
    const modal = document.getElementById('admin-user-modal');
    modal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeAdminModal));

    document.getElementById('admin-modal-reset').addEventListener('click', () => {
        if (adminModalUsername) adminResetPassword(adminModalUsername);
    });
    document.getElementById('admin-modal-toggle-role').addEventListener('click', () => {
        if (adminModalUsername) adminToggleRole(adminModalUsername);
    });
    document.getElementById('admin-modal-delete').addEventListener('click', () => {
        if (adminModalUsername) adminDeleteUser(adminModalUsername);
    });

    document.getElementById('admin-refresh').addEventListener('click', () => {
        renderAdminStats();
        renderAdminUsers();
        showToast('Data refreshed', 'success');
    });

    document.getElementById('admin-search').addEventListener('input', (e) => {
        adminSearch = e.target.value.trim().toLowerCase();
        renderAdminUsers();
    });

    document.getElementById('admin-create-user').addEventListener('click', async () => {
        const username = prompt('New username (min 3 chars):');
        if (username === null) return;
        const trimmed = username.trim();
        if (trimmed.length < 3) return alert('Username must be at least 3 characters.');

        const key = trimmed.toLowerCase();
        const users = getUsers();
        if (users[key]) return alert('Username is already taken.');

        const password = prompt('Password (min 6 chars):');
        if (password === null) return;
        if (password.length < 6) return alert('Password must be at least 6 characters.');

        const roleInput = prompt('Role — type "admin" or "user":', 'user');
        const role = (roleInput || '').toLowerCase() === 'admin' ? 'admin' : 'user';

        users[key] = {
            name: trimmed,
            hash: await hashPassword(password),
            role,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        saveUsers(users);

        showToast(`User "${trimmed}" created (${role})`, 'success');
        renderAdminStats();
        renderAdminUsers();
    });
}