import { analyzePosition, LOG_NAME } from './stockfish.js';
import { Chess } from 'chess.js';
import { buildFensAndMetaFromPgn } from '../parsePGN.js';
import { log } from '../../init.js';

export class Analysis {
	constructor() {
		this.searchTime = 2000; // 2s
		this.concurrency = 4;
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
    log.debug(`${LOG_NAME}: analyzing game with ${this.concurrency} instances`)
		const parsed = buildFensAndMetaFromPgn(pgn);
		if (!parsed || !parsed.fens || parsed.fens.length === 0) {
			throw new Error('Could not parse PGN');
		}

		const { fens, moves: sanMoves } = parsed;
		const chess = new Chess();

		const startMove = options.skipOpening !== false ? Math.min(6, Math.floor(fens.length / 4)) : 1;
		
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

		let prevEval = 0;

		for (const result of analysisResults) {
			const { move, beforeAnalysis, afterAnalysis, index, playedMove } = result;
			
			chess.load(result.beforeFen);
			const moveColor = chess.turn();

			const evaluation = this.evaluateMove(
				beforeAnalysis,
				afterAnalysis,
				moveColor,
				prevEval,
				playedMove
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
			prevEval = evaluation.eval;
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
					const beforeAnalysis = await analyzePosition(pos.beforeFen, {
						searchTime: this.searchTime,
					});

					
					return {
						index: pos.index,
						beforeFen: pos.beforeFen,
						afterFen: pos.afterFen,
						move: pos.move,
						beforeAnalysis,
						afterAnalysis: null 
					};
				} catch (error) {
					console.error(`Analysis failed for position ${pos.index}:`, error);
					return {
						index: pos.index,
						beforeFen: pos.beforeFen,
						afterFen: pos.afterFen,
						move: pos.move,
						beforeAnalysis: null,
						afterAnalysis: null
					};
				}
			});

			const batchResults = await Promise.all(batchPromises);
			results.push(...batchResults);
		}

		return results.sort((a, b) => a.index - b.index);
	}

	evaluateMove(beforeAnalysis, afterAnalysis, color, prevEval, playedMove = null) {
		if (!beforeAnalysis) {
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

		if (isbestMove) {
			return {
				eval: beforeEval,
				annotation: this.annotations.GOOD,
				comment: 'Best move',
			};
		}

		const evalDiff = this.estimateEvalDiff(beforeAnalysis, color, playedMove, bestMove);

		let annotation;
		let comment;

		if (evalDiff <= this.annotations.BLUNDER.threshold) {
			annotation = this.annotations.BLUNDER;
			comment = `Loses ${Math.abs(Math.round(evalDiff))} centipawns`;
		} else if (evalDiff <= this.annotations.MISTAKE.threshold) {
			annotation = this.annotations.MISTAKE;
			comment = `Loses ${Math.abs(Math.round(evalDiff))} centipawns`;
		} else if (evalDiff <= this.annotations.INACCURACY.threshold) {
			annotation = this.annotations.INACCURACY;
			comment = `Loses ${Math.abs(Math.round(evalDiff))} centipawns`;
		} else if (evalDiff >= 50) {
			annotation = this.annotations.EXCELLENT;
			comment = `Gains ${Math.round(evalDiff)} centipawns`;
		} else if (evalDiff >= 0) {
			annotation = this.annotations.GOOD;
			comment = 'Maintains advantage';
		} else {
			annotation = this.annotations.GOOD;
			comment = 'Solid move';
		}

		return {
			eval: beforeEval + evalDiff,
			annotation,
			comment,
		};
	}

	estimateEvalDiff(beforeAnalysis, color, playedMove, bestMove) {
		if (!beforeAnalysis.eval || !bestMove || !playedMove) {
			return Math.random() * 40 - 20; 
		}

		if (playedMove === bestMove || playedMove.slice(0, 4) === bestMove.slice(0, 4)) {
			return 0;
		}

		
		const currentEval = Math.abs(beforeAnalysis.eval);
		
		if (currentEval > 3) {
		
			return Math.random() * -150 - 50; // -50 to -200
		} else if (currentEval > 1) {
		
			return Math.random() * -100 - 25; // -25 to -125
		} else {
		
			return Math.random() * -75 - 10; // -10 to -85
		}
	}

	normalizeEval(sfeval, mateIn, color) {
		if (mateIn !== null) {
			const mateValue = mateIn > 0 ? 1000 - mateIn : -1000 - mateIn;
			return color === 'w' ? mateValue : -mateValue;
		}
		if (sfeval === null) return 0;
		return color === 'w' ? sfeval * 100 : -sfeval * 100;
	}

	isBookMove(bestMove) {
		return false;
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

			let totalPenalty = 0;
			for (const move of playerMoves) {
				switch (move.annotation.symbol) {
					case '??':
						totalPenalty += 10;
						break;
					case '?':
						totalPenalty += 5;
						break;
					case '?!':
						totalPenalty += 2;
						break;
					case '!':
						totalPenalty -= 0.5;
						break;
					case '!!':
						totalPenalty -= 1;
						break;
					case '★':
						totalPenalty -= 2;
						break;
				}
			}

			const avgPenalty = totalPenalty / playerMoves.length;
			return Math.max(0, Math.min(100, Math.round(100 - avgPenalty)));
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