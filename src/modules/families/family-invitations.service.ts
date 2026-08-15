import {
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FamilyInvitationStatus, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { durationToSeconds } from '../../common/utils/duration';
import { PrismaService } from '../../database/prisma.service';
import { AcceptPrivateFamilyInvitationDto } from './dto/accept-private-family-invitation.dto';
import { CreateFamilyInvitationDto } from './dto/create-family-invitation.dto';
import { CreatePrivateFamilyInvitationDto } from './dto/create-private-family-invitation.dto';
import { FamilyInvitationResponseDto } from './dto/family-invitation-response.dto';
import {
  CreatedPrivateFamilyInvitationResponseDto,
  PrivateFamilyInvitationResponseDto,
} from './dto/private-family-invitation-response.dto';

const invitationInclude = {
  sender: { include: { familyMember: { select: { id: true } } } },
  recipient: { include: { familyMember: { select: { id: true } } } },
} satisfies Prisma.FamilyInvitationInclude;

@Injectable()
export class FamilyInvitationsService {
  private readonly logger = new Logger(FamilyInvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(
    senderId: string,
    dto: CreateFamilyInvitationDto,
  ): Promise<FamilyInvitationResponseDto> {
    if (senderId === dto.recipientId) {
      throw new ConflictException('You cannot invite yourself');
    }

    await this.expirePending();
    const expiresIn = durationToSeconds(
      this.config.getOrThrow<string>('FAMILY_INVITATION_EXPIRES_IN'),
    );

    try {
      const invitation = await this.prisma.$transaction(
        async (tx) => {
          const [sender, recipient] = await Promise.all([
            tx.user.findFirst({
              where: { id: senderId, isActive: true },
              include: { familyMember: { select: { id: true } } },
            }),
            tx.user.findFirst({
              where: { id: dto.recipientId, isActive: true },
              include: { familyMember: { select: { id: true } } },
            }),
          ]);

          if (!sender) throw new NotFoundException('Sender not found');
          if (!recipient) throw new NotFoundException('Recipient not found');
          if (sender.familyMember) throw new ConflictException('You already belong to a family');
          if (recipient.familyMember) {
            throw new ConflictException('Recipient already belongs to a family');
          }

          return tx.familyInvitation.create({
            data: {
              senderId,
              recipientId: dto.recipientId,
              expiresAt: new Date(Date.now() + expiresIn * 1000),
            },
            include: invitationInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return FamilyInvitationResponseDto.fromEntity(invitation);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A pending invitation already exists between these users');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Family membership changed; please refresh and try again');
      }
      throw error;
    }
  }

  async createPrivate(
    senderId: string,
    dto: CreatePrivateFamilyInvitationDto,
  ): Promise<CreatedPrivateFamilyInvitationResponseDto> {
    await this.expirePending();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const expiresIn = durationToSeconds(
      this.config.getOrThrow<string>('FAMILY_INVITATION_EXPIRES_IN'),
    );
    const cooldown = durationToSeconds(
      this.config.getOrThrow<string>('PRIVATE_FAMILY_INVITATION_COOLDOWN'),
    );

    try {
      const invitation = await this.prisma.$transaction(
        async (tx) => {
          const sender = await tx.user.findFirst({
            where: { id: senderId, isActive: true },
            include: { familyMember: { select: { id: true } } },
          });
          if (!sender) throw new NotFoundException('Sender not found');
          if (sender.familyMember) throw new ConflictException('You already belong to a family');
          if (sender.email === dto.recipientEmail) {
            throw new ConflictException('You cannot invite yourself');
          }

          const latestPending = await tx.privateFamilyInvitation.findFirst({
            where: {
              senderId,
              recipientEmail: dto.recipientEmail,
              status: FamilyInvitationStatus.PENDING,
            },
            orderBy: { createdAt: 'desc' },
          });
          if (latestPending) {
            const retryAfterSeconds = Math.ceil(
              (latestPending.createdAt.getTime() + cooldown * 1000 - now.getTime()) / 1000,
            );
            if (retryAfterSeconds > 0) {
              throw new HttpException(
                {
                  code: 'INVITATION_COOLDOWN',
                  message: 'Please wait before creating another invitation for this email',
                  details: { retryAfterSeconds },
                },
                HttpStatus.TOO_MANY_REQUESTS,
              );
            }
          }

          await tx.privateFamilyInvitation.updateMany({
            where: {
              senderId,
              recipientEmail: dto.recipientEmail,
              status: FamilyInvitationStatus.PENDING,
            },
            data: { status: FamilyInvitationStatus.CANCELLED, respondedAt: now },
          });

          return tx.privateFamilyInvitation.create({
            data: {
              senderId,
              recipientEmail: dto.recipientEmail,
              tokenHash,
              expiresAt: new Date(now.getTime() + expiresIn * 1000),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      const frontendUrl = this.config.getOrThrow<string>('FRONTEND_APP_URL').replace(/\/+$/, '');
      const inviteUrl = `${frontendUrl}/join-family#token=${encodeURIComponent(token)}`;
      this.logger.log({ event: 'private_family_invitation_created', invitationId: invitation.id });
      return CreatedPrivateFamilyInvitationResponseDto.fromCreatedEntity(invitation, inviteUrl);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Invitation state changed; please try again');
      }
      throw error;
    }
  }

  async findOutgoingPrivate(userId: string): Promise<PrivateFamilyInvitationResponseDto[]> {
    await this.expirePending();
    const invitations = await this.prisma.privateFamilyInvitation.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((item) => PrivateFamilyInvitationResponseDto.fromEntity(item));
  }

  async acceptPrivate(
    userId: string,
    dto: AcceptPrivateFamilyInvitationDto,
  ): Promise<PrivateFamilyInvitationResponseDto> {
    await this.expirePending();
    const tokenHash = this.hashToken(dto.token);

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.privateFamilyInvitation.findUnique({ where: { tokenHash } });
          if (!current) throw new NotFoundException('Invitation not found');
          if (current.status === FamilyInvitationStatus.EXPIRED) {
            throw new GoneException('Invitation has expired');
          }
          if (current.status !== FamilyInvitationStatus.PENDING || current.useCount > 0) {
            throw new ConflictException('Invitation is no longer available');
          }

          const [sender, recipient] = await Promise.all([
            tx.user.findFirst({
              where: { id: current.senderId, isActive: true },
              include: { familyMember: { select: { id: true } } },
            }),
            tx.user.findFirst({
              where: { id: userId, isActive: true },
              include: { familyMember: { select: { id: true } } },
            }),
          ]);
          if (!sender || !recipient) throw new NotFoundException('Invitation not found');
          if (recipient.email !== current.recipientEmail) {
            throw new ForbiddenException('Invitation is intended for another account');
          }
          if (sender.id === recipient.id) throw new ConflictException('You cannot invite yourself');
          if (sender.familyMember || recipient.familyMember) {
            throw new ConflictException('One of the users already belongs to a family');
          }

          const family = await tx.family.create({
            data: {
              timeZone: this.config.get('APP_TIMEZONE', 'Europe/Moscow'),
              locale: this.config.get('DEFAULT_LOCALE', 'ru-RU'),
              defaultCurrency: this.config.get('DEFAULT_CURRENCY', 'RUB'),
              members: { create: [{ userId: sender.id }, { userId: recipient.id }] },
            },
          });
          const respondedAt = new Date();

          await Promise.all([
            tx.familyInvitation.updateMany({
              where: {
                status: FamilyInvitationStatus.PENDING,
                OR: [
                  { senderId: { in: [sender.id, recipient.id] } },
                  { recipientId: { in: [sender.id, recipient.id] } },
                ],
              },
              data: { status: FamilyInvitationStatus.CANCELLED, respondedAt },
            }),
            tx.privateFamilyInvitation.updateMany({
              where: {
                id: { not: current.id },
                status: FamilyInvitationStatus.PENDING,
                OR: [
                  { senderId: { in: [sender.id, recipient.id] } },
                  { recipientEmail: { in: [sender.email, recipient.email] } },
                ],
              },
              data: { status: FamilyInvitationStatus.CANCELLED, respondedAt },
            }),
          ]);

          const accepted = await tx.privateFamilyInvitation.updateMany({
            where: {
              id: current.id,
              status: FamilyInvitationStatus.PENDING,
              useCount: 0,
            },
            data: {
              status: FamilyInvitationStatus.ACCEPTED,
              acceptedById: recipient.id,
              respondedAt,
              useCount: { increment: 1 },
            },
          });
          if (accepted.count !== 1) {
            throw new ConflictException('Invitation is no longer available');
          }

          const updated = await tx.privateFamilyInvitation.findUnique({
            where: { id: current.id },
          });
          if (!updated) throw new NotFoundException('Invitation not found');
          return { familyId: family.id, invitation: updated };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      this.logger.log({
        event: 'private_family_invitation_accepted',
        familyId: result.familyId,
        invitationId: result.invitation.id,
      });
      return PrivateFamilyInvitationResponseDto.fromEntity(result.invitation);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException('Family membership changed; please refresh and try again');
      }
      throw error;
    }
  }

  async revokePrivate(
    invitationId: string,
    userId: string,
  ): Promise<PrivateFamilyInvitationResponseDto> {
    await this.expirePending();
    const invitation = await this.prisma.privateFamilyInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.senderId !== userId) {
      throw new ForbiddenException('Only the sender can revoke it');
    }
    if (invitation.status !== FamilyInvitationStatus.PENDING) {
      throw new ConflictException('Invitation is no longer pending');
    }

    const result = await this.prisma.privateFamilyInvitation.updateMany({
      where: { id: invitationId, senderId: userId, status: FamilyInvitationStatus.PENDING },
      data: { status: FamilyInvitationStatus.CANCELLED, respondedAt: new Date() },
    });
    if (result.count !== 1) throw new ConflictException('Invitation is no longer pending');

    const updated = await this.prisma.privateFamilyInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!updated) throw new NotFoundException('Invitation not found');
    this.logger.log({ event: 'private_family_invitation_revoked', invitationId });
    return PrivateFamilyInvitationResponseDto.fromEntity(updated);
  }

  async findIncoming(userId: string): Promise<FamilyInvitationResponseDto[]> {
    await this.expirePending();
    const invitations = await this.prisma.familyInvitation.findMany({
      where: { recipientId: userId },
      include: invitationInclude,
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((item) => FamilyInvitationResponseDto.fromEntity(item));
  }

  async findOutgoing(userId: string): Promise<FamilyInvitationResponseDto[]> {
    await this.expirePending();
    const invitations = await this.prisma.familyInvitation.findMany({
      where: { senderId: userId },
      include: invitationInclude,
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((item) => FamilyInvitationResponseDto.fromEntity(item));
  }

  accept(invitationId: string, userId: string): Promise<FamilyInvitationResponseDto> {
    return this.respond(invitationId, userId, FamilyInvitationStatus.ACCEPTED);
  }

  reject(invitationId: string, userId: string): Promise<FamilyInvitationResponseDto> {
    return this.respond(invitationId, userId, FamilyInvitationStatus.REJECTED);
  }

  async cancel(invitationId: string, userId: string): Promise<FamilyInvitationResponseDto> {
    await this.expirePending();
    const invitation = await this.prisma.familyInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.senderId !== userId)
      throw new ForbiddenException('Only the sender can cancel it');
    if (invitation.status !== FamilyInvitationStatus.PENDING) {
      throw new ConflictException('Invitation is no longer pending');
    }

    const result = await this.prisma.familyInvitation.updateMany({
      where: { id: invitationId, senderId: userId, status: FamilyInvitationStatus.PENDING },
      data: { status: FamilyInvitationStatus.CANCELLED, respondedAt: new Date() },
    });
    if (result.count !== 1) throw new ConflictException('Invitation is no longer pending');

    const updated = await this.prisma.familyInvitation.findUnique({
      where: { id: invitationId },
      include: invitationInclude,
    });
    if (!updated) throw new NotFoundException('Invitation not found');
    return FamilyInvitationResponseDto.fromEntity(updated);
  }

  private async respond(
    invitationId: string,
    userId: string,
    status: 'ACCEPTED' | 'REJECTED',
  ): Promise<FamilyInvitationResponseDto> {
    await this.expirePending();

    try {
      const invitation = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.familyInvitation.findUnique({ where: { id: invitationId } });
          if (!current) throw new NotFoundException('Invitation not found');
          if (current.recipientId !== userId) {
            throw new ForbiddenException('Only the recipient can respond to it');
          }
          if (current.status === FamilyInvitationStatus.EXPIRED) {
            throw new GoneException('Invitation has expired');
          }
          if (current.status !== FamilyInvitationStatus.PENDING) {
            throw new ConflictException('Invitation is no longer pending');
          }

          const respondedAt = new Date();
          if (status === FamilyInvitationStatus.ACCEPTED) {
            const members = await tx.familyMember.count({
              where: { userId: { in: [current.senderId, current.recipientId] } },
            });
            if (members > 0) {
              throw new ConflictException('One of the users already belongs to a family');
            }

            await tx.family.create({
              data: {
                timeZone: this.config.get('APP_TIMEZONE', 'Europe/Moscow'),
                locale: this.config.get('DEFAULT_LOCALE', 'ru-RU'),
                defaultCurrency: this.config.get('DEFAULT_CURRENCY', 'RUB'),
                members: {
                  create: [{ userId: current.senderId }, { userId: current.recipientId }],
                },
              },
            });

            await tx.familyInvitation.updateMany({
              where: {
                id: { not: current.id },
                status: FamilyInvitationStatus.PENDING,
                OR: [
                  { senderId: { in: [current.senderId, current.recipientId] } },
                  { recipientId: { in: [current.senderId, current.recipientId] } },
                ],
              },
              data: { status: FamilyInvitationStatus.CANCELLED, respondedAt },
            });
          }

          const result = await tx.familyInvitation.updateMany({
            where: { id: current.id, status: FamilyInvitationStatus.PENDING },
            data: { status, respondedAt },
          });
          if (result.count !== 1) {
            throw new ConflictException('Invitation is no longer pending');
          }

          const updated = await tx.familyInvitation.findUnique({
            where: { id: current.id },
            include: invitationInclude,
          });
          if (!updated) throw new NotFoundException('Invitation not found');
          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return FamilyInvitationResponseDto.fromEntity(invitation);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException('Family membership changed; please refresh and try again');
      }
      throw error;
    }
  }

  private async expirePending(): Promise<void> {
    const now = new Date();
    await Promise.all([
      this.prisma.familyInvitation.updateMany({
        where: { status: FamilyInvitationStatus.PENDING, expiresAt: { lte: now } },
        data: { status: FamilyInvitationStatus.EXPIRED, respondedAt: now },
      }),
      this.prisma.privateFamilyInvitation.updateMany({
        where: { status: FamilyInvitationStatus.PENDING, expiresAt: { lte: now } },
        data: { status: FamilyInvitationStatus.EXPIRED, respondedAt: now },
      }),
    ]);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
