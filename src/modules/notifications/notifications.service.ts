import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
  ) {}
  async list(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.notification.findMany({
      where: { userId, OR: [{ familyId }, { familyId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
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
