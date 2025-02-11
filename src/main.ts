import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { formatDate, formatPlayer, itemToHtml, mapLookup } from 'hbs_helpers/helpers';
import { create, engine } from 'express-handlebars';
import { getConfig } from './config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.engine('.hbs', engine({ extname: '.hbs', helpers: { formatPlayer, mapLookup, formatDate, itemToHtml }, defaultLayout: 'default' }));
  app.setViewEngine('hbs');
  app.useStaticAssets(join(__dirname, '..', 'public'));
  const config = await getConfig();
  await app.listen(config.port);
}
bootstrap();
