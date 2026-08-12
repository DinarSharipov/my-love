import { PartialType } from '@nestjs/swagger';
import { CreateFirstDateDto } from './create-first-date.dto';

export class UpdateFirstDateDto extends PartialType(CreateFirstDateDto) {}
