import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
  ) {}
  async list(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const notifications = await this.prisma.notification.findMany({
      where: { userId, OR: [{ familyId }, { familyId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return notifications.map((notification) => NotificationResponseDto.fromEntity(notification));
  }
  async listPaginated(userId: string, query: PaginationQueryDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    const where = { userId, OR: [{ familyId }, { familyId: null }] };
    const [total, notifications] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: notifications.map((notification) => NotificationResponseDto.fromEntity(notification)),
      ...paginationMeta(total, query.page, query.limit),
    };
  }
  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Notification not found');
  }
  async markAllRead(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, OR: [{ familyId }, { familyId: null }] },
      data: { readAt: new Date() },
    });
  }
}
