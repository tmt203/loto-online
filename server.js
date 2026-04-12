// server.ts
import express from "express";
import { createServer } from "http";

// src/lib/server/socketHandler.ts
import { Server } from "socket.io";
var players = /* @__PURE__ */ new Map();
var INITIAL_BALANCE = 500;
var usedNumbers = /* @__PURE__ */ new Set();
var hostId = null;
var currentPot = 0;
var currentTicketPrice = 0;
var gameState = "IDLE";
function injectSocketIO(server2) {
  const io = new Server(server2, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  io.on("connection", (socket) => {
    const broadcastGameState = () => {
      const playerList = Array.from(players.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        balance: data.balance,
        hasTicket: data.hasTicket,
        isApproved: data.isApproved,
        isHost: id === hostId
      }));
      io.emit("update-game-state", {
        players: playerList,
        pot: currentPot,
        ticketPrice: currentTicketPrice,
        gameState
      });
    };
    const broadcastSystemLog = (message, type = "info") => {
      io.emit("receive-chat", {
        type: "system",
        subType: type,
        content: message,
        timestamp: Date.now()
      });
    };
    socket.on("join-game", (data) => {
      const { name, secretKey } = data;
      players.set(socket.id, {
        name,
        balance: INITIAL_BALANCE,
        hasTicket: false,
        isApproved: false
      });
      broadcastSystemLog(`\u{1F44B} ${name} v\xE0o s\xF2ng!`, "info");
      if (secretKey === "trantrideptrai") {
        if (hostId && hostId !== socket.id) {
          io.to(hostId).emit("role-update", { isHost: false });
          const oldHost = players.get(hostId);
          if (oldHost)
            broadcastSystemLog(
              `\u26A0\uFE0F ${oldHost.name} b\u1ECB t\u01B0\u1EDBc quy\u1EC1n Nh\xE0 C\xE1i do Ch\xEDnh Ch\u1EE7 \u0111\xE3 xu\u1EA5t hi\u1EC7n!`,
              "warning"
            );
        }
        hostId = socket.id;
        socket.emit("role-update", { isHost: true });
        broadcastSystemLog(`\u{1F451} ${name} \u0111\xE3 \u0111\u0103ng nh\u1EADp quy\u1EC1n Nh\xE0 C\xE1i!`, "success");
      } else {
        socket.emit("role-update", { isHost: false });
      }
      broadcastGameState();
      socket.emit("sync-numbers", Array.from(usedNumbers));
    });
    socket.on("disconnect", () => {
      const player = players.get(socket.id);
      players.delete(socket.id);
      if (player) broadcastSystemLog(`\u{1F3C3} ${player.name} r\u1EDDi s\xF2ng.`, "info");
      if (socket.id === hostId) {
        hostId = null;
        broadcastSystemLog(`\u26A0\uFE0F Nh\xE0 C\xE1i \u0111\xE3 r\u1EDDi \u0111i. C\u1EA7n ng\u01B0\u1EDDi c\xF3 Key \u0111\u1EC3 ti\u1EBFp qu\u1EA3n!`, "error");
      }
      broadcastGameState();
    });
    socket.on("send-chat", (message) => {
      const player = players.get(socket.id);
      io.emit("receive-chat", {
        type: "user",
        sender: player?.name || "Ng\u01B0\u1EDDi l\u1EA1",
        content: message,
        timestamp: Date.now()
      });
    });
    socket.on("host-open-betting", (price) => {
      if (socket.id !== hostId) return;
      currentTicketPrice = price;
      currentPot = 0;
      usedNumbers.clear();
      gameState = "BETTING";
      for (let [_, p] of players) {
        p.hasTicket = false;
        p.isApproved = false;
      }
      io.emit("game-reset");
      broadcastGameState();
      broadcastSystemLog(`\u{1F4E2} M\u1EDE B\xC1N V\xC9: ${price}k/v\xE9. M\u1EA1i d\xF4 m\u1EA1i d\xF4!`, "warning");
    });
    socket.on("buy-ticket", () => {
      if (gameState !== "BETTING") return;
      const p = players.get(socket.id);
      if (!p || p.hasTicket) return;
      if (p.balance >= currentTicketPrice) {
        p.balance -= currentTicketPrice;
        p.hasTicket = true;
        p.isApproved = false;
        currentPot += currentTicketPrice;
        broadcastGameState();
        if (currentTicketPrice >= 10) broadcastSystemLog(`\u{1F3AB} ${p.name} \u0111\xE3 mua v\xE9!`, "info");
      } else {
        p.balance -= currentTicketPrice;
        p.hasTicket = true;
        p.isApproved = false;
        currentPot += currentTicketPrice;
        broadcastGameState();
        broadcastSystemLog(`\u{1F4B8} ${p.name} "b\xE1o" qu\xE1, \xE2m ti\u1EC1n v\u1EABn mua v\xE9!`, "error");
      }
    });
    socket.on("host-approve-player", (playerId) => {
      if (socket.id !== hostId) return;
      const player = players.get(playerId);
      if (player && player.hasTicket && !player.isApproved) {
        player.isApproved = true;
        broadcastGameState();
      }
    });
    socket.on("host-revoke-player", (playerId) => {
      if (socket.id !== hostId) return;
      const player = players.get(playerId);
      if (player && player.hasTicket) {
        if (player.isApproved) {
          player.isApproved = false;
          broadcastGameState();
        } else {
          player.balance += currentTicketPrice;
          currentPot -= currentTicketPrice;
          player.hasTicket = false;
          player.isApproved = false;
          broadcastGameState();
          broadcastSystemLog(`\u274C ${player.name} b\u1ECB "\u0111\xE1" ra kh\u1ECFi ph\xF2ng.`, "warning");
        }
      }
    });
    socket.on("host-start-game", () => {
      if (socket.id !== hostId) return;
      if (currentPot === 0) return;
      gameState = "PLAYING";
      broadcastGameState();
      broadcastSystemLog(`\u{1F512} \u0110\xD3NG S\u1ED4! T\u1ED5ng h\u0169: ${currentPot}k. B\u1EAFt \u0111\u1EA7u quay!`, "success");
    });
    socket.on("call-number", () => {
      if (socket.id !== hostId) return;
      if (gameState !== "PLAYING") return;
      if (usedNumbers.size >= 90) return;
      let num;
      do {
        num = Math.floor(Math.random() * 90) + 1;
      } while (usedNumbers.has(num));
      usedNumbers.add(num);
      io.emit("new-number", num);
    });
    socket.on("request-check-win", (playerSheet) => {
      const player = players.get(socket.id);
      if (!player) return;
      if (!player.hasTicket || !player.isApproved) {
        socket.emit("check-fail");
        broadcastSystemLog(`\u26D4 ${player.name} ch\u01B0a \u0111\u01B0\u1EE3c duy\u1EC7t/mua v\xE9 m\xE0 \u0111\xF2i KINH!`, "error");
        return;
      }
      broadcastSystemLog(`\u{1F440} ${player.name} \u0111ang \u0111\xF2i KINH...`, "warning");
      let isWinner = false;
      for (const row of playerSheet) {
        const numbersInRow = row.filter((n) => n !== null);
        const fullRow = numbersInRow.every((num) => usedNumbers.has(num));
        if (fullRow && numbersInRow.length > 0) {
          isWinner = true;
          break;
        }
      }
      if (isWinner) {
        player.balance += currentPot;
        const winAmount = currentPot;
        currentPot = 0;
        gameState = "IDLE";
        broadcastGameState();
        broadcastSystemLog(`\u{1F3C6} ${player.name} H\u1ED0T TR\u1ECCN H\u0168 ${winAmount}k!!!`, "success");
        io.emit("game-over", { winnerName: player.name, winAmount });
      } else {
        broadcastSystemLog(`\u274C ${player.name} kinh tr\u01B0\u1EE3t! Ph\u1EA1t 1 ly \u{1F37A}!`, "error");
        socket.emit("check-fail");
      }
    });
    socket.on("reset-game", () => {
      if (socket.id !== hostId) return;
      usedNumbers.clear();
      currentPot = 0;
      gameState = "IDLE";
      for (const [_, player] of players) {
        player.hasTicket = false;
        player.isApproved = false;
      }
      io.emit("game-reset");
      broadcastGameState();
      broadcastSystemLog("\u{1F504} Nh\xE0 c\xE1i \u0111\xE3 l\xE0m m\u1EDBi b\xE0n ch\u01A1i. M\u1EDDi set k\xE8o m\u1EDBi!", "warning");
    });
  });
  console.log("\u2705 Socket.io injected!");
}

// server.ts
import { handler } from "./build/handler.js";
var app = express();
var server = createServer(app);
injectSocketIO(server);
app.use(handler);
var PORT = process.env.PORT || 3e3;
server.listen(PORT, () => {
  console.log(`\u{1F680} Production Server \u0111ang ch\u1EA1y t\u1EA1i http://localhost:${PORT}`);
});
