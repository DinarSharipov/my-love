import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { PrismaService } from '../../database/prisma.service';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { PublicUserResponseDto } from './dto/public-user-response.dto';
import { UsersQueryDto } from './dto/users-query.dto';

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
