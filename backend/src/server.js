const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { z } = require('zod');

const { MONGO_URI, JWT_SECRET, PORT = 3000 } = process.env;
if (!MONGO_URI || !JWT_SECRET) {
  console.error('MONGO_URI dan JWT_SECRET wajib diisi');
  process.exit(1);
}

// ---------- Model (D1-D4) ----------
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true }));

const Habit = mongoose.model('Habit', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
}, { timestamps: true }));

const logSchema = new mongoose.Schema({
  habitId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
}, { timestamps: true });
logSchema.index({ habitId: 1, date: 1 }, { unique: true });
const HabitLog = mongoose.model('HabitLog', logSchema);

const Audit = mongoose.model('Audit', new mongoose.Schema({
  event: String, userId: String, ip: String, detail: String,
}, { timestamps: { createdAt: true, updatedAt: false } }));

const audit = (event, req, userId, detail = '') =>
  Audit.create({ event, userId: String(userId || ''), ip: req.ip, detail }).catch(() => {});

// ---------- App & keamanan dasar ----------
const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());
app.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

// ---------- Validasi ----------
const authSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(72),
});
const habitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});
const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ error: 'ID tidak valid' });

// ---------- Middleware auth & RBAC (proses 1.5 / 2.1) ----------
const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    audit('TOKEN_INVALID', req);
    res.status(401).json({ error: 'Token tidak valid' });
  }
};
const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : (audit('FORBIDDEN', req, req.user.id, req.originalUrl),
    res.status(403).json({ error: 'Akses ditolak' }));

// ---------- Auth ----------
app.post('/api/auth/register', loginLimiter, async (req, res) => {
  const p = authSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Input tidak valid' });
  try {
    const passwordHash = await bcrypt.hash(p.data.password, 12);
    const u = await User.create({ username: p.data.username, passwordHash }); // role selalu 'user'
    audit('REGISTER', req, u._id);
    res.status(201).json({ message: 'Registrasi berhasil' });
  } catch (e) {
    res.status(e.code === 11000 ? 409 : 500).json({ error: e.code === 11000 ? 'Username sudah dipakai' : 'Server error' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const p = authSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Input tidak valid' });
  const u = await User.findOne({ username: p.data.username });
  const ok = u && await bcrypt.compare(p.data.password, u.passwordHash);
  if (!ok) { audit('LOGIN_FAILED', req, u?._id, p.data.username); return res.status(401).json({ error: 'Username atau password salah' }); }
  const token = jwt.sign({ id: u._id, role: u.role }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  audit('LOGIN_OK', req, u._id);
  res.json({ token });
});

// ---------- Habit (selalu dicek kepemilikan: anti-IDOR) ----------
app.get('/api/habits', auth, async (req, res) =>
  res.json(await Habit.find({ userId: req.user.id })));

app.post('/api/habits', auth, async (req, res) => {
  const p = habitSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Input tidak valid' });
  res.status(201).json(await Habit.create({ ...p.data, userId: req.user.id }));
});

app.put('/api/habits/:id', auth, validId, async (req, res) => {
  const p = habitSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Input tidak valid' });
  const h = await Habit.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, p.data, { new: true });
  h ? res.json(h) : res.status(404).json({ error: 'Habit tidak ditemukan' });
});

app.delete('/api/habits/:id', auth, validId, async (req, res) => {
  const h = await Habit.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!h) return res.status(404).json({ error: 'Habit tidak ditemukan' });
  await HabitLog.deleteMany({ habitId: h._id });
  res.json({ message: 'Habit dihapus' });
});

// ---------- Check-in & statistik (proses 3.0) ----------
const fmt = (d) => d.toISOString().slice(0, 10);

app.post('/api/habits/:id/checkin', auth, validId, async (req, res) => {
  const h = await Habit.findOne({ _id: req.params.id, userId: req.user.id });
  if (!h) return res.status(404).json({ error: 'Habit tidak ditemukan' });
  try {
    await HabitLog.create({ habitId: h._id, userId: req.user.id, date: fmt(new Date()) });
    res.status(201).json({ message: 'Check-in berhasil' });
  } catch (e) {
    res.status(e.code === 11000 ? 409 : 500).json({ error: e.code === 11000 ? 'Sudah check-in hari ini' : 'Server error' });
  }
});

app.get('/api/habits/:id/stats', auth, validId, async (req, res) => {
  const h = await Habit.findOne({ _id: req.params.id, userId: req.user.id });
  if (!h) return res.status(404).json({ error: 'Habit tidak ditemukan' });
  const logs = await HabitLog.find({ habitId: h._id });
  const set = new Set(logs.map((l) => l.date));
  const d = new Date();
  if (!set.has(fmt(d))) d.setUTCDate(d.getUTCDate() - 1);
  let streak = 0;
  while (set.has(fmt(d))) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
  res.json({ totalCheckin: logs.length, streak });
});

// ---------- Admin (proses 4.0) ----------
app.get('/api/admin/users', auth, requireRole('admin'), async (req, res) =>
  res.json(await User.find().select('-passwordHash')));

app.patch('/api/admin/users/:id/role', auth, requireRole('admin'), validId, async (req, res) => {
  const p = z.object({ role: z.enum(['user', 'admin']) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Input tidak valid' });
  const u = await User.findByIdAndUpdate(req.params.id, { role: p.data.role }, { new: true }).select('-passwordHash');
  if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
  audit('ROLE_CHANGED', req, req.user.id, `${u.username} -> ${p.data.role}`);
  res.json(u);
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

mongoose.connect(MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`API berjalan di port ${PORT}`)))
  .catch((e) => { console.error('Gagal konek MongoDB', e.message); process.exit(1); });
