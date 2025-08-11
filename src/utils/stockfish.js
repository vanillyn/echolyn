import { spawn } from 'node:child_process'

export async function analyzePosition(fen, { searchTime = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    const sf = spawn('stockfish', [], { stdio: ['pipe', 'pipe', 'pipe'] })
    
    let bestMove = null
    let evalScore = null
    let mateIn = null
    let resolved = false
    let buffer = ''

    const cleanup = () => {
      if (!sf.killed) sf.kill()
    }

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        reject(new Error('Analysis timeout'))
      }
    }, searchTime + 2000)

    sf.stdout.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line
      
      for (const line of lines) {
        if (line.startsWith('info') && line.includes('score')) {
          const parts = line.split(' ')
          const scoreIdx = parts.indexOf('score')
          if (scoreIdx !== -1 && parts[scoreIdx + 1]) {
            if (parts[scoreIdx + 1] === 'cp' && parts[scoreIdx + 2]) {
              evalScore = parseInt(parts[scoreIdx + 2], 10) / 100
            } else if (parts[scoreIdx + 1] === 'mate' && parts[scoreIdx + 2]) {
              mateIn = parseInt(parts[scoreIdx + 2], 10)
            }
          }
        }
        
        if (line.startsWith('bestmove') && !resolved) {
          resolved = true
          clearTimeout(timeout)
          bestMove = line.split(' ')[1]
          cleanup()
          resolve({ bestMove, eval: evalScore, mateIn })
          return
        }
      }
    })

    sf.on('error', (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        cleanup()
        reject(new Error(`Stockfish error: ${err.message}`))
      }
    })

    sf.on('close', (code) => {
      if (!resolved) {
        resolved = true  
        clearTimeout(timeout)
        reject(new Error(`Stockfish exited with code ${code}`))
      }
    })

    // Send commands
    sf.stdin.write('uci\n')
    sf.stdin.write(`position fen ${fen}\n`)  
    sf.stdin.write(`go movetime ${searchTime}\n`)
  })
}