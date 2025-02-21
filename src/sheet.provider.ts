import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { readFile } from 'fs/promises';
import { Player } from './player';
import { Game } from './game';
import { getConfig } from './config';
import { Point } from './point';
import { Item } from './item';
import { Font } from './font';

export const sheetProvider = {
  provide: 'SHEET_PROVIDER',
  useFactory: async () => {

    let config = await getConfig();
    let creds = JSON.parse(await readFile(__dirname + "/../config/" + config["keyfile"], "utf8"));

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

    // Check schemas.
    await Promise.all([Player.checkSchema(this.playerSheet()), Game.checkSchema(this.gameSheet()), Point.checkSchema(this.getPointSheet()), Item.checkSchema(this.getItemSheet()), Font.checkSchema(this.getFontSheet())]);
  }

  private getFontSheet() {
    return this.sheet.sheetsByTitle['fonts'];
  }

  private getItemSheet() {
    return this.sheet.sheetsByTitle['items'];
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
    return sheet.getRows().then(rows => {
      // Using apply here because Math.max doesn't take an array. Weird that we
      // need to pass null. Blame JavaScript.
      let id = Math.max.apply(null, rows.map(row => Number(row.get('id')))) + 1;
      let newGame = new Game(id, player1, player2, player3, player4, new Date());

      // This promise ensures that the game is added to the sheet before the id is returned.
      return newGame.addToSheet(sheet).then(_ => id);
    });
  }

  getAllPlayers(): Promise<any[]> {
    let sheet = this.playerSheet();
    return sheet.getRows().then(rows => rows.map(row => { return Player.fromRow(row) }));
  }

  async getAllPlayersMap(): Promise<Map<number, Player>> {
    let sheet = this.playerSheet();
    return sheet.getRows().then(rows => new Map(rows.map(row => { let player = Player.fromRow(row); return [player.id, player]; })));
  }

  async getAllGamesMap(): Promise<Map<number, Game>> {
    let sheet = this.gameSheet();
    return sheet.getRows().then(rows => new Map(rows.map(row => { let game = Game.fromRow(row); return [game.id, game]; })));
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
    return sheet.getRows().then(rows => {
      return ids.map(id => {
        let row = rows.find(row => row.get('id') == id);
        if (typeof row === 'undefined') {
          throw new Error(`player with id ${id} not found`);
        } else {
          return Player.fromRow(row);
        }
      })
    });
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

  /// Removes latest point from specified player in specified game.
  async removePoint(gameId, playerId) {
    let pointSheet = this.getPointSheet();
    return this.isGameActive(gameId).then(isActive => {
      if (!isActive) {
        throw new Error("Game is not active");
      }
      else {
        return pointSheet.getRows().then(rows => {
          let sortedRows = rows.filter(row => row.get('gameId') == gameId && row.get('playerId') == playerId).sort((a, b) => a.get('datetime') - b.get('datetime'));
          if (sortedRows.length) {
            sortedRows.pop().delete();
          }
        });
      }
    });
  }

  /// returns score in the form 
  /// [team 1 score (player1+player3), team 2 score (player2+player4),
  ///  player 1 score, player 2 score, player 3 score, player 4 score]
  async getScore(gameId) {
    let pointSheet = this.getPointSheet();
    let game = this.getGame(gameId);
    let pointRows = pointSheet.getRows().then(rows => rows.filter(row => row.get('gameId') == gameId));
    return Promise.all([game, pointRows]).then(([game, pointRows]) => {
      return pointRows.reduce((acc, row) => {
        let id = row.get('playerId');
        if (id === undefined) {
          throw new Error("playerId is undefined");
        }
        if (![game.player1id, game.player2id, game.player3id, game.player4id].includes(id)) {
          throw new Error(`playerId ${id} not in game ${gameId}`);
        }
        if (id === game.player1id) {
          acc[0] += 1;
          acc[2] += 1;
        }
        if (id === game.player2id) {
          acc[1] += 1;
          acc[3] += 1;
        }
        if (id === game.player3id) {
          acc[0] += 1;
          acc[4] += 1;
        }
        if (id === game.player4id) {
          acc[1] += 1;
          acc[5] += 1;
        }
        return acc;
      }, [0, 0, 0, 0, 0, 0]);
    });
  }

  async getPhrases() {
    let sheet = this.sheet.sheetsById[1119588355];
    return sheet.getRows().then(rows => rows.map(row => row.get('phrase')));
  }

  async renameGame(gameId: number, gameName: string) {
    let sheet = this.gameSheet();
    return sheet.getRows().then(rows => {
      let filtered = rows.filter(row => row.get('id') === gameId);
      if (filtered.length === 0) {
        throw new Error(`Game with id ${gameId} not found`);
      }
      if (filtered.length > 1) {
        throw new Error(`Multiple games with id ${gameId} found`);
      }
      let row = filtered[0];

      row.set('name', gameName);
      return row.save();
    });
  }

  // Returns
  // - Map from player id to [points scored, doubles scored].
  async getInterestingStats(): Promise<any> {
    let playerSheet = this.playerSheet();

    return Promise.all([this.playerSheet().getRows(), this.gameSheet().getRows(), this.getPointSheet().getRows()]).then(([playerRows, gameRows, pointRows]) => {
      // Rank players by points scored.

      // Points, with doubles/triples/etc computed.
      let processedPoints = Point.fromRows(pointRows);

      // Maps player id to a map from point type (nonneg integer) to number of
      // points of that type. (0 = single, 1 = double, 2 = triple, etc.)
      let playersToPointTypeMap = new Map();
      for (let point of processedPoints) {
        if (typeof point.double !== "number") {
          throw new Error("point.double is not a number");
        }
        if (!playersToPointTypeMap.has(point.playerId)) {
          playersToPointTypeMap.set(point.playerId, new Map());
        }
        let playerMap = playersToPointTypeMap.get(point.playerId);
        if (!playerMap.has(point.double)) {
          playerMap.set(point.double, 0);
        }
        playerMap.set(point.double, playerMap.get(point.double) + 1);
      }

      // Set of point types present. e.g. [0, 1] would indicate that only
      // singles and doubles are present in all the data.
      let allPointTypes = new Set();
      for (let [_, playerMap] of playersToPointTypeMap) {
        for (let pointType of playerMap.keys()) {
          allPointTypes.add(pointType);
        }
      }

      // Generate a map from point type to a list of [playerId, points of that
      // type], sorted by points.
      let pointTypeToSortedPlayersAndPoints = new Map();
      for (let pointType of allPointTypes) {
        let players = Array.from(playersToPointTypeMap.entries()).map(([playerId, playerMap]) => {
          let points = playerMap.get(pointType);
          if (points === undefined) {
            points = 0;
          }
          return [playerId, points];
        });
        pointTypeToSortedPlayersAndPoints.set(pointType, players.filter(([_, points]) => points > 0).sort((a, b) => b[1] - a[1]));
      }

      return pointTypeToSortedPlayersAndPoints;
    });
  }

  async getItemsMap(): Promise<Map<string, Item>> {
    let sheet = this.getItemSheet();
    return sheet.getRows().then(rows => new Map(rows.map(row => { let item = Item.fromRow(row); return [item.id, item]; })));
  }

  async getFontsMap(): Promise<Map<string, Font>> {
    let sheet = this.getFontSheet();
    return sheet.getRows().then(rows => new Map(rows.map(row => { let font = Font.fromRow(row); return [font.id, font]; })));
  }
}