import { Player } from "src/player"
import { format } from "date-fns";
import { Item } from "src/item";

export function formatPlayer(player: Player, itemsMap: Map<string, Item>) {
  let style = "";
  if (player.fontName) {
    style += `font-family: '${player.fontName}', serif;`;
  }
  if (player.nameColor) {
    style += `color: ${player.nameColor};`;
  }
  if (player.fontWeight) {
    style += `font-weight: ${player.fontWeight};`;
  }

  let html = `<span style="${style}">${player.name}</span>`;

  if (player.equippedItemIds.length > 0) {
    if (player.equippedItemIds.length > 1) {
      throw new Error(`Not supported yet`);
    }
    let item = itemsMap.get(player.equippedItemIds[0]);
    let itemHtml = itemToHtml(item);
    // Stack the item above the existing html in an inline element.
    html = `<table class="align-middle" style="text-align:center;display:inline-table;"><tr><td>${itemHtml}</td></tr><tr><td>${html}</td></tr></table>`;
  }

  return html;
}

export function mapLookup(map: Map<any, any>, key: any) {
  return map.get(key);
}

export function formatDate(date: Date, formatString: string) {
  return format(date, formatString);
}

export function itemToHtml(item: Item) {
  if (item.icon.startsWith('base64:')) {
    return `<img src="${item.icon.slice(7)}" alt="${item.name}" />`;
  } else if (item.icon.startsWith('text:')) {
    return item.icon.slice(5);
  } else {
    throw new Error(`Item ${item.id} has invalid icon ${item.icon}`);
  }
}