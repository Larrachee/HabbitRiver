let habits = [];
let userProfile = { xp: 0, level: 1 };
let unlockedAchievements = [];
let habitNotes = {};

// Preferensi
let soundEnabled = JSON.parse(localStorage.getItem('soundEnabled')) ?? true;
let themeMode = localStorage.getItem('themeMode') || 'auto';

// Session
let currentUser = null;
let currentUserRole = null;

// Filter UI
let currentFilter = 'All';
let currentSearch = '';
let adminSearch = '';

// Chart & audio
let progressChart = null;
let audioCtx = null;

// Misc
let lastDeleted = null;
let openModalHabitId = null;
let adminModalUsername = null;
let authMode = 'login';

// Storage keys
const USERS_KEY = 'hr_users';
const SESSION_KEY = 'hr_session';