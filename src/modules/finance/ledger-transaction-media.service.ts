import { Injectable, NotFoundException } from '@nestjs/common';
import { MediaResponseDto } from '../media/dto/media-response.dto';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { LedgerHistoryService } from './ledger-history.service';

@Injectable()
export class LedgerTransactionMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly history: LedgerHistoryService,
    private readonly media: MediaService,
  ) {}

  async list(transactionId: string, userId: string): Promise<MediaResponseDto[]> {
    await this.history.get(userId, transactionId);
    const transaction = await this.prisma.ledgerTransaction.findUnique({
      where: { id: transactionId },
      include: { mediaAttachments: { select: { mediaId: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!transaction) throw new NotFoundException('Ledger transaction not found');
    return this.media.findManyByIds(
      userId,
      transaction.mediaAttachments.map(({ mediaId }) => mediaId),
    );
  }

  async attach(
    transactionId: string,
    userId: string,
    mediaId: string,
  ): Promise<MediaResponseDto[]> {
    const context = await this.membership.requireMembership(userId);
    await this.history.get(userId, transactionId);
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, familyId: context.familyId },
    });
    if (!media) throw new NotFoundException('Media not found');
    await this.prisma.ledgerTransactionMedia.createMany({
      data: { transactionId, mediaId },
      skipDuplicates: true,
    });
    return this.list(transactionId, userId);
  }

  async detach(transactionId: string, userId: string, mediaId: string): Promise<void> {
    await this.history.get(userId, transactionId);
    await this.prisma.ledgerTransactionMedia.deleteMany({ where: { transactionId, mediaId } });
  }
}
