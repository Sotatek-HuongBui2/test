import {Controller, Get, Query, Req, UseGuards} from '@nestjs/common'
import {ApiBearerAuth, ApiTags} from '@nestjs/swagger'
import {JwtAuthGuard} from 'src/auth/guards/jwt-auth.guard';

import {TrackingResultDto} from "./dtos/tracking-result.dto";
import {IChartDay, IChartWeekMonth, TrackingResultSevice} from './tracking-result.service';

@ApiTags('tracking-result')
@Controller('tracking-result')
export class TrackingResultController {
  constructor(private readonly trackingResultService: TrackingResultSevice) {
  }

  @Get('chart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async trackingResult(
    @Req() req: any,
    @Query() dto: TrackingResultDto,
  ): Promise<IChartDay | IChartWeekMonth> {
    return this.trackingResultService.getChartData(req.user.id, dto.type, dto.fdate, dto.tdate)
  }
}
