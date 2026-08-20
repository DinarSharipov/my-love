import { PartialType } from '@nestjs/swagger';
import { CreateTaskRoutineDto } from './create-task-routine.dto';

export class UpdateTaskRoutineDto extends PartialType(CreateTaskRoutineDto) {}
