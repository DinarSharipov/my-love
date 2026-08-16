import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationProducerService } from '../../common/notifications/notification-producer.service';
import { CreateShoppingItemDto, CreateShoppingListDto } from './dto/shopping.dto';
@Injectable()
export class ShoppingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationProducerService,
  ) {}
  async lists(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.shoppingList.findMany({
      where: { familyId, archived: false },
      include: { items: { orderBy: [{ checked: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async createList(userId: string, dto: CreateShoppingListDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    const list = await this.prisma.shoppingList.create({
      data: { familyId, createdById: userId, name: dto.name.trim() },
      include: { items: true },
    });
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'shopping_list.created',
      resourceType: 'shopping_list',
      resourceId: list.id,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'SHOPPING_LIST_CREATED',
      title: 'Создан список покупок',
      body: list.name,
    });
    return list;
  }
  async addItem(userId: string, listId: string, dto: CreateShoppingItemDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    const list = await this.prisma.shoppingList.findFirst({
      where: { id: listId, familyId, archived: false },
    });
    if (!list) throw new NotFoundException('Shopping list not found');
    const item = await this.prisma.shoppingItem.create({
      data: {
        listId,
        addedById: userId,
        name: dto.name.trim(),
        quantity: dto.quantity?.trim() || null,
      },
    });
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'shopping_item.created',
      resourceType: 'shopping_item',
      resourceId: item.id,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'SHOPPING_ITEM_CREATED',
      title: 'Новая покупка в списке',
      body: item.name,
    });
    return item;
  }
  async checkItem(userId: string, itemId: string, checked: boolean, expectedVersion?: number) {
    const { familyId } = await this.membership.requireMembership(userId);
    const item = await this.prisma.shoppingItem.findFirst({
      where: { id: itemId, list: { familyId, archived: false } },
    });
    if (!item) throw new NotFoundException('Shopping item not found');
    const result = await this.prisma.shoppingItem.updateMany({
      where: { id: itemId, version: expectedVersion ?? item.version, checked: { not: checked } },
      data: {
        checked,
        checkedById: checked ? userId : null,
        checkedAt: checked ? new Date() : null,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new ConflictException('Shopping item was changed concurrently');
    const updated = await this.prisma.shoppingItem.findUniqueOrThrow({ where: { id: itemId } });
    await this.audit.record({
      actorId: userId,
      familyId,
      action: checked ? 'shopping_item.checked' : 'shopping_item.unchecked',
      resourceType: 'shopping_item',
      resourceId: itemId,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: checked ? 'SHOPPING_ITEM_CHECKED' : 'SHOPPING_ITEM_UNCHECKED',
      title: checked ? 'Покупка отмечена' : 'Покупка возвращена в список',
      body: updated.name,
    });
    return updated;
  }
  async archiveList(userId: string, listId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const result = await this.prisma.shoppingList.updateMany({
      where: { id: listId, familyId, archived: false },
      data: { archived: true, version: { increment: 1 } },
    });
    if (!result.count) throw new NotFoundException('Shopping list not found');
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'shopping_list.archived',
      resourceType: 'shopping_list',
      resourceId: listId,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'SHOPPING_LIST_ARCHIVED',
      title: 'Список покупок архивирован',
    });
  }
}
