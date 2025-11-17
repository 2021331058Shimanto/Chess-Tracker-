import { useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

export default function PlayChess() {
  // We only track the FEN. The `game` object is created as needed,
  // or we can keep a reference, but the FEN controls the board's visual state.
  const [fen, setFen] = useState(new Chess().fen());

  // Function to safely make a move and update the FEN
  const makeMove = (move) => {
    // 1. Create a temporary game object from the current FEN
    const gameCopy = new Chess(fen);
    
    // 2. Attempt the move
    const result = gameCopy.move(move);

    // 3. If the move was successful, update the FEN state
    if (result) {
      setFen(gameCopy.fen());
    }
    
    // Return the result of the move attempt
    return result;
  };

  const makeAiMove = useCallback(() => {
    // We use the current FEN to calculate the next move
    const game = new Chess(fen);
    if (game.game_over()) return;

    const moves = game.moves();
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    
    // Pass the random move to the primary move function
    makeMove(randomMove);
  }, [fen]); // Recalculate makeAiMove if FEN changes

  const onPieceDrop = (source, target) => {
    // Attempt the player's move
    console.log(`Attempting move from ${source} to ${target}`);
    const moveAttempt = { from: source, to: target, promotion: "q" };
    const moveResult = makeMove(moveAttempt);
    
    // If player move was illegal, return false
    if (!moveResult) return false;

    // Schedule AI move after a short delay
    // Note: We don't need to wrap this in a functional update now 
    // because makeMove and makeAiMove handle state updates cleanly.
    setTimeout(makeAiMove, 300);

    // Return true if the player's move was successful
    return true;
  };

  const restartGame = () => {
    // Simply set the FEN back to the starting position
    setFen(new Chess().fen());
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-800 p-6">
      <h1 className="text-white text-3xl font-bold mb-6">Play Chess vs AI</h1>

      <div className="w-full max-w-xs">
        <Chessboard
          position={fen}
          onPieceDrop={onPieceDrop}
          boardWidth={300}
          // Ensure dragging is explicitly enabled
          arePiecesDraggable={true} 
        />
      </div>

      <button
        onClick={restartGame}
        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg"
      >
        Restart Game
      </button>
    </div>
  );
}