const { z } = require('zod');

const googleClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.literal(true),
  name: z.string().min(1).optional(),
  picture: z.string().url().optional(),
});

function parseGoogleClaims(claims) {
  return googleClaimsSchema.parse(claims);
}

module.exports = { parseGoogleClaims };
