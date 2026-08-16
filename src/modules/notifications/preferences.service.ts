import { BadRequestException, Injectable } from '@nestjs/common';
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
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.notificationPreference.findUnique({ where: { userId } });
      const next = {
        quietHoursEnabled: dto.quietHoursEnabled ?? current?.quietHoursEnabled ?? false,
        quietHoursStart: dto.quietHoursStart ?? current?.quietHoursStart ?? null,
        quietHoursEnd: dto.quietHoursEnd ?? current?.quietHoursEnd ?? null,
      };
      if (
        next.quietHoursEnabled &&
        (!next.quietHoursStart ||
          !next.quietHoursEnd ||
          next.quietHoursStart === next.quietHoursEnd)
      ) {
        throw new BadRequestException('Enabled quiet hours require different start and end times');
      }
      return tx.notificationPreference.upsert({
        where: { userId },
        create: { userId, ...dto },
        update: dto,
      });
    });
  }
}
