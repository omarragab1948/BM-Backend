import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreatePostDto {
  @ApiPropertyOptional({ example: 'Check out my new video and photos!' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'string', format: 'binary' }, description: 'Media files' })
  @IsOptional()
  media?: any;
}
