import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthResult, AuthService } from 'src/modules/auth/auth.service';
import { ChangePasswordDto } from 'src/modules/auth/dto/change-password.dto';
import { LoginDto } from 'src/modules/auth/dto/login.dto';
import { RegisterStudentDto } from 'src/modules/auth/dto/register-student.dto';
import { TokenService } from 'src/modules/auth/token.service';
import type { AuthenticatedRequest, AuthUser } from 'src/shared/auth/auth-user';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto);
  }

  @Public()
  @Post('register-student')
  registerStudent(@Body() dto: RegisterStudentDto): Promise<AuthResult> {
    return this.auth.registerStudent(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser): { user: AuthUser } {
    return { user };
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    if (request.accessToken) {
      await this.tokens.revoke(request.accessToken);
    }
  }

  @ApiBearerAuth()
  @Put('password')
  @HttpCode(204)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.auth.changePassword(user.id, dto, request.accessToken);
  }
}
