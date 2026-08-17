import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { CreateChildProfileDto, UpdateChildProfileDto } from './dto/child-profile.dto';

@Injectable()
export class ChildProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
  ) {}

  async create(userId: string, dto: CreateChildProfileDto) {
    const { familyId } = await this.membership.requirePartner(userId);
    return this.prisma.childProfile.create({
      data: {
        familyId,
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        birthDate: new Date(dto.birthDate),
        avatarUrl: dto.avatarUrl ?? null,
      },
    });
  }
  async list(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.childProfile.findMany({
      where: { familyId },
      orderBy: [{ firstName: 'asc' }, { createdAt: 'asc' }],
    });
  }
  async export(userId: string, id: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const child = await this.prisma.childProfile.findFirst({
      where: { id, familyId },
      include: {
        tasks: { orderBy: [{ createdAt: 'asc' }] },
        events: { where: { deletedAt: null }, orderBy: [{ scheduledAt: 'asc' }] },
      },
    });
    if (!child) throw new NotFoundException('The child profile does not exist');
    const { tasks, events, ...profile } = child;
    return { profile, tasks, events };
  }
  async update(userId: string, id: string, dto: UpdateChildProfileDto) {
    const { familyId } = await this.membership.requirePartner(userId);
    const existing = await this.prisma.childProfile.findFirst({ where: { id, familyId } });
    if (!existing) throw new NotFoundException('The child profile does not exist');
    return this.prisma.childProfile.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        avatarUrl: dto.avatarUrl,
      },
    });
  }
  async remove(userId: string, id: string): Promise<void> {
    const { familyId } = await this.membership.requirePartner(userId);
    const result = await this.prisma.childProfile.deleteMany({ where: { id, familyId } });
    if (!result.count) throw new NotFoundException('The child profile does not exist');
  }
}
