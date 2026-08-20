import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VersionConflictException } from '../../common/http/version-conflict.exception';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationProducerService } from '../../common/notifications/notification-producer.service';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import {
  CreateMealPlanDto,
  CreateRecipeDto,
  UpdateMealPlanDto,
  UpdateRecipeDto,
} from './dto/recipe.dto';
@Injectable()
export class MealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationProducerService,
  ) {}
  async list(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.recipe.findMany({
      where: { familyId, archived: false },
      include: { ingredients: true, dietaryLabels: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async listArchived(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.recipe.findMany({
      where: { familyId, archived: true },
      include: { ingredients: true, dietaryLabels: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async create(userId: string, dto: CreateRecipeDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    const recipe = await this.prisma.recipe.create({
      data: {
        familyId,
        createdById: userId,
        name: dto.name.trim(),
        instructions: dto.instructions?.trim() || null,
        ingredients: {
          create: dto.ingredients.map((i) => ({
            name: i.name.trim(),
            quantity: i.quantity?.trim() || null,
          })),
        },
        dietaryLabels: {
          create: this.normalizeDietaryLabels(dto.dietaryLabels ?? []).map((label) => ({ label })),
        },
      },
      include: { ingredients: true, dietaryLabels: true },
    });
    await this.recordAndNotifyRecipe(userId, familyId, recipe.id, 'created', recipe.name);
    return recipe;
  }
  async archive(userId: string, id: string, expectedVersion?: number) {
    const { familyId } = await this.membership.requireMembership(userId);
    const current = await this.prisma.recipe.findFirst({
      where: { id, familyId, archived: false },
    });
    if (!current) throw new NotFoundException('Recipe not found');
    const result = await this.prisma.recipe.updateMany({
      where: {
        id,
        familyId,
        archived: false,
        ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
      },
      data: { archived: true, version: { increment: 1 } },
    });
    if (!result.count) {
      if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
      throw new NotFoundException('Recipe not found');
    }
    await this.recordAndNotifyRecipe(userId, familyId, id, 'archived');
  }
  async restore(userId: string, id: string, expectedVersion?: number) {
    const { familyId } = await this.membership.requireMembership(userId);
    const current = await this.prisma.recipe.findFirst({
      where: { id, familyId, archived: true },
    });
    if (!current) throw new NotFoundException('Recipe not found');
    const result = await this.prisma.recipe.updateMany({
      where: {
        id,
        familyId,
        archived: true,
        ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
      },
      data: { archived: false, version: { increment: 1 } },
    });
    if (!result.count) {
      if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
      throw new NotFoundException('Recipe not found');
    }
    const recipe = await this.prisma.recipe.findUniqueOrThrow({
      where: { id },
      include: { ingredients: true, dietaryLabels: true },
    });
    await this.recordAndNotifyRecipe(userId, familyId, id, 'restored', recipe.name);
    return recipe;
  }
  async update(userId: string, id: string, dto: UpdateRecipeDto, expectedVersion?: number) {
    const { familyId } = await this.membership.requireMembership(userId);
    const current = await this.prisma.recipe.findFirst({
      where: { id, familyId, archived: false },
    });
    if (!current) throw new NotFoundException('Recipe not found');

    const recipe = await this.prisma.$transaction(async (tx) => {
      const result = await tx.recipe.updateMany({
        where: {
          id,
          familyId,
          archived: false,
          ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
        },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.instructions === undefined
            ? {}
            : { instructions: dto.instructions?.trim() || null }),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
        throw new NotFoundException('Recipe not found');
      }
      if (dto.ingredients !== undefined) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        if (dto.ingredients.length) {
          await tx.recipeIngredient.createMany({
            data: dto.ingredients.map((ingredient) => ({
              recipeId: id,
              name: ingredient.name.trim(),
              quantity: ingredient.quantity?.trim() || null,
            })),
          });
        }
      }
      if (dto.dietaryLabels !== undefined) {
        await tx.recipeDietaryLabel.deleteMany({ where: { recipeId: id } });
        const labels = this.normalizeDietaryLabels(dto.dietaryLabels);
        if (labels.length) {
          await tx.recipeDietaryLabel.createMany({
            data: labels.map((label) => ({ recipeId: id, label })),
          });
        }
      }
      return tx.recipe.findUniqueOrThrow({
        where: { id },
        include: { ingredients: true, dietaryLabels: true },
      });
    });
    await this.recordAndNotifyRecipe(userId, familyId, id, 'updated', recipe.name);
    return recipe;
  }
  async createPlan(userId: string, dto: CreateMealPlanDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: dto.recipeId, familyId, archived: false },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');
    try {
      const plan = await this.prisma.mealPlan.create({
        data: {
          familyId,
          createdById: userId,
          recipeId: dto.recipeId,
          plannedFor: new Date(`${dto.plannedFor}T00:00:00.000Z`),
          mealSlot: dto.mealSlot.trim(),
          servings: dto.servings ?? 1,
        },
        include: { recipe: { include: { ingredients: true, dietaryLabels: true } } },
      });
      await this.recordAndNotifyMealPlan(userId, familyId, plan.id, 'created', plan.recipe.name);
      return plan;
    } catch (error) {
      this.rethrowMealPlanSlotConflict(error);
    }
  }
  async listPlans(userId: string, from?: string, to?: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.mealPlan.findMany({
      where: {
        familyId,
        ...(from || to
          ? {
              plannedFor: {
                ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
                ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
              },
            }
          : {}),
      },
      include: { recipe: { include: { ingredients: true, dietaryLabels: true } } },
      orderBy: [{ plannedFor: 'asc' }, { mealSlot: 'asc' }],
    });
  }
  async updatePlan(userId: string, id: string, dto: UpdateMealPlanDto, expectedVersion?: number) {
    const { familyId } = await this.membership.requireMembership(userId);
    const current = await this.prisma.mealPlan.findFirst({ where: { id, familyId } });
    if (!current) throw new NotFoundException('Meal plan not found');
    if (dto.recipeId) {
      const recipe = await this.prisma.recipe.findFirst({
        where: { id: dto.recipeId, familyId, archived: false },
      });
      if (!recipe) throw new NotFoundException('Recipe not found');
    }
    try {
      const result = await this.prisma.mealPlan.updateMany({
        where: {
          id,
          familyId,
          ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
        },
        data: {
          ...(dto.recipeId ? { recipeId: dto.recipeId } : {}),
          ...(dto.plannedFor ? { plannedFor: new Date(`${dto.plannedFor}T00:00:00.000Z`) } : {}),
          ...(dto.mealSlot ? { mealSlot: dto.mealSlot.trim() } : {}),
          ...(dto.servings ? { servings: dto.servings } : {}),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
        throw new NotFoundException('Meal plan not found');
      }
      const plan = await this.prisma.mealPlan.findUniqueOrThrow({
        where: { id },
        include: { recipe: { include: { ingredients: true, dietaryLabels: true } } },
      });
      await this.recordAndNotifyMealPlan(userId, familyId, id, 'updated', plan.recipe.name);
      return plan;
    } catch (error) {
      this.rethrowMealPlanSlotConflict(error);
    }
  }
  async deletePlan(userId: string, id: string): Promise<void> {
    const { familyId } = await this.membership.requireMembership(userId);
    const result = await this.prisma.mealPlan.deleteMany({ where: { id, familyId } });
    if (result.count !== 1) throw new NotFoundException('Meal plan not found');
    await this.recordAndNotifyMealPlan(userId, familyId, id, 'cancelled');
  }
  async generateShopping(userId: string, planId: string, listId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const plan = await this.prisma.mealPlan.findFirst({
      where: { id: planId, familyId },
      include: { recipe: { include: { ingredients: true, dietaryLabels: true } } },
    });
    const list = await this.prisma.shoppingList.findFirst({
      where: { id: listId, familyId, archived: false },
    });
    if (!plan) throw new NotFoundException('Meal plan not found');
    if (!list) throw new NotFoundException('Shopping list not found');
    const items = await this.prisma.$transaction(async (tx) =>
      Promise.all(
        plan.recipe.ingredients.map((ingredient) =>
          tx.shoppingItem.upsert({
            where: { sourceKey: `meal-plan:${plan.id}:ingredient:${ingredient.id}` },
            create: {
              listId,
              addedById: userId,
              name: ingredient.name,
              quantity: ingredient.quantity,
              sourceKey: `meal-plan:${plan.id}:ingredient:${ingredient.id}`,
            },
            update: { listId },
          }),
        ),
      ),
    );
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'meal_plan.shopping_generated',
      resourceType: 'meal_plan',
      resourceId: planId,
      metadata: { shoppingListId: listId, itemCount: items.length },
    });
    return items;
  }

  private rethrowMealPlanSlotConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A meal plan already exists for this date and slot');
    }
    throw error;
  }

  private normalizeDietaryLabels(labels: string[]): string[] {
    return [...new Set(labels.map((label) => label.trim().toLowerCase()).filter(Boolean))];
  }

  private async recordAndNotifyRecipe(
    actorId: string,
    familyId: string,
    resourceId: string,
    action: 'created' | 'updated' | 'archived' | 'restored',
    name?: string,
  ): Promise<void> {
    await this.audit.record({
      actorId,
      familyId,
      action: `recipe.${action}`,
      resourceType: 'recipe',
      resourceId,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId,
      type: `RECIPE_${action.toUpperCase()}`,
      title: {
        created: 'Создан рецепт',
        updated: 'Рецепт изменён',
        archived: 'Рецепт архивирован',
        restored: 'Рецепт восстановлен',
      }[action],
      ...(name ? { body: name } : {}),
    });
  }

  private async recordAndNotifyMealPlan(
    actorId: string,
    familyId: string,
    resourceId: string,
    action: 'created' | 'updated' | 'cancelled',
    recipeName?: string,
  ): Promise<void> {
    await this.audit.record({
      actorId,
      familyId,
      action: `meal_plan.${action}`,
      resourceType: 'meal_plan',
      resourceId,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId,
      type: `MEAL_PLAN_${action.toUpperCase()}`,
      title: {
        created: 'Добавлено блюдо в план',
        updated: 'План питания изменён',
        cancelled: 'Блюдо удалено из плана',
      }[action],
      ...(recipeName ? { body: recipeName } : {}),
    });
  }
}
