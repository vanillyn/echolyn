import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { drawBoard } from '../utils/drawBoard';
import { hexToRgba, isCheckmate, isInCheck } from '../utils/utils';

export default {
	data: new SlashCommandBuilder()
		.setName('position')
		.setDescription('generate a chess board image based on a position from a FEN string')
		.addStringOption(option =>
			option
				.setName('fen')
				.setDescription('The FEN string representing the chess position.')
				.setRequired(true)
				.addChoices(
					{
						name: 'Starting Position',
						value: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
					},
					{
						name: "Fool's Mate",
						value: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
					},
					{
						name: 'Italian Game',
						value: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
					},
					{
						name: "Queen's Gambit",
						value: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2',
					}
				)
		)
		.addStringOption(option =>
			option
				.setName('light_color')
				.setDescription('Light square color in hex (e.g., #E6E6E6). Default: #E6E6E6')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('dark_color')
				.setDescription('Dark square color in hex (e.g., #707070). Default: #707070')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('border_color')
				.setDescription('Border color in hex (e.g., #1E1E1E). Default: #1E1E1E')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('check_color')
				.setDescription('Check highlight color in hex (e.g., #FF0000). Default: #FF0000')
				.setRequired(false)
		)
		.addStringOption(option =>
			option
				.setName('piece_set')
				.setDescription('Piece set to use (e.g., pixel, alpha). Default: pixel')
				.setRequired(false)
		),

	async execute(interaction) {
		await interaction.deferReply();
		const fen = interaction.options.getString('fen');
		
		let pos;
		try {
			const setup = parseFen(fen).unwrap();
			pos = Chess.fromSetup(setup).unwrap();
		} catch (error) {
			return interaction.editReply(
				'Invalid FEN string. Please provide a valid chess position in FEN format.'
			);
		}

		const options = {
			lightColor: hexToRgba(interaction.options.getString('light_color')),
			darkColor: hexToRgba(interaction.options.getString('dark_color')),
			borderColor: hexToRgba(interaction.options.getString('border_color')),
			checkColor: hexToRgba(interaction.options.getString('check_color')),
			pieceSet: interaction.options.getString('piece_set') || 'pixel',
		};

		try {
			const checkSquare = pos.isCheck() ? getKingSquare(pos, pos.turn) : null;
			const buffer = await drawBoard(fen, checkSquare, pos.isCheckmate(), options);
			
			let statusText = '';
			if (pos.isCheckmate()) {
				const winner = pos.turn === 'white' ? 'Black' : 'White';
				statusText = `(${winner} wins by checkmate)`;
			} else if (pos.isCheck()) {
				statusText = '(Check)';
			} else if (pos.isStalemate()) {
				statusText = '(Stalemate)';
			} else if (pos.isInsufficientMaterial()) {
				statusText = '(Draw - Insufficient material)';
			}

			const embed = new EmbedBuilder()
				.setTitle(`Chess Position ${statusText}`)
				.setDescription(`Chess position from \`${fen}\``)
				.setImage('attachment://chessboard.png')
				.setColor('#e6e6e6');
				
			await interaction.editReply({
				embeds: [embed],
				files: [{ attachment: buffer, name: 'chessboard.png' }],
			});
		} catch (error) {
			console.error(error);
			await interaction.editReply('An error occurred while rendering the chess board.');
		}
	},
};

function getKingSquare(pos, color) {
	const board = pos.board;
	for (let square = 0; square < 64; square++) {
		const piece = board.get(square);
		if (piece && piece.role === 'king' && piece.color === color) {
			const file = square % 8;
			const rank = Math.floor(square / 8);
			return { rank, file };
		}
	}
	return null;
}