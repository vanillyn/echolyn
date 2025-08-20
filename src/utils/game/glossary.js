export const chessGlossary = {
	'white': {
		name: 'White',
		definition: 'The player who moves first in chess. White pieces are traditionally light-colored and occupy ranks 1 and 2 at the start of the game.',
		image: 'white.png'
	},
	'black': {
		name: 'Black',
		definition: 'The player who moves second in chess. Black pieces are traditionally dark-colored and occupy ranks 7 and 8 at the start of the game.',
		image: 'black.png'
	},
	'pawn': {
		name: 'Pawn',
		definition: 'The weakest chess piece, worth about 1 point. Pawns move forward one square (two on first move) and capture diagonally. They can promote to any piece except a king when reaching the opposite end.',
		image: 'pawn.png'
	},
	'bishop': {
		name: 'Bishop',
		definition: 'A chess piece worth about 3 points. Bishops move diagonally any number of squares. Each player starts with two bishops: one on light squares and one on dark squares.',
		image: 'bishop.png'
	},
	'knight': {
		name: 'Knight',
		definition: 'A chess piece worth about 3 points. Knights move in an L-shape: two squares in one direction and one square perpendicular. Knights are the only pieces that can jump over other pieces.',
		image: 'knight.png'
	},
	'rook': {
		name: 'Rook',
		definition: 'A chess piece worth about 5 points. Rooks move horizontally or vertically any number of squares. They are essential for castling and controlling open files.',
		image: 'rook.png'
	},
	'queen': {
		name: 'Queen',
		definition: 'The most powerful chess piece, worth about 9 points. The queen combines the movement of a rook and bishop, moving any number of squares horizontally, vertically, or diagonally.',
		image: 'queen.png'
	},
	'king': {
		name: 'King',
		definition: 'The most important chess piece. The king moves one square in any direction. The objective is to checkmate the opponent\'s king. The king cannot move into check.',
		image: 'king.png'
	},
	'file': {
		name: 'File',
		definition: 'A vertical column of squares on the chessboard, labeled a-h from left to right (from White\'s perspective). Files are important for piece coordination and tactics.',
		image: 'file.png'
	},
	'rank': {
		name: 'Rank',
		definition: 'A horizontal row of squares on the chessboard, numbered 1-8 from bottom to top (from White\'s perspective). Ranks are important for piece positioning and pawn structure.',
		image: 'rank.png'
	},
	'checkmate': {
		name: 'Checkmate',
		definition: 'The game-ending position where a king is in check and has no legal moves to escape capture. This results in an immediate victory for the attacking player.',
		image: 'checkmate.png'
	},
	'check': {
		name: 'Check',
		definition: 'A position where a king is under attack and must be moved to safety, the attacking piece captured, or the attack blocked on the next move.',
		image: 'check.png'
	},
	'stalemate': {
		name: 'Stalemate',
		definition: 'A drawn position where the player to move has no legal moves but their king is not in check. This results in a draw, not a win.',
		image: 'stalemate.png'
	},
    'draw': {
        name: 'Draw by Insufficient Material',
        definition: 'A drawn position where both players do not have sufficient material to checkmate the other, for example, two kings.',
        image: 'draw.png'
    },
	'castling': {
		name: 'Castling',
		definition: 'A special move involving the king and a rook. The king moves two squares toward the rook, and the rook moves to the square the king crossed. Can only be done under specific conditions.',
		image: 'castling.png'
	},
	'en-passant': {
		name: 'En Passant',
		definition: 'A special pawn capture that can occur when an opponent\'s pawn moves two squares forward from its starting position and lands beside your pawn.',
		image: 'en-passant.png'
	},
	'promotion': {
		name: 'Promotion',
		definition: 'When a pawn reaches the opposite end of the board, it must be promoted to any piece except a king (usually a queen). This is the only way to get more than one queen.',
		image: 'promotion.png'
	},
	'pin': {
		name: 'Pin',
		definition: 'A tactic where a piece cannot or should not move because it would expose a more valuable piece behind it to attack.',
		image: 'pin.png'
	},
	'fork': {
		name: 'Fork',
		definition: 'A tactic where one piece attacks two or more enemy pieces simultaneously, forcing the opponent to lose material.',
		image: 'fork.png'
	},
    'board': {
        name: 'Chess Board',
        definition: 'A chess board is a checkered board with 64 squares, with coordinates assigned to each square based on their rank and file.',
        image: 'board.png'
    },
    'setup': {
        name: 'Set-up Chess Board',
        definition: 'Chess boards are set up by having 8 rooks on the second and 7th rank, with the 2nd having the white pieces and the 7th having the black pieces. Then, the white and black king is placed on the e-file, on the first rank for each side (e1 for white, e8 for black). To the side of the king on the left for white and the right for black, the queen is placed. On the four corners of the board, the rooks are placed. And to the side of the rooks, the knights are placed. Each king and queen gets a bishop to their side as well.',
        image: 'setup.png'
    }
}

export function searchGlossary(query) {
	const results = []
	const searchTerm = query.toLowerCase()
	
	for (const [key, term] of Object.entries(chessGlossary)) {
		const matches = 
			term.name.toLowerCase().includes(searchTerm) ||
			term.definition.toLowerCase().includes(searchTerm)
			
		if (matches) {
			results.push({ key, ...term })
		}
	}
	
	return results
}