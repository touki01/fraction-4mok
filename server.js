// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const SIZE = 7;
let players = {};
let sockets = [];
let board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
let currentPlayer = 1;
let gameOver = false;

function checkWin(r, c, player) {
  const directions = [
    [1, 0], [0, 1], [1, 1], [1, -1]
  ];
  for (let [dr, dc] of directions) {
    let count = 1;
    for (let dir of [-1, 1]) {
      let nr = r + dr * dir;
      let nc = c + dc * dir;
      while (
        nr >= 0 && nr < SIZE &&
        nc >= 0 && nc < SIZE &&
        board[nr][nc] === player
      ) {
        count++;
        nr += dr * dir;
        nc += dc * dir;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}

io.on('connection', (socket) => {
  console.log('🔌 New connection:', socket.id);

  if (sockets.length >= 2) {
    socket.emit('full');
    return;
  }

  sockets.push(socket);
  const assignedPlayer = sockets.length;
  players[socket.id] = assignedPlayer;
  socket.emit('playerNumber', assignedPlayer);
  io.emit('boardUpdate', { board, currentPlayer });

  socket.on('submit', ({ row, col }) => {
    if (gameOver || board[row][col] !== null || players[socket.id] !== currentPlayer) return;

    board[row][col] = currentPlayer;
    io.emit('moveMade', { row, col, player: currentPlayer });

    if (checkWin(row, col, currentPlayer)) {
      io.emit('gameOver', { winner: currentPlayer });
      gameOver = true;
    } else {
      currentPlayer = currentPlayer === 1 ? 2 : 1;
      io.emit('turnUpdate', currentPlayer);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    delete players[socket.id];
    sockets = sockets.filter(s => s.id !== socket.id);
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    currentPlayer = 1;
    gameOver = false;
    io.emit('reset');
  });
});

server.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});