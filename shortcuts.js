function bindShortcuts() {
    document.addEventListener('keydown', (e) => {
        const tag = (e.target.tagName || '').toLowerCase();
        const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

        if (e.key === 'Escape') {
            if (typing) { e.target.blur(); return; }
            const habitModal = document.getElementById('habit-modal');
            const adminModal = document.getElementById('admin-user-modal');
            if (habitModal.classList.contains('open')) { closeModal(); return; }
            if (adminModal.classList.contains('open')) { closeAdminModal(); return; }
        }
        if (typing) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        if (e.key === 't' || e.key === 'T') { cycleTheme(); return; }

        // App shortcuts
        if (!document.getElementById('app-screen').hidden) {
            if (e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                const input = document.getElementById('habit-name');
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (e.key === '/') {
                e.preventDefault();
                const search = document.getElementById('habit-search');
                search.focus();
                search.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // Admin shortcuts
        if (!document.getElementById('admin-screen').hidden) {
            if (e.key === '/') {
                e.preventDefault();
                document.getElementById('admin-search').focus();
            }
        }
    });
}