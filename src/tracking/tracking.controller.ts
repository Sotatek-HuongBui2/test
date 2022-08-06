import {Body, Controller, Get, HttpStatus, Param, Post, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {Tracking} from "../databases/entities/tracking.entity";
import {TrackingResult} from "../databases/entities/tracking-result.entity";
import {SwaggerBaseApiResponse} from "../shared/dtos/base-api-response.dto";
import {ReqContext} from "../shared/request-context/req-context.decorator";
import {RequestContext} from "../shared/request-context/request-context.dto";
import {CreateTrackingDto} from "./dtos/create-tracking.dto";
import {WakeUpResultDto} from "./dtos/wakeup-result.dto";
import {TrackingService} from "./tracking.service";

@Controller('tracking')
@ApiTags('Sleep tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create tracking API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(Tracking),
  })
  async createTracking(@Body() dto: CreateTrackingDto, @ReqContext() ctx: RequestContext): Promise<any> {
    return this.trackingService.createTracking(dto, ctx);
  }

  @Get('/estimate-tracking')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Estimate tracking',
  })
  async estimateTracking(@ReqContext() ctx: RequestContext,
  ) {
    return this.trackingService.estimateEarnWrapperApi(ctx.user.id)
  }

  @Get('/tracking-result/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'get tracking result',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TrackingResult
  })
  async getTrackingResult(@Param('id') id: number): Promise<TrackingResult> {
    return this.trackingService.getTrackingResult(id)
  }

  @Post('/wake-up')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'tracking wake up',
  })
  async wakeUp(@Body() dto: WakeUpResultDto, @ReqContext() ctx: RequestContext,) {
    return this.trackingService.wakeUp(dto, ctx.user.id)
  }

  @Get('/user-status-tracking')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'get tracking status off user',
  })
  userStatusTracking(@ReqContext() ctx: RequestContext,) {
    return this.trackingService.getStatusTracking(ctx)
  }

  @Get('/sleep-score/:id')
  @ApiOperation({summary: 'get sleep score by tracking id'})
  getSleepScore(@Param('id') id: number) {
    return this.trackingService.wrapperSleepScoreByTrackingId(id)
  }
}
