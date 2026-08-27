import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { MediaModule } from '../media/media.module';
import { MessengerController } from './messenger.controller';
import { MessengerGateway } from './messenger.gateway';
import { MessengerService } from './messenger.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [DatabaseModule, FamilyMembersModule, MediaModule, PushModule, JwtModule.register({})],
  controllers: [MessengerController],
  providers: [MessengerService, MessengerGateway],
  exports: [MessengerService],
})
export class MessengerModule {}
