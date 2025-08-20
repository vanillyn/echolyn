export const openingsDatabase = {
	"e4": {
		"name": "King's Pawn Game",
		"eco": "B00",
		"moves": ["e4"],
		"description": "> Best by test.\n> — [Bobby Fischer](https://en.wikipedia.org/wiki/Bobby_Fischer)\n1. e4, the King's Pawn Opening, is the most popular first move at all levels of the game. 1. e4 opens lines to develop the queen and the king's bishop. It also fights for control of the centre. ",
		"variations": ["e4-c5", "e4-e5"]
	},
	"e4-c5": {
		"name": "Sicilian Defense",
		"eco": "B20",
		"moves": ["e4", "c5"],
		"description": "The moves 1. e4 c5 constitute the Sicilian Defence, a counter-attacking opening in which players typically attack on opposite sides of the board. The Sicilian was introduced to the chess world in 1594 by Giulio Cesare Polerio and emerged into the mainstream in the early 20th century as a somewhat tame variation. With the discovery of new attacking ideas, it became Black's most feared weapon by the 1950s and is, pound for pound, the most exhaustively analysed of all openings.",
		"variations": ["e4-c5-Nf3", "e4-c5-Nc3"]
	},
	"e4-c5-Nc3": {
		"name": "Sicilian Defense: Closed",
		"eco": "B23",
		"moves": ["e4", "c5", "Nc3"],
		"description": "Closed Sicilian is a strategical opening that often leads to a slow white kingside attack. Black usually fights for counterplay on the queenside. Much less played than the main line 2. Nf3, this opening is a good alternative against Sicilian experts.",
		"variations": ["e4-c5-Nc3-Nc6", "e4-c5-Nc3-d6"]
	},
	"e4-c5-Nc3-Nc6": {
		"name": "Sicilian Defense: Closed, Traditional",
		"eco": "B23",
		"moves": ["e4", "c5", "Nc3", "Nc6"],
		"description": "Most of the time in the Sicilian, White puts their Knight on c3. White may yet play d4, but for the moment the question is yet to be answered. White's second move of 2. Nc3 suggests the possibility of NOT playing d4 (avoiding the exchange), and playing a closed position instead of the slashing, attacking types of position, that are more common to the Sicilian Defence. Leads to 3. g3 g6 4. Bg2 Bg7 5. d3 d6 ",
		"variations": ["e4-c5-Nc3-Nc6-g3", "e4-c5-Nc3-Nc6-Bb5"]
	},
	"d4": {
		"name": "Queen's Pawn Game",
		"eco": "A40",
		"moves": ["d4"],
		"description": "1. d4 is the Queen's pawn opening. With 1. d4 White looks to take over control of the centre. The pawn directly controls the c5 and e5 squares, and White's queen now 'sees' the d4 square. 1. d4 is also a developing move in that it opens a diagonal for the queen's bishop to venture into the game later.",
		"variations": ["d4-Nf6", "d4-d5"]
	},
	"d4-Nf6": {
		"name": "Indian Defense",
		"eco": "A45",
		"moves": ["d4", "Nf6"],
		"description": "Black controls e4 while developing a knight. This is the most flexible response to 1. d4. Black doesn't commit a pawn to the centre yet. They may yet do so, or they can fight for the centre in the hypermodern way: controlling it from afar with pieces, allowing White to construct their pawn centre but undermining it later with timely pawn advances.",
		"variations": ["d4-Nf6-c4", "d4-Nf6-Nf3"]
	},
	"d4-Nf6-c4": {
		"name": "Indian Defense: Normal Variation",
		"eco": "A50",
		"moves": ["d4", "Nf6", "c4"],
		"description": "White takes more space and increases the control of the important d5 square. This move order allows White's queenside knight to develop to the active c3 square without blocking the c-pawn.",
		"variations": ["d4-Nf6-c4-e6", "d4-Nf6-c4-g6"]
	},
	"d4-Nf6-c4-g6": {
		"name": "Indian Defense: West Indian Defense",
		"eco": "E60",
		"moves": ["d4", "Nf6", "c4", "g6"],
		"description": "With 2...g6, Black commits to a hypermodern development strategy. They will fianchetto their dark-squared bishop with ...Bg7 and attempt to exert pressure on White's center with pieces and timely pawn breaks. After 2...g6 certain themes are already evident. Preservation of the dark-square bishop will be vital for Black's safety after castling kingside. 2...g6 weakens the dark squares around Black's king; without the dark-square bishop to control squares like f6 and h6, these weaknesses can be fatal. The g7 bishop is not purely a defensive piece, however. White must be aware that opening the center by pawn exchanges may very well unleash the bishop's power by giving it a clear diagonal towards White's queenside.",
		"variations": ["d4-Nf6-c4-g6-Nc3", "d4-Nf6-c4-g6-g3"]
	},
	"d4-Nf6-Nf3": {
		"name": "Indian Defense: Knights Variation",
		"eco": "A46",
		"moves": ["d4", "Nf6", "Nf3"],
		"description": "This move keeps White's options open: they can first see how Black intends to play before deciding on a response. If, for example, White likes to play against the King's Indian defence with c4, but wants to avoid lines involving c4 and ...e6, they can lead with 2. Nf3 and answer 2...g6 with 3. c4 but 2...e6 with (e.g.) 3. Bg5.",
		"variations": ["d4-Nf6-Nf3-g6", "d4-Nf6-Nf3-e6"]
	},
	"d4-Nf6-Nf3-g6": {
		"name": "East Indian Defense",
		"eco": "A48",
		"moves": ["d4", "Nf6", "Nf3", "g6"],
		"description": "A transposition position as White has yet to commit to playing c4, and Black has not committed the d-pawn to either d5 or d6.",
		"variations": ["d4-Nf6-Nf3-g6-c4", "d4-Nf6-Nf3-g6-g3"]
	},
	"c4": {
		"name": "English Opening",
		"eco": "A10",
		"moves": ["c4"],
		"description": "The English Opening, which starts with 1.c4, is the fourth most commonly played opening move in chess. By playing this move, White allows the queen to move freely and also discourages Black from responding with 1...d5. Additionally, White ensures that the c-pawn will not be blocked behind a knight on c3. The resulting positions often resemble those that arise from 1.d4 openings rather than 1.e4 openings, and the move d4 is frequently played later on.",
		"variations": ["c4-Nf6", "c4-e5"]
	},
	"c4-Nf6": {
		"name": "English Opening: Anglo-Indian Defense",
		"eco": "A15",
		"moves": ["c4", "Nf6"],
		"description": "Black keeps their options open with this move. After a d4 advance by white, the game may transpose into an Indian defence.",
		"variations": ["c4-Nf6-Nc3", "c4-Nf6-g3"]
	},
	"c4-Nf6-Nc3": {
		"name": "English Opening: Anglo-Indian Defense, Queen's Knight Variation",
		"eco": "A16",
		"moves": ["c4", "Nf6", "Nc3"],
		"description": "White reinforces the attack on the d5 square and keeps his options open. Black has a variety of answers here, aiming for a King's Indian setup with 2...g6 is an interesting option, 2...e6 is also possible although white can choose to disrupt black's plan of reaching a Nimzo-Indian or QID setup by playing 3. e4 leading to the very sharp and tactical variations known collectively as the Mikenas Carls variation, which black is best advised to avoid if not prepared to face them.",
		"variations": ["c4-Nf6-Nc3-g6", "c4-Nf6-Nc3-e5"]
	},
	"c4-Nf6-Nc3-e5": {
		"name": "English Opening: King's English Variation, Two Knights Variation",
		"eco": "A22",
		"moves": ["c4", "Nf6", "Nc3", "e5"],
		"description": "This position, also reachable through the move orders 1...e5/2.Nc3 Nf6, can lead to two important variations of the English opening depending on how white chooses to develop. 3.Nf3 is the natural developing move and more often than not it leads to the English four knights variation simply because black must defend his pawn and the most practical way to do it is with 3...Nc6. After this white will usually develop his bishop to g2 and castle kingside. Black has a variety of options against this variation including the pinning of the knight on c3 with the dual idea of advancing the pawn on e5 and inflicting doubled pawns.",
		"variations": ["c4-Nf6-Nc3-e5-Nf3", "c4-Nf6-Nc3-e5-g3"]
	},
	"c4-e5": {
		"name": "English Opening: King's English Variation",
		"eco": "A20",
		"moves": ["c4", "e5"],
		"description": "This move creates a reverse Sicilian but it's White's move and the aim for White to create an advantage leads generally to different positions.\nWhite's choices are now:",
		"variations": ["c4-e5-Nc3", "c4-e5-g3"]
	},
	"c4-e5-Nc3": {
		"name": "English Opening: King's English Variation, Reversed Sicilian",
		"eco": "A21",
		"moves": ["c4", "e5", "Nc3"],
		"description": "An instant way of reinforcing the attack on d5, Nc3 is the standard second move of the independent lines of the English opening. This move is also useful because it allows 3.Nf3, although some players prefer to play the Bremen System with 3.g3 preparing for 4.Bg2, and thus increasing control over d5 and keeping two good options for the development of the king's knight (a standard Nf3 or Ne2, which keeps the long diagonal open and offers some protection against the pinning and possible exchange of the other knight).",
		"variations": ["c4-e5-Nc3-Nf6", "c4-e5-Nc3-Nc6"]
	},
	"c4-e5-Nc3-Nc6": {
		"name": "English Opening: King's English Variation, Reversed Closed Sicilian",
		"eco": "A25",
		"moves": ["c4", "e5", "Nc3", "Nc6"],
		"description": "r1bqkbnr/pppp1ppp/2n5/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR w",
		"variations": ["c4-e5-Nc3-Nc6-g3", "c4-e5-Nc3-Nc6-Nf3"]
	},
	"Nf3": {
		"name": "Zukertort Opening",
		"eco": "A04",
		"moves": ["Nf3"],
		"description": "1. Nf3, the Zukertort opening, is the 3rd most popular initial move. It's a sophisticated way of stalling for time. White reckons that Nf3 will almost certainly be a useful move sooner or later, whereas every pawn move is an irrevocable commitment. 1. Nf3 has the benefit of preventing Black's 1...e5 reply, which is a move that Black likes to play for all the same reasons that White likes to play 1. e4. White's options are kept flexible since White could intend to play theRéti Openingor theKing's Indian Attack, although it can easily transpose into something else, including theSicilian Defence. Other reasons for playing 1. Nf3 go something along the lines of:",
		"variations": ["Nf3-Nf6", "Nf3-d5"]
	},
	"f4": {
		"name": "Bird Opening",
		"eco": "A02",
		"moves": ["f4"],
		"description": "Bird’s Opening is an aggressive and less common opening, named after the chess player Henry Bird.  This opening weakens the h4-to-e1 diagonal, and weakens White’s kingside, but helps control the centre and is good for players who don’t want to study openings. Black can respond with1...d5(Dutch variation) or1...e5(From’s Gambit); if White accepts the gambit, it creates more kingside weakness, and White must play carefully as a mate is easily seen with 2…d6 3. exd6 Bxd6 4. Nc3 Qh4+ 5. g3 Qxg3+ 6. hxg3 Bxg3#. Overall, this opening can be fun for club players and can usually lead to a tactical and aggressive game.",
		"variations": ["f4-d5", "f4-Nf6"]
	},
	"f4-d5": {
		"name": "Bird Opening: Dutch Variation",
		"eco": "A03",
		"moves": ["f4", "d5"],
		"description": "From here, one possible reply is to treat the position as aDutch Defencereversed. As in the Dutch, white can either fianchetto with 2. g3 (Leningrad Dutch) or go for the Stonewall with 2. e3, soon followed by d4 and c3.",
		"variations": ["f4-d5-Nf3", "f4-d5-b3"]
	},
	"g3": {
		"name": "Hungarian Opening",
		"eco": "A00",
		"moves": ["g3"],
		"description": "1. g3, the Hungarian Opening (also known as theBenko's Openingand theKing's Fianchetto Opening) is the 5th most popular initial move. It is highly transpositional, and can lead to many other mainstream openings. This move doesn't immediately influence the center, but White prepares to fianchetto the Bishop to g2, which does. Thehypermodernschool of opening theory, most influential in the 1920s and 1930s, was all about controlling the center from a distance with pieces rather than occupying it with pawns. Hypermodernists claimed that while a large center could very well be a boon, it could also end up being a target that would need the rest of White’s forces to babysit it. The move 1. g3 has many long term prospects of applying pressure on the center and Black's queenside. The ease with which White can castle Kingside often aids White's position. When playing this opening, White will often adopt the King’s Indian Attack (or Barcza System), with a Bishop on g2, a Knight on f3, and kingside castling. Black can mirror White's move with 1…g6, thus entering the hypermodernFianchetto. Analysis shows that, as with most openings, the positions arising from the Hungarian Opening are equal, or perhaps just a little bit more comfortable for White. Black has plenty of responses, the most popular of which being moves like 1…d5 or 1…e5, which place a pawn in the center and gain space. Nevertheless, even responses such as the bizarre 1…h5?! (known as theLasker Simul Special) have been tried before, surprisingly only giving White a slight edge.",
		"variations": ["g3-d5", "g3-Nf6"]
	},
	"g3-Nf6": {
		"name": "Hungarian Opening: Indian Defense",
		"eco": "A00",
		"moves": ["g3", "Nf6"],
		"description": "Black responds to White’s hypermodern idea with a hypermodern idea of their own. By developing the knight to f6, Black is playing a flexible move that allows for many transpositions to occur, while also attacking the centre from afar.",
		"variations": ["g3-Nf6-Bg2", "g3-Nf6-c4"]
	},
	"e3": {
		"name": "Van't Kruijs Opening",
		"eco": "A00",
		"moves": ["e3"],
		"description": "An irregular opening, considered somewhat passive. Play may transpose to lines of theEnglish Opening(c2–c4),Queen's Pawn Game(d2–d4), or reversedFrench Defence(delayed d2–d4), reversedDutch Defence(f2–f4) positions or the modern variation ofLarsen's Opening(b2–b3),orKing's Isa Reverse Opening(e4–e5)",
		"variations": ["e3-Nf6", "e3-d5"]
	},
	"d3": {
		"name": "Mieses Opening",
		"eco": "A00",
		"moves": ["d3"],
		"description": "This move is playable but not played much as it does little to claim the center and potentially locks in the light squared bishop. It would normally transpose into theKing's Indian Attack, or with colours reversed, aModern,Pirc, orKing's Indian defence.",
		"variations": ["d3-d5", "d3-e5"]
	},
	"f3": {
		"name": "Barnes Opening",
		"eco": "A00",
		"moves": ["f3"],
		"description": "The Barnes Opening is a rarely-played and passive first move that gives Black a slight advantage. In fact, it is arguably White's worst possible first move. It deprives the white king's knight of the f3 square. It opens the e1–h4 diagonal, exposing the white king. While it controls e4, White could have done that by playing 1. e4 right away. ",
		"variations": []
	},
	"f3-e5-g4-qh4": {
		"name": "Barnes Opening: Fool's Mate",
		"eco": "NC",
		"moves": ["f3", "e5", "g4", "Qh4#"],
		"description": "The fool's mate is the quickest possible checkmate in the game. It isn't played often, but is notable for being the fastest possible way to lose.",
        "variations": []
	},
	"h4": {
		"name": "Kádas Opening",
		"eco": "A00",
		"moves": ["h4"],
		"description": "TheDesprez Opening(orKádas Opening) is a rare kingside flank opening. It does little for development, does not fight for control of the center, and weakens White's kingside. It frees the rook, but the rook normally does not go to h3. It could be said that White has made their position worse, as castling kingside is now less attractive. Due to the near-uselessness of this opening, it is rarely seen among serious chess players. However, it could be used to throw off the opponent.",
		"variations": ["h4-d5", "h4-e5"]
	},
	"a3": {
		"name": "Anderssen's Opening",
		"eco": "A00",
		"moves": ["a3"],
		"description": "This opening move does little for development or control of the center. White can transpose into other openings later, but the tempo loss is usually not ideal.",
		"variations": ["a3-d5", "a3-e5", "a3-Nf6"]
	},
	"a3-d5": {
		"name": "Anderssen's Opening: d5 Variation",
		"eco": "A00",
		"moves": ["a3", "d5"],
		"description": "Black immediately contests the center. White may respond with d4 or e4 to develop a more standard position.",
		"variations": []
	},
	"a3-e5": {
		"name": "Anderssen's Opening: e5 Variation",
		"eco": "A00",
		"moves": ["a3", "e5"],
		"description": "Black occupies the center with e5. White can prepare c4 or d4 to challenge the center.",
		"variations": []
	},
	"e4-e5-Nf3-Nc6-Bc4": {
		"name": "Italian Game",
		"eco": "C50",
		"moves": ["e4", "e5", "Nf3", "Nc6", "Bc4"],
		"description": "White aims for quick development and central control. Leads to open tactical positions.",
		"variations": ["e4-e5-Nf3-Nc6-Bc4-Bc5", "e4-e5-Nf3-Nc6-Bc4-Nf6", "e4-e5-Nf3-Nc6-Bc4-Bc5-b4"]
	},
	"e4-e5-Nf3-Nc6-Bc4-Bc5": {
		"name": "Giuoco Piano",
		"eco": "C53",
		"moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
		"description": "The classic quiet Italian Game, aiming for slow buildup and control of the center.",
		"variations": []
	},
	"e4-e5-Nf3-Nc6-Bc4-Nf6": {
		"name": "Two Knights Defense",
		"eco": "C55",
		"moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"],
		"description": "Black develops actively with Nf6, allowing tactical possibilities like the Fried Liver Attack.",
		"variations": []
	},
	"e4-e5-Nf3-Nc6-Bc4-Bc5-b4": {
		"name": "Evans Gambit",
		"eco": "C51",
		"moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"],
		"description": "White sacrifices a pawn for rapid development and attacking chances against Black's king.",
		"variations": []
	},
	"e4-e5-Qh5-Nc6-Bc4-Nf6-Qxf7#": {
		"name": "Scholar's Mate",
		"eco": "C20",
		"moves": ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"],
		"description": "A quick four-move checkmate targeting the f7 pawn. Commonly used against beginners.",
		"variations": ["e4-e5-Qh5-Nc6-Qxf7#", "e4-e5-Qf3-Nc6-Bc4-Nf6-Qxf7#"]
	},
	"e4-e5-Qh5-Nc6-Qxf7#": {
		"name": "Scholar's Mate: Qh5 Variation",
		"eco": "C20",
		"moves": ["e4", "e5", "Qh5", "Nc6", "Qxf7#"],
		"description": "White delivers the mate with queen immediately after minor piece development.",
		"variations": []
	},
	"e4-e5-Qf3-Nc6-Bc4-Nf6-Qxf7#": {
		"name": "Scholar's Mate: Qf3 Variation",
		"eco": "C20",
		"moves": ["e4", "e5", "Qf3", "Nc6", "Bc4", "Nf6", "Qxf7#"],
		"description": "An alternate route for Scholar's Mate with the queen on f3 instead of h5.",
		"variations": []
	},
	"e4-c6": {
		"name": "Caro-Kann Defense",
		"eco": "B12",
		"moves": ["e4", "c6"],
		"description": "A solid defense where Black prepares d5. Known for resilience and strategic depth.",
		"variations": ["e4-c6-d4-d5-e5", "e4-c6-d4-d5-Nc3-dxe4", "e4-c6-d4-d5-exd5-cxd5-c4"]
	},
	"e4-c6-d4-d5-e5": {
		"name": "Caro-Kann: Advance Variation",
		"eco": "B12",
		"moves": ["e4", "c6", "d4", "d5", "e5"],
		"description": "White pushes e5 early, gaining space and restricting Black's pieces.",
		"variations": []
	},
	"e4-c6-d4-d5-Nc3-dxe4": {
		"name": "Caro-Kann: Classical Variation",
		"eco": "B13",
		"moves": ["e4", "c6", "d4", "d5", "Nc3", "dxe4"],
		"description": "White develops naturally while Black exchanges in the center.",
		"variations": []
	},
	"e4-c6-d4-d5-exd5-cxd5-c4": {
		"name": "Caro-Kann: Panov-Botvinnik Attack",
		"eco": "B14",
		"moves": ["e4", "c6", "d4", "d5", "exd5", "cxd5", "c4"],
		"description": "White aims for an isolated queen's pawn structure and active piece play.",
		"variations": []
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