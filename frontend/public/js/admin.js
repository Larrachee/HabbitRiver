let adminUsers = [];

async function loadAdminUsers() {
    try { adminUsers = await api('/admin/users?today=' + getTodayStr()); }
    catch (e) { showToast(e.message, 'error'); }
}

function computeAdminStats() {
    return {
        totalUsers:  adminUsers.length,
        totalAdmins: adminUsers.filter(u => u.role === 'admin').length,
        totalHabits: adminUsers.reduce((n, u) => n + u.habits, 0),
        activeToday: adminUsers.filter(u => u.completedToday > 0).length
    };
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

    const rows = adminUsers.filter(u => !adminSearch || u.username.toLowerCase().includes(adminSearch));

    if (rows.length === 0) { empty.hidden = false; return; }
    empty.hidden = true;

    rows.forEach(u => {
        const tr = document.createElement('tr');
        const self = u.username === currentUser;
        if (self) tr.classList.add('is-self');

        tr.innerHTML = `
            <td>${escapeHtml(u.username)}${self ? ' <span class="badge-role role-admin" style="margin-left:6px;">you</span>' : ''}</td>
            <td><span class="badge-role ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${escapeHtml(u.role)}</span></td>
            <td class="mono">${formatDate(u.createdAt)}</td>
            <td class="mono">${formatDateTime(u.lastLogin)}</td>
            <td class="mono">${u.habits}</td>
            <td class="mono">Lv.${u.level}</td>
            <td class="mono">${u.totalXp}</td>
            <td class="mono">${u.bestStreak}</td>
            <td class="col-actions">
                <button class="row-action" data-action="view" title="View details"><i class="fas fa-eye"></i></button>
                <button class="row-action" data-action="reset" title="Reset password"><i class="fas fa-key"></i></button>
                <button class="row-action" data-action="role" title="Toggle role" ${self ? 'disabled' : ''}><i class="fas fa-user-shield"></i></button>
                <button class="row-action danger" data-action="delete" title="Delete user" ${self ? 'disabled' : ''}><i class="fas fa-trash"></i></button>
            </td>
        `;

        tr.querySelectorAll('.row-action').forEach(btn => {
            btn.addEventListener('click', () => handleAdminAction(btn.dataset.action, u.id));
        });
        tbody.appendChild(tr);
    });
}

function handleAdminAction(action, id) {
    if (action === 'view')   return openAdminUserModal(id);
    if (action === 'reset')  return adminResetPassword(id);
    if (action === 'role')   return adminToggleRole(id);
    if (action === 'delete') return adminDeleteUser(id);
}

async function openAdminUserModal(id) {
    const u = adminUsers.find(x => x.id === id);
    if (!u) return;

    let habitsList = [];
    try { habitsList = (await api('/admin/users/' + id)).habits || []; }
    catch (e) { return showToast(e.message, 'error'); }

    adminModalUsername = id;   // menyimpan id user
    document.getElementById('admin-modal-role').textContent  = u.role;
    document.getElementById('admin-modal-title').textContent = u.username;
    document.getElementById('admin-modal-sub').textContent   =
        `Registered ${formatDate(u.createdAt)} · Last login ${formatDateTime(u.lastLogin)}`;

    document.getElementById('admin-modal-stats').innerHTML = `
        <div class="modal-stat"><div class="ms-value">${u.habits}</div><span class="ms-label">Habits</span></div>
        <div class="modal-stat"><div class="ms-value">${u.level}</div><span class="ms-label">Level</span></div>
        <div class="modal-stat"><div class="ms-value">${u.totalXp}</div><span class="ms-label">Total XP</span></div>
        <div class="modal-stat"><div class="ms-value">${u.bestStreak}</div><span class="ms-label">Best streak</span></div>
    `;

    const listEl = document.getElementById('admin-modal-habits');
    listEl.innerHTML = '';
    if (habitsList.length === 0) {
        listEl.innerHTML = `<div class="empty-state" style="padding:24px 0;"><i class="fas fa-inbox"></i><p>No habits yet.</p></div>`;
    } else {
        habitsList.forEach(h => {
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

    const self = u.username === currentUser;
    document.getElementById('admin-modal-toggle-role').disabled = self;
    document.getElementById('admin-modal-delete').disabled = self;

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

async function refreshAdmin() {
    await loadAdminUsers();
    renderAdminStats();
    renderAdminUsers();
}

async function adminResetPassword(id) {
    const u = adminUsers.find(x => x.id === id);
    if (!u) return;
    const newPass = prompt(`New password for "${u.username}" (min 8 chars):`);
    if (newPass === null) return;
    if (newPass.length < 8) return alert('Password must be at least 8 characters.');
    try {
        await api(`/admin/users/${id}/password`, { method: 'PUT', body: { password: newPass } });
        showToast(`Password reset for "${u.username}"`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

async function adminToggleRole(id) {
    const u = adminUsers.find(x => x.id === id);
    if (!u) return;
    if (u.username === currentUser) return showToast('You cannot change your own role', 'error');
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change role of "${u.username}" to ${newRole}?`)) return;
    try {
        await api(`/admin/users/${id}/role`, { method: 'PATCH', body: { role: newRole } });
        showToast(`"${u.username}" is now ${newRole}`, 'success');
        await refreshAdmin();
        if (adminModalUsername === id) openAdminUserModal(id);
    } catch (e) { showToast(e.message, 'error'); }
}

async function adminDeleteUser(id) {
    const u = adminUsers.find(x => x.id === id);
    if (!u) return;
    if (u.username === currentUser) return showToast('You cannot delete your own account', 'error');
    if (!confirm(`Delete user "${u.username}" and ALL their data? This cannot be undone.`)) return;
    try {
        await api('/admin/users/' + id, { method: 'DELETE' });
        showToast(`User "${u.username}" deleted`, 'error');
        closeAdminModal();
        await refreshAdmin();
    } catch (e) { showToast(e.message, 'error'); }
}

function initAdmin() {
    refreshAdmin();
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

    document.getElementById('admin-refresh').addEventListener('click', async () => {
        await refreshAdmin();
        showToast('Data refreshed', 'success');
    });

    document.getElementById('admin-search').addEventListener('input', (e) => {
        adminSearch = e.target.value.trim().toLowerCase();
        renderAdminUsers();
    });

    document.getElementById('admin-create-user').addEventListener('click', async () => {
        const username = prompt('New username (3-30 chars, letters/numbers/underscore):');
        if (username === null) return;
        const password = prompt('Password (min 8 chars):');
        if (password === null) return;
        const roleInput = prompt('Role — type "admin" or "user":', 'user');
        const role = (roleInput || '').toLowerCase() === 'admin' ? 'admin' : 'user';

        try {
            await api('/admin/users', { method: 'POST', body: { username: username.trim(), password, role } });
            showToast(`User "${username.trim()}" created (${role})`, 'success');
            await refreshAdmin();
        } catch (e) { showToast(e.message === 'Input tidak valid' ? 'Invalid username or password' : e.message, 'error'); }
    });
}
