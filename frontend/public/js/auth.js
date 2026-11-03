function isAuthed() {
    return !!getToken();
}

function getCurrentUsername() {
    return currentUser || localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || '';
}

// Akun admin kini dibuat server dari .env; fungsi dibiarkan kosong agar main.js lama tidak error
async function ensureAdmin() {}
function markLastLogin() {}

function clearSession() {
    clearToken();
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
}

// Dipanggil saat halaman dibuka ulang: pulihkan sesi dari token
async function restoreSession() {
    if (!getToken()) return false;
    try {
        const me = await api('/me');
        currentUser = me.username;
        currentUserRole = me.role;
        if (me.role !== 'admin') await loadUserData();
        return true;
    } catch {
        clearSession();
        return false;
    }
}

// ---------- screen switching ----------
function hideAllScreens() {
    document.getElementById('auth-screen').hidden  = true;
    document.getElementById('app-screen').hidden   = true;
    document.getElementById('admin-screen').hidden = true;
}

function showAuthScreen() {
    hideAllScreens();
    document.getElementById('auth-screen').hidden = false;
}

function showAppScreen() {
    hideAllScreens();
    document.getElementById('app-screen').hidden = false;

    const user = getCurrentUsername();
    if (user) {
        document.getElementById('user-initial').textContent = user.charAt(0).toUpperCase();
        document.getElementById('user-name').textContent = user;
        document.getElementById('profile-avatar').textContent = user.slice(0, 2).toUpperCase();
    }

    if (!window.__appInited) {
        window.__appInited = true;
        initApp();
    }
}

function showAdminScreen() {
    hideAllScreens();
    document.getElementById('admin-screen').hidden = false;

    const user = getCurrentUsername();
    if (user) {
        document.getElementById('admin-initial').textContent = user.charAt(0).toUpperCase();
        document.getElementById('admin-name').textContent = user;
    }

    initAdmin();
}

// ---------- session ----------
async function startSession(username, role, remember) {
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, username);
    currentUser = username;
    currentUserRole = role;
    if (role !== 'admin') await loadUserData();
}

async function logout() {
    try { if (currentUserRole !== 'admin') await flushUserData(); } catch {}
    clearSession();

    currentUser = null;
    currentUserRole = null;
    habits = [];
    window.__appInited = false;

    showAuthScreen();
    document.getElementById('auth-form').reset();
    setAuthMessage('');
}

// ---------- auth form ----------
function setAuthMode(newMode) {
    authMode = newMode;
    const isLogin = authMode === 'login';
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);
    document.getElementById('auth-confirm-field').classList.toggle('hidden', isLogin);
    document.getElementById('auth-remember-row').classList.toggle('hidden', !isLogin);
    document.getElementById('auth-submit-text').textContent = isLogin ? 'Login' : 'Create Account';
    document.getElementById('auth-password').autocomplete = isLogin ? 'current-password' : 'new-password';
    setAuthMessage('');
}

function setAuthMessage(text, type = 'error') {
    const el = document.getElementById('auth-message');
    el.textContent = text;
    el.className = `message ${type}`;
}

function bindAuthUI() {
    document.getElementById('tab-login').addEventListener('click',    () => setAuthMode('login'));
    document.getElementById('tab-register').addEventListener('click', () => setAuthMode('register'));

    const togglePass = document.getElementById('auth-toggle-pass');
    const passwordEl = document.getElementById('auth-password');
    togglePass.addEventListener('click', () => {
        const isHidden = passwordEl.type === 'password';
        passwordEl.type = isHidden ? 'text' : 'password';
        togglePass.innerHTML = `<i class="fas ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Logout from HabitRiver?')) logout();
    });

    document.getElementById('admin-logout-btn').addEventListener('click', () => {
        if (confirm('Logout from admin?')) logout();
    });

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const usernameEl = document.getElementById('auth-username');
        const confirmEl  = document.getElementById('auth-confirm');
        const rememberEl = document.getElementById('auth-remember');

        const username = usernameEl.value.trim();
        const password = passwordEl.value;

        if (!username || !password) return setAuthMessage('Username and password are required.');

        try {
            if (authMode === 'register') {
                if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return setAuthMessage('Username: 3-30 characters, letters, numbers, underscore only.');
                if (password.length < 8)          return setAuthMessage('Password must be at least 8 characters.');
                if (password !== confirmEl.value) return setAuthMessage('Passwords do not match.');

                await api('/auth/register', { method: 'POST', body: { username, password } });
            }

            const data = await api('/auth/login', { method: 'POST', body: { username, password } });
            const remember = authMode === 'register' ? false : rememberEl.checked;
            setToken(data.token, remember);
            await startSession(data.username, data.role, remember);

            setAuthMessage(authMode === 'register' ? 'Account created! Loading…' : `Welcome back, ${data.username}!`, 'success');
            setTimeout(() => {
                if (data.role === 'admin') showAdminScreen();
                else showAppScreen();
            }, 400);
        } catch (err) {
            setAuthMessage(err.message === 'Input tidak valid' ? 'Invalid input.' : err.message);
        }
    });
}
