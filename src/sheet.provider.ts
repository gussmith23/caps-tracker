import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { readFile } from 'fs/promises';


export const sheetProvider = {
  provide: 'SHEET_PROVIDER',
  useFactory: async () => {

    let creds = JSON.parse(await readFile(__dirname + "/../key.json", "utf8"));

    // Initialize auth - see https://theoephraim.github.io/node-google-spreadsheet/#/guides/authentication
    const serviceAccountAuth = new JWT({
      // env var values here are copied from service account credentials generated by google
      // see "Authentication" section in docs for more info
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return new SheetService(new GoogleSpreadsheet('19rXl2tC7fqCNWW45hP4MitOk0DBWzb_SDTUWP2xNTuA', serviceAccountAuth));
  }
}

class SheetService {
  constructor(private sheet: GoogleSpreadsheet) {
    sheet.loadInfo()
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
    return sheet.getRows().then(rows => rows.map(row => { return { id: row.get('id'), name: row.get('name') } }));
  }

  getGame(id) {
    if (id === undefined) {
      throw new Error("requested game id is undefined");
    }
    let sheet = this.gameSheet();
    return sheet.getRows().then(rows => rows.find(row => row.get('id') == id)).then(row => { return { id: row.get('id'), player1: row.get('player1'), player2: row.get('player2'), player3: row.get('player3'), player4: row.get('player4'), datetime: row.get('datetime') } });
  }

  async getPlayers(ids: any[]) {
    if (ids.includes(undefined)) {
      throw new Error("one of the requested player ids is undefined");
    }
    let sheet = this.playerSheet();
    return sheet.getRows().then(rows => rows.filter(row => row.get('id') in ids)).then(rows => rows.map(row => { return { id: row.get('id'), name: row.get('name') } }));
  }

  async activeAndConcludedGames(): Promise<[any, any]> {
    let sheet = this.gameSheet();
    return sheet.getRows().then(rows => {
      let pred = row => row.get('active');
      let convert = row => { return { id: row.get('id'), player1: row.get('player1'), player2: row.get('player2'), player3: row.get('player3'), player4: row.get('player4') } };
      return [rows.filter(pred).map(convert), rows.filter(row => !pred(row)).map(convert)];
    });
  }
}