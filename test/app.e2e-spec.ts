import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FamilyMemberRole, FamilyStatus, Gender, OutboxEventStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import { OutboxService } from '../src/common/outbox/outbox.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { MaintenanceService } from '../src/common/maintenance/maintenance.service';

interface AuthResult {
  accessToken: string;
  user: { id: string; email: string };
}

interface InvitationResult {
  id: string;
}

interface PrivateInvitationResult extends InvitationResult {
  inviteUrl?: string;
  recipientEmail: string;
  status: string;
}

interface EventResult {
  id: string;
  version: number;
}

interface RegistryResult {
  data: Array<{ id: string }>;
  total: number;
}

interface FamilyResult {
  status: FamilyStatus;
  timeZone: string;
  locale: string;
  defaultCurrency: string;
  members: Array<{ role: FamilyMemberRole }>;
}

interface ApiErrorResult {
  statusCode: number;
  code: string;
  message: string | string[];
  details?: { messages?: string[] };
  requestId: string;
}

interface UserProfileResult {
  id: string;
  firstName: string;
  locale: string;
  timeZone: string;
  version: number;
}

interface SessionResult {
  id: string;
  isCurrent: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AccountDeletionRequestResult {
  scheduledFor: string;
}

describe('API security regression (e2e)', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];
  let prisma: PrismaService;
  let registrationSequence = 1;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    const expressApp = app.getHttpAdapter().getInstance() as {
      set(setting: string, value: unknown): void;
    };
    expressApp.set('trust proxy', 1);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    prisma = app.get(PrismaService);
    await prisma.family.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    try {
      await prisma.family.deleteMany();
      await prisma.user.deleteMany();
    } finally {
      await app.close();
    }
  });

  const auth = (token: string): { Authorization: string } => ({
    Authorization: `Bearer ${token}`,
  });

  async function register(label: string): Promise<AuthResult> {
    const response = await request(httpServer)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', `198.51.100.${registrationSequence++}`)
      .send({
        firstName: label,
        lastName: 'E2E',
        email: `${label.toLowerCase()}@e2e.test`,
        password: 'StrongPassword123!',
        gender: Gender.NOT_SPECIFIED,
        birthDate: '1990-01-01',
      })
      .expect(201);
    return response.body as AuthResult;
  }

  async function createFamily(sender: AuthResult, recipient: AuthResult): Promise<void> {
    const invitation = await request(httpServer)
      .post('/api/v1/family-invitations')
      .set(auth(sender.accessToken))
      .send({ recipientId: recipient.user.id })
      .expect(201);

    await request(httpServer)
      .patch(`/api/v1/family-invitations/${(invitation.body as InvitationResult).id}/accept`)
      .set(auth(recipient.accessToken))
      .expect(200);
  }

  it('protects the couple lifecycle and family-owned resources', async () => {
    const unauthorized = await request(httpServer)
      .get('/api/v1/users')
      .set('x-request-id', 'e2e-unauthorized-request')
      .expect('x-request-id', 'e2e-unauthorized-request')
      .expect(401);
    expect(unauthorized.body).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      requestId: 'e2e-unauthorized-request',
    } satisfies Partial<ApiErrorResult>);

    const invalidRegistration = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ email: 'invalid' })
      .expect(400);
    const validationError = invalidRegistration.body as ApiErrorResult;
    expect(validationError).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      requestId: invalidRegistration.headers['x-request-id'],
    });
    expect(Array.isArray(validationError.message)).toBe(true);
    expect(validationError.details?.messages).toEqual(validationError.message);

    const [alice, bob, carol, dave] = await Promise.all([
      register('Alice'),
      register('Bob'),
      register('Carol'),
      register('Dave'),
    ]);

    const registry = await request(httpServer)
      .get('/api/v1/users?page=1&limit=20')
      .set(auth(alice.accessToken))
      .expect(200);
    const registryBody = registry.body as RegistryResult;
    expect(registryBody.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: alice.user.id })]),
    );
    expect(registryBody.total).toBe(3);

    await request(httpServer)
      .post('/api/v1/family-invitations')
      .set(auth(alice.accessToken))
      .send({ recipientId: alice.user.id })
      .expect(409);

    await createFamily(alice, bob);
    await createFamily(carol, dave);

    const family = await request(httpServer)
      .get('/api/v1/families/me')
      .set(auth(alice.accessToken))
      .expect(200);
    const familyBody = family.body as FamilyResult;
    expect(familyBody).toMatchObject({
      status: FamilyStatus.ACTIVE,
      timeZone: 'Europe/Moscow',
      locale: 'ru-RU',
      defaultCurrency: 'RUB',
    });
    expect(familyBody.members).toHaveLength(2);
    expect(familyBody.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: FamilyMemberRole.PARTNER }),
        expect.objectContaining({ role: FamilyMemberRole.PARTNER }),
      ]),
    );

    const eventPayload = {
      name: 'Private family event',
      description: 'Must not cross the family boundary',
      scheduledAt: '2030-08-20T18:00:00.000Z',
      location: 'Home',
    };
    const event = await request(httpServer)
      .post('/api/v1/family-events')
      .set(auth(alice.accessToken))
      .set('Idempotency-Key', 'event-create-e2e-0001')
      .send(eventPayload)
      .expect(201);
    const eventBody = event.body as EventResult;

    const replayedEvent = await request(httpServer)
      .post('/api/v1/family-events')
      .set(auth(alice.accessToken))
      .set('Idempotency-Key', 'event-create-e2e-0001')
      .send(eventPayload)
      .expect(201);
    expect((replayedEvent.body as EventResult).id).toBe(eventBody.id);
    expect(await prisma.familyEvent.count({ where: { id: eventBody.id } })).toBe(1);

    const reusedKey = await request(httpServer)
      .post('/api/v1/family-events')
      .set(auth(alice.accessToken))
      .set('Idempotency-Key', 'event-create-e2e-0001')
      .send({ ...eventPayload, name: 'Different payload' })
      .expect(409);
    expect(reusedKey.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });

    const staleUpdate = await request(httpServer)
      .patch(`/api/v1/family-events/${eventBody.id}`)
      .set(auth(alice.accessToken))
      .set('If-Match', '999')
      .send({ name: 'Stale overwrite' })
      .expect(409);
    expect(staleUpdate.body).toMatchObject({
      code: 'VERSION_CONFLICT',
      details: { expectedVersion: 999 },
    });

    const updatedEvent = await request(httpServer)
      .patch(`/api/v1/family-events/${eventBody.id}`)
      .set(auth(alice.accessToken))
      .set('If-Match', `"${eventBody.version}"`)
      .send({ name: 'Updated private family event' })
      .expect(200);
    expect((updatedEvent.body as EventResult).version).toBe(eventBody.version + 1);

    await request(httpServer)
      .get(`/api/v1/family-events/${eventBody.id}`)
      .set(auth(carol.accessToken))
      .expect(404);

    await request(httpServer)
      .patch(`/api/v1/family-events/${eventBody.id}/confirm`)
      .set(auth(alice.accessToken))
      .expect(403);

    await request(httpServer)
      .patch(`/api/v1/family-events/${eventBody.id}/confirm`)
      .set(auth(bob.accessToken))
      .expect(200);

    await request(httpServer).post('/api/v1/auth/logout').set(auth(alice.accessToken)).expect(204);
    await request(httpServer).get('/api/v1/families/me').set(auth(alice.accessToken)).expect(401);
  });

  it('creates and accepts a closed one-time invitation after registration', async () => {
    const sender = await register('LinkSender');
    const recipientEmail = 'linkrecipient@e2e.test';

    const created = await request(httpServer)
      .post('/api/v1/family-invitations/private')
      .set(auth(sender.accessToken))
      .send({ recipientEmail: `  ${recipientEmail.toUpperCase()}  ` })
      .expect(201);
    const createdBody = created.body as PrivateInvitationResult;
    expect(createdBody).toMatchObject({ recipientEmail, status: 'PENDING' });
    expect(createdBody.inviteUrl).toBeDefined();
    const token = new URL(createdBody.inviteUrl as string).hash.replace('#token=', '');
    expect(token.length).toBeGreaterThanOrEqual(32);
    const storedInvitation = await prisma.privateFamilyInvitation.findUnique({
      where: { id: createdBody.id },
    });
    expect(storedInvitation).toMatchObject({ maxUses: 1, useCount: 0 });
    expect(storedInvitation?.tokenHash).not.toContain(token);

    await request(httpServer)
      .post('/api/v1/family-invitations/private')
      .set(auth(sender.accessToken))
      .send({ recipientEmail })
      .expect(429);

    const outgoing = await request(httpServer)
      .get('/api/v1/family-invitations/private/outgoing')
      .set(auth(sender.accessToken))
      .expect(200);
    expect(outgoing.body).toEqual([
      expect.objectContaining({ id: createdBody.id, recipientEmail, status: 'PENDING' }),
    ]);
    expect((outgoing.body as PrivateInvitationResult[])[0].inviteUrl).toBeUndefined();

    const wrongRecipient = await register('LinkWrong');
    await request(httpServer)
      .post('/api/v1/family-invitations/private/accept')
      .set(auth(wrongRecipient.accessToken))
      .send({ token })
      .expect(403);

    const recipient = await register('LinkRecipient');
    await request(httpServer)
      .post('/api/v1/family-invitations/private/accept')
      .set(auth(recipient.accessToken))
      .set('Idempotency-Key', 'closed-invite-accept-e2e-0001')
      .send({ token })
      .expect(200)
      .expect(({ body }: { body: PrivateInvitationResult }) => {
        expect(body).toMatchObject({ id: createdBody.id, status: 'ACCEPTED' });
      });

    await request(httpServer)
      .post('/api/v1/family-invitations/private/accept')
      .set(auth(recipient.accessToken))
      .set('Idempotency-Key', 'closed-invite-accept-e2e-0001')
      .send({ token })
      .expect(200);
    await request(httpServer)
      .post('/api/v1/family-invitations/private/accept')
      .set(auth(recipient.accessToken))
      .send({ token })
      .expect(409);

    const family = await request(httpServer)
      .get('/api/v1/families/me')
      .set(auth(recipient.accessToken))
      .expect(200);
    expect((family.body as FamilyResult).members).toHaveLength(2);
  });

  it('reads and updates only the authenticated profile with optional concurrency', async () => {
    const owner = await register('ProfileOwner');

    const current = await request(httpServer)
      .get('/api/v1/users/me')
      .set(auth(owner.accessToken))
      .expect(200);
    const profile = current.body as UserProfileResult;
    expect(profile).toMatchObject({
      id: owner.user.id,
      locale: 'ru-RU',
      timeZone: 'Europe/Moscow',
      version: 1,
    });

    const updated = await request(httpServer)
      .patch('/api/v1/users/me')
      .set(auth(owner.accessToken))
      .set('If-Match', String(profile.version))
      .send({ firstName: 'Updated', locale: 'en-US', timeZone: 'Asia/Tokyo' })
      .expect(200);
    expect(updated.body).toMatchObject({
      id: owner.user.id,
      firstName: 'Updated',
      locale: 'en-US',
      timeZone: 'Asia/Tokyo',
      version: 2,
    });

    const stale = await request(httpServer)
      .patch('/api/v1/users/me')
      .set(auth(owner.accessToken))
      .set('If-Match', String(profile.version))
      .send({ firstName: 'Stale' })
      .expect(409);
    expect((stale.body as ApiErrorResult).code).toBe('VERSION_CONFLICT');

    await request(httpServer)
      .patch('/api/v1/users/me')
      .send({ firstName: 'Anonymous' })
      .expect(401);
  });

  it('changes the password and manages revocable user sessions', async () => {
    const owner = await register('SessionOwner');
    const secondLogin = await request(httpServer)
      .post('/api/v1/auth/login')
      .set('User-Agent', 'MyLove E2E second device')
      .send({ email: owner.user.email, password: 'StrongPassword123!' })
      .expect(200);
    let secondToken = (secondLogin.body as AuthResult).accessToken;

    const listed = await request(httpServer)
      .get('/api/v1/auth/sessions')
      .set(auth(owner.accessToken))
      .expect(200);
    const sessions = listed.body as SessionResult[];
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((session) => session.isCurrent)).toHaveLength(1);
    expect(sessions.some((session) => session.userAgent === 'MyLove E2E second device')).toBe(true);

    const secondSession = sessions.find((session) => !session.isCurrent);
    expect(secondSession).toBeDefined();
    await request(httpServer)
      .delete(`/api/v1/auth/sessions/${secondSession?.id}`)
      .set(auth(owner.accessToken))
      .expect(204);
    await request(httpServer).get('/api/v1/auth/sessions').set(auth(secondToken)).expect(401);

    const replacementLogin = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: owner.user.email, password: 'StrongPassword123!' })
      .expect(200);
    secondToken = (replacementLogin.body as AuthResult).accessToken;

    await request(httpServer)
      .patch('/api/v1/auth/password')
      .set(auth(owner.accessToken))
      .send({ currentPassword: 'WrongPassword123!', newPassword: 'NewStrongPassword123!' })
      .expect(403);

    await request(httpServer)
      .patch('/api/v1/auth/password')
      .set(auth(owner.accessToken))
      .send({
        currentPassword: 'StrongPassword123!',
        newPassword: 'NewStrongPassword123!',
      })
      .expect(204);

    await request(httpServer).get('/api/v1/auth/sessions').set(auth(owner.accessToken)).expect(200);
    await request(httpServer).get('/api/v1/auth/sessions').set(auth(secondToken)).expect(401);

    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: owner.user.email, password: 'StrongPassword123!' })
      .expect(401);
    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: owner.user.email, password: 'NewStrongPassword123!' })
      .expect(200);
  });

  it('delivers a committed outbox email event exactly once', async () => {
    const queued = await prisma.outboxEvent.create({
      data: {
        type: 'email.send',
        payload: { to: 'recipient@e2e.test', subject: 'E2E', text: 'Message' },
      },
    });
    const outbox = app.get(OutboxService);

    await expect(outbox.processAvailable()).resolves.toBe(1);
    const delivered = await prisma.outboxEvent.findUnique({ where: { id: queued.id } });
    expect(delivered).toMatchObject({ status: OutboxEventStatus.DELIVERED, attempts: 0 });

    await expect(outbox.processAvailable()).resolves.toBe(0);
  });

  it('requests and confirms a one-time password reset without exposing the reset link', async () => {
    const account = await register('PasswordReset');
    const unknownEmail = 'unknown-password-reset@e2e.test';

    const knownRequest = await request(httpServer)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: `  ${account.user.email.toUpperCase()}  ` })
      .expect(202);
    const unknownRequest = await request(httpServer)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: unknownEmail })
      .expect(202);
    expect(knownRequest.body).toEqual(unknownRequest.body);

    const queued = await prisma.outboxEvent.findFirst({
      where: { type: 'email.send', status: OutboxEventStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    expect(queued?.payload).toMatchObject({ to: account.user.email });
    expect(JSON.stringify(queued?.payload)).toContain('encryptedText');
    expect(JSON.stringify(queued?.payload)).not.toContain('/reset-password?token=');
    await app.get(OutboxService).processAvailable();

    const token = randomBytes(32).toString('base64url');
    await prisma.passwordResetToken.create({
      data: {
        userId: account.user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await request(httpServer)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token, newPassword: 'RecoveredStrongPassword123!' })
      .expect(204);
    await request(httpServer)
      .get('/api/v1/auth/sessions')
      .set(auth(account.accessToken))
      .expect(401);
    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: account.user.email, password: 'StrongPassword123!' })
      .expect(401);
    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: account.user.email, password: 'RecoveredStrongPassword123!' })
      .expect(200);
    await request(httpServer)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token, newPassword: 'AnotherStrongPassword123!' })
      .expect(400);
  });

  it('changes email only after a one-time confirmation and revokes every session', async () => {
    const account = await register('EmailChange');
    const newEmail = 'email-change-confirmed@e2e.test';

    await request(httpServer)
      .post('/api/v1/auth/email-change/request')
      .set(auth(account.accessToken))
      .send({ email: newEmail, currentPassword: 'WrongPassword123!' })
      .expect(403);
    await request(httpServer)
      .post('/api/v1/auth/email-change/request')
      .set(auth(account.accessToken))
      .send({ email: `  ${newEmail.toUpperCase()}  ` })
      .expect(400);
    await request(httpServer)
      .post('/api/v1/auth/email-change/request')
      .set(auth(account.accessToken))
      .send({ email: newEmail, currentPassword: 'StrongPassword123!' })
      .expect(202);

    const queued = await prisma.outboxEvent.findFirst({
      where: { type: 'email.send', status: OutboxEventStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    expect(queued?.payload).toMatchObject({ to: newEmail });
    expect(JSON.stringify(queued?.payload)).not.toContain('confirm-email-change?token=');

    const token = randomBytes(32).toString('base64url');
    await prisma.emailChangeToken.create({
      data: {
        userId: account.user.id,
        requestedEmail: newEmail,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await request(httpServer).post('/api/v1/auth/email-change/confirm').send({ token }).expect(204);

    await request(httpServer).get('/api/v1/users/me').set(auth(account.accessToken)).expect(401);
    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: account.user.email, password: 'StrongPassword123!' })
      .expect(401);
    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: newEmail, password: 'StrongPassword123!' })
      .expect(200);
    await request(httpServer).post('/api/v1/auth/email-change/confirm').send({ token }).expect(400);
  });

  it('deactivates an account during the deletion grace period and restores it once', async () => {
    const account = await register('AccountDeletion');

    await request(httpServer)
      .post('/api/v1/auth/account-deletion/request')
      .set(auth(account.accessToken))
      .send({ currentPassword: 'WrongPassword123!' })
      .expect(403);

    const deletionRequest = await request(httpServer)
      .post('/api/v1/auth/account-deletion/request')
      .set(auth(account.accessToken))
      .send({ currentPassword: 'StrongPassword123!' })
      .expect(202);
    expect(
      new Date((deletionRequest.body as AccountDeletionRequestResult).scheduledFor).getTime(),
    ).toBeGreaterThan(Date.now());

    const deactivated = await prisma.user.findUnique({ where: { id: account.user.id } });
    expect(deactivated).toMatchObject({ isActive: false });
    expect(deactivated?.deletionRequestedAt).not.toBeNull();
    expect(deactivated?.deletionScheduledAt).not.toBeNull();
    await request(httpServer).get('/api/v1/users/me').set(auth(account.accessToken)).expect(401);
    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: account.user.email, password: 'StrongPassword123!' })
      .expect(401);

    const queued = await prisma.outboxEvent.findFirst({
      where: { type: 'email.send', status: OutboxEventStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    expect(queued?.payload).toMatchObject({ to: account.user.email });
    expect(JSON.stringify(queued?.payload)).not.toContain('cancel-account-deletion?token=');

    const token = randomBytes(32).toString('base64url');
    await prisma.accountDeletionToken.create({
      data: {
        userId: account.user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await request(httpServer)
      .post('/api/v1/auth/account-deletion/cancel')
      .send({ token })
      .expect(204);

    const restored = await prisma.user.findUnique({ where: { id: account.user.id } });
    expect(restored).toMatchObject({
      isActive: true,
      deletionRequestedAt: null,
      deletionScheduledAt: null,
    });
    await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: account.user.email, password: 'StrongPassword123!' })
      .expect(200);
    await request(httpServer)
      .post('/api/v1/auth/account-deletion/cancel')
      .send({ token })
      .expect(400);
  });

  it('links and unlinks Telegram with a validated one-time token', async () => {
    const account = await register('TelegramLink');

    await request(httpServer)
      .post('/api/v1/telegram/link/exchange')
      .send({ token: 'short', telegramUserId: '', chatId: '' })
      .expect(400);

    const created = await request(httpServer)
      .post('/api/v1/telegram/link-token')
      .set(auth(account.accessToken))
      .expect(201);
    const link = created.body as { token: string; expiresAt: string };
    expect(link.token.length).toBeGreaterThanOrEqual(32);
    expect(new Date(link.expiresAt).getTime()).toBeGreaterThan(Date.now());

    await request(httpServer)
      .post('/api/v1/telegram/link/exchange')
      .send({ token: link.token, telegramUserId: 'tg-user-e2e', chatId: 'tg-chat-e2e' })
      .expect(201)
      .expect(({ body }: { body: { linked: boolean } }) => expect(body.linked).toBe(true));

    await request(httpServer)
      .post('/api/v1/telegram/link/exchange')
      .send({ token: link.token, telegramUserId: 'tg-user-e2e', chatId: 'tg-chat-e2e' })
      .expect(404);

    const connection = await request(httpServer)
      .get('/api/v1/telegram/connection')
      .set(auth(account.accessToken))
      .expect(200);
    expect(connection.body).toMatchObject({ telegramUserId: 'tg-user-e2e', status: 'ACTIVE' });
    expect(connection.body).not.toHaveProperty('chatId');

    await request(httpServer)
      .get('/api/v1/telegram/integration/connection?telegramUserId=tg-user-e2e')
      .set('x-telegram-integration-secret', 'invalid-secret-that-is-long-enough')
      .expect(503);

    await request(httpServer)
      .delete('/api/v1/telegram/connection')
      .set(auth(account.accessToken))
      .expect(204);
    await request(httpServer)
      .get('/api/v1/telegram/connection')
      .set(auth(account.accessToken))
      .expect(200)
      .expect(({ body }: { body: { status: string } }) => expect(body.status).toBe('REVOKED'));
  });

  it('protects tasks, shopping, notifications and reminders across families', async () => {
    const [alice, bob, outsider, outsiderPartner] = await Promise.all([
      register('HouseholdAlice'),
      register('HouseholdBob'),
      register('HouseholdOutsider'),
      register('HouseholdOutsiderPartner'),
    ]);
    await createFamily(alice, bob);
    await createFamily(outsider, outsiderPartner);

    const taskResponse = await request(httpServer)
      .post('/api/v1/families/me/tasks')
      .set(auth(alice.accessToken))
      .send({
        title: 'Family-only task',
        priority: 'NORMAL',
        assignedToId: bob.user.id,
        dueAt: '2026-08-16T10:00:00.000Z',
      })
      .expect(201);
    const task = taskResponse.body as { id: string; version: number };

    await request(httpServer)
      .patch(`/api/v1/families/me/tasks/${task.id}`)
      .set(auth(alice.accessToken))
      .set('If-Match', 'invalid')
      .send({ title: 'Invalid concurrency header' })
      .expect(400);
    await request(httpServer)
      .patch(`/api/v1/families/me/tasks/${task.id}`)
      .set(auth(outsider.accessToken))
      .send({ title: 'Cross-family overwrite' })
      .expect(404);

    const bobInbox = await request(httpServer)
      .get('/api/v1/notifications')
      .set(auth(bob.accessToken))
      .expect(200);
    const taskNotification = (bobInbox.body as Array<{ id: string; type: string }>).find(
      (notification) => notification.type === 'TASK_CREATED',
    );
    expect(taskNotification).toBeDefined();
    await request(httpServer)
      .patch(`/api/v1/notifications/${taskNotification?.id}/read`)
      .set(auth(alice.accessToken))
      .expect(404);

    const reminder = await request(httpServer)
      .post(`/api/v1/families/me/tasks/${task.id}/reminders`)
      .set(auth(bob.accessToken))
      .send({ remindAt: '2026-08-16T08:00:00.000Z' })
      .expect(201);
    const reminderId = (reminder.body as { id: string }).id;
    await request(httpServer)
      .delete(`/api/v1/families/me/tasks/reminders/${reminderId}`)
      .set(auth(alice.accessToken))
      .expect(404);

    const calendar = await request(httpServer)
      .get('/api/v1/families/me/calendar?dateFrom=2026-08-16&dateTo=2026-08-17')
      .set(auth(bob.accessToken))
      .expect(200);
    expect(calendar.body).toMatchObject({
      timeZone: 'Europe/Moscow',
      truncated: false,
    });
    expect((calendar.body as { data: Array<{ sourceId: string }> }).data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: task.id, kind: 'TASK' }),
        expect.objectContaining({ sourceId: reminderId, kind: 'TASK_REMINDER' }),
      ]),
    );
    const outsiderCalendar = await request(httpServer)
      .get('/api/v1/families/me/calendar?dateFrom=2026-08-16&dateTo=2026-08-17')
      .set(auth(outsider.accessToken))
      .expect(200);
    expect(
      (outsiderCalendar.body as { data: Array<{ sourceId: string }> }).data.some(
        (entry) => entry.sourceId === task.id || entry.sourceId === reminderId,
      ),
    ).toBe(false);

    const maintenance = app.get(MaintenanceService);
    await expect(
      maintenance.deliverDueReminders(new Date('2026-08-16T09:00:00.000Z')),
    ).resolves.toEqual({ delivered: 1 });
    await expect(
      maintenance.deliverDueReminders(new Date('2026-08-16T09:00:00.000Z')),
    ).resolves.toEqual({ delivered: 0 });

    const firstList = await request(httpServer)
      .post('/api/v1/families/me/shopping-lists')
      .set(auth(alice.accessToken))
      .send({ name: 'Groceries' })
      .expect(201);
    const secondList = await request(httpServer)
      .post('/api/v1/families/me/shopping-lists')
      .set(auth(alice.accessToken))
      .send({ name: 'Hardware' })
      .expect(201);
    const firstListId = (firstList.body as { id: string }).id;
    const secondListId = (secondList.body as { id: string }).id;
    const itemResponse = await request(httpServer)
      .post(`/api/v1/families/me/shopping-lists/${firstListId}/items`)
      .set(auth(alice.accessToken))
      .send({ name: 'Milk' })
      .expect(201);
    const item = itemResponse.body as { id: string; version: number };

    await request(httpServer)
      .post(`/api/v1/families/me/shopping-lists/${secondListId}/items/${item.id}/check`)
      .set(auth(alice.accessToken))
      .set('If-Match', String(item.version))
      .expect(404);
    await request(httpServer)
      .post(`/api/v1/families/me/shopping-lists/${firstListId}/items/${item.id}/check`)
      .set(auth(alice.accessToken))
      .set('If-Match', String(item.version))
      .expect(201);
  });
});
