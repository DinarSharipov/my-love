import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FamilyInvitationStatus, Prisma } from '@prisma/client';
import { durationToSeconds } from '../../common/utils/duration';
import { PrismaService } from '../../database/prisma.service';
import { CreateFamilyInvitationDto } from './dto/create-family-invitation.dto';
import { FamilyInvitationResponseDto } from './dto/family-invitation-response.dto';

const invitationInclude = {
  sender: { include: { familyMember: { select: { id: true } } } },
  recipient: { include: { familyMember: { select: { id: true } } } },
} satisfies Prisma.FamilyInvitationInclude;

@Injectable()
export class FamilyInvitationsService {
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
    await this.prisma.familyInvitation.updateMany({
      where: { status: FamilyInvitationStatus.PENDING, expiresAt: { lte: new Date() } },
      data: { status: FamilyInvitationStatus.EXPIRED, respondedAt: new Date() },
    });
  }
}
