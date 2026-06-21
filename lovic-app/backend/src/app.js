require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const fs          = require('fs');

const app = express();

// Uploads dir
const uploadPath = process.env.UPLOAD_PATH || 'uploads/';
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true }));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(uploadPath)));

// Routes
app.use('/auth',          require('./routes/auth'));
app.use('/food',          require('./routes/food'));
app.use('/dashboard',     require('./routes/dashboard'));
app.use('/measurements',  require('./routes/measurements'));
app.use('/bioimpedance',  require('./routes/bioimpedance'));
app.use('/trainer',       require('./routes/trainer'));

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Imagen demasiado grande (máx 10MB)' });
  res.status(500).json({ error: err.message || 'Error interno' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Lovic API corriendo en puerto ${PORT}`));

module.exports = app;
