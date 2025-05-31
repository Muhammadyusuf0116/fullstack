
const express = require('express');
const cors = require('cors');
const dotenvv = require('dotenv');
const connectDB = require('./config/db');

dotenvv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());


const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const ustaRoutes = require('./routes/ustaRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/usta', ustaRoutes);
app.use('/api/admin', adminRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`\x1b[32m Server ${PORT}-portda ishlamoqda \x1b[0m`));
