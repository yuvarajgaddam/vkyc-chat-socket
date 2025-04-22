const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
  credentials: true, // Allow credentials
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

// Store active rooms with their metadata
const rooms = new Map(); // Using Map for easier cleanup

// Function to clean up empty rooms
const cleanUpRooms = () => {
  const now = Date.now();
  for (const [roomId, roomData] of rooms.entries()) {
    if (roomData.expiresAt <= now || roomData.users.length === 0) {
      console.log(`Cleaning up room: ${roomId}`);
      rooms.delete(roomId);
    }
  }
};

// Run cleanup every hour
setInterval(cleanUpRooms, 60 * 60 * 1000);

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Create a new room
  socket.on('create_room', ({ username, room }) => {
    if (rooms.has(room)) {
      socket.emit('room_error', {
        message: `Room "${room}" already exists. Please choose a different name.`
      });
      return;
    }

    // Create new room with 24-hour expiration
    rooms.set(room, {
      users: [],
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours from now
    });

    console.log(`Room created: ${room} by ${username}`);
    socket.emit('room_created', { room });
    
    // Automatically join the creator to the room
    socket.emit('join_room', { username, room });
  });

  // Join an existing room
  socket.on('join_room', ({ username, room }) => {
    if (!rooms.has(room)) {
      socket.emit('room_error', {
        message: `Room "${room}" doesn't exist.`
      });
      return;
    }

    const roomData = rooms.get(room);
    
    // Check if username is already taken in this room
    if (roomData.users.some(user => user.username === username)) {
      socket.emit('room_error', {
        message: `Username "${username}" is already taken in this room.`
      });
      return;
    }

    // Add user to room
    roomData.users.push({ id: socket.id, username });
    rooms.set(room, roomData); // Update room data

    socket.join(room);
    console.log(`${username} joined room: ${room}`);

    // Notify room about new user
    io.to(room).emit('user_joined', {
      username,
      room,
      users: roomData.users.map(u => u.username)
    });

    // Send welcome message to the user
    socket.emit('message', {
      username: 'System',
      text: `Welcome to room ${room}, ${username}!`,
      timestamp: new Date()
    });

    // Send room info
    socket.emit('room_info', {
      room,
      createdAt: roomData.createdAt,
      expiresAt: roomData.expiresAt,
      userCount: roomData.users.length
    });
  });

  // Handle chat messages
  socket.on('send_message', ({ room, username, text }) => {
    if (!rooms.has(room)) {
      socket.emit('room_error', {
        message: `Room "${room}" doesn't exist anymore.`
      });
      return;
    }

    const message = {
      username,
      text,
      timestamp: new Date()
    };
    io.to(room).emit('message', message);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Remove user from all rooms
    for (const [room, roomData] of rooms.entries()) {
      const userIndex = roomData.users.findIndex(user => user.id === socket.id);
      if (userIndex !== -1) {
        const username = roomData.users[userIndex].username;
        roomData.users.splice(userIndex, 1);
        
        // Update room data
        rooms.set(room, roomData);
        
        // Notify room about user leaving
        io.to(room).emit('user_left', {
          username,
          users: roomData.users.map(u => u.username)
        });
      }
    }
  });

  // List available rooms
  socket.on('list_rooms', () => {
    const roomList = Array.from(rooms.entries()).map(([roomId, roomData]) => ({
      name: roomId,
      userCount: roomData.users.length,
      createdAt: roomData.createdAt,
      expiresAt: roomData.expiresAt
    }));
    socket.emit('room_list', roomList);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});