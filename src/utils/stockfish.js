import { spawn } from 'node:child_process'
import path from 'node:path'

export async function analyzePosition(fen, { searchTime = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    const sf = spawn(path.resolve('node_modules', 'stockfish', 'stockfish.js'))

    let bestMove = null
    let evalScore = null
    let mateIn = null

    const cleanup = () => sf.kill('SIGKILL')

    sf.stdout.on('data', (data) => {
      const line = data.toString().trim()
      if (line.startsWith('info')) {
        const parts = line.split(' ')
        const scoreIdx = parts.indexOf('score')
        if (scoreIdx !== -1) {
          if (parts[scoreIdx + 1] === 'cp') {
            evalScore = parseInt(parts[scoreIdx + 2], 10) / 100
          } else if (parts[scoreIdx + 1] === 'mate') {
            mateIn = parseInt(parts[scoreIdx + 2], 10)
          }
        }
      }
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ')
        bestMove = parts[1]
        cleanup()
        resolve({ bestMove, eval: evalScore, mateIn })
      }
    })

    sf.stdin.write('uci\n')
    sf.stdin.write('isready\n')
    sf.stdin.write(`position fen ${fen}\n`)
    sf.stdin.write(`go movetime ${searchTime}\n`)

    sf.on('error', (err) => {
      cleanup()
      reject(err)
    })
  })
}
