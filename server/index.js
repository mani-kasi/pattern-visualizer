const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set.');
}

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: false,
}));
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  })
);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image uploads are allowed.'));
  }
};

const upload = multer({ storage, fileFilter });

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Missing authorization token.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

function buildShareUrl(req, slug) {
  return `${req.protocol}://${req.get('host')}/s/${slug}`;
}

function mapPresetRow(row) {
  return {
    id: row.id,
    name: row.name,
    patternId: row.pattern_id,
    settings: row.settings,
    isPublic: row.is_public,
    shareSlug: row.share_slug,
    createdAt: row.created_at,
  };
}

async function generateUniqueShareSlug() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = crypto.randomBytes(6).toString('hex').slice(0, 10);
    const exists = await pool.query('SELECT 1 FROM presets WHERE share_slug = $1', [slug]);
    if (exists.rows.length === 0) {
      return slug;
    }
  }
  throw new Error('Failed to generate a unique share slug.');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'User already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    const newUser = result.rows[0];
    res.status(201).json({ id: newUser.id, email: newUser.email });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Failed to create user.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const userResult = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = userResult.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Failed to log in.' });
  }
});

app.post('/api/patterns/upload', authenticateToken, upload.single('pattern'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Pattern file is required.' });
  }

  try {
    const storedFilename = req.file.filename;
    const dbResult = await pool.query(
      'INSERT INTO patterns (user_id, filename, uploaded_at) VALUES ($1, $2, NOW()) RETURNING id, filename, uploaded_at',
      [req.user.userId, storedFilename]
    );

    const pattern = dbResult.rows[0];
    res.status(201).json({
      id: pattern.id,
      filename: pattern.filename,
      uploadedAt: pattern.uploaded_at,
      url: `/uploads/${pattern.filename}`,
    });
  } catch (error) {
    console.error('Pattern upload error:', error);
    res.status(500).json({ message: 'Failed to save pattern metadata.' });
  }
});

app.get('/api/patterns', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, filename, uploaded_at FROM patterns WHERE user_id = $1 ORDER BY uploaded_at DESC',
      [req.user.userId]
    );

    const patterns = result.rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      uploadedAt: row.uploaded_at,
      url: `/uploads/${row.filename}`,
    }));

    res.json(patterns);
  } catch (error) {
    console.error('Fetch patterns error:', error);
    res.status(500).json({ message: 'Failed to fetch patterns.' });
  }
});

app.post('/api/presets', authenticateToken, async (req, res) => {
  const { name, patternId, settings } = req.body;

  if (!isNonEmptyString(name) || !isNonEmptyString(patternId) || !settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return res.status(400).json({ message: 'Preset name, patternId, and settings are required.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO presets (user_id, name, pattern_id, settings) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.userId, name.trim(), patternId, settings]
    );
    res.status(201).json(mapPresetRow(result.rows[0]));
  } catch (error) {
    console.error('Create preset error:', error);
    res.status(500).json({ message: 'Failed to save preset.' });
  }
});

app.get('/api/presets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM presets WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows.map(mapPresetRow));
  } catch (error) {
    console.error('Fetch presets error:', error);
    res.status(500).json({ message: 'Failed to fetch presets.' });
  }
});

app.get('/api/presets/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM presets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Preset not found.' });
    }
    res.json(mapPresetRow(result.rows[0]));
  } catch (error) {
    console.error('Fetch preset error:', error);
    res.status(500).json({ message: 'Failed to fetch preset.' });
  }
});

app.delete('/api/presets/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM presets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Preset not found.' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete preset error:', error);
    res.status(500).json({ message: 'Failed to delete preset.' });
  }
});

app.post('/api/presets/:id/share', authenticateToken, async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT share_slug FROM presets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Preset not found.' });
    }

    const shareSlug = existing.rows[0].share_slug || (await generateUniqueShareSlug());
    const updated = await pool.query(
      'UPDATE presets SET is_public = true, share_slug = $1 WHERE id = $2 AND user_id = $3 RETURNING share_slug',
      [shareSlug, req.params.id, req.user.userId]
    );

    res.json({ shareSlug: updated.rows[0].share_slug, shareUrl: buildShareUrl(req, shareSlug) });
  } catch (error) {
    console.error('Share preset error:', error);
    res.status(500).json({ message: 'Failed to share preset.' });
  }
});

app.post('/api/presets/:id/unshare', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE presets SET is_public = false WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Preset not found.' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Unshare preset error:', error);
    res.status(500).json({ message: 'Failed to unshare preset.' });
  }
});

app.get('/api/share/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name, pattern_id, settings, is_public FROM presets WHERE share_slug = $1',
      [req.params.slug]
    );
    if (result.rows.length === 0 || !result.rows[0].is_public) {
      return res.status(404).json({ message: 'Shared preset not found.' });
    }

    const preset = result.rows[0];
    let patternUrl = null;

    if (typeof preset.pattern_id === 'string' && preset.pattern_id.startsWith('remote-')) {
      const patternId = Number(preset.pattern_id.replace('remote-', ''));
      if (!Number.isNaN(patternId)) {
        const patternResult = await pool.query('SELECT filename FROM patterns WHERE id = $1', [patternId]);
        if (patternResult.rows.length > 0) {
          patternUrl = `${req.protocol}://${req.get('host')}/uploads/${patternResult.rows[0].filename}`;
        }
      }
    }

    res.json({
      name: preset.name,
      patternId: preset.pattern_id,
      settings: preset.settings,
      patternUrl,
    });
  } catch (error) {
    console.error('Fetch shared preset error:', error);
    res.status(500).json({ message: 'Failed to fetch shared preset.' });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
  res.status(404).json({ message: 'Not found.' });
});

app.listen(PORT, () => {
  console.log(`Pattern Visualizer API listening on port ${PORT}`);
});
