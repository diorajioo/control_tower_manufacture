import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    /** Azure AD access token — available on the server via getToken() or getServerSession() */
    accessToken?: string;
    /** Set to "RefreshAccessTokenError" when the token could not be refreshed */
    error?: "RefreshAccessTokenError";
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    /** Unix timestamp (seconds) when the access token expires */
    expiresAt?: number;
    error?: "RefreshAccessTokenError";
  }
}