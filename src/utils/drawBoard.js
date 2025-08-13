import puppeteer from 'puppeteer'
import fs from 'node:fs/promises'
import path from 'node:path'

// Default config
const DEFAULT_CONFIG = {
  size: 512,
  lightColor: '#f0d9b5',
  darkColor: '#b58863',
  borderColor: '#8b7355',
  coordinateColor: '#333',
  playerBgColor: 'rgba(255,255,255,0.1)',
  playerTextColor: '#ffffff',
  clockTextColor: '#ffffff',
  evalBarWhite: '#f0f0f0',
  evalBarBlack: '#333333',
  evalBarBorder: '#555555',
  evalTextColor: '#888888',
  watermarkColor: 'rgba(255,255,255,0.7)',
  arrowColor: 'rgba(0, 255, 0, 0.8)',
  checkColor: 'rgba(255, 0, 0, 0.4)',
  pieceSet: 'cburnett', // cburnett, merida, alpha, spatial, etc
  showCoordinates: true,
  coordinatePosition: 'inside', // inside, outside, none
  borderRadius: 8,
  shadowEnabled: true,
  arrowStyle: 'default', // default, thick, thin
  watermark: 'echolyn'
}

class ChessBoardRenderer {
  constructor() {
    this.browser = null
    this.configs = new Map() // userId -> config
  }

  async init() {
    this.browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }

  async close() {
    if (this.browser) await this.browser.close()
  }

  // Get user config or default
  getUserConfig(userId) {
    return { ...DEFAULT_CONFIG, ...this.configs.get(userId) }
  }

  // Update user config
  setUserConfig(userId, config) {
    const current = this.getUserConfig(userId)
    this.configs.set(userId, { ...current, ...config })
  }

  async renderBoard(fen, options = {}, userId = null) {
    const config = userId ? this.getUserConfig(userId) : DEFAULT_CONFIG
    const mergedOptions = { ...config, ...options }

    const page = await this.browser.newPage()
    
    try {
      await page.setViewport({ 
        width: mergedOptions.size + 300, 
        height: mergedOptions.size + 300 
      })
      
      const html = await this.generateHTML(fen, mergedOptions)
      
      await page.setContent(html, { waitUntil: 'networkidle0' })
      await page.waitForSelector('#board-container', { timeout: 5000 })
      
      // Wait a bit for pieces to load
      await page.waitForTimeout(500)
      
      const element = await page.$('#board-container')
      const buffer = await element.screenshot({ 
        type: 'png',
        omitBackground: false
      })
      
      return buffer
    } finally {
      await page.close()
    }
  }

  async generateHTML(fen, options) {
    const {
      size, flip = false, players = {}, clocks = {}, eval: evaluation, bestMove,
      checkSquare, lightColor, darkColor, borderColor, coordinateColor,
      playerBgColor, playerTextColor, clockTextColor, evalBarWhite, evalBarBlack,
      evalBarBorder, evalTextColor, watermarkColor, arrowColor, checkColor,
      pieceSet, showCoordinates, coordinatePosition, borderRadius,
      shadowEnabled, arrowStyle, watermark
    } = options

    const squareSize = size / 8
    const playerHeight = 32
    const evalWidth = 48
    const padding = 16
    
    const showPlayers = players.white || players.black || clocks.white || clocks.black
    const showEval = evaluation !== undefined
    
    const boardWidth = size
    const boardHeight = size + (showPlayers ? playerHeight * 2 + padding : 0)
    const totalWidth = boardWidth + (showEval ? evalWidth + padding : 0) + padding * 2
    const totalHeight = boardHeight + padding * 2

    // Convert piece images to base64 for embedding
    const pieceImages = await this.loadPieceImages(pieceSet)

    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      margin: 0; 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: ${borderColor}; 
      padding: 20px;
    }
    #board-container { 
      display: inline-block; 
      padding: ${padding}px; 
      background: ${borderColor};
      border-radius: ${borderRadius}px;
      ${shadowEnabled ? `box-shadow: 0 4px 12px rgba(0,0,0,0.3);` : ''}
      position: relative;
    }
    .content { 
      display: flex; 
      align-items: flex-start; 
      gap: ${padding}px;
    }
    .chess-board { 
      width: ${size}px; 
      height: ${size}px; 
      border: 2px solid ${borderColor};
      border-radius: 4px;
      position: relative;
      background: ${lightColor};
      overflow: hidden;
    }
    .square { 
      position: absolute; 
      width: ${squareSize}px; 
      height: ${squareSize}px; 
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .square.dark { background: ${darkColor}; }
    .square.light { background: ${lightColor}; }
    .square.check { 
      background: ${checkColor} !important; 
      ${shadowEnabled ? `box-shadow: inset 0 0 10px rgba(255,0,0,0.5);` : ''}
    }
    .piece { 
      width: ${squareSize * 0.9}px; 
      height: ${squareSize * 0.9}px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      ${shadowEnabled ? `filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.3));` : ''}
    }
    .coord { 
      position: absolute; 
      font-size: ${Math.max(10, size/45)}px; 
      color: ${coordinateColor};
      font-weight: 600;
      text-shadow: 1px 1px 1px rgba(255,255,255,0.8);
    }
    .coord.file { 
      bottom: ${coordinatePosition === 'outside' ? '-18px' : '2px'}; 
      right: ${coordinatePosition === 'outside' ? '50%' : '4px'};
      ${coordinatePosition === 'outside' ? 'transform: translateX(50%);' : ''}
    }
    .coord.rank { 
      top: ${coordinatePosition === 'outside' ? '-18px' : '2px'}; 
      left: ${coordinatePosition === 'outside' ? '50%' : '4px'};
      ${coordinatePosition === 'outside' ? 'transform: translateX(-50%);' : ''}
    }
    .player-info { 
      height: ${playerHeight}px; 
      width: ${size}px;
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      padding: 0 12px;
      background: ${playerBgColor};
      color: ${playerTextColor};
      font-size: 14px;
      margin: 4px 0;
      border-radius: 4px;
      ${shadowEnabled ? `box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);` : ''}
    }
    .player-name {
      font-weight: 500;
      color: ${playerTextColor};
    }
    .player-clock {
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: ${clockTextColor};
      background: rgba(0,0,0,0.2);
      padding: 2px 8px;
      border-radius: 3px;
    }
    .eval-bar {
      width: ${evalWidth}px;
      height: ${size}px;
      border: 2px solid ${evalBarBorder};
      border-radius: 4px;
      position: relative;
      overflow: hidden;
      ${shadowEnabled ? `box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);` : ''}
    }
    .eval-white { 
      background: linear-gradient(to bottom, ${evalBarWhite}, #e0e0e0); 
      position: absolute; 
      bottom: 0; 
      width: 100%; 
    }
    .eval-black { 
      background: linear-gradient(to bottom, #555, ${evalBarBlack}); 
      position: absolute; 
      top: 0; 
      width: 100%; 
    }
    .eval-label {
      position: absolute;
      width: 100%;
      text-align: center;
      top: 50%;
      transform: translateY(-50%);
      font-size: 11px;
      color: ${evalTextColor};
      font-weight: bold;
      font-family: 'Courier New', monospace;
      text-shadow: 1px 1px 1px rgba(255,255,255,0.8);
      background: rgba(255,255,255,0.9);
      margin: 0 4px;
      border-radius: 2px;
      padding: 1px 0;
    }
    .watermark {
      position: absolute;
      bottom: 6px;
      right: 12px;
      font-size: 11px;
      color: ${watermarkColor};
      font-weight: 500;
      text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
    }
    .arrow {
      position: absolute;
      pointer-events: none;
      z-index: 100;
    }
    .arrow-line {
      stroke: ${arrowColor};
      stroke-width: ${arrowStyle === 'thick' ? '8' : arrowStyle === 'thin' ? '4' : '6'};
      stroke-linecap: round;
      marker-end: url(#arrowhead);
      ${shadowEnabled ? `filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.4));` : ''}
    }
    .highlight {
      position: absolute;
      border: 3px solid ${arrowColor};
      border-radius: 50%;
      width: ${squareSize - 6}px;
      height: ${squareSize - 6}px;
      top: 3px;
      left: 3px;
      pointer-events: none;
      ${shadowEnabled ? `box-shadow: 0 0 8px ${arrowColor};` : ''}
    }
  </style>
</head>
<body>
  <div id="board-container">
    <div class="content">
      <div class="board-section">
        ${showPlayers ? this.generatePlayerInfo(players, clocks, flip, true, options) : ''}
        <div class="chess-board">
          ${this.generateSquares(size, flip, checkSquare, options)}
          ${this.generateCoordinates(size, flip, showCoordinates, coordinatePosition)}
          ${await this.generatePieces(fen, size, flip, pieceImages)}
          ${bestMove ? this.generateArrow(bestMove, size, flip, arrowColor, arrowStyle, shadowEnabled) : ''}
        </div>
        ${showPlayers ? this.generatePlayerInfo(players, clocks, flip, false, options) : ''}
      </div>
      ${showEval ? this.generateEvalBar(evaluation, size, options) : ''}
    </div>
    <div class="watermark">${watermark}</div>
  </div>
</body>
</html>`
  }

  generatePlayerInfo(players, clocks, flip, isTop, options) {
    const color = (isTop && !flip) || (!isTop && flip) ? 'black' : 'white'
    const player = players[color] || ''
    const clock = clocks[color] || ''
    
    if (!player && !clock) return ''
    
    return `<div class="player-info">
      <span class="player-name">${player}</span>
      ${clock ? `<span class="player-clock">${clock}</span>` : ''}
    </div>`
  }

  generateSquares(size, flip, checkSquare, options) {
    const squareSize = size / 8
    let squares = ''
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const isLight = (rank + file) % 2 === 0
        const displayRank = flip ? rank : 7 - rank
        const displayFile = flip ? 7 - file : file
        
        const left = displayFile * squareSize
        const top = displayRank * squareSize
        
        const isCheck = checkSquare && 
          checkSquare.rank === rank && 
          checkSquare.file === file
        
        squares += `<div class="square ${isLight ? 'light' : 'dark'} ${isCheck ? 'check' : ''}" 
          style="left: ${left}px; top: ${top}px;"></div>`
      }
    }
    
    return squares
  }

  generateCoordinates(size, flip, showCoordinates, coordinatePosition) {
    if (!showCoordinates || coordinatePosition === 'none') return ''
    
    const squareSize = size / 8
    const files = 'abcdefgh'
    const ranks = '12345678'
    let coords = ''
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const displayRank = flip ? rank : 7 - rank
        const displayFile = flip ? 7 - file : file
        
        const left = displayFile * squareSize
        const top = displayRank * squareSize
        
        // File coordinates on bottom rank
        if (rank === (flip ? 0 : 7)) {
          coords += `<div class="coord file" style="left: ${left}px; top: ${top}px;">${files[file]}</div>`
        }
        
        // Rank coordinates on left file
        if (file === (flip ? 7 : 0)) {
          coords += `<div class="coord rank" style="left: ${left}px; top: ${top}px;">${ranks[rank]}</div>`
        }
      }
    }
    
    return coords
  }

  async generatePieces(fen, size, flip, pieceImages) {
    const squareSize = size / 8
    const fenBoard = fen.split(' ')[0].split('/')
    let pieces = ''
    
    for (let rank = 0; rank < 8; rank++) {
      let file = 0
      const rankStr = fenBoard[rank]
      
      for (const char of rankStr) {
        if (/[1-8]/.test(char)) {
          file += parseInt(char)
          continue
        }
        
        const isWhite = char === char.toUpperCase()
        const pieceType = char.toLowerCase()
        const color = isWhite ? 'w' : 'b'
        const pieceKey = `${color}${pieceType.toUpperCase()}`
        
        const displayRank = flip ? rank : 7 - rank
        const displayFile = flip ? 7 - file : file
        
        const left = displayFile * squareSize + squareSize * 0.05
        const top = displayRank * squareSize + squareSize * 0.05
        
        const pieceImage = pieceImages[pieceKey]
        if (pieceImage) {
          pieces += `<div class="piece" style="
            left: ${left}px; 
            top: ${top}px;
            background-image: url('${pieceImage}');
          "></div>`
        }
        
        file++
      }
    }
    
    return pieces
  }

  generateEvalBar(evaluation, size, options) {
    let whitePercent = 0.5
    let label = '0.00'
    
    if (typeof evaluation === 'number') {
      if (Math.abs(evaluation) >= 100) {
        const mateIn = Math.abs(evaluation) - 100
        label = evaluation > 0 ? `M${mateIn}` : `M-${mateIn}`
        whitePercent = evaluation > 0 ? 0.95 : 0.05
      } else {
        const clamped = Math.max(-10, Math.min(10, evaluation))
        whitePercent = (clamped + 10) / 20
        label = (evaluation >= 0 ? '+' : '') + evaluation.toFixed(1)
      }
    }
    
    const whiteHeight = size * whitePercent
    const blackHeight = size - whiteHeight
    
    return `<div class="eval-bar">
      ${blackHeight > 0 ? `<div class="eval-black" style="height: ${blackHeight}px;"></div>` : ''}
      ${whiteHeight > 0 ? `<div class="eval-white" style="height: ${whiteHeight}px;"></div>` : ''}
      <div class="eval-label">${label}</div>
    </div>`
  }

  generateArrow(bestMove, size, flip, arrowColor, arrowStyle, shadowEnabled) {
    if (!bestMove || bestMove.length < 4) return ''
    
    const from = bestMove.slice(0, 2)
    const to = bestMove.slice(2, 4)
    
    const fromCoords = this.algebraicToPixels(from, size, flip)
    const toCoords = this.algebraicToPixels(to, size, flip)
    
    if (!fromCoords || !toCoords) return ''
    
    const strokeWidth = arrowStyle === 'thick' ? 8 : arrowStyle === 'thin' ? 4 : 6
    
    return `
      <svg class="arrow" style="width: ${size}px; height: ${size}px; position: absolute; top: 0; left: 0;">
        <defs>
          <marker id="arrowhead" markerWidth="12" markerHeight="10" 
                  refX="11" refY="5" orient="auto" markerUnits="strokeWidth">
            <polygon points="0 0, 12 5, 0 10" fill="${arrowColor}"/>
          </marker>
        </defs>
        <line x1="${fromCoords.x}" y1="${fromCoords.y}" 
              x2="${toCoords.x}" y2="${toCoords.y}" 
              class="arrow-line"/>
      </svg>`
  }

  algebraicToPixels(square, size, flip) {
    if (!square || square.length !== 2) return null
    
    const file = square.charCodeAt(0) - 97
    const rank = parseInt(square[1]) - 1
    
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
    
    const squareSize = size / 8
    const displayFile = flip ? 7 - file : file
    const displayRank = flip ? rank : 7 - rank
    
    return {
      x: displayFile * squareSize + squareSize / 2,
      y: displayRank * squareSize + squareSize / 2
    }
  }

  async loadPieceImages(pieceSet) {
    const pieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
    const images = {}
    
    for (const piece of pieces) {
      try {
        const piecePath = path.resolve('assets', pieceSet, `${piece}.png`)
        const imageBuffer = await fs.readFile(piecePath)
        const base64 = imageBuffer.toString('base64')
        images[piece] = `data:image/png;base64,${base64}`
      } catch (error) {
        console.warn(`Could not load piece: ${piece} from ${pieceSet}`)
        // Fallback to Unicode symbols if images fail
        const unicodePieces = {
          'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
          'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
        }
        // Create a simple SVG with Unicode symbol as fallback
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
          <text x="32" y="45" text-anchor="middle" font-size="48">${unicodePieces[piece]}</text>
        </svg>`
        images[piece] = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
      }
    }
    
    return images
  }
}

// Singleton instance
let boardRenderer = null

export async function initBoardRenderer() {
  if (!boardRenderer) {
    boardRenderer = new ChessBoardRenderer()
    await boardRenderer.init()
  }
  return boardRenderer
}

export async function drawBoard(fen, options = {}, userId = null) {
  const renderer = await initBoardRenderer()
  return await renderer.renderBoard(fen, options, userId)
}

export async function getUserConfig(userId) {
  const renderer = await initBoardRenderer()
  return renderer.getUserConfig(userId)
}

export async function setUserConfig(userId, config) {
  const renderer = await initBoardRenderer()
  renderer.setUserConfig(userId, config)
}

export { DEFAULT_CONFIG }