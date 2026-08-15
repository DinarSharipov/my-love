import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { VersionConflictException } from '../../common/http/version-conflict.exception';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { CreateFirstDateDto } from './dto/create-first-date.dto';
import { firstDateInclude, FirstDateResponseDto } from './dto/first-date-response.dto';
import { UpdateFirstDateDto } from './dto/update-first-date.dto';

@Injectable()
export class FirstDateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
  ) {}

  async create(userId: string, dto: CreateFirstDateDto): Promise<FirstDateResponseDto> {
    const { familyId } = await this.membership.requirePartner(userId);

    try {
      const firstDate = await this.prisma.firstDate.create({
        data: {
          familyId,
          createdById: userId,
          name: dto.name,
          date: new Date(dto.date),
          description: dto.description || null,
        },
        include: firstDateInclude,
      });
      return FirstDateResponseDto.fromEntity(firstDate);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('The first date already exists');
      }
      throw error;
    }
  }

  async findMine(userId: string): Promise<FirstDateResponseDto> {
    const { familyId } = await this.membership.requirePartner(userId);
    const firstDate = await this.prisma.firstDate.findUnique({
      where: { familyId },
      include: firstDateInclude,
    });
    if (!firstDate) throw new NotFoundException('The first date does not exist');
    return FirstDateResponseDto.fromEntity(firstDate);
  }

  async update(
    userId: string,
    dto: UpdateFirstDateDto,
    expectedVersion?: number,
  ): Promise<FirstDateResponseDto> {
    const { familyId } = await this.membership.requirePartner(userId);
    if (dto.name === undefined && dto.date === undefined && dto.description === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }

    const firstDate = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.firstDate.findUnique({
        where: { familyId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('The first date does not exist');

      const result = await transaction.firstDate.updateMany({
        where: {
          familyId,
          ...(expectedVersion !== undefined ? { version: expectedVersion } : {}),
        },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
          ...(dto.description !== undefined ? { description: dto.description || null } : {}),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1 && expectedVersion !== undefined) {
        throw new VersionConflictException(expectedVersion);
      }
      if (result.count !== 1) throw new NotFoundException('The first date does not exist');

      return transaction.firstDate.findUniqueOrThrow({
        where: { familyId },
        include: firstDateInclude,
      });
    });
    return FirstDateResponseDto.fromEntity(firstDate);
  }

  async remove(userId: string): Promise<void> {
    const { familyId } = await this.membership.requirePartner(userId);
    const firstDate = await this.prisma.firstDate.findUnique({
      where: { familyId },
      select: { createdById: true },
    });
    if (!firstDate) throw new NotFoundException('The first date does not exist');
    if (firstDate.createdById !== userId) {
      throw new ForbiddenException('Only the first date creator can delete it');
    }

    await this.prisma.firstDate.delete({ where: { familyId } });
  }
}
