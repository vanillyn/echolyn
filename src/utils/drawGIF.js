import fs from 'node:fs/promises';
import path from 'node:path';
import { drawBoard, getUserConfig } from './drawBoard.js';
import { Chess } from 'chess.js';
import { buildFensAndMetaFromPgn } from './parsePGN.js';
import { log } from '../init.js';
import ffmpeg from 'fluent-ffmpeg';
import tmp from 'tmp-promise';
import { PassThrough } from 'node:stream';

const LOG_NAME = 'render.gif';

export class GifRenderer {
	constructor() {
		this.defaultOptions = {
			delay: 1000, // 1s
			quality: 100,
			loop: 0,
			size: 512,
			showEval: true,
			showAnnotations: true,
			highlightLastMove: true,
		};
	}

	async createAnimatedGif(frames, options = {}) {
		const config = { ...this.defaultOptions, ...options };

		if (frames.length === 0) {
			throw new Error('no frames to create gif');
		}

		log.debug(`${LOG_NAME}: creating animated gif with ${frames.length} frames`);

		if (frames.length === 1) {
			return frames[0];
		}

		let tmpDir;
		let cleanup;

		try {
			const tmpObj = await tmp.dir({ unsafeCleanup: true });
			tmpDir = tmpObj.path;
			cleanup = tmpObj.cleanup;

			// write all frames to png files
			await Promise.all(
				frames.map(async (frame, i) => {
					const filename = path.join(
						tmpDir,
						`frame-${i.toString().padStart(4, '0')}.png`
					);
					await fs.writeFile(filename, frame);
				})
			);

			const inputPattern = path.join(tmpDir, 'frame-%04d.png');
			const palettePath = path.join(tmpDir, 'palette.png');
			const fps = 1000 / config.delay;

			// step 1: generate palette
			await new Promise((resolve, reject) => {
				ffmpeg()
					.input(inputPattern)
					.inputFPS(fps)
					.outputOptions('-vf', `palettegen=stats_mode=diff`)
					.output(palettePath)
					.on('error', err =>
						reject(new Error(`ffmpeg palettegen error: ${err.message}`))
					)
					.on('end', resolve)
					.run();
			});

			// step 2: use palette to make gif
			return await new Promise((resolve, reject) => {
				const outputStream = new PassThrough();
				const buffers = [];

				outputStream.on('data', chunk => buffers.push(chunk));
				outputStream.on('end', () => resolve(Buffer.concat(buffers)));
				outputStream.on('error', reject);

				ffmpeg()
					.input(inputPattern)
					.inputFPS(fps)
					.input(palettePath)
					.complexFilter(`paletteuse=dither=floyd_steinberg`)
					.outputOptions('-loop', config.loop.toString())
					.format('gif')
					.on('error', err =>
						reject(new Error(`ffmpeg paletteuse error: ${err.message}`))
					)
					.on('end', () => outputStream.end())
					.pipe(outputStream, { end: true });
			});
		} catch (err) {
			log.error(`${LOG_NAME}: gif creation failed - ${err.message}`);
			throw err;
		} finally {
			if (cleanup) {
				try {
					await cleanup();
				} catch (cleanupErr) {
					log.error(`${LOG_NAME}: cleanup failed - ${cleanupErr.message}`);
				}
			}
		}
	}

	async createPgnGif(pgn, options = {}) {
		const config = { ...this.defaultOptions, ...options };

		log.debug(`${LOG_NAME}: creating PGN GIF`);

		const parsed = buildFensAndMetaFromPgn(pgn);
		if (!parsed || !parsed.fens || parsed.fens.length === 0) {
			throw new Error('Could not parse PGN');
		}

		const { headers, fens, meta, moves } = parsed;
		const chess = new Chess();
		const frames = [];

		const white = headers.White || headers.WhitePlayer || 'White';
		const black = headers.Black || headers.BlackPlayer || 'Black';

		const maxFrames = fens.length;
		const step = 1;

		for (let i = 0; i < fens.length; i += step) {
			const fen = fens[i];
			const currentMeta = meta[i] || {};
			const currentMove = i > 0 ? moves[i - 1] : null;

			chess.load(fen);
			const history = chess.history({ verbose: true });
			const lastMove = history.length > 0 ? history[history.length - 1] : null;

			const boardOptions = {
				size: config.size,
				flip: config.flip || false,
				players: { white, black },
				clocks: currentMeta.clocks || {},
				watermark: config.watermark || 'echolyn',
				...config.boardOptions,
			};

			if (config.showEval && currentMeta.eval !== undefined) {
				boardOptions.eval = currentMeta.eval;
			}

			if (config.showAnnotations && currentMove?.glyph) {
				boardOptions.annotation = currentMove.glyph;
			}

			if (config.highlightLastMove && lastMove) {
				boardOptions.lastMove = {
					from: lastMove.from,
					to: lastMove.to,
				};
			}

			if (currentMeta.checkSquare) {
				boardOptions.checkSquare = currentMeta.checkSquare;
			}

			if (currentMeta.bestMove) {
				boardOptions.bestMove = currentMeta.bestMove;
			}

			if (config.highlights && Array.isArray(config.highlights[i])) {
				boardOptions.highlights = config.highlights[i];
			}

			const buffer = await drawBoard(fen, boardOptions, config.userId);
			frames.push(buffer);
		}

		return await this.createAnimatedGif(frames, config);
	}

	async createAnalysisGif(pgn, analysisData, options = {}) {
		const config = { ...this.defaultOptions, ...options };

		log.debug(`${LOG_NAME}: creating analysis GIF`);

		const parsed = buildFensAndMetaFromPgn(pgn);
		if (!parsed || !parsed.fens || parsed.fens.length === 0) {
			throw new Error('Could not parse PGN');
		}

		const { headers, fens, meta, moves } = parsed;
		const chess = new Chess();
		const frames = [];

		const white = headers.White || headers.WhitePlayer || 'White';
		const black = headers.Black || headers.BlackPlayer || 'Black';

		const maxFrames = fens.length;
		const step = 1;

		for (let i = 0; i < fens.length; i += step) {
			const fen = fens[i];
			const currentMeta = meta[i] || {};
			const analysisMove = analysisData.moves?.[i - 1];

			chess.load(fen);
			const history = chess.history({ verbose: true });
			const lastMove = history.length > 0 ? history[history.length - 1] : null;

			const boardOptions = {
				size: config.size,
				flip: config.flip || false,
				players: { white, black },
				clocks: currentMeta.clocks || {},
				watermark: 'echolyn analysis',
				...config.boardOptions,
			};

			if (analysisMove) {
				boardOptions.eval = analysisMove.evaluation / 100;
				boardOptions.annotation = analysisMove.annotation.symbol;
				boardOptions.bestMove = analysisMove.bestMove;
			} else if (currentMeta.eval !== undefined) {
				boardOptions.eval = currentMeta.eval;
			}

			if (config.highlightLastMove && lastMove) {
				boardOptions.lastMove = {
					from: lastMove.from,
					to: lastMove.to,
				};
			}

			if (currentMeta.checkSquare) {
				boardOptions.checkSquare = currentMeta.checkSquare;
			}

			const buffer = await drawBoard(fen, boardOptions, config.userId);
			frames.push(buffer);
		}

		return await this.createAnimatedGif(frames, config);
	}

	async createOpeningGif(
		moves,
		startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
		options = {}
	) {
		const config = { ...this.defaultOptions, ...options };
		const chess = new Chess(startFen);

		log.debug(`${LOG_NAME}: creating opening GIF with ${moves.length} moves`);

		const frames = [];
		const positions = [
			{
				fen: chess.fen(),
				move: null,
			},
		];

		for (const move of moves) {
			try {
				const moveResult = chess.move(move);
				if (moveResult) {
					positions.push({
						fen: chess.fen(),
						move: moveResult,
					});
				}
			} catch (error) {
				log.error(`${LOG_NAME}: invalid move: ${move}`);
				break;
			}
		}

		for (const position of positions) {
			const boardOptions = {
				size: config.size,
				flip: config.flip || false,
				watermark: config.watermark || 'echolyn',
				...config.boardOptions,
			};

			if (config.highlightLastMove && position.move) {
				boardOptions.lastMove = {
					from: position.move.from,
					to: position.move.to,
				};
			}

			const buffer = await drawBoard(position.fen, boardOptions, config.userId);
			frames.push(buffer);
		}

		return await this.createAnimatedGif(frames, config);
	}

	async createGameReviewGif(pgn, options = {}) {
		return await this.createPgnGif(pgn, {
			...options,
			showEval: true,
			showAnnotations: true,
			highlightLastMove: true,
			watermark: 'echolyn review',
		});
	}

	async createPositionGif(positions, options = {}) {
		const config = { ...this.defaultOptions, ...options };
		const frames = [];

		log.debug(`${LOG_NAME}: creating position GIF with ${positions.length} positions`);

		for (const position of positions) {
			const boardOptions = {
				size: config.size,
				flip: config.flip || false,
				watermark: config.watermark || 'echolyn',
				...config.boardOptions,
				...position.options,
			};

			const buffer = await drawBoard(
				position.fen,
				boardOptions,
				position.userId || config.userId
			);
			frames.push(buffer);
		}

		return await this.createAnimatedGif(frames, config);
	}
}

export const gifRenderer = new GifRenderer();
