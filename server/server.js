// server.js with 통분 기능
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
const rooms = {};

function getGCD(a, b) {
  return b === 0 ? a : getGCD(b, a % b);
}

function getRandomFraction() {
  let num, den, gcd;
  do {
    num = Math.floor(Math.random() * 4 + 1);
    den = Math.floor(Math.random() * 5 + 2);
    gcd = getGCD(num, den);
  } while (gcd !== 1 || num >= den);
  return { n: num, d: den };
}

function getTwoDistinctFractions() {
  let f1, f2;
  do {
    f1 = getRandomFraction();
    f2 = getRandomFraction();
  } while (
    f1.d === f2.d ||
    f1.n * f2.d === f2.n * f1.d
  );
  return [f1, f2];
}

function checkWin(board, r, c, player) {
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

  socket.on('joinRoom', (roomCode) => {
    socket.join(roomCode);
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        board: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
        data: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
        sockets: [],
        players: {},
        currentPlayer: 1,
        gameOver: false
      };
    }

    const room = rooms[roomCode];
    if (room.sockets.length >= 2) {
      socket.emit('full');
      return;
    }

    room.sockets.push(socket);
    room.players[socket.id] = room.sockets.length;
    socket.emit('playerNumber', room.players[socket.id]);

    // 각 칸마다 분수 2개 생성
    if (!room.initialized) {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          room.data[r][c] = getTwoDistinctFractions();
        }
      }
      room.initialized = true;
    }

    io.to(roomCode).emit('boardInit', {
      board: room.board,
      data: room.data,
      currentPlayer: room.currentPlayer,
      count: room.sockets.length
    });

    socket.on('submit', ({ row, col, answers }) => {
      if (room.gameOver || room.board[row][col] !== null || room.players[socket.id] !== room.currentPlayer) return;
      const [f1, f2] = room.data[row][col];
      const [a1, a2] = answers; // answers: [{n, d}, {n, d}]
      const lcm = f1.d * f2.d / getGCD(f1.d, f2.d);
      const correct =
        a1.d === lcm && a2.d === lcm &&
        a1.n === f1.n * (lcm / f1.d) &&
        a2.n === f2.n * (lcm / f2.d);

      if (correct) {
        room.board[row][col] = room.currentPlayer;
        io.to(roomCode).emit('moveMade', {
          row, col,
          player: room.currentPlayer
        });

        if (checkWin(room.board, row, col, room.currentPlayer)) {
          io.to(roomCode).emit('gameOver', {
            winner: room.currentPlayer
          });
          room.gameOver = true;
        } else {
          room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
          io.to(roomCode).emit('turnUpdate', room.currentPlayer);
        }
      } else {
        socket.emit('wrong');
      }
    });

    socket.on('disconnect', () => {
      room.sockets = room.sockets.filter(s => s.id !== socket.id);
      delete room.players[socket.id];
      io.to(roomCode).emit('reset');
    });
  });
});

server.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
