import { ApiProperty } from '@nestjs/swagger';

class ExportMemberDto {
  @ApiProperty() id: string;
  @ApiProperty() role: string;
  @ApiProperty() joinedAt: Date;
  @ApiProperty() userId: string;
}

class ExportFamilyDto {
  @ApiProperty() id: string;
  @ApiProperty() status: string;
  @ApiProperty() timeZone: string;
  @ApiProperty() locale: string;
  @ApiProperty() defaultCurrency: string;
  @ApiProperty({ type: [ExportMemberDto] }) members: ExportMemberDto[];
  @ApiProperty({ type: [Object] }) events: Record<string, unknown>[];
  @ApiProperty({ type: Object, nullable: true }) firstDate: Record<string, unknown> | null;
}

export class AccountExportResponseDto {
  @ApiProperty({ example: 'my-love-account-export' }) format: string;
  @ApiProperty({ example: '2026-08-15T12:00:00.000Z' }) exportedAt: Date;
  @ApiProperty({ type: Object }) profile: Record<string, unknown>;
  @ApiProperty({ type: [ExportFamilyDto] }) families: ExportFamilyDto[];
  @ApiProperty({ type: [Object] }) invitations: Record<string, unknown>[];
}
