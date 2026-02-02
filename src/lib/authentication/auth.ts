// Get database connection for Better Auth
import { betterAuth } from 'better-auth';
import { surrealdbAdapter } from 'surreal-better-auth';
import {
  openAPI,
  username,
  phoneNumber,
  admin as adminPlugin,
  lastLoginMethod,
  twoFactor,
  anonymous,
  createAuthMiddleware,
  oneTimeToken,
} from 'better-auth/plugins';
import { dbManager } from '@/lib/surrealdb-multi';
import { ac, platformAdmin, platformUser } from '@/lib/authentication/permissions';
import { expo } from '@better-auth/expo';
import { needExcelBetterAuthHelper } from './plugins/needx-better-auth-helper';
import env from '@/env';

const db = await dbManager.getConnection(env.MAIN_NS, env.MAIN_DB);

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: surrealdbAdapter(db, {
    // debugLogs: true,
    // Let SurrealDB generate ULID
    idGenerator: 'surreal.guid',
    // Use singular table names
    usePlural: false,
    // Allow passing custom IDs
    allowPassingId: true,
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds
    },
    additionalFields: {
      activeSpaceId: {
        type: 'string',
        input: true,
        required: false,
      },
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    phoneNumber({
      sendOTP: ({ phoneNumber, code }, request) => {
        // Implement sending OTP code via SMS
        console.log({ phoneNumber, code });
      },
      requireVerification: true,
      callbackOnVerification: async ({ phoneNumber, user }, request) => {
        // Implement callback after phone number verification
        console.log(phoneNumber, user);
      },
    }),
    openAPI({
      disableDefaultReference: true,
    }),
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (username) => {
        if (username === 'admin') {
          return false;
        }
        return true;
      },
    }),
    adminPlugin({
      // Access control for platform-level admin operations
      ac,
      roles: {
        admin: platformAdmin,
        user: platformUser,
      },
    }),
    lastLoginMethod({
      storeInDatabase: true,
    }),

    twoFactor(),
    anonymous(),
    oneTimeToken(),
    expo(),
    needExcelBetterAuthHelper(),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // console.log(ctx);
    }),
  },
  user: {
    additionalFields: {
      gender: {
        type: 'string',
        required: false,
        input: true,
      },
      dateOfBirth: {
        type: 'string',
        required: false,
        input: true,
      },
      about: {
        type: 'string',
        required: false,
        input: true,
      },
      cover: {
        type: 'string',
        required: false,
        input: true,
      },
    },
    deleteUser: {
      enabled: true,
    },
  },
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    // TODO: For mobile APP Scheme later
    // 'needxbusiness://',
    // 'needxspace://',
    // 'ashpash://',
    // 'exp://',
    // 'needx://',
  ],
});
