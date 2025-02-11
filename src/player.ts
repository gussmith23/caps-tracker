import { assert } from "console";
import { GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from "google-spreadsheet"

export class Player {
  constructor(public id: number, public name: string, public nameColor: string, public fontName: string, public fontWeight: string, public unlockedItemIds: [string], public equippedItemIds: [string]) { };

  static async checkSchema(arg0: GoogleSpreadsheetWorksheet): Promise<any> {
    return arg0.loadHeaderRow().then(_ => {
      let expectedHeaderValues = ['id', 'name', 'nameColor', 'fontName', 'fontWeight', 'unlockedItemIds', 'equippedItemIds'];
      for (let expectedHeaderValue of expectedHeaderValues) {
        if (!arg0.headerValues.includes(expectedHeaderValue)) {
          throw new Error(`Player sheet missing field "${expectedHeaderValue}"`);
        }
      }
      for (let actualHeaderValue of arg0.headerValues) {
        if (!expectedHeaderValues.includes(actualHeaderValue)) {
          throw new Error(`Player sheet includes unexpected field "${actualHeaderValue}"`);
        }
      }
    })
  }


  static fromRow(row: GoogleSpreadsheetRow) {
    // TODO(@gussmith23): It feels like there should be a more TypeScript-y way
    // of doing this. Apparently get() can return undefined and there's no way
    // to make it fail if it does.
    let errorIfUndefined = (field: string) => {
      if (typeof row.get(field) === 'undefined') {
        throw new Error(`Player row is missing ${field}`);
      }
      return row.get(field);
    };
    let unlockedItemIds = row.get('unlockedItemIds');
    if (unlockedItemIds !== undefined) unlockedItemIds = unlockedItemIds.split(',').map(id => id.trim());
    else unlockedItemIds = [];
    let equippedItemIds = row.get('equippedItemIds');
    if (equippedItemIds !== undefined) equippedItemIds = equippedItemIds.split(',').map(id => id.trim());
    else equippedItemIds = [];
    for (let id of equippedItemIds) {
      if (!unlockedItemIds.includes(id)) {
        throw new Error(`Player has equipped item ${id} but does not have it unlocked`);
      }
    }
    return new Player(errorIfUndefined('id'), errorIfUndefined('name'), row.get('nameColor'), row.get('fontName'), row.get('fontWeight'), unlockedItemIds, equippedItemIds);
  }
};