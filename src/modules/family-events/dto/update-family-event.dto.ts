import { PartialType } from '@nestjs/swagger';
import { CreateFamilyEventDto } from './create-family-event.dto';

export class UpdateFamilyEventDto extends PartialType(CreateFamilyEventDto) {}
