const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');


dotenv.config();

const connectDB=require("./src/config/database");
const errorHandler = require('./src/middleware/errorMiddleware');

const app = express();

// Connect to the database

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes

// Auth routes
app.use('/api/v1', require('./src/routes/authRoutes'));

// Default route
app.get('/', (req, res) => {
  res.send('Welcome to BuzzBoard API');
});

// Error handling middleware
app.use(errorHandler);

// handleUndefined routes

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot find ${req.originalUrl} on this server`,
  });
});

// Connect to the database
connectDB().then(() => {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`BuzzBoard is running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});