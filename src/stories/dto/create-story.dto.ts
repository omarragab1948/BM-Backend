import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateStoryDto {
  @ApiPropertyOptional({ example: 'My day at the beach!' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Story image/video media file' })
  @IsOptional()
  media?: any;
}
