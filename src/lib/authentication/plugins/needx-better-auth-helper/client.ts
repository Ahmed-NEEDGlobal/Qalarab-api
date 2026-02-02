import { BetterAuthClientPlugin } from 'better-auth';
import type { needExcelBetterAuthHelper } from '.';

export const needExcelBetterAuthHelperClient = () => {
  return {
    id: 'need-excel-better-auth-helper',
    $InferServerPlugin: {} as ReturnType<typeof needExcelBetterAuthHelper>,
    getActions: ($fetch) => ({
      signupPhoneNumber: async (data: {
        name: string;
        phoneNumber: string;
        password: string;
        confirmPassword: string;
        image?: string;
      }) => {
        return await $fetch('/need-excel/signup-phone-number', {
          method: 'POST',
          body: data,
        });
      },
      verifyResetPasswordOTP: async (data: { phoneNumber: string; code: string }) => {
        return await $fetch('/need-excel/verify-reset-password-otp', {
          method: 'POST',
          body: data,
        });
      },
      checkPhoneNumberExists: async (data: { phoneNumber: string }) => {
        return await $fetch<{ exists: boolean }>('/need-excel/check-phone-number', {
          method: 'POST',
          body: data,
        });
      },
      validatePassword: async (data: { password: string }) => {
        return await $fetch<{ valid: boolean }>('/need-excel/validate-password', {
          method: 'POST',
          body: data,
        });
      },
    }),
  } satisfies BetterAuthClientPlugin;
};
