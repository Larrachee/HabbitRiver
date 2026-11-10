function updateSoundButton() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    const icon = soundEnabled ? 'fa-volume-high' : 'fa-volume-xmark';
    const text = soundEnabled ? 'Sound' : 'Muted';
    btn.innerHTML = `<i class="fas ${icon}"></i> ${text}`;
    btn.classList.toggle('muted', !soundEnabled);
}

function bindSoundUI() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
        updateSoundButton();
        if (soundEnabled) playSound('complete');
    });
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        const makeBeep = (freq, start, dur, vol = 0.08, wave = 'sine') => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = wave;
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            gain.gain.setValueAtTime(vol, now + start);
            gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
            osc.start(now + start);
            osc.stop(now + start + dur);
        };

        if (type === 'complete') {
            makeBeep(800, 0, 0.15, 0.06);
            makeBeep(1200, 0.05, 0.15, 0.05);
        } else if (type === 'undo') {
            makeBeep(400, 0, 0.15, 0.05, 'triangle');
        } else if (type === 'levelup') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => makeBeep(f, i * 0.1, 0.3, 0.07));
        } else if (type === 'achievement') {
            [659.25, 880].forEach((f, i) => makeBeep(f, i * 0.12, 0.35, 0.07));
        }
    } catch (e) { console.warn('Sound error:', e); }
}