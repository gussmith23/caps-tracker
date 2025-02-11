import { Body, Controller, Get, Inject, Param, Post, Render, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, @Inject('SHEET_PROVIDER') private sheet) { }

  @Get()
  @Render('index')
  async getIndex() {
    return Promise.all([this.sheet.getAllGamesMap(), this.sheet.getAllPlayersMap(), this.sheet.getPhrases(), this.sheet.getItemsMap()]).then(([gamesMap, playersMap, phrases, itemsMap]) => {
      let activeGameIds = [];
      let concludedGameIds = [];
      for (let game of gamesMap.values()) {
        if (game.endedAt) {
          concludedGameIds.push(game.id);
        } else {
          activeGameIds.push(game.id);
        }
      }
      return { activeGameIds: activeGameIds, concludedGameIds: concludedGameIds, playersMap: playersMap, gamesMap: gamesMap, phrase: phrases[Math.floor(Math.random() * phrases.length)], itemsMap };
    });
  }

  @Post('newGame')
  async postNewGame(@Res() res, @Body() body) {
    let id = await this.sheet.newGame(body.player1, body.player2, body.player3, body.player4);
    res.redirect(`/game/${id}`);
  }

  @Post('game/:id/addPoint')
  async addPoint(@Res() res, @Param() params, @Body() body) {
    try {
      await this.sheet.addPoint(params.id, body.playerId, body.double != undefined, new Date());
      res.redirect(`/game/${params.id}`);
    } catch (error) {
      res.status(400).send(error.message);
    }
  }

  @Post('game/:id/removePoint')
  async removePoint(@Res() res, @Param() params, @Body() body) {
    try {
      await this.sheet.removePoint(params.id, body.playerId);
      res.redirect(`/game/${params.id}`);
    } catch (error) {
      res.status(400).send(error.message);
    }
  }

  @Post('game/:id/endGame')
  async endGame(@Res() res, @Param() params) {
    await this.sheet.endGame(params.id, new Date());
    res.redirect(`/game/${params.id}`);
  }

  @Get('game/:id')
  @Render('game')
  async getGame(@Param() params, @Res() res) {
    try {
      let game = await this.sheet.getGame(params.id);
      let [player1, player2, player3, player4] = await this.sheet.getPlayers([game.player1id, game.player2id, game.player3id, game.player4id]);
      let [team1Score, team2Score, player1Score, player2Score, player3Score, player4Score] = await this.sheet.getScore(params.id);
      let itemsMap = await this.sheet.getItemsMap();
      return { game: game, player1: player1, player2: player2, player3: player3, player4: player4, team1Score, team2Score, player1Score, player2Score, player3Score, player4Score, itemsMap };
    } catch (error) {
      return res.status(400).send(error.message);
    }
  }

  @Post('game/:id/renameGame')
  async renameGame(@Res() res, @Param() params, @Body() body) {
    try {
      await this.sheet.renameGame(params.id, body.gameName);
      res.redirect(`/game/${params.id}`);
    } catch (error) {
      res.status(400).send(error.message);
    }
  }

  @Get('live')
  @Render('live')
  async getLive() {
    let [pointTypeToSortedPlayersAndPoints, allPlayersMap] = await Promise.all([this.sheet.getInterestingStats(), this.sheet.getAllPlayersMap()]);
    return { pointTypeToSortedPlayersAndPoints, allPlayersMap };
  }
}
