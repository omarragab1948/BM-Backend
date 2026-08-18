import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class SearchUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Username query filter', example: 'john' })
  @IsOptional()
  @IsString()
  q?: string;
}
