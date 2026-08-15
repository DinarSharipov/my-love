import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { PrismaService } from '../../database/prisma.service';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { PublicUserResponseDto } from './dto/public-user-response.dto';
import { UpdateCurrentUserDto } from './dto/update-current-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { VersionConflictException } from '../../common/http/version-conflict.exception';
import { AccountExportResponseDto } from './dto/account-export-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findCurrent(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({ where: { id, isActive: true } });
    if (!user) throw new NotFoundException('User not found');
    return UserResponseDto.fromEntity(user);
  }

  async exportCurrent(id: string): Promise<AccountExportResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        gender: true,
        description: true,
        birthDate: true,
        phone: true,
        locale: true,
        timeZone: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        deletionRequestedAt: true,
        deletionScheduledAt: true,
        familyMember: {
          select: {
            family: {
              select: {
                id: true,
                status: true,
                timeZone: true,
                locale: true,
                defaultCurrency: true,
                createdAt: true,
                updatedAt: true,
                members: { select: { id: true, userId: true, role: true, joinedAt: true } },
                events: {
                  orderBy: { scheduledAt: 'asc' },
                  select: {
                    id: true,
                    familyId: true,
                    proposedById: true,
                    respondedById: true,
                    deletedById: true,
                    name: true,
                    description: true,
                    scheduledAt: true,
                    location: true,
                    status: true,
                    respondedAt: true,
                    deletedAt: true,
                    version: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
                firstDate: {
                  select: {
                    id: true,
                    familyId: true,
                    createdById: true,
                    name: true,
                    date: true,
                    description: true,
                    version: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
        sentFamilyInvitations: {
          select: {
            id: true,
            recipientId: true,
            status: true,
            expiresAt: true,
            respondedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        receivedFamilyInvitations: {
          select: {
            id: true,
            senderId: true,
            status: true,
            expiresAt: true,
            respondedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        sentPrivateInvitations: {
          select: {
            id: true,
            recipientEmail: true,
            status: true,
            expiresAt: true,
            respondedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const {
      familyMember,
      sentFamilyInvitations,
      receivedFamilyInvitations,
      sentPrivateInvitations,
      ...profile
    } = user;
    return {
      format: 'my-love-account-export',
      exportedAt: new Date(),
      profile,
      families: familyMember ? [familyMember.family] : [],
      invitations: [
        ...sentFamilyInvitations,
        ...receivedFamilyInvitations,
        ...sentPrivateInvitations,
      ],
    };
  }

  async updateCurrent(
    id: string,
    dto: UpdateCurrentUserDto,
    expectedVersion?: number,
  ): Promise<UserResponseDto> {
    const data: Prisma.UserUpdateManyMutationInput = {
      ...dto,
      description: dto.description === '' ? null : dto.description,
      phone: dto.phone === '' ? null : dto.phone,
      version: { increment: 1 },
    };
    const result = await this.prisma.user.updateMany({
      where: { id, isActive: true, ...(expectedVersion ? { version: expectedVersion } : {}) },
      data,
    });
    if (result.count !== 1) {
      const exists = await this.prisma.user.count({ where: { id, isActive: true } });
      if (!exists) throw new NotFoundException('User not found');
      throw new VersionConflictException(expectedVersion as number);
    }
    return this.findCurrent(id);
  }

  async findRegistry(
    currentUserId: string,
    query: UsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      id: { not: currentUserId },
      isActive: true,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { familyMember: { select: { id: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => PublicUserResponseDto.fromEntity(user)),
      ...paginationMeta(total, query.page, query.limit),
    };
  }

  async findPublicById(id: string): Promise<PublicUserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, isActive: true },
      include: { familyMember: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return PublicUserResponseDto.fromEntity(user);
  }
}
