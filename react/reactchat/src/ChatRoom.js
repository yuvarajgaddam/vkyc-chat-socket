import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:4000');

function ChatRoom() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [roomInfo, setRoomInfo] = useState(null);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [error, setError] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on('message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('user_joined', (data) => {
      setUsers(data.users);
      setMessages(prev => [...prev, {
        username: 'System',
        text: `${data.username} joined the room`,
        timestamp: new Date()
      }]);
    });

    socket.on('user_left', (data) => {
      setUsers(data.users);
      setMessages(prev => [...prev, {
        username: 'System',
        text: `${data.username} left the room`,
        timestamp: new Date()
      }]);
    });

    socket.on('room_info', (info) => {
      setRoomInfo(info);
    });

    socket.on('room_list', (rooms) => {
      setAvailableRooms(rooms);
    });

    socket.on('room_error', (error) => {
      setError(error.message);
    });

    return () => {
      socket.off('message');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('room_info');
      socket.off('room_list');
      socket.off('room_error');
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createRoom = () => {
    if (!username || !room) {
      setError('Username and room name are required');
      return;
    }
    socket.emit('create_room', { username, room });
  };

  const joinRoom = () => {
    if (!username || !room) {
      setError('Username and room name are required');
      return;
    }
    socket.emit('join_room', { username, room });
    setIsInRoom(true);
  };

  const sendMessage = () => {
    if (!message) return;
    socket.emit('send_message', { room, username, text: message });
    setMessage('');
  };

  const listRooms = () => {
    socket.emit('list_rooms');
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatExpiration = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const hoursLeft = Math.round((expires - now) / (1000 * 60 * 60));
    return `${hoursLeft} hours`;
  };

  return (
    <div className="chat-container">
      <h1>Chat App</h1>
      
      {!isInRoom ? (
        <div className="room-setup">
          <input
            type="text"
            placeholder="Your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="text"
            placeholder="Room name"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
          <button onClick={createRoom}>Create Room</button>
          <button onClick={joinRoom}>Join Room</button>
          <button onClick={listRooms}>List Rooms</button>
          
          {error && <div className="error">{error}</div>}
          
          {availableRooms.length > 0 && (
            <div className="room-list">
              <h3>Available Rooms</h3>
              <ul>
                {availableRooms.map(r => (
                  <li key={r.name}>
                    {r.name} ({r.userCount} users) - Expires in {formatExpiration(r.expiresAt)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="chat-room">
          <div className="room-header">
            <h2>Room: {room}</h2>
            {roomInfo && (
              <div className="room-meta">
                <span>Created: {new Date(roomInfo.createdAt).toLocaleString()}</span>
                <span>Expires in: {formatExpiration(roomInfo.expiresAt)}</span>
                <span>Users: {roomInfo.userCount}</span>
              </div>
            )}
          </div>
          
          <div className="messages">
            {messages.map((msg, i) => (
              <div key={i} className="message">
                <span className="message-time">{formatTime(msg.timestamp)}</span>
                <span className="message-user">{msg.username}:</span>
                <span className="message-text">{msg.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="message-input">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>
          
          <div className="user-list">
            <h3>Online Users ({users.length})</h3>
            <ul>
              {users.map((user, i) => (
                <li key={i}>{user}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatRoom;