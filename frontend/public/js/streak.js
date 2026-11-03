function calculateStreak(history) {
    let streak = 0;
    const cursor = new Date();
    if (!history[getTodayStr()]) cursor.setDate(cursor.getDate() - 1);
    while (true) {
        const dateStr = cursor.toISOString().split('T')[0];
        if (history[dateStr]) { streak++; cursor.setDate(cursor.getDate() - 1); }
        else break;
    }
    return streak;
}

function getBestStreak(history) {
    const dates = Object.keys(history || {}).sort();
    if (!dates.length) return 0;
    let best = 1, cur = 1;
    for (let i = 1; i < dates.length; i++) {
        const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
        if (diff === 1) { cur++; best = Math.max(best, cur); }
        else if (diff > 1) cur = 1;
    }
    return best;
}