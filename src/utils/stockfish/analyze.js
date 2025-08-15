import { analyzePosition, LOG_NAME } from './stockfish.js';
import { Chess } from 'chess.js';
import { buildFensAndMetaFromPgn } from '../parsePGN.js';
import { log } from '../../init.js';

export class Analysis {
	constructor() {
		this.searchTime = 2000;
		this.concurrency = 3;
		this.annotations = {
			BLUNDER: { symbol: '??', threshold: -200, description: 'Blunder' },
			MISTAKE: { symbol: '?', threshold: -100, description: 'Mistake' },
			INACCURACY: { symbol: '?!', threshold: -50, description: 'Inaccuracy' },
			GOOD: { symbol: '!', description: 'Good' },
			EXCELLENT: { symbol: '!!', description: 'Great' },
			BRILLIANT: { symbol: '★', description: 'Brilliant' },
			BOOK: { symbol: '', description: 'Book' },
		};
	}

	async analyzeGame(pgn, options = {}) {
		log.debug(`${LOG_NAME}: analyzing game with ${this.concurrency} instances`);
		const parsed = buildFensAndMetaFromPgn(pgn);
		if (!parsed || !parsed.fens || parsed.fens.length === 0) {
			throw new Error('Could not parse PGN');
		}

		const { fens, moves: sanMoves } = parsed;
		const chess = new Chess();

		const startMove = options.skipOpening !== false ? Math.min(8, Math.floor(fens.length / 4)) : 1;
		
		const positionsToAnalyze = [];
		for (let i = startMove; i < fens.length; i++) {
			chess.load(fens[i - 1]);
			const playedMove = chess.move(sanMoves[i - 1].san);
			chess.undo(); 
			
			positionsToAnalyze.push({
				index: i,
				beforeFen: fens[i - 1],
				afterFen: fens[i],
				move: sanMoves[i - 1],
				playedMove: playedMove ? playedMove.from + playedMove.to + (playedMove.promotion || '') : null
			});
		}

		const analysisResults = await this.analyzePositionsBatch(positionsToAnalyze);

		const analysis = {
			moves: [],
			summary: {
				blunders: { white: 0, black: 0 },
				mistakes: { white: 0, black: 0 },
				inaccuracies: { white: 0, black: 0 },
				good: { white: 0, black: 0 },
				excellent: { white: 0, black: 0 },
				brilliant: { white: 0, black: 0 },
			},
			accuracy: { white: 0, black: 0 },
		};

		for (const result of analysisResults) {
			const { move, beforeAnalysis, afterAnalysis, index } = result;
			
			chess.load(result.beforeFen);
			const moveColor = chess.turn();

			const evaluation = this.evaluateMove(
				beforeAnalysis,
				afterAnalysis,
				moveColor,
				result.playedMove
			);

			analysis.moves.push({
				move: move.san,
				color: moveColor,
				fen: result.afterFen,
				evaluation: evaluation.eval,
				bestMove: beforeAnalysis?.bestMove,
				annotation: evaluation.annotation,
				comment: evaluation.comment,
			});

			this.updateSummary(analysis.summary, evaluation.annotation, moveColor);
		}

		analysis.accuracy = this.calculateAccuracy(analysis.moves);
		return analysis;
	}

	async analyzePositionsBatch(positions) {
		const results = [];
		
		for (let i = 0; i < positions.length; i += this.concurrency) {
			const batch = positions.slice(i, i + this.concurrency);
			
			const batchPromises = batch.map(async (pos) => {
				try {
					const [beforeAnalysis, afterAnalysis] = await Promise.all([
						analyzePosition(pos.beforeFen, { searchTime: this.searchTime }),
						analyzePosition(pos.afterFen, { searchTime: this.searchTime })
					]);

					return {
						index: pos.index,
						beforeFen: pos.beforeFen,
						afterFen: pos.afterFen,
						move: pos.move,
						playedMove: pos.playedMove,
						beforeAnalysis,
						afterAnalysis
					};
				} catch (error) {
					console.error(`Analysis failed for position ${pos.index}:`, error);
					return {
						index: pos.index,
						beforeFen: pos.beforeFen,
						afterFen: pos.afterFen,
						move: pos.move,
						playedMove: pos.playedMove,
						beforeAnalysis: null,
						afterAnalysis: null
					};
				}
			});

			const batchResults = await Promise.all(batchPromises);
			results.push(...batchResults);
			
			// Small delay between batches to prevent overload
			if (i + this.concurrency < positions.length) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}

		return results.sort((a, b) => a.index - b.index);
	}

	evaluateMove(beforeAnalysis, afterAnalysis, color, playedMove = null) {
		if (!beforeAnalysis || !afterAnalysis) {
			return {
				eval: 0,
				annotation: this.annotations.GOOD,
				comment: 'Unable to analyze',
			};
		}

		const beforeEval = this.normalizeEval(beforeAnalysis.eval, beforeAnalysis.mateIn, color);
		const afterEval = this.normalizeEval(afterAnalysis.eval, afterAnalysis.mateIn, color === 'w' ? 'b' : 'w');

		const bestMove = beforeAnalysis.bestMove;
		const isBestMove = playedMove && bestMove && 
			(playedMove === bestMove || playedMove.slice(0, 4) === bestMove.slice(0, 4));

		// Check if it's a book move (simplified)
		if (Math.abs(beforeEval) < 30 && isBestMove) {
			return {
				eval: afterEval,
				annotation: this.annotations.BOOK,
				comment: 'Book move',
			};
		}

		// Calculate the actual eval difference
		const evalDiff = afterEval - beforeEval;

		let annotation;
		let comment;

		if (isBestMove) {
			if (evalDiff >= 50) {
				annotation = this.annotations.EXCELLENT;
				comment = `Best move - gains ${Math.round(evalDiff)} centipawns`;
			} else {
				annotation = this.annotations.GOOD;
				comment = 'Best move';
			}
		} else {
			// Move is not best - evaluate how bad it is
			if (evalDiff <= -200) {
				annotation = this.annotations.BLUNDER;
				comment = `Loses ${Math.abs(Math.round(evalDiff))} centipawns`;
			} else if (evalDiff <= -100) {
				annotation = this.annotations.MISTAKE;
				comment = `Loses ${Math.abs(Math.round(evalDiff))} centipawns`;
			} else if (evalDiff <= -50) {
				annotation = this.annotations.INACCURACY;
				comment = `Loses ${Math.abs(Math.round(evalDiff))} centipawns`;
			} else if (evalDiff >= 100) {
				annotation = this.annotations.BRILLIANT;
				comment = `Brilliant! Gains ${Math.round(evalDiff)} centipawns`;
			} else if (evalDiff >= 50) {
				annotation = this.annotations.EXCELLENT;
				comment = `Great move! Gains ${Math.round(evalDiff)} centipawns`;
			} else if (evalDiff >= 0) {
				annotation = this.annotations.GOOD;
				comment = 'Good move';
			} else {
				annotation = this.annotations.GOOD;
				comment = 'Acceptable move';
			}
		}

		return {
			eval: afterEval,
			annotation,
			comment,
		};
	}

	normalizeEval(sfeval, mateIn, color) {
		if (mateIn !== null) {
			const mateValue = mateIn > 0 ? 1000 - Math.abs(mateIn) : -1000 + Math.abs(mateIn);
			return color === 'w' ? mateValue : -mateValue;
		}
		if (sfeval === null) return 0;
		
		// Convert from pawns to centipawns and adjust for color
		const centipawns = sfeval * 100;
		return color === 'w' ? centipawns : -centipawns;
	}

	updateSummary(summary, annotation, color) {
		const colorKey = color === 'w' ? 'white' : 'black';
		
		switch (annotation.symbol) {
			case '??':
				summary.blunders[colorKey]++;
				break;
			case '?':
				summary.mistakes[colorKey]++;
				break;
			case '?!':
				summary.inaccuracies[colorKey]++;
				break;
			case '!':
				summary.good[colorKey]++;
				break;
			case '!!':
				summary.excellent[colorKey]++;
				break;
			case '★':
				summary.brilliant[colorKey]++;
				break;
		}
	}

	calculateAccuracy(moves) {
		const whiteMoves = moves.filter(m => m.color === 'w');
		const blackMoves = moves.filter(m => m.color === 'b');

		const calculatePlayerAccuracy = playerMoves => {
			if (playerMoves.length === 0) return 100;

			let totalScore = 0;
			let maxScore = 0;

			for (const move of playerMoves) {
				maxScore += 10;
				
				switch (move.annotation.symbol) {
					case '??':
						totalScore += 0; // Blunder = 0 points
						break;
					case '?':
						totalScore += 3; // Mistake = 3 points
						break;
					case '?!':
						totalScore += 6; // Inaccuracy = 6 points
						break;
					case '!':
						totalScore += 9; // Good = 9 points
						break;
					case '!!':
						totalScore += 10; // Excellent = 10 points
						break;
					case '★':
						totalScore += 10; // Brilliant = 10 points
						break;
					case '':
						totalScore += 8; // Book = 8 points
						break;
					default:
						totalScore += 7; // Default = 7 points
				}
			}

			return Math.round((totalScore / maxScore) * 100);
		};

		return {
			white: calculatePlayerAccuracy(whiteMoves),
			black: calculatePlayerAccuracy(blackMoves),
		};
	}

	async getPositionAnalysis(fen, depth = 20) {
		const analysisResult = await analyzePosition(fen, { searchTime: this.searchTime });

		return {
			fen,
			eval: analysisResult.eval,
			mateIn: analysisResult.mateIn,
			bestMove: analysisResult.bestMove,
			evaluation: this.getPositionEvaluation(analysisResult.eval, analysisResult.mateIn),
		};
	}

	getPositionEvaluation(sfeval, mateIn) {
		if (mateIn !== null) {
			return mateIn > 0 ? `Mate in ${mateIn}` : `Mate in ${Math.abs(mateIn)}`;
		}

		if (Math.abs(sfeval) >= 5) {
			return sfeval > 0 ? 'White is winning' : 'Black is winning';
		} else if (Math.abs(sfeval) >= 2) {
			return sfeval > 0 ? 'White is better' : 'Black is better';
		} else if (Math.abs(sfeval) >= 0.5) {
			return sfeval > 0 ? 'White is slightly better' : 'Black is slightly better';
		} else {
			return 'Equal position';
		}
	}
}

export const analysis = new Analysis();