import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PushService } from './push.service';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { PushDeviceResponseDto } from './dto/push-device-response.dto';

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push/devices')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post()
  @ApiOperation({ summary: 'Register or refresh an FCM device token' })
  @ApiOkResponse({ type: PushDeviceResponseDto })
  register(@Req() req: Request & { user: AuthenticatedUser }, @Body() dto: RegisterPushDeviceDto) {
    return this.push.registerDevice(req.user.id, dto);
  }

  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disable an FCM device token owned by the current user' })
  @ApiNoContentResponse()
  async remove(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('token') token: string,
  ): Promise<void> {
    await this.push.disableDevice(req.user.id, token);
  }
}
