import { spawn } from 'node:child_process';
import { log } from '../../init';

const STOCKFISH_CONFIG = {
	threads: Math.min(6, require('os').cpus().length),
	hashSize: 512,
	depth: 20,
	multiPV: 1,
};

export const LOG_NAME = 'fish';

export async function analyzePosition(
	fen,
	{ searchTime = 2000, depth = STOCKFISH_CONFIG.depth } = {}
) {
	log.debug(`${LOG_NAME}: analyzing position ${fen}`);
	return new Promise((resolve, reject) => {
		const sf = spawn('stockfish', [], { stdio: ['pipe', 'pipe', 'pipe'] });

		let bestMove = null;
		let evalScore = null;
		let mateIn = null;
		let resolved = false;
		let buffer = '';

		const cleanup = () => {
			if (!sf.killed) sf.kill();
		};

		const timeout = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				cleanup();
				reject(new Error('Analysis timeout'));
			}
		}, searchTime + 2000);

		sf.stdout.on('data', data => {
			buffer += data.toString();
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.startsWith('info') && line.includes('score')) {
					const parts = line.split(' ');
					const scoreIdx = parts.indexOf('score');
					if (scoreIdx !== -1 && parts[scoreIdx + 1]) {
						if (parts[scoreIdx + 1] === 'cp' && parts[scoreIdx + 2]) {
							evalScore = parseInt(parts[scoreIdx + 2], 10) / 100;
						} else if (parts[scoreIdx + 1] === 'mate' && parts[scoreIdx + 2]) {
							mateIn = parseInt(parts[scoreIdx + 2], 10);
						}
					}
				}

				if (line.startsWith('bestmove') && !resolved) {
					resolved = true;
					clearTimeout(timeout);
					bestMove = line.split(' ')[1];
					cleanup();
					resolve({ bestMove, eval: evalScore, mateIn });
					return;
				}
			}
		});

		sf.on('error', err => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timeout);
				cleanup();
				reject(new Error(`Stockfish error: ${err.message}`));
			}
		});

		sf.on('close', code => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timeout);
				reject(new Error(`Stockfish exited with code ${code}`));
			}
		});

		sf.stdin.write('uci\n');
		sf.stdin.write(`setoption name Threads value ${STOCKFISH_CONFIG.threads}\n`);
		sf.stdin.write(`setoption name Hash value ${STOCKFISH_CONFIG.hashSize}\n`);
		sf.stdin.write(`setoption name MultiPV value ${STOCKFISH_CONFIG.multiPV}\n`);
		sf.stdin.write('uciok\n');
		sf.stdin.write('isready\n');
		sf.stdin.write(`position fen ${fen}\n`);

		if (depth && depth < 20) {
			sf.stdin.write(`go depth ${depth}\n`);
		} else {
			sf.stdin.write(`go movetime ${searchTime}\n`);
		}
	});
}

class StockfishPool {
	constructor(maxInstances = 4) {
		this.maxInstances = maxInstances;
		this.instances = [];
		this.queue = [];
	}

	async analyze(fen, options = {}) {
		return new Promise((resolve, reject) => {
			this.queue.push({ fen, options, resolve, reject });
			this.processQueue();
		});
	}

	processQueue() {
		if (this.queue.length === 0) return;
		if (this.instances.length >= this.maxInstances) return;

		const job = this.queue.shift();
		this.runAnalysis(job);
	}

	async runAnalysis({ fen, options, resolve, reject }) {
		const instanceId = this.instances.length;
		this.instances.push(instanceId);

		try {
			const result = await analyzePosition(fen, options);
			resolve(result);
		} catch (error) {
			reject(error);
		} finally {
			const index = this.instances.indexOf(instanceId);
			if (index > -1) {
				this.instances.splice(index, 1);
			}
			setTimeout(() => this.processQueue(), 10);
		}
	}
}

export const stockfishPool = new StockfishPool(4);

export async function analyzePositionPooled(fen, options = {}) {
	return stockfishPool.analyze(fen, options);
}
