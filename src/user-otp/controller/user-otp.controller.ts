import {Body, Controller, Get, HttpStatus, Post, Query} from "@nestjs/common";
import {ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";

import {BaseApiResponse, SwaggerBaseApiResponse} from "../../shared/dtos/base-api-response.dto";
import {OTP_RESPONSE} from "../constants/UserTypeOTP";
import {CreateUserOtpDto} from "../dtos/create-user-otp.dto";
import {VerifyOtpDto} from "../dtos/verify-otp.dto";
import {UserOtpService} from "../services/user-otp.service";

@ApiTags('User Otp')
@Controller('user-otp')
export class UserOtpController {
  constructor(private readonly userOtpService: UserOtpService) {
  }

  @Get()
  @ApiOperation({
    summary: 'Create user OTP by Type',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwaggerBaseApiResponse(OTP_RESPONSE)
  })
  async createUserOtpByType(@Query() query: CreateUserOtpDto): Promise<BaseApiResponse<OTP_RESPONSE>> {
    const data = await this.userOtpService.getOTPbyType(query);
    return {
      data,
      meta: {}
    }
  }

  @Post('/verify-otp')
  @ApiOperation({
    summary: 'Verify otp code email and type',
  })
  @ApiResponse({
    status: HttpStatus.OK,
  })
  async verifyOtpById(@Body() dto: VerifyOtpDto): Promise<BaseApiResponse<string>> {
    const data = await this.userOtpService.verifyOtpById(dto);
    return {
      data,
      meta: {}
    }
  }
}
