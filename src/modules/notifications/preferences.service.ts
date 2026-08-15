import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  NotificationPreferencesResponseDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification-preferences.dto';
@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}
  async get(userId: string): Promise<NotificationPreferencesResponseDto> {
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return row;
  }
  async update(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponseDto> {
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
    return row;
  }
}
