const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const { startDbWorker } = require('./workers/dbWorker');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Make io accessible to routes/workers
app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', apiRoutes);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room user_${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'follower-farming-backend', timestamp: new Date() });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startDbWorker(io);
});

module.exports = { app, server, io };
