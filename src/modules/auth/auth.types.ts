/** Shape of the signed JWT payload. */
export interface JwtPayload {
  /** User id (subject). */
  sub: string;
  /** Primary establishment the user operates on (tenant id). */
  establishmentId: string;
  email: string;
}

/** Authenticated principal attached to the request by the JWT strategy. */
export interface AuthUser {
  userId: string;
  establishmentId: string;
  email: string;
}
