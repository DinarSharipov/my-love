import { ForbiddenException, Injectable } from '@nestjs/common';
import { FamilyMemberRole, FamilyStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface FamilyContext {
  familyId: string;
  memberId: string;
  role: FamilyMemberRole;
  timeZone: string;
  locale: string;
  defaultCurrency: string;
}

@Injectable()
export class FamilyMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(userId: string): Promise<FamilyContext> {
    const membership = await this.prisma.familyMember.findUnique({
      where: { userId },
      select: {
        id: true,
        familyId: true,
        role: true,
        family: {
          select: {
            status: true,
            timeZone: true,
            locale: true,
            defaultCurrency: true,
          },
        },
      },
    });

    if (!membership || membership.family.status !== FamilyStatus.ACTIVE) {
      throw new ForbiddenException('An active family membership is required');
    }

    return {
      familyId: membership.familyId,
      memberId: membership.id,
      role: membership.role,
      timeZone: membership.family.timeZone,
      locale: membership.family.locale,
      defaultCurrency: membership.family.defaultCurrency,
    };
  }

  async requirePartner(userId: string): Promise<FamilyContext> {
    const context = await this.requireMembership(userId);
    if (context.role !== FamilyMemberRole.PARTNER) {
      throw new ForbiddenException('A partner membership is required');
    }
    return context;
  }
}
