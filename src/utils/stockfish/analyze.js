import { analyzePosition, LOG_NAME } from './stockfish.js';
import { Chess } from 'chess.js';
import { buildFensAndMetaFromPgn } from '../parsePGN.js';
import { log } from '../../init.js';

export class Analysis {
	constructor() {
		this.searchTime = 2000;
		this.concurrency = 4;
		this.moveColor = 'w';
		this.annotations = {
			BLUNDER: { symbol: '??', threshold: -200, description: 'Blunder' },
			MISTAKE: { symbol: '?', threshold: -100, description: 'Mistake' },
			INACCURACY: { symbol: '?!', threshold: -50, description: 'Inaccuracy' },
			GOOD: { symbol: '✓', description: 'Good' },
			EXCELLENT: { symbol: '!', description: 'Great' },
			BRILLIANT: { symbol: '!!', description: 'Brilliant' },
			BOOK: { symbol: '📓', description: 'Book' },
		};
	}

	async analyzeGame(pgn, options = {}) {
		try {
			log.debug(`${LOG_NAME}: analyzing game with ${this.concurrency} instances`);
			const parsed = buildFensAndMetaFromPgn(pgn);
			if (!parsed || !parsed.fens || parsed.fens.length === 0) {
				throw new Error('Could not parse PGN');
			}

			const { fens, moves: sanMoves } = parsed;
			const chess = new Chess();

			const startMove = 1;
			
			const positionsToAnalyze = [];
			for (let i = startMove; i < fens.length; i++) {
				try {
					chess.load(fens[i - 1]);
					
					if (!sanMoves[i - 1] || !sanMoves[i - 1].san) {
						continue;
					}
					
					const move = chess.move(sanMoves[i - 1].san, { sloppy: true });
					if (!move) continue;
					
					positionsToAnalyze.push({
						index: i,
						beforeFen: fens[i - 1],
						afterFen: fens[i],
						move: sanMoves[i - 1],
						playedMove: move.from + move.to + (move.promotion || '')
					});
				} catch (error) {
					log.error(`${LOG_NAME}: Error processing move ${i}: ${error.message}`);
					continue;
				}
			}

			if (positionsToAnalyze.length === 0) {
				throw new Error('No valid positions found to analyze');
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

			let prevEval = 0;

			for (const result of analysisResults) {
				if (!result || !result.move) continue;
				
				const { move, beforeAnalysis, afterAnalysis, index, playedMove } = result;
				
				try {
					chess.load(result.beforeFen);
					this.moveColor = chess.turn() === 'w' ? 'white' : 'black';

					const evaluation = this.evaluateMove(
						beforeAnalysis,
						afterAnalysis,
						this.moveColor,
						prevEval,
						playedMove
					);

					analysis.moves.push({
						move: move.san,
						color: this.moveColor,
						fen: result.afterFen,
						evaluation: evaluation.eval,
						bestMove: beforeAnalysis?.bestMove,
						annotation: evaluation.annotation,
						comment: evaluation.comment,
					});

					this.updateSummary(analysis.summary, evaluation.annotation, this.moveColor);
					prevEval = evaluation.eval;
				} catch (error) {
					log.error(`${LOG_NAME}: Error evaluating move ${index}: ${error.message}`);
					continue;
				}
			}

			analysis.accuracy = this.calculateAccuracy(analysis.moves);
			return analysis;
		} catch (error) {
			log.error(`${LOG_NAME}: Game analysis failed: ${error.message}`, error.stack);
			throw error;
		}
	}

	async analyzePositionsBatch(positions) {
		const results = [];
		
		for (let i = 0; i < positions.length; i += this.concurrency) {
			const batch = positions.slice(i, i + this.concurrency);
			
			const batchPromises = batch.map(async (pos) => {
				try {
					const beforeAnalysis = await analyzePosition(pos.beforeFen, {
						searchTime: this.searchTime,
					});

					const afterAnalysis = await analyzePosition(pos.afterFen, {
						searchTime: this.searchTime,
					});

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
					log.error(`Analysis failed for position ${pos.index}: ${error.message}`);
					return null;
				}
			});

			try {
				const batchResults = await Promise.all(batchPromises);
				results.push(...batchResults);
			} catch (error) {
				log.error(`${LOG_NAME}: Batch analysis failed: ${error.message}`);
			}
		}

		return results.filter(r => r !== null).sort((a, b) => a.index - b.index);
	}

	evaluateMove(beforeAnalysis, afterAnalysis, color, prevEval, playedMove = null) {
		if (!beforeAnalysis || !afterAnalysis) {
			return {
				eval: prevEval,
				annotation: this.annotations.GOOD,
				comment: 'Unable to analyze',
			};
		}

		const beforeEval = this.normalizeEval(
			beforeAnalysis.eval,
			beforeAnalysis.mateIn,
			color
		);
		const afterColor = this.moveColor === 'white' ? 'black' : 'white';
		const afterEval = this.normalizeEval(
			afterAnalysis.eval,
			afterAnalysis.mateIn,
			afterColor
		);

		const bestMove = beforeAnalysis.bestMove;
		const isbestMove = playedMove && bestMove && 
			(playedMove === bestMove || playedMove.slice(0, 4) === bestMove.slice(0, 4));

		if (this.isBookMove(beforeAnalysis.bestMove)) {
			return {
				eval: beforeEval,
				annotation: this.annotations.BOOK,
				comment: 'Book move',
			};
		}

		const evalDiff = afterEval - beforeEval;
		const playerDiff = (this.moveColor === 'white'? evalDiff : -evalDiff);

		let annotation;
		let comment;

		if (evalDiff <= -300) {  
			annotation = this.annotations.BLUNDER;
			comment = `Loses ${Math.abs(Math.round(playerDiff))} centipawns`;
		} else if (playerDiff <= -150) {
			annotation = this.annotations.MISTAKE;
			comment = `Loses ${Math.abs(Math.round(playerDiff))} centipawns`;
		} else if (playerDiff <= -75) {
			annotation = this.annotations.INACCURACY;
			comment = `Loses ${Math.abs((playerDiff).toFixed(1))} centipawns`;
		} else if (playerDiff >= 100) {
			annotation = this.annotations.EXCELLENT;
			comment = `Gains ${(playerDiff).toFixed(1)} centipawns`;
		} else if (playerDiff >= 200 && isbestMove){
			annotation = this.annotations.BRILLIANT;
			comment = `Gains ${(playerDIff).toFixed(1)} centipawns, brilliant!`
		} else if (playerDiff >= 50) {
			annotation = this.annotations.GOOD;
			comment = `Gains ${(playerDiff).toFixed(1)} centipawns`;
		} else {
			annotation = this.annotations.GOOD;
			comment = isbestMove ? 'Best move' : 'Good move';
		}

		return {
			eval: afterEval,
			annotation,
			comment,
		};
	}

	normalizeEval(sfeval, mateIn, color) {
		if (mateIn !== null) {
			const mateValue = mateIn > 0 ? 2000 - Math.abs(mateIn) * 10 : -2000 + Math.abs(mateIn) * 10;
			return color === 'white' ? mateValue : -mateValue;
		}
		if (sfeval === null) return 0;
		return color === 'white' ? sfeval * 100 : -sfeval * 100;
	}

	isBookMove(bestMove) {
		return false;
	}

	updateSummary(summary, annotation, color) {
		const colorKey = color === 'white' ? 'white' : 'black';
		
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
			case '✓':
				summary.good[colorKey]++;
				break;
			case '!':
				summary.excellent[colorKey]++;
				break;
			case '!!':
				summary.brilliant[colorKey]++;
				break;
		}
	}

	calculateAccuracy(moves) {
		const whiteMoves = moves.filter(m => m.color === 'white');
		const blackMoves = moves.filter(m => m.color === 'black');

		const calculatePlayerAccuracy = playerMoves => {
			if (playerMoves.length === 0) return 100;

			let totalScore = 0;
			let maxScore = 0;

			for (const move of playerMoves) {
				maxScore += 100;
				
				switch (move.annotation.symbol) {
					case '??': // Blunder
						totalScore += 10;
						break;
					case '?': // Mistake
						totalScore += 40;
						break;
					case '?!': // Inaccuracy
						totalScore += 70;
						break;
					case '✓': // Good
						totalScore += 85;
						break;
					case '!': // Excellent
						totalScore += 95;
						break;
					case '!!': // Brilliant
						totalScore += 100;
						break;
					case '📓': // Book
						totalScore += 90;
						break;
					default:
						totalScore += 85;
						break;
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
		try {
			const analysisResult = await analyzePosition(fen, { searchTime: this.searchTime });

			return {
				fen,
				eval: analysisResult.eval || 0,
				mateIn: analysisResult.mateIn,
				bestMove: analysisResult.bestMove,
				evaluation: this.getPositionEvaluation(analysisResult.eval, analysisResult.mateIn),
			};
		} catch (error) {
			log.error(`${LOG_NAME}: Position analysis failed: ${error.message}`);
			throw error;
		}
	}

	getPositionEvaluation(sfeval, mateIn) {
		if (mateIn !== null) {
			return mateIn > 0 ? `Mate in ${mateIn}` : `Mate in ${Math.abs(mateIn)}`;
		}

		if (!sfeval) sfeval = 0;

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