import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskRoutinesController } from './task-routines.controller';
import { TaskRoutinesService } from './task-routines.service';
import { FamilyMembersModule } from '../family-members/family-members.module';
@Module({
  imports: [FamilyMembersModule],
  controllers: [TasksController, TaskRoutinesController],
  providers: [TasksService, TaskRoutinesService],
})
export class TasksModule {}
