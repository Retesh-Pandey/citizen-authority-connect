type RecoveryOtpAuth = {
  verifyOtp: (params: { email: string; token: string; type: "recovery" }) => Promise<{ error: Error | null }>;
};

export async function confirmRecoveryCode(auth: RecoveryOtpAuth, email: string, token: string) {
  const { error } = await auth.verifyOtp({ email, token, type: "recovery" });
  if (error) throw error;
}