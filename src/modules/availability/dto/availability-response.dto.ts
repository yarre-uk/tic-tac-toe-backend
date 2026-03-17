import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityResponseDto {
  @ApiProperty({ example: true })
  available!: boolean;
}
