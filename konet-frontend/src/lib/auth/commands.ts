// Commands that end the current authentication context on successful completion.
export const sessionEndingCommands = [
  "signOut",
  "resetPassword",
  "changePassword",
  "confirmEmailChange",
  "deactivateAccount",
];
export const authenticationCommands = [
  "signIn",
  "signUp",
  ...sessionEndingCommands,
];
