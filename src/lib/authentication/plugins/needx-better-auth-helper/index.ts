import * as z from 'zod';
import { APIError } from 'better-call';
import type { BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint, getSessionFromCtx } from 'better-auth/api';

export const needExcelBetterAuthHelper = () => {
  return {
    id: 'need-excel-better-auth-helper',
    endpoints: {
      signupPhoneNumber: createAuthEndpoint(
        '/need-excel/signup-phone-number',
        {
          method: 'POST',
          body: z.object({
            name: z.string().describe('Name of the user'),
            phoneNumber: z.string().describe('Phone number for the account'),
            password: z.string().describe('Password for the account'),
            confirmPassword: z.string().describe('Confirm password'),
            image: z.string().optional().describe('Profile image URL'),
          }),
        },
        async (ctx) => {
          const { name, phoneNumber, password, confirmPassword, image } = ctx.body;

          // Validate password confirmation
          if (password !== confirmPassword) {
            throw new APIError('BAD_REQUEST', {
              message: 'Passwords do not match',
            });
          }

          // Check if phone number already exists
          const existingUser = await ctx.context.adapter.findOne({
            model: 'user',
            where: [
              {
                field: 'phoneNumber',
                value: phoneNumber,
              },
            ],
          });

          if (existingUser) {
            throw new APIError('BAD_REQUEST', {
              message: 'Phone number already registered',
            });
          }

          // Validate password length
          const minPasswordLength = ctx.context.password.config.minPasswordLength;
          if (password.length < minPasswordLength) {
            throw new APIError('BAD_REQUEST', {
              message: 'Password is too short',
            });
          }

          const maxPasswordLength = ctx.context.password.config.maxPasswordLength;
          if (password.length > maxPasswordLength) {
            throw new APIError('BAD_REQUEST', {
              message: 'Password is too long',
            });
          }

          // Hash the password
          const hashedPassword = await ctx.context.password.hash(password);

          // Create the user with phone number
          const user: any = await ctx.context.internalAdapter.createUser({
            name,
            phoneNumber,
            phoneNumberVerified: false,
            email: `temp-${phoneNumber}@temp.com`, // Temporary email
            emailVerified: false,
            image,
          });

          if (!user) {
            throw new APIError('BAD_REQUEST', {
              message: 'Failed to create user',
            });
          }

          // Create credential account with password
          await ctx.context.internalAdapter.createAccount({
            userId: user.id,
            providerId: 'credential',
            password: hashedPassword,
            accountId: user.id,
          });

          return ctx.json({
            status: true,
            user: {
              id: user.id,
              name: user.name,
              phoneNumber: user.phoneNumber,
              phoneNumberVerified: user.phoneNumberVerified,
              email: user.email,
              emailVerified: user.emailVerified,
              image: user.image,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
          });
        }
      ),
      verifyResetPasswordOTP: createAuthEndpoint(
        '/need-excel/verify-reset-password-otp',
        {
          method: 'POST',
          body: z.object({
            phoneNumber: z.string().describe('Phone number for verification'),
            code: z.string().describe('OTP code to verify'),
          }),
        },
        async (ctx) => {
          const { phoneNumber, code } = ctx.body;

          // Find verification record with identifier for password reset
          const verification = await ctx.context.internalAdapter.findVerificationValue(
            `${phoneNumber}-request-password-reset`
          );

          if (!verification) {
            throw new APIError('BAD_REQUEST', {
              message: 'Verification record not found',
            });
          }

          // Check if expired
          if (verification.expiresAt < new Date()) {
            throw new APIError('BAD_REQUEST', {
              message: 'OTP expired',
            });
          }

          // Extract OTP value from the stored format (value:attempts)
          const [otpValue] = verification.value.split(':');

          // Check if code matches
          if (otpValue !== code) {
            throw new APIError('BAD_REQUEST', {
              message: 'Invalid OTP code',
            });
          }

          return ctx.json({
            status: true,
            message: 'OTP verified successfully',
          });
        }
      ),
      checkPhoneNumberExists: createAuthEndpoint(
        '/need-excel/check-phone-number',
        {
          method: 'POST',
          body: z.object({
            phoneNumber: z.string().describe('Phone number to check'),
          }),
        },
        async (ctx) => {
          const { phoneNumber } = ctx.body;

          const user = await ctx.context.adapter.findOne({
            model: 'user',
            where: [
              {
                field: 'phoneNumber',
                value: phoneNumber,
              },
            ],
          });

          return ctx.json({
            exists: !!user,
          });
        }
      ),
      validatePassword: createAuthEndpoint(
        '/need-excel/validate-password',
        {
          method: 'POST',
          requireHeaders: true,
          body: z.object({
            password: z.string().describe('Password to validate'),
          }),
        },
        async (ctx) => {
          const session = await getSessionFromCtx(ctx);
          if (!session) {
            throw new APIError('UNAUTHORIZED', {
              message: 'Unauthorized',
            });
          }

          const { password } = ctx.body;

          // Get user's credential account
          const accounts = await ctx.context.internalAdapter.findAccountByUserId(session.user.id);
          const credentialAccount = accounts.find((a) => a.providerId === 'credential');

          if (!credentialAccount) {
            throw new APIError('NOT_FOUND', {
              message: 'Credential account not found',
            });
          }

          const currentPassword = credentialAccount?.password;
          if (!currentPassword) {
            throw new APIError('NOT_FOUND', {
              message: 'Password not found',
            });
          }

          // Verify password
          const validPassword = await ctx.context.password.verify({
            hash: currentPassword,
            password,
          });

          return ctx.json({
            valid: validPassword,
          });
        }
      ),
    },
  } satisfies BetterAuthPlugin;
};
