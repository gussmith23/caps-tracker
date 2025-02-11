import { GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from "google-spreadsheet"

export class Item {

  constructor(public id: string, public name: string, public icon: string, public price: number) { };

  static async checkSchema(arg0: GoogleSpreadsheetWorksheet): Promise<any> {
    return arg0.loadHeaderRow().then(_ => {
      let expectedHeaderValues = ['id', 'name', 'icon', 'price'];
      for (let expectedHeaderValue of expectedHeaderValues) {
        if (!arg0.headerValues.includes(expectedHeaderValue)) {
          throw new Error(`Item sheet missing field "${expectedHeaderValue}"`);
        }
      }
      for (let actualHeaderValue of arg0.headerValues) {
        if (!expectedHeaderValues.includes(actualHeaderValue)) {
          throw new Error(`Item sheet includes unexpected field "${actualHeaderValue}"`);
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
    return new Item(errorIfUndefined('id'), errorIfUndefined('name'), errorIfUndefined('icon'), errorIfUndefined('price'));
  }
};