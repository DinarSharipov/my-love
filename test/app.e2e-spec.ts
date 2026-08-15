import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FamilyMemberRole, FamilyStatus, Gender } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

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
});
