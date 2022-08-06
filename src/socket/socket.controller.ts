import {
    ClassSerializerInterceptor,
    Controller,
    Get,
    UseInterceptors,
} from '@nestjs/common';

@Controller('')
@UseInterceptors(ClassSerializerInterceptor)
export default class SocketController {
    @Get('health')
    health() {
        return { status: 'OK' };
    }
}
