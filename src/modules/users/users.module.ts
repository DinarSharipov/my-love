import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  controllers: [UsersController, TelegramController],
  providers: [UsersService, TelegramService],
  exports: [UsersService, TelegramService],
})
export class UsersModule {}
