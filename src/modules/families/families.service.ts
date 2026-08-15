import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { FamilyResponseDto } from './dto/family-response.dto';

@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
  ) {}

  async findMine(userId: string): Promise<FamilyResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!family) throw new NotFoundException('Family not found');
    return FamilyResponseDto.fromEntity(family);
  }
}
