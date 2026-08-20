import { NotFoundException } from '@nestjs/common';
import { MealsService } from './meals.service';

describe('MealsService', () => {
  const membership = {
    requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notifyFamilyMembers: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => jest.clearAllMocks());

  it('keeps recipe creation scoped to the authenticated family and normalizes labels', async () => {
    const prisma = {
      recipe: {
        create: jest.fn().mockResolvedValue({ id: 'recipe-id' }),
      },
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await service.create('user-id', {
      name: '  Pasta  ',
      ingredients: [{ name: '  Tomato ', quantity: ' 2 pcs ' }],
      dietaryLabels: [' Vegetarian ', 'vegetarian', ''],
    });

    expect(prisma.recipe.create).toHaveBeenCalledWith({
      data: {
        familyId: 'family-id',
        createdById: 'user-id',
        name: 'Pasta',
        instructions: null,
        ingredients: { create: [{ name: 'Tomato', quantity: '2 pcs' }] },
        dietaryLabels: { create: [{ label: 'vegetarian' }] },
      },
      include: { ingredients: true, dietaryLabels: true },
    });
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'user-id',
      familyId: 'family-id',
      action: 'recipe.created',
      resourceType: 'recipe',
      resourceId: 'recipe-id',
    });
    expect(notifications.notifyFamilyMembers).toHaveBeenCalledWith({
      familyId: 'family-id',
      actorId: 'user-id',
      type: 'RECIPE_CREATED',
      title: 'Создан рецепт',
    });
  });

  it('lists archived recipes only for the authenticated family', async () => {
    const prisma = { recipe: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await service.listArchived('user-id');

    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: { familyId: 'family-id', archived: true },
      include: { ingredients: true, dietaryLabels: true },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('restores an archived recipe only when its supplied version matches', async () => {
    const restoredRecipe = { id: 'recipe-id', archived: false, version: 3 };
    const prisma = {
      recipe: {
        findFirst: jest.fn().mockResolvedValue({ id: 'recipe-id', version: 2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(restoredRecipe),
      },
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(service.restore('user-id', 'recipe-id', 2)).resolves.toEqual(restoredRecipe);
    expect(prisma.recipe.updateMany).toHaveBeenCalledWith({
      where: { id: 'recipe-id', familyId: 'family-id', archived: true, version: 2 },
      data: { archived: false, version: { increment: 1 } },
    });
  });

  it('does not reveal a foreign recipe while archiving', async () => {
    const prisma = {
      recipe: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() },
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(service.archive('user-id', 'foreign-recipe', 2)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.recipe.updateMany).not.toHaveBeenCalled();
  });

  it('does not create a plan for a recipe outside the authenticated family', async () => {
    const prisma = {
      recipe: { findFirst: jest.fn().mockResolvedValue(null) },
      mealPlan: { create: jest.fn() },
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(
      service.createPlan('user-id', {
        recipeId: 'foreign-recipe',
        plannedFor: '2026-08-20',
        mealSlot: 'dinner',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.recipe.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-recipe', familyId: 'family-id', archived: false },
    });
    expect(prisma.mealPlan.create).not.toHaveBeenCalled();
  });

  it('replaces recipe ingredients and labels atomically inside the caller family', async () => {
    const updatedRecipe = { id: 'recipe-id', version: 3 };
    const tx = {
      recipe: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedRecipe),
      },
      recipeIngredient: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      recipeDietaryLabel: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      recipe: { findFirst: jest.fn().mockResolvedValue({ id: 'recipe-id', version: 2 }) },
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(
      service.update(
        'user-id',
        'recipe-id',
        {
          name: '  Pasta primavera  ',
          ingredients: [{ name: ' Tomato ', quantity: ' 2 pcs ' }],
          dietaryLabels: [' Vegetarian ', 'vegetarian', ''],
        },
        2,
      ),
    ).resolves.toEqual(updatedRecipe);

    expect(tx.recipe.updateMany).toHaveBeenCalledWith({
      where: { id: 'recipe-id', familyId: 'family-id', archived: false, version: 2 },
      data: { name: 'Pasta primavera', version: { increment: 1 } },
    });
    expect(tx.recipeIngredient.deleteMany).toHaveBeenCalledWith({
      where: { recipeId: 'recipe-id' },
    });
    expect(tx.recipeIngredient.createMany).toHaveBeenCalledWith({
      data: [{ recipeId: 'recipe-id', name: 'Tomato', quantity: '2 pcs' }],
    });
    expect(tx.recipeDietaryLabel.deleteMany).toHaveBeenCalledWith({
      where: { recipeId: 'recipe-id' },
    });
    expect(tx.recipeDietaryLabel.createMany).toHaveBeenCalledWith({
      data: [{ recipeId: 'recipe-id', label: 'vegetarian' }],
    });
  });

  it('does not overwrite a recipe after a concurrent update', async () => {
    const tx = {
      recipe: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      recipeIngredient: { deleteMany: jest.fn() },
      recipeDietaryLabel: { deleteMany: jest.fn() },
    };
    const prisma = {
      recipe: { findFirst: jest.fn().mockResolvedValue({ id: 'recipe-id', version: 2 }) },
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(
      service.update('user-id', 'recipe-id', { name: 'Updated' }, 2),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.recipeIngredient.deleteMany).not.toHaveBeenCalled();
  });

  it('does not update a recipe outside the authenticated family', async () => {
    const prisma = {
      recipe: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(
      service.update('user-id', 'foreign-recipe', { name: 'Updated' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not update a meal plan outside the authenticated family', async () => {
    const prisma = {
      mealPlan: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() },
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(
      service.updatePlan('user-id', 'foreign-plan', { servings: 2 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.mealPlan.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-plan', familyId: 'family-id' },
    });
    expect(prisma.mealPlan.updateMany).not.toHaveBeenCalled();
  });

  it('rejects shopping generation when either plan or list is outside the family', async () => {
    const prisma = {
      mealPlan: { findFirst: jest.fn().mockResolvedValue(null) },
      shoppingList: { findFirst: jest.fn().mockResolvedValue({ id: 'list-id' }) },
      $transaction: jest.fn(),
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(
      service.generateShopping('user-id', 'foreign-plan', 'list-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.mealPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'foreign-plan', familyId: 'family-id' } }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates a plan in the caller family only when its supplied version matches', async () => {
    const updatedPlan = { id: 'plan-id', version: 3, recipe: { name: 'Pasta' } };
    const prisma = {
      mealPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plan-id', version: 2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedPlan),
      },
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(service.updatePlan('user-id', 'plan-id', { servings: 4 }, 2)).resolves.toEqual(
      updatedPlan,
    );
    expect(prisma.mealPlan.updateMany).toHaveBeenCalledWith({
      where: { id: 'plan-id', familyId: 'family-id', version: 2 },
      data: { servings: 4, version: { increment: 1 } },
    });
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'user-id',
      familyId: 'family-id',
      action: 'meal_plan.updated',
      resourceType: 'meal_plan',
      resourceId: 'plan-id',
    });
    expect(notifications.notifyFamilyMembers).toHaveBeenCalledWith({
      familyId: 'family-id',
      actorId: 'user-id',
      type: 'MEAL_PLAN_UPDATED',
      title: 'План питания изменён',
      body: 'Pasta',
    });
  });

  it('reports a conflict rather than overwriting a concurrently updated plan', async () => {
    const prisma = {
      mealPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'plan-id', version: 2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(
      service.updatePlan('user-id', 'plan-id', { servings: 4 }, 2),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it('deletes a meal plan only inside the authenticated family', async () => {
    const prisma = { mealPlan: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(service.deletePlan('user-id', 'plan-id')).resolves.toBeUndefined();
    expect(prisma.mealPlan.deleteMany).toHaveBeenCalledWith({
      where: { id: 'plan-id', familyId: 'family-id' },
    });
  });

  it('does not reveal whether a foreign meal plan exists during deletion', async () => {
    const prisma = { mealPlan: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const service = new MealsService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(service.deletePlan('user-id', 'foreign-plan')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.mealPlan.deleteMany).toHaveBeenCalledWith({
      where: { id: 'foreign-plan', familyId: 'family-id' },
    });
  });
});
