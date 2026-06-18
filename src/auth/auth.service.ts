import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/user.schema';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { RefreshDto } from './refresh.dto';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') ?? 'dev-jwt-secret-key-change-me-in-production';
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const secretKey = new TextEncoder().encode(this.jwtSecret);

    const accessToken = await new SignJWT({ sub: userId, email, role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secretKey);

    const refreshToken = await new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secretKey);

    return { accessToken, refreshToken };
  }

  private mapUser(user: UserDocument) {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
    };
  }

  async register(registerDto: RegisterDto) {
    const { name, email, password } = registerDto;
    const normalizedEmail = email.toLowerCase();

    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const savedUser = await this.usersService.create(name, normalizedEmail, passwordHash);

    const tokens = await this.generateTokens(savedUser._id.toString(), savedUser.email, savedUser.role);

    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.usersService.updateRefreshTokenHash(savedUser._id.toString(), refreshTokenHash);

    return {
      ...tokens,
      user: this.mapUser(savedUser),
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const normalizedEmail = email.toLowerCase();

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user || user.isActive === false) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user._id.toString(), user.email, user.role);

    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.usersService.updateRefreshTokenHash(user._id.toString(), refreshTokenHash);

    return {
      ...tokens,
      user: this.mapUser(user),
    };
  }

  async refresh(refreshDto: RefreshDto) {
    const { refreshToken } = refreshDto;
    const secretKey = new TextEncoder().encode(this.jwtSecret);

    try {
      const { payload } = await jwtVerify(refreshToken, secretKey, {
        algorithms: ['HS256'],
        clockTolerance: 60,
      });

      const userId = payload.sub;
      if (!userId) {
        throw new UnauthorizedException('Invalid token claims');
      }

      const user = await this.usersService.findById(userId);
      if (!user || user.isActive === false || !user.refreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh session');
      }

      const isHashValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isHashValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user._id.toString(), user.email, user.role);

      const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
      await this.usersService.updateRefreshTokenHash(user._id.toString(), refreshTokenHash);

      return {
        ...tokens,
        user: this.mapUser(user),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user || user.isActive === false) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.generateTokens(user._id.toString(), user.email, user.role);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.usersService.updateRefreshTokenHash(user._id.toString(), refreshTokenHash);

    return {
      ...tokens,
      user: this.mapUser(user),
    };
  }

  async logout(userId: string) {
    await this.usersService.clearRefreshTokenHash(userId);
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async deactivate(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    await this.usersService.deactivate(userId);

    return {
      success: true,
      message: 'Account deactivated successfully',
    };
  }
}
