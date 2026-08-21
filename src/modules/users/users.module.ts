import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { MediaModule } from '../media/media.module';
import { UsersAvatarController } from './users-avatar.controller';

@Module({
  imports: [MediaModule],
  controllers: [UsersController, UsersAvatarController, TelegramController],
  providers: [UsersService, TelegramService],
  exports: [UsersService, TelegramService],
})
export class UsersModule {}
