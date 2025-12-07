// ChessBoardComponent.js
import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000"); // replace YOUR_LOCAL_IP with host PC's LAN IP

export default function ChessBoardComponent({ username }) {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());

  const [roomInput, setRoomInput] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [playerColor, setPlayerColor] = useState("");

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  // Socket events
  useEffect(() => {
    socket.on("move-made", ({ from, to, promotion, fen: newFen }) => {
      game.move({ from, to, promotion });
      setFen(newFen);
    });

    socket.on("start-game", ({ fen: newFen }) => {
      setFen(newFen);
      game.load(newFen);
    });

    socket.on("game-over", ({ reason, winner }) => {
      alert(`Game over! Reason: ${reason}. Winner: ${winner || "Draw"}`);
      setInRoom(false);
      setRoomId("");
      setPlayerColor("");
      setGame(new Chess());
      setFen(new Chess().fen());
    });

    socket.on("opponent-left", () => {
      alert("Your opponent left the game!");
      setInRoom(false);
      setRoomId("");
      setPlayerColor("");
      setGame(new Chess());
      setFen(new Chess().fen());
    });

    socket.on("chat", ({ from, text }) => {
      setMessages((prev) => [...prev, { from, text }]);
    });

    return () => {
      socket.off("move-made");
      socket.off("start-game");
      socket.off("game-over");
      socket.off("opponent-left");
      socket.off("chat");
    };
  }, [game]);

  // Handle move from this player
  const onDrop = (sourceSquare, targetSquare, piece) => {
    if (!inRoom) return false;
    if ((game.turn() === "w" && playerColor !== "white") || (game.turn() === "b" && playerColor !== "black")) return false;

    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q", // auto-queen
    });

    if (move === null) return false;

    setFen(game.fen());
    socket.emit("move", { roomId, from: sourceSquare, to: targetSquare, promotion: "q" });
    return true;
  };

  // Multiplayer handlers
  const handleCreateRoom = () => {
    socket.emit("create-room", (res) => {
      if (res.ok) {
        setRoomId(res.roomId);
        setPlayerColor(res.color);
        setInRoom(true);
        setGame(new Chess());
        setFen(new Chess().fen());
        alert(`Room created! Room ID: ${res.roomId}`);
      }
    });
  };

  const handleJoinRoom = () => {
    if (!roomInput) return alert("Enter room ID to join!");
    socket.emit("join-room", { roomId: roomInput }, (res) => {
      if (res.ok) {
        setRoomId(roomInput);
        setPlayerColor(res.color || "spectator");
        setInRoom(true);
        setGame(new Chess());
        setFen(new Chess().fen());
        alert(`Joined room ${roomInput} as ${res.color || "spectator"}`);
      } else {
        alert(res.error);
      }
    });
  };

  const handleResign = () => {
    socket.emit("resign", { roomId });
  };

  const handleSendChat = () => {
    if (!chatInput) return;
    socket.emit("chat", { roomId, text: chatInput });
    setMessages((prev) => [...prev, { from: "Me", text: chatInput }]);
    setChatInput("");
  };

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      <div>
        {!inRoom ? (
          <div>
            <button onClick={handleCreateRoom}>Create Room</button>
            <input
              placeholder="Enter Room ID"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
            />
            <button onClick={handleJoinRoom}>Join Room</button>
          </div>
        ) : (
          <div>
            <p>Room: {roomId} | You are {playerColor}</p>
            <button onClick={handleResign}>Resign</button>
          </div>
        )}

        <Chessboard position={fen} onPieceDrop={onDrop} />
      </div>

      {/* Chat sidebar */}
      <div style={{ width: "200px" }}>
        <h3>Chat</h3>
        <div style={{ border: "1px solid black", height: "400px", overflowY: "scroll", padding: "5px" }}>
          {messages.map((m, i) => (
            <div key={i}><b>{m.from}:</b> {m.text}</div>
          ))}
        </div>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Type message..."
        />
        <button onClick={handleSendChat}>Send</button>
      </div>
    </div>
  );
}
