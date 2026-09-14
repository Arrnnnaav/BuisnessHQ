export const MIN_OPERATOR_TOKEN_LENGTH = 32;

export function validateOperatorToken(token) {
  return typeof token === "string" && token.length >= MIN_OPERATOR_TOKEN_LENGTH;
}
