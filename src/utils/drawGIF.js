import sharp from 'sharp';
import { drawBoard } from './drawBoard.js';
import { Chess } from 'chess.js';
import { log } from '../init.js';

const LOG_NAME = "render.gif"

export class GifRenderer {
  constructor() {
    this.defaultOptions = {
      delay: 2000,
      quality: 85,
      loop: 0,
      size: 512
    };
  }

  async createGif(positions, options = {}) {
    const config = { ...this.defaultOptions, ...options };
    const frames = [];

    log.debug(`${LOG_NAME}: creating GIF: ${positions}`)

    for (const position of positions) {
      const boardOptions = {
        size: config.size,
        ...position.options
      };
      
      const buffer = await drawBoard(position.fen, boardOptions, position.userId);
      frames.push(buffer);
    }

    if (frames.length === 0) {
      throw new Error('No frames to create GIF');
    }

    const gif = sharp(frames[0], { animated: true, pages: -1 })
      .gif({
        delay: Array(frames.length).fill(config.delay),
        loop: config.loop
      });

    for (let i = 1; i < frames.length; i++) {
      gif.composite([{
        input: frames[i],
        top: 0,
        left: 0,
        blend: 'over'
      }]);
    }

    return await gif.toBuffer();
  }

  async createOpeningGif(moves, startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', options = {}) {
    const chess = new Chess(startFen);
    log.debug(LOG_NAME + ": Creating an opening GIF" + moves)
    const positions = [{ 
      fen: chess.fen(), 
      options: options.boardOptions || {} 
    }];

    for (const move of moves) {
      try {
        chess.move(move);
        positions.push({ 
          fen: chess.fen(), 
          options: options.boardOptions || {} 
        });
      } catch (error) {
        console.error(`Invalid move: ${move}`);
        break;
      }
    }

    return await this.createGif(positions, options);
  }

  async createGameReviewGif(pgn, options = {}) {
    const chess = new Chess();
    
    

    const positions = [];
    const history = chess.history({ verbose: true });
    chess.reset();

    positions.push({ 
      fen: chess.fen(), 
      options: options.boardOptions || {} 
    });

    for (const move of history) {
      chess.move(move);
      positions.push({ 
        fen: chess.fen(), 
        options: options.boardOptions || {} 
      });
    }

    return await this.createGif(positions, options);
  }
}

export const gifRenderer = new GifRenderer();