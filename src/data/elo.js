import EloRank from 'elo-rank'

export class EloSystem {
  constructor() {
    this.elo = new EloRank(32)
  }

  calculateRatingChange(playerRating, opponentRating, result) {
    const expectedA = this.elo.getExpected(playerRating, opponentRating)
    const expectedB = this.elo.getExpected(opponentRating, playerRating)
    
    let actualResult = 0
    if (result === 'win') actualResult = 1
    else if (result === 'draw') actualResult = 0.5
    
    const newPlayerRating = this.elo.updateRating(expectedA, actualResult, playerRating)
    const newOpponentRating = this.elo.updateRating(expectedB, 1 - actualResult, opponentRating)
    
    return {
      playerRating: Math.round(newPlayerRating),
      opponentRating: Math.round(newOpponentRating),
      playerChange: Math.round(newPlayerRating - playerRating),
      opponentChange: Math.round(newOpponentRating - opponentRating)
    }
  }

  isRated(games) {
    return games >= 5
  }

  getRatingClass(rating) {
    if (rating >= 2400) return 'Master'
    if (rating >= 2200) return 'Expert'  
    if (rating >= 2000) return 'Advanced'
    if (rating >= 1800) return 'Intermediate'
    if (rating >= 1600) return 'Beginner'
    return 'Novice'
  }
}

export const eloSystem = new EloSystem()