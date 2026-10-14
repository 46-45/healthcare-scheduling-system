import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { LoginResponse } from './entities/login-response.entity';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: AuthService;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockLoginResponse: LoginResponse = {
    accessToken: 'mock.jwt.token',
    expiresAt: new Date(Date.now() + 3600000),
  };

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    validateToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user with email and password', async () => {
      const email = 'test@example.com';
      const password = 'Password123';

      mockAuthService.register.mockResolvedValue(mockUser);

      const result = await resolver.register(email, password);

      expect(authService.register).toHaveBeenCalledWith({ email, password });
      expect(result).toEqual(mockUser);
    });

    it('should pass validation through to service', async () => {
      const email = 'invalid-email';
      const password = 'weak';

      mockAuthService.register.mockResolvedValue(mockUser);

      await resolver.register(email, password);

      expect(authService.register).toHaveBeenCalledWith({
        email: 'invalid-email',
        password: 'weak',
      });
    });
  });

  describe('login', () => {
    it('should authenticate user and return access token', async () => {
      const email = 'test@example.com';
      const password = 'Password123';

      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      const result = await resolver.login(email, password);

      expect(authService.login).toHaveBeenCalledWith({ email, password });
      expect(result).toEqual(mockLoginResponse);
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('validateToken', () => {
    it('should validate token and return user information', async () => {
      const token = 'valid.jwt.token';

      mockAuthService.validateToken.mockResolvedValue(mockUser);

      const result = await resolver.validateToken(token);

      expect(authService.validateToken).toHaveBeenCalledWith(token);
      expect(result).toEqual(mockUser);
      expect(result).not.toHaveProperty('password');
    });

    it('should pass token directly to service', async () => {
      const token = 'another.token.here';

      mockAuthService.validateToken.mockResolvedValue(mockUser);

      await resolver.validateToken(token);

      expect(authService.validateToken).toHaveBeenCalledWith(token);
    });
  });
});
