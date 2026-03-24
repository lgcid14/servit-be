const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const ticketRoutes = require('./routes/ticketRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const configRoutes = require('./routes/configRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const mediaRoutes = require('./routes/mediaRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    process.env.FRONTEND_URL
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.use(express.json());

// Expose static media files
app.use('/media', express.static('public/media'));

// Routes
app.use('/api/tickets', ticketRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/config', configRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/media', mediaRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Create simulated webhook endpoint to receive updates back from n8n (Optional but useful for async processing)
app.post('/api/webhooks/n8n/update', (req, res) => {
    console.log('Received update from n8n:', req.body);
    res.status(200).json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
