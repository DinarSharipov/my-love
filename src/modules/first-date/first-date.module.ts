import { Module } from '@nestjs/common';
import { FirstDateController } from './first-date.controller';
import { FirstDateService } from './first-date.service';

@Module({
  controllers: [FirstDateController],
  providers: [FirstDateService],
})
export class FirstDateModule {}
