function isAuthed() {
    return !!(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY));
}

function getCurrentUsername() {
    return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || '';
}

async function hashPassword(text) {
    if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return btoa(unescape(encodeURIComponent(text)));
}

async function ensureAdmin() {
    const users = getUsers();
    if (!users['admin']) {
        users['admin'] = {
            name: 'admin',
            hash: await hashPassword('admin123'),
            role: 'admin',
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        saveUsers(users);
    }
}

function markLastLogin(username) {
    const users = getUsers();
    if (users[username]) {
        users[username].lastLogin = new Date().toISOString();
        saveUsers(users);
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
function startSession(username, role, remember) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, username);
    currentUser = username;
    currentUserRole = role;
    markLastLogin(username);
    loadUserData(username);
}

function logout() {
    if (currentUser && currentUserRole === 'user') saveUserData(currentUser);

    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);

    currentUser = null;
    currentUserRole = null;
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

        const users = getUsers();
        const key = username.toLowerCase();

        if (authMode === 'register') {
            if (username.length < 3)          return setAuthMessage('Username must be at least 3 characters.');
            if (password.length < 6)          return setAuthMessage('Password must be at least 6 characters.');
            if (password !== confirmEl.value) return setAuthMessage('Passwords do not match.');
            if (users[key])                   return setAuthMessage('Username is already taken.');

            const newUser = {
                name: username,
                hash: await hashPassword(password),
                role: 'user',
                createdAt: new Date().toISOString(),
                lastLogin: null
            };
            users[key] = newUser;
            saveUsers(users);

            startSession(username, newUser.role, rememberEl.checked);
            setAuthMessage('Account created! Loading…', 'success');
            setTimeout(() => {
                if (newUser.role === 'admin') showAdminScreen();
                else showAppScreen();
            }, 400);
        } else {
            const user = users[key];
            if (!user || user.hash !== await hashPassword(password)) {
                return setAuthMessage('Wrong username or password.');
            }
            startSession(user.name, user.role, rememberEl.checked);
            setAuthMessage(`Welcome back, ${user.name}!`, 'success');
            setTimeout(() => {
                if (user.role === 'admin') showAdminScreen();
                else showAppScreen();
            }, 400);
        }
    });
}