import { ApiProperty } from '@nestjs/swagger';
import { IsLocalDate } from '../../../common/validation/date-time.decorators';

export class CalendarQueryDto {
  @ApiProperty({ format: 'date', description: 'Inclusive date in the family timezone' })
  @IsLocalDate()
  dateFrom: string;

  @ApiProperty({ format: 'date', description: 'Exclusive date in the family timezone' })
  @IsLocalDate()
  dateTo: string;
}
