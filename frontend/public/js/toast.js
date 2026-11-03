function showToast(message, type = 'success', duration = 3000, action = null) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
        success: 'fa-check-circle', error: 'fa-exclamation-circle',
        'level-up': 'fa-star', achievement: 'fa-medal'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.success}" style="color: var(--secondary-color);"></i>
        <span>${escapeHtml(message)}</span>
        ${action ? '<button type="button" class="toast-action">' + escapeHtml(action.label) + '</button>' : ''}
        <button type="button" class="toast-close">&times;</button>
    `;
    container.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
    if (action) {
        toast.querySelector('.toast-action').addEventListener('click', () => {
            action.onClick();
            toast.remove();
        });
    }

    if (duration > 0) {
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            setTimeout(() => toast.remove(), 260);
        }, duration);
    }
}