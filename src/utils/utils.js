export const hexToRgba = hex => {
	if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return null;
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return { r, g, b, alpha: 1 };
};

export function isInCheck(chess) {
    const isInCheck = chess.inCheck();
    let checkSquare = null;
	if (isInCheck) {
		const turn = chess.turn();
		const board = chess.board();
		for (let rank = 0; rank < 8; rank++) {
			for (let file = 0; file < 8; file++) {
				const square = board[rank][file];
				if (square && square.type === 'k' && square.color === turn) {
					checkSquare = { rank, file };
					break;
				}
			}
			if (checkSquare) break;
		}
		return { isInCheck, checkSquare };
	}
}

export function isCheckmate(chess) {
    if (chess.isCheckmate()) {
        const victor = chess.turn() === 'w' ? 'black' : 'white';
        return { checkmate: true, victor };
    }
    return { checkmate: false, victor: null };
}