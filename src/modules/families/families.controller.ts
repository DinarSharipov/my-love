import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
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
  @ApiNotFoundResponse({ description: 'The current user does not belong to a family' })
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<FamilyResponseDto> {
    return this.familiesService.findMine(user.id);
  }
}
