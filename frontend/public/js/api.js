const TOKEN_KEY = 'hr_token';

function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
}
function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
}
function setToken(token, remember) {
    clearToken();
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (getToken()) headers.Authorization = 'Bearer ' + getToken();

    const res = await fetch('/api' + path, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    let data = null;
    try { data = await res.json(); } catch {}

    // sesi kedaluwarsa: bersihkan dan kembali ke halaman login
    if (res.status === 401 && getToken()) {
        clearToken();
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        location.reload();
    }
    if (res.status === 429) throw new Error('Terlalu banyak percobaan, coba lagi nanti.');
    if (!res.ok) throw new Error((data && data.error) || 'Request gagal');
    return data;
}
