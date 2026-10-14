import { ObjectType, Field } from '@nestjs/graphql';

/**
 * Login response entity returned after successful authentication.
 * Contains the JWT access token and its expiration timestamp.
 */
@ObjectType({ description: 'Response returned after successful login' })
export class LoginResponse {
  @Field({ description: 'JWT access token for authenticating subsequent requests' })
  accessToken: string;

  @Field({ description: 'Timestamp when the access token will expire (ISO 8601 format)' })
  expiresAt: Date;
}
