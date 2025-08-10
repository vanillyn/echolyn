import sharp from 'sharp';
import path from 'node:path';

const squareSize = 64;
const boardSize = squareSize * 8;
const borderSize = 40;
const pieceScale = 0.85;

const defaultLightColor = { r: 230, g: 230, b: 230, alpha: 1 };
const defaultDarkColor = { r: 112, g: 112, b: 112, alpha: 1 };
const defaultBorderColor = { r: 30, g: 30, b: 30, alpha: 1 };
const defaultCheckColor = { r: 255, g: 0, b: 0, alpha: 0.5 };
const watermarkText = process.env.BOT_NAME || 'echolyn';

const pieceMap = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
const files = 'abcdefgh';
const ranks = '87654321';

async function createTextOverlay(text, width, height, fontSize = 24) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            fill="#ffffff" font-size="${fontSize}px" font-family="04b03">
        ${text}
      </text>
    </svg>
  `;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

export async function drawBoard(fen, checkSquare, isCheckmate, options = {}) {
  const lightColor = options.lightColor || defaultLightColor;
  const darkColor = options.darkColor || defaultDarkColor;
  const borderColor = options.borderColor || defaultBorderColor;
  const checkColor = options.checkColor || defaultCheckColor;
  const pieceSet = options.pieceSet || 'pixel';
  const fullSize = boardSize + borderSize * 2;

  const canvas = sharp({
    create: {
      width: fullSize,
      height: fullSize,
      channels: 4,
      background: borderColor
    }
  }).png();

  const boardBuffer = Buffer.alloc(boardSize * boardSize * 4);
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      const rankIdx = Math.floor(y / squareSize);
      const fileIdx = Math.floor(x / squareSize);
      const isDark = (rankIdx + fileIdx) % 2 === 1;
      let color = isDark ? darkColor : lightColor;
      if (checkSquare && checkSquare.rank === rankIdx && checkSquare.file === fileIdx) {
        color = checkColor;
      }
      const idx = (y * boardSize + x) * 4;
      boardBuffer[idx] = color.r;
      boardBuffer[idx + 1] = color.g;
      boardBuffer[idx + 2] = color.b;
      boardBuffer[idx + 3] = color.alpha * 255;
    }
  }

  const overlays = [{
    input: boardBuffer,
    raw: { width: boardSize, height: boardSize, channels: 4 },
    top: borderSize,
    left: borderSize
  }];

  const fenRanks = fen.split(' ')[0].split('/');
  let kingToRotate = null;
  if (isCheckmate && options.rotateKing) {
    const fenParts = fen.split(' ');
    const turn = fenParts[1] || 'w';
    for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
      let fileIdx = 0;
      for (const char of fenRanks[rankIdx]) {
        if (/\d/.test(char)) {
          fileIdx += parseInt(char, 10);
          continue;
        }
        const isWhite = char === char.toUpperCase();
        const pieceType = pieceMap[char.toLowerCase()];
        if (pieceType === 'K' && ((turn === 'w' && isWhite) || (turn === 'b' && !isWhite))) {
          kingToRotate = { rankIdx, fileIdx, isWhite };
        }
        fileIdx++;
      }
    }
  }

  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    let fileIdx = 0;
    for (const char of fenRanks[rankIdx]) {
      if (/\d/.test(char)) {
        fileIdx += parseInt(char, 10);
        continue;
      }
      const isWhite = char === char.toUpperCase();
      const pieceType = pieceMap[char.toLowerCase()];
      if (pieceType) {
        const pieceColor = isWhite ? 'w' : 'b';
        const pieceFile = path.resolve(`assets/${pieceSet}`, `${pieceColor}${pieceType}.png`);
        try {
          let pieceSharp = sharp(pieceFile);
          const pieceSize = Math.floor(squareSize * pieceScale);
          pieceSharp = pieceSharp.resize(pieceSize, pieceSize);
          if (isCheckmate && options.pieceColorOverride) {
            const { r, g, b, alpha } = options.pieceColorOverride;
            pieceSharp = pieceSharp
              .grayscale()
              .modulate({ brightness: 1, saturation: 0 })
              .tint({ r, g, b });
          } else if (isCheckmate) {
            pieceSharp = pieceSharp.grayscale();
          }
          let rotateAngle = 0;
          if (
            isCheckmate && options.rotateKing &&
            kingToRotate && kingToRotate.rankIdx === rankIdx && kingToRotate.fileIdx === fileIdx
          ) {
            rotateAngle = 90;
            pieceSharp = pieceSharp.rotate(rotateAngle, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
          }
          const pieceBuf = await pieceSharp.toBuffer();
          const offset = Math.floor((squareSize - pieceSize) / 2);
          overlays.push({
            input: pieceBuf,
            top: borderSize + rankIdx * squareSize + offset,
            left: borderSize + fileIdx * squareSize + offset
          });
        } catch (err) {
          console.error(`Failed to load or process piece ${pieceFile}: ${err.message}`);
        }
      }
      fileIdx++;
    }
  }

  for (let i = 0; i < 8; i++) {
    const fileLabel = await createTextOverlay(files[i], squareSize, borderSize, 28);
    overlays.push({
      input: fileLabel,
      top: fullSize - borderSize,
      left: borderSize + i * squareSize
    });

    const rankLabel = await createTextOverlay(ranks[i], borderSize, squareSize, 28);
    overlays.push({
      input: rankLabel,
      top: borderSize + i * squareSize,
      left: 0
    });
  }

  const watermarkWidth = borderSize * 3;
  const watermark = await createTextOverlay(watermarkText, watermarkWidth, borderSize, 16);
  overlays.push({
    input: watermark,
    top: 0,
    left: fullSize - watermarkWidth
  });

  return await canvas.composite(overlays).toBuffer();
}