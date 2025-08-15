import { Chess } from 'chessops/chess';
import { Atomic } from 'chessops/variant';
import { Antichess } from 'chessops/variant';
import { Horde } from 'chessops/variant';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci, makeUci } from 'chessops/util';
import { makeSan } from 'chessops/san';
import { analyzePosition } from '../stockfish/stockfish.js';

export const VARIANTS = {
  standard: 'Standard Chess',
  antichess: 'Antichess (King of the Hill)',
  horde: 'Horde Chess',
  atomic: 'Atomic Chess',
  realtime: 'Real-time Chaos Chess',
  servervs: 'Server vs Player',
  correspondence: 'Correspondence Chess',
  blitz: 'Speed Chess with Reactions'
};

export class VariantChess {
  constructor(variant = 'standard', options = {}) {
    this.variant = variant;
    this.options = options;
    this.initVariant();
  }

  initVariant() {
    switch (this.variant) {
      case 'antichess':
        this.pos = Antichess.default();
        break;
      case 'atomic':
        this.pos = Atomic.default();
        break;
      case 'horde':
        this.pos = Horde.default();
        break;
      case 'realtime':
        this.pos = Chess.default();
        this.moveQueue = new Map();
        this.processingMoves = false;
        this.simultaneousWindow = 3000;
        break;
      case 'blitz':
        this.pos = Chess.default();
        this.reactionMoves = new Map();
        this.moveReactions = new Set();
        break;
      default:
        this.pos = Chess.default();
        break;
    }
  }

  move(move, options = {}) {
    switch (this.variant) {
      case 'realtime':
        return this.realtimeMove(move, options);
      case 'blitz':
        return this.blitzMove(move, options);
      default:
        return this.standardMove(move, options);
    }
  }

  standardMove(move, options) {
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
      
      return { 
        from: makeUci(parsedMove).slice(0, 2), 
        to: makeUci(parsedMove).slice(2, 4), 
        san,
        promotion: parsedMove.promotion || undefined
      };
    } catch (error) {
      return null;
    }
  }

  realtimeMove(move, options) {
    const playerId = options.playerId;
    if (!playerId) return null;

    this.moveQueue.set(playerId, {
      move,
      timestamp: Date.now(),
      options
    });

    if (!this.processingMoves) {
      this.processingMoves = true;
      setTimeout(() => this.processSimultaneousMoves(), this.simultaneousWindow);
    }

    return { queued: true, move, playerId };
  }

  processSimultaneousMoves() {
    this.processingMoves = false;
    
    if (this.moveQueue.size === 0) return null;

    const moves = Array.from(this.moveQueue.entries());
    this.moveQueue.clear();

    if (moves.length === 1) {
      const [playerId, moveData] = moves[0];
      return this.standardMove(moveData.move, moveData.options);
    }

    const validMoves = moves.filter(([_, data]) => {
      try {
        const testPos = this.pos.clone();
        let parsedMove;
        
        if (typeof data.move === 'string') {
          if (data.move.length === 4 || data.move.length === 5) {
            parsedMove = parseUci(data.move);
          } else {
            parsedMove = testPos.parseSan(data.move);
          }
        } else {
          parsedMove = data.move;
        }
        
        return parsedMove && testPos.isLegal(parsedMove);
      } catch {
        return false;
      }
    });

    if (validMoves.length === 0) return null;
    if (validMoves.length === 1) {
      return this.standardMove(validMoves[0][1].move, validMoves[0][1].options);
    }

    const [p1, p1Data] = validMoves[0];
    const [p2, p2Data] = validMoves[1];

    if (this.movesConflict(p1Data.move, p2Data.move)) {
      const earlierMove = p1Data.timestamp <= p2Data.timestamp ? p1Data : p2Data;
      return this.standardMove(earlierMove.move, earlierMove.options);
    }

    const firstMove = this.standardMove(p1Data.move, p1Data.options);
    if (firstMove) {
      try {
        const secondMove = this.standardMove(p2Data.move, p2Data.options);
        return { double: true, first: firstMove, second: secondMove };
      } catch {
        return firstMove;
      }
    }

    return null;
  }

  movesConflict(move1, move2) {
    try {
      const testPos1 = this.pos.clone();
      const testPos2 = this.pos.clone();
      
      let parsedMove1, parsedMove2;
      
      if (typeof move1 === 'string') {
        parsedMove1 = move1.length === 4 || move1.length === 5 ? 
          parseUci(move1) : testPos1.parseSan(move1);
      } else {
        parsedMove1 = move1;
      }
      
      if (typeof move2 === 'string') {
        parsedMove2 = move2.length === 4 || move2.length === 5 ? 
          parseUci(move2) : testPos2.parseSan(move2);
      } else {
        parsedMove2 = move2;
      }
      
      if (!parsedMove1 || !parsedMove2) return true;
      
      const uci1 = makeUci(parsedMove1);
      const uci2 = makeUci(parsedMove2);
      
      return uci1.slice(0, 2) === uci2.slice(0, 2) || 
             uci1.slice(2, 4) === uci2.slice(2, 4) || 
             uci1.slice(2, 4) === uci2.slice(0, 2) ||
             uci1.slice(0, 2) === uci2.slice(2, 4);
    } catch {
      return true;
    }
  }

  blitzMove(move, options) {
    const playerId = options.playerId;
    const reactionType = options.reactionType;
    
    if (reactionType) {
      this.reactionMoves.set(playerId, { move, reaction: reactionType });
      return { reaction: true, move, playerId };
    }

    return this.standardMove(move, options);
  }

  isGameOver() {
    return this.pos.isEnd();
  }

  isCheckmate() {
    return this.pos.isCheckmate();
  }

  isStalemate() {
    return this.pos.isStalemate();
  }

  isCheck() {
    return this.pos.isCheck();
  }

  isInsufficientMaterial() {
    return this.pos.isInsufficientMaterial();
  }

  turn() {
    return this.pos.turn;
  }

  fen() {
    return makeFen(this.pos.toSetup());
  }

  moves() {
    return Array.from(this.pos.legalMoves()).map(move => makeSan(this.pos, move));
  }

  legalMoves() {
    return this.pos.legalMoves();
  }

  parseSan(san) {
    return this.pos.parseSan(san);
  }

  isLegal(move) {
    return this.pos.isLegal(move);
  }

  play(move) {
    this.pos = this.pos.play(move);
    return this;
  }

  clone() {
    const cloned = new VariantChess(this.variant, this.options);
    cloned.pos = this.pos.clone();
    return cloned;
  }

  load(fen) {
    try {
      const setup = parseFen(fen).unwrap();
      switch (this.variant) {
        case 'antichess':
          this.pos = Antichess.fromSetup(setup).unwrap();
          break;
        case 'atomic':
          this.pos = Atomic.fromSetup(setup).unwrap();
          break;
        case 'horde':
          this.pos = Horde.fromSetup(setup).unwrap();
          break;
        default:
          this.pos = Chess.fromSetup(setup).unwrap();
          break;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  getWinner() {
    if (!this.isGameOver()) return null;
    
    if (this.isCheckmate()) {
      return this.turn() === 'white' ? 'black' : 'white';
    }
    
    return null;
  }
}

export class VariantGame {
  constructor(channelId, players, options = {}) {
    this.id = `${channelId}-${Date.now()}`;
    this.channelId = channelId;
    this.variant = options.variant || 'standard';
    this.chess = new VariantChess(this.variant, options);
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
    
    this.initVariantSpecific();
  }

  initVariantSpecific() {
    if (this.variant === 'servervs') {
      this.discussionChannel = null;
      this.votingActive = false;
      this.votes = new Map();
      this.voteEndTime = null;
      this.voteMinutes = 2;
    }

    if (this.variant === 'correspondence') {
      this.moveTimeLimit = this.options.moveTimeLimit || 24 * 60 * 60 * 1000;
      this.lastMoveWarning = false;
    }

    if (this.variant === 'realtime') {
      this.simultaneousEnabled = true;
      this.moveBuffer = [];
    }

    if (this.variant === 'blitz') {
      this.reactionCollector = null;
      this.currentMoveMessage = null;
    }
  }

  async makeMove(move, playerId = null, options = {}) {
    if (this.variant === 'realtime') {
      return this.chess.move(move, { playerId, ...options });
    }

    if (this.variant === 'servervs' && this.isServerTurn()) {
      return this.handleServerMove(move, playerId);
    }

    if (this.variant === 'blitz' && options.reactionType) {
      return this.handleBlitzReaction(move, playerId, options);
    }

    try {
      const result = this.chess.move(move, { sloppy: true, ...options });
      if (!result) return null;
      
      this.moveHistory.push(result);
      this.currentPlayerIndex = 1 - this.currentPlayerIndex;
      this.lastMoveTime = Date.now();
      
      if (this.gameType === 'vs-engine' && this.getCurrentPlayer() === 'stockfish') {
        await this.makeEngineMove();
      } else if (this.gameType === 'vs-random' && this.getCurrentPlayer() === 'random') {
        this.makeRandomMove();
      }
      
      return result;
    } catch (error) {
      return null;
    }
  }

  handleBlitzReaction(move, playerId, options) {
    if (options.reactionType === '⚡') {
      return this.chess.move(move, { playerId, priority: true });
    } else if (options.reactionType === '🤔') {
      setTimeout(() => {
        this.chess.move(move, { playerId });
      }, 3000);
      return { delayed: true };
    }
    
    return this.chess.move(move, { playerId });
  }

  isServerTurn() {
    return this.variant === 'servervs' && this.getCurrentPlayer() === 'server';
  }

  async handleServerMove(move, playerId) {
    if (!this.votingActive) {
      this.startMoveVoting();
    }

    this.votes.set(playerId, move);
    
    if (Date.now() >= this.voteEndTime || this.shouldEndVoting()) {
      const winningMove = this.tallyVotes();
      if (winningMove) {
        const result = this.chess.move(winningMove, { sloppy: true });
        if (result) {
          this.moveHistory.push(result);
          this.currentPlayerIndex = 1 - this.currentPlayerIndex;
          this.lastMoveTime = Date.now();
          this.votingActive = false;
          this.votes.clear();
          return result;
        }
      }
    }
    
    return { voted: true, move, totalVotes: this.votes.size };
  }

  shouldEndVoting() {
    const uniqueVotes = new Set(this.votes.values());
    const majorityThreshold = Math.floor(this.votes.size / 2) + 1;
    
    for (const move of uniqueVotes) {
      const voteCount = Array.from(this.votes.values()).filter(v => v === move).length;
      if (voteCount >= majorityThreshold && this.votes.size >= 3) {
        return true;
      }
    }
    
    return this.votes.size >= 10;
  }

  startMoveVoting() {
    this.votingActive = true;
    this.voteEndTime = Date.now() + (this.voteMinutes * 60000);
    this.votes.clear();
  }

  tallyVotes() {
    const moveCount = new Map();
    
    for (const move of this.votes.values()) {
      moveCount.set(move, (moveCount.get(move) || 0) + 1);
    }
    
    let winningMove = null;
    let maxVotes = 0;
    
    for (const [move, votes] of moveCount) {
      if (votes > maxVotes) {
        maxVotes = votes;
        winningMove = move;
      }
    }
    
    return winningMove;
  }

  getCurrentPlayer() {
    if (this.variant === 'servervs') {
      return this.currentPlayerIndex === 0 ? this.players[0] : 'server';
    }
    if (this.variant === 'realtime') {
      return 'both';
    }
    return this.players[this.currentPlayerIndex];
  }

  isPlayerTurn(userId) {
    if (this.variant === 'realtime' || this.variant === 'blitz') {
      return this.players.includes(userId);
    }
    if (this.variant === 'servervs' && this.isServerTurn()) {
      return this.guild?.members?.cache?.has(userId);
    }
    return this.getCurrentPlayer() === userId;
  }

  getGameState() {
    const baseState = {
      fen: this.chess.fen(),
      pgn: this.getPgn(),
      turn: this.chess.turn(),
      isCheck: this.chess.isCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isDraw: this.chess.isStalemate() || this.chess.isInsufficientMaterial(),
      isStalemate: this.chess.isStalemate(),
      gameOver: this.chess.isGameOver(),
      variant: this.variant
    };

    if (this.variant === 'servervs') {
      baseState.votingActive = this.votingActive;
      baseState.votes = Array.from(this.votes.entries());
      baseState.voteEndTime = this.voteEndTime;
      baseState.timeRemaining = this.voteEndTime ? Math.max(0, this.voteEndTime - Date.now()) : 0;
    }

    if (this.variant === 'correspondence') {
      baseState.timeRemaining = this.moveTimeLimit - (Date.now() - this.lastMoveTime);
      baseState.moveTimeLimit = this.moveTimeLimit;
    }

    if (this.variant === 'realtime') {
      baseState.queuedMoves = Array.from(this.chess.moveQueue?.entries() || []);
      baseState.processingMoves = this.chess.processingMoves;
    }

    return baseState;
  }

  getPgn() {
    let pgn = '';
    let moveNumber = 1;
    let isWhiteMove = true;

    for (const move of this.moveHistory) {
      if (isWhiteMove) {
        pgn += `${moveNumber}. ${move.san} `;
      } else {
        pgn += `${move.san} `;
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

  getVariantDescription() {
    switch (this.variant) {
      case 'antichess':
        return 'Capture moves are mandatory. First to lose all pieces wins!';
      case 'horde':
        return 'White: only pawns vs Black: normal pieces. White wins by checkmate, Black by capturing all pawns.';
      case 'atomic':
        return 'Captures cause explosions! Adjacent pieces destroyed (except pawns).';
      case 'realtime':
        return 'Both players move simultaneously! 3-second windows, conflicts resolved by timestamp.';
      case 'servervs':
        return 'The server votes on moves against one player. Democracy vs skill!';
      case 'correspondence':
        return 'Slow chess via DMs. 24 hours per move.';
      case 'blitz':
        return 'React ⚡ for instant moves, 🤔 for 3-second delay!';
      default:
        return 'Standard chess rules.';
    }
  }

  async makeEngineMove() {
    try {
      const analysis = await analyzePosition(this.chess.fen(), { searchTime: 1000 });
      if (analysis.bestMove) {
        const result = this.chess.move(analysis.bestMove, { sloppy: true });
        if (result) {
          this.moveHistory.push(result);
          this.currentPlayerIndex = 1 - this.currentPlayerIndex;
          return result;
        }
      }
    } catch (err) {
      console.error('Engine move failed:', err);
    }
    return this.makeRandomMove();
  }

  makeRandomMove() {
    const moves = this.chess.moves();
    if (moves.length > 0) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      const result = this.chess.move(randomMove, { sloppy: true });
      if (result) {
        this.moveHistory.push(result);
        this.currentPlayerIndex = 1 - this.currentPlayerIndex;
        return result;
      }
    }
    return null;
  }

  isInGame(userId) {
    if (this.variant === 'servervs') {
      return this.players.includes(userId) || this.guild?.members?.cache?.has(userId);
    }
    return this.players.includes(userId);
  }

  getPlayerName(index) {
    if (this.variant === 'servervs' && index === 1) return 'The Server';
    if (this.variant === 'realtime' && index === 1) return 'Both Players';
    
    const player = this.players[index];
    if (player === 'stockfish') return 'Stockfish';
    if (player === 'random') return 'Random Bot';
    return `Player ${index + 1}`;
  }

  getPlayerMention(index) {
    if (this.variant === 'servervs' && index === 1) return 'The Server';
    if (this.variant === 'realtime') return 'Everyone';
    
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
    
    this.chess.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    this.moveHistory = [];
    return true;
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
}