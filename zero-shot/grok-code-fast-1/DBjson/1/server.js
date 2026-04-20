const express = require('express');
const { authenticateToken, authorize } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const dynamicRoutes = require('./routes/dynamic');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Auth routes (no auth required)
app.use('/auth', authRoutes);

// Dynamic routes (auth required)
app.use('/:resource', authenticateToken, authorize, dynamicRoutes);

// Special handling for root
app.get('/', (req, res) => {
  res.json({ message: 'Dynamic REST API', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});