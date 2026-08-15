import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { FamilyResponseDto } from './dto/family-response.dto';
import { FamiliesService } from './families.service';

@ApiTags('families')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families', version: '1' })
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user family' })
  @ApiOkResponse({ type: FamilyResponseDto })
  @ApiForbiddenResponse({ description: 'An active family membership is required' })
  findMyFamily(@CurrentUser() user: AuthenticatedUser): Promise<FamilyResponseDto> {
    return this.familiesService.findMine(user.id);
  }
}
