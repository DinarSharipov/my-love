import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { CreateMealPlanDto, CreateRecipeDto, UpdateMealPlanDto } from './dto/recipe.dto';
@Injectable()
export class MealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
  ) {}
  async list(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.recipe.findMany({
      where: { familyId, archived: false },
      include: { ingredients: true, dietaryLabels: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async create(userId: string, dto: CreateRecipeDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.recipe.create({
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
          create: [
            ...new Set(
              (dto.dietaryLabels ?? []).map((label) => label.trim().toLowerCase()).filter(Boolean),
            ),
          ].map((label) => ({ label })),
        },
      },
      include: { ingredients: true, dietaryLabels: true },
    });
  }
  async archive(userId: string, id: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const result = await this.prisma.recipe.updateMany({
      where: { id, familyId, archived: false },
      data: { archived: true },
    });
    if (!result.count) throw new NotFoundException('Recipe not found');
  }
  async createPlan(userId: string, dto: CreateMealPlanDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: dto.recipeId, familyId, archived: false },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');
    return this.prisma.mealPlan.create({
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
  async updatePlan(userId: string, id: string, dto: UpdateMealPlanDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    const current = await this.prisma.mealPlan.findFirst({ where: { id, familyId } });
    if (!current) throw new NotFoundException('Meal plan not found');
    if (dto.recipeId) {
      const recipe = await this.prisma.recipe.findFirst({
        where: { id: dto.recipeId, familyId, archived: false },
      });
      if (!recipe) throw new NotFoundException('Recipe not found');
    }
    return this.prisma.mealPlan.update({
      where: { id },
      data: {
        ...(dto.recipeId ? { recipeId: dto.recipeId } : {}),
        ...(dto.plannedFor ? { plannedFor: new Date(`${dto.plannedFor}T00:00:00.000Z`) } : {}),
        ...(dto.mealSlot ? { mealSlot: dto.mealSlot.trim() } : {}),
        ...(dto.servings ? { servings: dto.servings } : {}),
      },
      include: { recipe: { include: { ingredients: true, dietaryLabels: true } } },
    });
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
    return this.prisma.$transaction(async (tx) =>
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
  }
}
