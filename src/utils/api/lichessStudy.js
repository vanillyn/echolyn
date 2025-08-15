import { log } from '../../init.js';

export class LichessStudy {
  constructor() {
    this.baseUrl = 'https://lichess.org';
  }

  async searchStudies(query, options = {}) {
    const params = new URLSearchParams({
      q: query,
      max: options.max || 10
    });

    try {
      const response = await fetch(`${this.baseUrl}/study/search?${params}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Study search failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      log.error('Study search error:', error);
      return null;
    }
  }

  async getStudy(studyId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/study/${studyId}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch study: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      log.error('Study fetch error:', error);
      return null;
    }
  }

  async getStudyChapter(studyId, chapterId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/study/${studyId}/${chapterId}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch chapter: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      log.error('Chapter fetch error:', error);
      return null;
    }
  }

  async getStudyPgn(studyId, chapterId = null) {
    const url = chapterId 
      ? `${this.baseUrl}/study/${studyId}/${chapterId}.pgn`
      : `${this.baseUrl}/study/${studyId}.pgn`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PGN: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      log.error('PGN fetch error:', error);
      return null;
    }
  }

  parseStudyId(url) {
    const match = url.match(/lichess\.org\/study\/([a-zA-Z0-9]{8})/);
    return match ? match[1] : null;
  }

  parseChapterId(url) {
    const match = url.match(/lichess\.org\/study\/[a-zA-Z0-9]{8}\/([a-zA-Z0-9]{8})/);
    return match ? match[1] : null;
  }

  parseStudyData(studyData) {
    const chapters = studyData.chapters || [];
    
    return {
      id: studyData.id,
      name: studyData.name,
      description: studyData.description || '',
      author: studyData.ownerId,
      createdAt: studyData.createdAt,
      updatedAt: studyData.updatedAt,
      likes: studyData.likes || 0,
      views: studyData.views || 0,
      public: studyData.visibility === 'public',
      chapters: chapters.map(chapter => ({
        id: chapter.id,
        name: chapter.name,
        orientation: chapter.orientation || 'white'
      })),
      totalChapters: chapters.length
    };
  }

  parseChapterData(chapterData) {
    return {
      id: chapterData.id,
      name: chapterData.name,
      fen: chapterData.setup?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      orientation: chapterData.setup?.orientation || 'white',
      moves: this.parseMoves(chapterData.root),
      comments: this.parseComments(chapterData.root),
      arrows: this.parseShapes(chapterData.root, 'arrow'),
      circles: this.parseShapes(chapterData.root, 'circle')
    };
  }

  parseMoves(node, moves = []) {
    if (!node) return moves;
    
    if (node.san) {
      moves.push({
        san: node.san,
        fen: node.fen,
        comments: node.comments || []
      });
    }

    if (node.children) {
      for (const child of node.children) {
        this.parseMoves(child, moves);
      }
    }

    return moves;
  }

  parseComments(node, comments = []) {
    if (!node) return comments;

    if (node.comments) {
      comments.push(...node.comments.map(comment => ({
        text: comment.text,
        author: comment.by
      })));
    }

    if (node.children) {
      for (const child of node.children) {
        this.parseComments(child, comments);
      }
    }

    return comments;
  }

  parseShapes(node, type, shapes = []) {
    if (!node) return shapes;

    if (node.shapes) {
      const filtered = node.shapes.filter(shape => shape.brush === type);
      shapes.push(...filtered.map(shape => ({
        type: shape.brush,
        from: shape.orig,
        to: shape.dest,
        color: shape.color || 'blue'
      })));
    }

    if (node.children) {
      for (const child of node.children) {
        this.parseShapes(child, type, shapes);
      }
    }

    return shapes;
  }

  extractStudyInfo(url) {
    const studyId = this.parseStudyId(url);
    const chapterId = this.parseChapterId(url);
    
    if (!studyId) return null;
    
    return {
      studyId,
      chapterId,
      url: chapterId 
        ? `${this.baseUrl}/study/${studyId}/${chapterId}`
        : `${this.baseUrl}/study/${studyId}`
    };
  }
}

export const lichessStudies = new LichessStudy();