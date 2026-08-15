import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { DissolutionResponseDto } from './dto/dissolution-response.dto';
import { FamiliesService } from './families.service';
import { PaginatedAuditEventsResponseDto } from './dto/paginated-audit-events-response.dto';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';
import { FamilyDashboardResponseDto } from './dto/family-dashboard-response.dto';

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

  @Get('me/dashboard')
  @ApiOperation({ summary: 'Get the current family dashboard aggregates' })
  @ApiOkResponse({ type: FamilyDashboardResponseDto })
  dashboard(@CurrentUser() user: AuthenticatedUser): Promise<FamilyDashboardResponseDto> {
    return this.familiesService.dashboard(user.id);
  }

  @Get('me/audit-events')
  @ApiOperation({ summary: 'List the current family audit events' })
  @ApiOkResponse({ type: PaginatedAuditEventsResponseDto })
  listAuditEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AuditEventsQueryDto,
  ): Promise<PaginatedAuditEventsResponseDto> {
    return this.familiesService.listAuditEvents(user.id, query);
  }

  @Delete('me/membership')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave the current family' })
  leaveFamily(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.familiesService.leave(user.id);
  }

  @Post('me/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive the current family' })
  archiveFamily(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.familiesService.archive(user.id);
  }

  @Post('me/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restore the current archived family' })
  restoreFamily(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.familiesService.restore(user.id);
  }

  @Post('me/dissolution/request')
  @ApiOperation({ summary: 'Request family dissolution' })
  @ApiOkResponse({ type: DissolutionResponseDto })
  requestDissolution(@CurrentUser() user: AuthenticatedUser): Promise<DissolutionResponseDto> {
    return this.familiesService.requestDissolution(user.id);
  }

  @Post('me/dissolution/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm family dissolution' })
  confirmDissolution(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.familiesService.confirmDissolution(user.id);
  }

  @Delete('me/dissolution')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel family dissolution request' })
  cancelDissolution(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.familiesService.cancelDissolution(user.id);
  }
}
