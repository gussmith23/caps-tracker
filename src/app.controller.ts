import { Body, Controller, Get, Inject, Param, Post, Render, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, @Inject('SHEET_PROVIDER') private sheet) { }

  @Get()
  @Render('index')
  async getIndex() {
    return Promise.all([this.sheet.activeAndConcludedGames(), this.sheet.getAllPlayers()]).then(([[activeGames, concludedGames], players]) => {
      return { activeGames: activeGames, concludedGames: concludedGames, players: players };
    });
  }

  @Post('newGame')
  async postNewGame(@Res() res, @Body() body) {
    let id = await this.sheet.newGame(body.player1, body.player2, body.player3, body.player4);
    res.redirect(`/game/${id}`);
  }

  @Post('game/:id/addPoint')
  async addPoint(@Res() res, @Param() params, @Body() body) {
    await this.sheet.addPoint(params.id, body.playerId, body.double != undefined, new Date());
    res.redirect(`/game/${params.id}`);
  }

  @Get('game/:id')
  @Render('game')
  async getGame(@Param() params) {
    let game = await this.sheet.getGame(params.id);
    let [player1, player2, player3, player4] = await this.sheet.getPlayers([game.player1, game.player2, game.player3, game.player4]);
    let score = await this.sheet.getScore(params.id);

    return { game: game, player1: player1, player2: player2, player3: player3, player4: player4, team1Score: score[0], team2Score: score[1] };
  }
}
