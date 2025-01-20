import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { readFile } from 'fs/promises';
import { Player } from './player';
import { Game } from './game';

export const sheetProvider = {
  provide: 'SHEET_PROVIDER',
  useFactory: async () => {

    let creds = JSON.parse(await readFile(__dirname + "/../key.json", "utf8"));
    let config = JSON.parse(await readFile(__dirname + "/../caps-track-config.json", "utf8"));

    // Initialize auth - see https://theoephraim.github.io/node-google-spreadsheet/#/guides/authentication
    const serviceAccountAuth = new JWT({
      // env var values here are copied from service account credentials generated by google
      // see "Authentication" section in docs for more info
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    let sheet_service = new SheetService(new GoogleSpreadsheet(config['spreadsheet-id'], serviceAccountAuth));
    await sheet_service.init();
    return sheet_service;
  }
}

class SheetService {
  constructor(private sheet: GoogleSpreadsheet) {
  }

  async init() {
    await this.sheet.loadInfo();
  }

  private gameSheet() {
    return this.sheet.sheetsById[0];
  }
  private playerSheet() {
    return this.sheet.sheetsById[1272448402];
  }

  async newGame(player1, player2, player3, player4) {
    console.assert((new Set([player1, player2, player3, player4])).size == 4, "Players must be unique");
    let sheet = this.gameSheet();
    let id = await sheet.getRows().then(rows => {
      let id = rows.length;
      sheet.addRow({ id: id, creator: 'TODO', datetime: new Date(), player1: player1, player2: player2, player3: player3, player4: player4, active: true });
      return id;
    });
    return id;
  }

  getAllPlayers(): Promise<any[]> {
    let sheet = this.playerSheet();
    return sheet.getRows().then(rows => rows.map(row => { return Player.fromRow(row) }));
  }

  async getGame(id) {
    if (id === undefined) {
      throw new Error("requested game id is undefined");
    }
    let sheet = this.gameSheet();
    return sheet.getRows().then(rows => rows.find(row => row.get('id') == id)).then(row => {
      if (typeof row === 'undefined') {
        throw new Error(`game with id ${id} not found`);
      } else {
        return Game.fromRow(row)
      }
    });
  }


  async getPlayers(ids: any[]) {
    if (ids.includes(undefined)) {
      throw new Error("one of the requested player ids is undefined");
    }
    let sheet = this.playerSheet();
    return sheet.getRows().then(rows => rows.filter(row => ids.includes(row.get('id')))).then(rows => rows.map(row => { return { id: row.get('id'), name: row.get('name') } }));
  }

  async activeAndConcludedGames(): Promise<[any, any]> {
    let sheet = this.gameSheet();
    return sheet.getRows().then(rows => {
      let pred = row => typeof row.get('endedAt') === 'undefined';
      return [rows.filter(pred).map(Game.fromRow), rows.filter(row => !pred(row)).map(Game.fromRow)];
    });
  }

  getPointSheet() {
    return this.sheet.sheetsById[537839588];
  }

  async isGameActive(gameId) {
    let game = this.getGame(gameId);
    return game.then(game => typeof game.endedAt === 'undefined');
  }

  async endGame(gameId, datetime) {
    return this.isGameActive(gameId).then(isActive => {
      if (!isActive) {
        throw new Error(`Game ${gameId} already ended`);
      }
      else {
        return this.gameSheet().getRows().then(rows => rows.find(row => row.get('id') == gameId)).then(row => {
          row.set('endedAt', datetime);
          return row.save();
        })
      }
    });
  }

  async addPoint(gameId, playerId, double, datetime) {
    let pointSheet = this.getPointSheet();
    return this.isGameActive(gameId).then(isActive => {
      if (!isActive) {
        throw new Error("Game is not active");
      }
      else {
        return pointSheet.addRow({ gameId: gameId, double: double, playerId: playerId, datetime: datetime });
      }
    });
  }

  /// returns score in the form (player1_and_player2, player3_and_player4)
  async getScore(gameId) {
    let pointSheet = this.getPointSheet();
    let game = this.getGame(gameId);
    let pointRows = pointSheet.getRows().then(rows => rows.filter(row => row.get('gameId') == gameId));
    return Promise.all([game, pointRows]).then(([game, pointRows]) => {
      return pointRows.reduce((acc, row) => {
        if ([game.player1id, game.player2id].includes(row.get('playerId'))) {
          acc[0] += 1;
        }
        if ([game.player3id, game.player4id].includes(row.get('playerId'))) {
          acc[1] += 1;
        }
        return acc;
      }, [0, 0]);
    });
  }
}