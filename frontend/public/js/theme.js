const mql = window.matchMedia('(prefers-color-scheme: light)');

function applyTheme() {
    let resolved = themeMode;
    if (themeMode === 'auto') resolved = mql.matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', resolved);
    updateThemeButton();
    if (progressChart) updateChart();
}

function updateThemeButton() {
    const map = {
        auto:  { icon: 'fa-circle-half-stroke', text: 'Auto'  },
        dark:  { icon: 'fa-moon',               text: 'Dark'  },
        light: { icon: 'fa-sun',                text: 'Light' }
    };
    const cfg = map[themeMode] || map.auto;
    const html = `<i class="fas ${cfg.icon}"></i> ${cfg.text}`;
    ['theme-toggle', 'auth-theme-toggle', 'admin-theme-toggle'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });
}

function cycleTheme() {
    themeMode = themeMode === 'auto' ? 'dark' : themeMode === 'dark' ? 'light' : 'auto';
    localStorage.setItem('themeMode', themeMode);
    applyTheme();
}

function bindThemeUI() {
    document.getElementById('theme-toggle')?.addEventListener('click', cycleTheme);
    document.getElementById('auth-theme-toggle')?.addEventListener('click', cycleTheme);
    document.getElementById('admin-theme-toggle')?.addEventListener('click', cycleTheme);
    mql.addEventListener('change', () => { if (themeMode === 'auto') applyTheme(); });
    applyTheme();
}