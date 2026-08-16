import { ApiProperty } from '@nestjs/swagger';

export class FamilyDashboardEventDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, format: 'date-time' }) scheduledAt: Date;
}

export class FamilyDashboardResponseDto {
  @ApiProperty() openTasks: number;
  @ApiProperty() overdueTasks: number;
  @ApiProperty() uncheckedShoppingItems: number;
  @ApiProperty() unreadNotifications: number;
  @ApiProperty() upcomingEvents: number;
  @ApiProperty({ type: [FamilyDashboardEventDto] }) nextEvents: FamilyDashboardEventDto[];
  @ApiProperty({ type: String, format: 'date-time' }) generatedAt: Date;
}
