export const openingsDatabase = {
  'italian-game': {
    name: 'Italian Game',
    eco: 'C50-C59',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'O-O', 'O-O'],
    description: 'One of the oldest chess openings, focusing on rapid development and control of the center. White develops the bishop to c4, targeting the f7 square.',
    explanation: 'The Italian Game emphasizes quick development and central control. The bishop on c4 puts immediate pressure on Black\'s kingside, particularly the weak f7 square. This opening leads to tactical, open positions where both sides can develop their pieces naturally.',
    history: {
      origin: '16th century Italy',
      notable_players: ['Gioachino Greco', 'Adolf Anderssen', 'Paul Morphy'],
      first_recorded: 'Around 1590 in Italian manuscripts'
    },
    variations: [
      {
        name: 'Hungarian Defense',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Be7'],
        description: 'Black develops the bishop defensively'
      },
      {
        name: 'Paris Defense',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'd6'],
        description: 'Solid but passive defense'
      }
    ]
  },
  'queens-gambit': {
    name: "Queen's Gambit",
    eco: 'D06-D69',
    moves: ['d4', 'd5', 'c4'],
    description: 'A classical opening where White offers a pawn to gain central control and rapid development.',
    explanation: 'The Queen\'s Gambit is not a true gambit since Black cannot hold the pawn. White aims to control the center with pawns and develop pieces harmoniously. It\'s one of the most respected openings at all levels.',
    history: {
      origin: '15th century',
      notable_players: ['Wilhelm Steinitz', 'José Raúl Capablanca', 'Garry Kasparov'],
      first_recorded: 'Mentioned in the Göttingen manuscript (1490)'
    },
    variations: [
      {
        name: 'Accepted',
        moves: ['d4', 'd5', 'c4', 'dxc4'],
        description: 'Black accepts the gambit pawn'
      },
      {
        name: 'Declined',
        moves: ['d4', 'd5', 'c4', 'e6'],
        description: 'Black maintains central tension'
      }
    ]
  },
  'ruy-lopez': {
    name: 'Ruy López',
    eco: 'C60-C99',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    description: 'Named after Spanish priest Ruy López, this opening puts pressure on the knight defending the e5 pawn.',
    explanation: 'The Spanish Opening creates subtle positional pressure. The bishop on b5 pins the knight and threatens to disrupt Black\'s pawn structure. It leads to rich middlegame positions with chances for both sides.',
    history: {
      origin: '16th century Spain',
      notable_players: ['Ruy López de Segura', 'Bobby Fischer', 'Garry Kasparov'],
      first_recorded: '1561 in Libro de la invención liberal y arte del juego del axedrez'
    },
    variations: [
      {
        name: 'Morphy Defense',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
        description: 'Most common response, questioning the bishop'
      },
      {
        name: 'Berlin Defense',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'],
        description: 'Solid defense popularized by Kramnik'
      }
    ]
  },
  'sicilian-defense': {
    name: 'Sicilian Defense',
    eco: 'B20-B99',
    moves: ['e4', 'c5'],
    description: 'Black\'s most popular and aggressive response to 1.e4, creating imbalanced positions.',
    explanation: 'The Sicilian Defense leads to sharp, tactical games where Black fights for the initiative from move one. It\'s statistically the most successful defense against 1.e4 and offers Black excellent winning chances.',
    history: {
      origin: '16th century Sicily',
      notable_players: ['Bobby Fischer', 'Garry Kasparov', 'Magnus Carlsen'],
      first_recorded: '1594 by Giulio Cesare Polerio'
    },
    variations: [
      {
        name: 'Najdorf',
        moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
        description: 'Sharp and complex variation'
      },
      {
        name: 'Dragon',
        moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'],
        description: 'Aggressive kingside fianchetto'
      }
    ]
  }
};

export function findOpening(moves) {
  const movesStr = moves.join(' ').toLowerCase();
  
  for (const [key, opening] of Object.entries(openingsDatabase)) {
    const openingMoves = opening.moves.map(m => m.toLowerCase()).join(' ');
    if (movesStr.startsWith(openingMoves) || openingMoves.startsWith(movesStr)) {
      return { key, ...opening };
    }
  }
  
  return null;
}

export function searchOpenings(query) {
  const results = [];
  const searchTerm = query.toLowerCase();
  
  for (const [key, opening] of Object.entries(openingsDatabase)) {
    const matches = 
      opening.name.toLowerCase().includes(searchTerm) ||
      opening.eco.toLowerCase().includes(searchTerm) ||
      opening.description.toLowerCase().includes(searchTerm);
      
    if (matches) {
      results.push({ key, ...opening });
    }
  }
  
  return results;
}