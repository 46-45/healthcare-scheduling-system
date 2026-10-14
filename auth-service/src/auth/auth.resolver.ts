import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { LoginResponse } from './entities/login-response.entity';
import { User } from './entities/user.entity';

/**
 * GraphQL resolver for authentication operations.
 * Handles user authentication mutations and queries.
 */
@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user with email and password.
   * 
   * @param email - Email address for the new account
   * @param password - Password for the new account
   * @returns User object excluding password
   * @throws GraphQLError with code CONFLICT if email already exists
   * @throws GraphQLError with code INVALID_INPUT if validation fails
   */
  @Mutation(() => User, {
    description: 'Register a new user with email and password. Returns user info excluding password.',
  })
  async register(
    @Args('email', { type: () => String, description: 'Email address for the new account (must be unique and valid format)' }) email: string,
    @Args('password', { type: () => String, description: 'Password for the new account (minimum 8 characters, must contain at least one letter and one number)' }) password: string,
  ): Promise<User> {
    const registerInput: RegisterInput = { email, password };
    return this.authService.register(registerInput);
  }

  /**
   * Login mutation to authenticate user and generate JWT token.
   * 
   * @param email - Email address of the user
   * @param password - Password for authentication
   * @returns LoginResponse with accessToken and expiresAt
   * @throws GraphQLError with code UNAUTHENTICATED if credentials are invalid
   */
  @Mutation(() => LoginResponse, {
    description: 'Authenticate user and generate JWT access token. Returns access token and expiration timestamp.',
  })
  async login(
    @Args('email', { type: () => String, description: 'Email address of the user' }) email: string,
    @Args('password', { type: () => String, description: 'Password for authentication' }) password: string,
  ): Promise<LoginResponse> {
    const loginInput: LoginInput = { email, password };
    return this.authService.login(loginInput);
  }

  /**
   * Validate JWT token and return user information.
   * Used by Schedule Service to authenticate incoming requests.
   * 
   * @param token - JWT access token to validate
   * @returns User object excluding password
   * @throws GraphQLError with code UNAUTHENTICATED if token is expired or invalid
   */
  @Query(() => User, {
    description: 'Validate JWT token and return user information',
  })
  async validateToken(
    @Args('token', { type: () => String, description: 'JWT access token to validate' }) token: string,
  ): Promise<User> {
    return this.authService.validateToken(token);
  }
}
