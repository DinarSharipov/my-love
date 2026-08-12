import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FamilyResponseDto } from './dto/family-response.dto';

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string): Promise<FamilyResponseDto> {
    const membership = await this.prisma.familyMember.findUnique({
      where: { userId },
      include: {
        family: {
          include: {
            members: {
              include: { user: true },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
    });
    if (!membership) throw new NotFoundException('You do not belong to a family');
    return FamilyResponseDto.fromEntity(membership.family);
  }
}
