import { Controller, Post, Get, Delete, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { RefreshDto } from './refresh.dto';
import { JwtGuard } from './jwt.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Account registered successfully, returns access + refresh tokens.' })
  @ApiResponse({ status: 400, description: 'Invalid input payload.' })
  @ApiResponse({ status: 409, description: 'User with this email already exists.' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Authentication credentials validated successfully, returns tokens.' })
  @ApiResponse({ status: 400, description: 'Invalid input payload.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account.' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for new tokens' })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: 200, description: 'Tokens successfully refreshed.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token.' })
  async refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get profile details of the active user' })
  @ApiResponse({ status: 200, description: 'User profile fetched successfully.' })
  @ApiResponse({ status: 401, description: 'Missing, expired, or invalid bearer token.' })
  async getMe(@Req() req: any) {
    const userId = req.user.sub;
    return this.authService.getMe(userId);
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidate active user session' })
  @ApiResponse({ status: 200, description: 'User logged out and session cleared.' })
  @ApiResponse({ status: 401, description: 'Invalid session/bearer token.' })
  async logout(@Req() req: any) {
    const userId = req.user.sub;
    return this.authService.logout(userId);
  }

  @Delete('account')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate user account (soft delete)' })
  @ApiResponse({ status: 200, description: 'User account soft deleted and sessions invalidated.' })
  @ApiResponse({ status: 401, description: 'Invalid bearer token.' })
  async deactivate(@Req() req: any) {
    const userId = req.user.sub;
    return this.authService.deactivate(userId);
  }
}
