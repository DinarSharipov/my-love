import { ApiProperty } from '@nestjs/swagger';
export class FamilyDashboardResponseDto {
  @ApiProperty() openTasks: number;
  @ApiProperty() overdueTasks: number;
  @ApiProperty() uncheckedShoppingItems: number;
  @ApiProperty() unreadNotifications: number;
  @ApiProperty() upcomingEvents: number;
  @ApiProperty({ type: [Object] }) nextEvents: Array<{
    id: string;
    name: string;
    scheduledAt: Date;
  }>;
  @ApiProperty() generatedAt: Date;
}
