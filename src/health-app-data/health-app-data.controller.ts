import { Body, Controller, Get, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

import { HealthAppDataDto } from './dto/create-data-health-app.dto';
import { HealthAppDataSevice } from './health-app-data.service';

@ApiTags('health-app')
@Controller('health-app')
export class HealthAppDataController {
  constructor(private readonly healthAppDataSevice: HealthAppDataSevice) {
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async insertDataFromHealthApp(
    @Body() healthAppDataDto: HealthAppDataDto,
    @Req() req: any
  ) {
    return await this.healthAppDataSevice.insertDataFromHealthApp(req.user, healthAppDataDto)
  }
}
