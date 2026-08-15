import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FamilyInvitationStatus, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { OutboxService } from '../../common/outbox/outbox.service';
import { durationToSeconds } from '../../common/utils/duration';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { RequestAccountDeletionDto } from './dto/request-account-deletion.dto';
import { CancelAccountDeletionDto } from './dto/cancel-account-deletion.dto';
import { AccountDeletionRequestResponseDto } from './dto/account-deletion-request-response.dto';
import type { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
  ) {}

  async register(dto: RegisterDto, metadata?: SessionMetadata): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) throw new ConflictException('User with this email already exists');

    try {
      const user = await this.usersService.create({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email,
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        gender: dto.gender,
        description: dto.description?.trim() || null,
        birthDate: new Date(dto.birthDate),
        phone: dto.phone?.trim() || null,
      });
      return this.issueAccessToken(user, metadata);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User with this email already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, metadata?: SessionMetadata): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (
      !user ||
      !user.isActive ||
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueAccessToken(user, metadata);
  }

  async logout(tokenHash: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { tokenHash } });
  }

  async listSessions(userId: string, currentTokenHash: string): Promise<AuthSessionResponseDto[]> {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((session) => AuthSessionResponseDto.fromEntity(session, currentTokenHash));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.authSession.deleteMany({ where: { id: sessionId, userId } });
    if (result.count !== 1) throw new NotFoundException('Session not found');
  }

  async revokeOtherSessions(userId: string, currentTokenHash: string): Promise<void> {
    await this.prisma.authSession.deleteMany({
      where: { userId, tokenHash: { not: currentTokenHash } },
    });
  }

  async changePassword(
    userId: string,
    currentTokenHash: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, isActive: true } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new ForbiddenException('Current password is incorrect');
    }
    if (await argon2.verify(user.passwordHash, dto.newPassword)) {
      throw new ConflictException('New password must differ from the current password');
    }
    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.authSession.deleteMany({
        where: { userId, tokenHash: { not: currentTokenHash } },
      }),
    ]);
  }

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user?.isActive || !user.passwordHash) return;

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresIn = durationToSeconds(
      this.config.getOrThrow<string>('PASSWORD_RESET_EXPIRES_IN'),
    );
    const resetUrl = `${this.config.getOrThrow<string>('FRONTEND_APP_URL').replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + expiresIn * 1000) },
      });
      await this.outbox.enqueueEncryptedEmail(tx, {
        to: user.email,
        subject: 'Восстановление пароля My Love',
        text: `Чтобы задать новый пароль, перейдите по ссылке: ${resetUrl}`,
      });
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const now = new Date();
    const tokenHash = this.hashToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= now ||
      !resetToken.user.isActive
    ) {
      throw new BadRequestException('Password reset token is invalid or expired');
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    const applied = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return false;
      await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
      await tx.authSession.deleteMany({ where: { userId: resetToken.userId } });
      return true;
    });
    if (!applied) throw new BadRequestException('Password reset token is invalid or expired');
  }

  async requestEmailChange(userId: string, dto: RequestEmailChangeDto): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, isActive: true } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new ForbiddenException('Current password is incorrect');
    }
    if (user.email === dto.email) {
      throw new ConflictException('New email must differ from the current email');
    }
    const occupied = await this.usersService.findByEmail(dto.email);
    if (occupied) throw new ConflictException('Email is already registered');

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresIn = durationToSeconds(this.config.getOrThrow<string>('EMAIL_CHANGE_EXPIRES_IN'));
    const confirmUrl = `${this.config.getOrThrow<string>('FRONTEND_APP_URL').replace(/\/+$/, '')}/confirm-email-change?token=${encodeURIComponent(token)}`;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.emailChangeToken.deleteMany({ where: { userId, usedAt: null } });
        await tx.emailChangeToken.create({
          data: {
            userId,
            requestedEmail: dto.email,
            tokenHash,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
          },
        });
        await this.outbox.enqueueEncryptedEmail(tx, {
          to: dto.email,
          subject: 'Подтвердите новый email My Love',
          text: `Чтобы сменить email аккаунта My Love, перейдите по ссылке: ${confirmUrl}`,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async confirmEmailChange(dto: ConfirmEmailChangeDto): Promise<void> {
    const now = new Date();
    const tokenHash = this.hashToken(dto.token);
    const emailChangeToken = await this.prisma.emailChangeToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !emailChangeToken ||
      emailChangeToken.usedAt ||
      emailChangeToken.expiresAt <= now ||
      !emailChangeToken.user.isActive
    ) {
      throw new BadRequestException('Email change token is invalid or expired');
    }

    try {
      const applied = await this.prisma.$transaction(async (tx) => {
        const consumed = await tx.emailChangeToken.updateMany({
          where: { id: emailChangeToken.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) return false;
        await tx.user.update({
          where: { id: emailChangeToken.userId },
          data: { email: emailChangeToken.requestedEmail, version: { increment: 1 } },
        });
        await tx.authSession.deleteMany({ where: { userId: emailChangeToken.userId } });
        return true;
      });
      if (!applied) throw new BadRequestException('Email change token is invalid or expired');
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async requestAccountDeletion(
    userId: string,
    dto: RequestAccountDeletionDto,
  ): Promise<AccountDeletionRequestResponseDto> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, isActive: true } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new ForbiddenException('Current password is incorrect');
    }

    const now = new Date();
    const gracePeriod = durationToSeconds(
      this.config.getOrThrow<string>('ACCOUNT_DELETION_GRACE_PERIOD'),
    );
    const scheduledFor = new Date(now.getTime() + gracePeriod * 1000);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const cancelUrl = `${this.config.getOrThrow<string>('FRONTEND_APP_URL').replace(/\/+$/, '')}/cancel-account-deletion?token=${encodeURIComponent(token)}`;

    await this.prisma.$transaction(async (tx) => {
      const deactivated = await tx.user.updateMany({
        where: { id: userId, isActive: true },
        data: {
          isActive: false,
          deletionRequestedAt: now,
          deletionScheduledAt: scheduledFor,
          version: { increment: 1 },
        },
      });
      if (deactivated.count !== 1)
        throw new ConflictException('Account deletion is already pending');

      await Promise.all([
        tx.authSession.deleteMany({ where: { userId } }),
        tx.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
        tx.emailChangeToken.deleteMany({ where: { userId, usedAt: null } }),
        tx.accountDeletionToken.deleteMany({ where: { userId, usedAt: null } }),
        tx.familyInvitation.updateMany({
          where: { senderId: userId, status: FamilyInvitationStatus.PENDING },
          data: { status: FamilyInvitationStatus.CANCELLED, respondedAt: now },
        }),
        tx.privateFamilyInvitation.updateMany({
          where: { senderId: userId, status: FamilyInvitationStatus.PENDING },
          data: { status: FamilyInvitationStatus.CANCELLED, respondedAt: now },
        }),
      ]);
      await tx.accountDeletionToken.create({
        data: { userId, tokenHash, expiresAt: scheduledFor },
      });
      await this.outbox.enqueueEncryptedEmail(tx, {
        to: user.email,
        subject: 'Удаление аккаунта My Love запланировано',
        text: `Аккаунт отключён и будет удалён ${scheduledFor.toISOString()}. Чтобы отменить удаление и восстановить доступ, перейдите по ссылке: ${cancelUrl}`,
      });
    });

    return { scheduledFor };
  }

  async cancelAccountDeletion(dto: CancelAccountDeletionDto): Promise<void> {
    const now = new Date();
    const tokenHash = this.hashToken(dto.token);
    const deletionToken = await this.prisma.accountDeletionToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !deletionToken ||
      deletionToken.usedAt ||
      deletionToken.expiresAt <= now ||
      deletionToken.user.isActive ||
      !deletionToken.user.deletionScheduledAt ||
      deletionToken.user.deletionScheduledAt <= now
    ) {
      throw new BadRequestException('Account recovery token is invalid or expired');
    }

    const applied = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.accountDeletionToken.updateMany({
        where: { id: deletionToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return false;
      const restored = await tx.user.updateMany({
        where: { id: deletionToken.userId, isActive: false, deletionScheduledAt: { gt: now } },
        data: {
          isActive: true,
          deletionRequestedAt: null,
          deletionScheduledAt: null,
          version: { increment: 1 },
        },
      });
      if (restored.count !== 1) {
        throw new BadRequestException('Account recovery token is invalid or expired');
      }
      await tx.accountDeletionToken.deleteMany({
        where: { userId: deletionToken.userId, usedAt: null },
      });
      return true;
    });
    if (!applied) throw new BadRequestException('Account recovery token is invalid or expired');
  }

  private async issueAccessToken(
    user: Awaited<ReturnType<UsersService['create']>>,
    metadata?: SessionMetadata,
  ): Promise<AuthResponseDto> {
    const jti = randomUUID();
    const tokenHash = createHash('sha256').update(jti).digest('hex');
    const expiresInValue = this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN');
    const expiresIn = durationToSeconds(expiresInValue);
    const payload: JwtPayload = { sub: user.id, email: user.email, jti };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn,
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    return { accessToken, tokenType: 'Bearer', expiresIn, user: UserResponseDto.fromEntity(user) };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}
