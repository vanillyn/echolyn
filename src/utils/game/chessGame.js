import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci, makeUci } from 'chessops/util';
import { makeSan } from 'chessops/san';
import { analyzePosition } from '../stockfish/stockfish.js';
import { database } from '../../data/database.js';
import { eloRole } from '../eloRole.js';

export class ChessGame {
  constructor(channelId, players, options = {}) {
    this.id = `${channelId}-${Date.now()}`;
    this.channelId = channelId;
    this.pos = Chess.default();
    this.players = players;
    this.currentPlayerIndex = 0;
    this.gameType = options.type || 'pvp';
    this.difficulty = options.difficulty || 1000;
    this.messageId = null;
    this.lastMoveTime = Date.now();
    this.flip = false;
    this.guild = options.guild;
    this.rated = options.rated !== false;
    this.moveHistory = [];
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  isPlayerTurn(userId) {
    return this.getCurrentPlayer() === userId;
  }

  isInGame(userId) {
    return this.players.includes(userId);
  }

  getPlayerName(index) {
    const player = this.players[index];
    if (player === 'stockfish') return 'Stockfish';
    if (player === 'random') return 'Random Bot';
    return `Player ${index + 1}`;
  }

  getPlayerMention(index) {
    const player = this.players[index];
    if (player === 'stockfish') return 'Stockfish';
    if (player === 'random') return 'Random Bot';
    return `<@${player}>`;
  }

  async getPlayerTitle(index) {
    const player = this.players[index];
    if (player === 'stockfish' || player === 'random' || !this.guild) return null;
    
    try {
      return await eloRole.getUserTitle(this.guild.id, player);
    } catch (error) {
      return null;
    }
  }

  async makeMove(move) {
    try {
      let parsedMove;
      
      if (typeof move === 'string') {
        if (move.length === 4 || move.length === 5) {
          parsedMove = parseUci(move);
        } else {
          parsedMove = this.pos.parseSan(move);
        }
      } else {
        parsedMove = move;
      }

      if (!parsedMove || !this.pos.isLegal(parsedMove)) return null;
      
      const san = makeSan(this.pos, parsedMove);
      this.pos = this.pos.play(parsedMove);
      this.moveHistory.push({ move: parsedMove, san });
      
      this.currentPlayerIndex = 1 - this.currentPlayerIndex;
      this.lastMoveTime = Date.now();
      
      if (this.gameType === 'vs-engine' && this.getCurrentPlayer() === 'stockfish') {
        await this.makeEngineMove();
      } else if (this.gameType === 'vs-random' && this.getCurrentPlayer() === 'random') {
        this.makeRandomMove();
      }
      
      return { from: makeUci(parsedMove).slice(0, 2), to: makeUci(parsedMove).slice(2, 4), san };
    } catch (error) {
      return null;
    }
  }

  async makeEngineMove() {
    try {
      const analysis = await analyzePosition(makeFen(this.pos.toSetup()), { searchTime: 1000 });
      if (analysis.bestMove) {
        try {
          const move = parseUci(analysis.bestMove);
          if (this.pos.isLegal(move)) {
            const san = makeSan(this.pos, move);
            this.pos = this.pos.play(move);
            this.moveHistory.push({ move, san });
            this.currentPlayerIndex = 1 - this.currentPlayerIndex;
            return { from: analysis.bestMove.slice(0, 2), to: analysis.bestMove.slice(2, 4), san };
          }
        } catch (error) {
          console.error('Engine move invalid:', analysis.bestMove, error);
        }
      }
    } catch (err) {
      console.error('Engine move failed:', err);
    }
    return this.makeRandomMove();
  }

  makeRandomMove() {
    const legalMoves = Array.from(this.pos.legalMoves());
    if (legalMoves.length > 0) {
      const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      try {
        const san = makeSan(this.pos, randomMove);
        this.pos = this.pos.play(randomMove);
        this.moveHistory.push({ move: randomMove, san });
        this.currentPlayerIndex = 1 - this.currentPlayerIndex;
        const uci = makeUci(randomMove);
        return { from: uci.slice(0, 2), to: uci.slice(2, 4), san };
      } catch (error) {
        console.error('Random move failed:', randomMove, error);
      }
    }
    return null;
  }

  getGameState() {
    return {
      fen: makeFen(this.pos.toSetup()),
      pgn: this.getPgn(),
      turn: this.pos.turn,
      isCheck: this.pos.isCheck(),
      isCheckmate: this.pos.isCheckmate(),
      isDraw: this.pos.isStalemate() || this.pos.isInsufficientMaterial(),
      isStalemate: this.pos.isStalemate(),
      gameOver: this.pos.isEnd()
    };
  }

  getPgn() {
    let pgn = '';
    let moveNumber = 1;
    let isWhiteMove = true;

    for (const { san } of this.moveHistory) {
      if (isWhiteMove) {
        pgn += `${moveNumber}. ${san} `;
      } else {
        pgn += `${san} `;
        moveNumber++;
      }
      isWhiteMove = !isWhiteMove;
    }

    const state = this.getGameState();
    if (state.isCheckmate) {
      pgn += state.turn === 'white' ? '0-1' : '1-0';
    } else if (state.isDraw || state.isStalemate) {
      pgn += '1/2-1/2';
    }

    return pgn.trim();
  }

  async finishGame() {
    if (!this.rated || this.gameType !== 'pvp') return null;

    const state = this.getGameState();
    const player1Id = this.players[0];
    const player2Id = this.players[1];

    if (typeof player1Id !== 'string' || typeof player2Id !== 'string') return null;

    let result = null;
    if (state.isCheckmate) {
      result = state.turn === 'white' ? 'loss' : 'win';
    } else if (state.isDraw || state.isStalemate) {
      result = 'draw';
    }

    if (result) {
      const ratingChanges = await database.updateEcholynRating(player1Id, player2Id, result, this.getPgn());
      
      if (this.guild) {
        try {
          await eloRole.updateUserRoles(this.guild, player1Id, ratingChanges.player1.newRating);
          await eloRole.updateUserRoles(this.guild, player2Id, ratingChanges.player2.newRating);
        } catch (error) {
          console.error('Error updating roles:', error);
        }
      }

      return ratingChanges;
    }

    return null;
  }

  resign(userId) {
    if (!this.isInGame(userId)) return false;
    
    const resigningPlayerIndex = this.players.indexOf(userId);
    const result = resigningPlayerIndex === 0 ? 'loss' : 'win';
    
    if (this.rated && this.gameType === 'pvp' && typeof this.players[0] === 'string' && typeof this.players[1] === 'string') {
      database.updateEcholynRating(this.players[0], this.players[1], result, this.getPgn() + '\n1-0 {Resignation}')
        .then(ratingChanges => {
          if (this.guild && ratingChanges) {
            eloRole.updateUserRoles(this.guild, this.players[0], ratingChanges.player1.newRating);
            eloRole.updateUserRoles(this.guild, this.players[1], ratingChanges.player2.newRating);
          }
        })
        .catch(console.error);
    }
    
    this.pos = Chess.default();
    this.moveHistory = [];
    return true;
  }

  moves() {
    return Array.from(this.pos.legalMoves()).map(move => makeSan(this.pos, move));
  }

  fen() {
    return makeFen(this.pos.toSetup());
  }

  turn() {
    return this.pos.turn;
  }

  inCheck() {
    return this.pos.isCheck();
  }

  isCheckmate() {
    return this.pos.isCheckmate();
  }

  isDraw() {
    return this.pos.isStalemate() || this.pos.isInsufficientMaterial();
  }

  isStalemate() {
    return this.pos.isStalemate();
  }

  isGameOver() {
    return this.pos.isEnd();
  }

  load(fen) {
    try {
      const setup = parseFen(fen).unwrap();
      this.pos = Chess.fromSetup(setup).unwrap();
      this.moveHistory = [];
      return true;
    } catch (error) {
      return false;
    }
  }

  reset() {
    this.pos = Chess.default();
    this.moveHistory = [];
    this.currentPlayerIndex = 0;
    this.lastMoveTime = Date.now();
  }
}