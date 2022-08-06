import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {UserOtpModule} from 'src/user-otp/user-otp.module';

import {JwtAuthStrategy} from '../auth/strategies/jwt-auth.strategy';
import {NftAttributesModule} from "../nft-attributes/nft-attributes.module";
import {SettingsModule} from '../settings/settings.module';
import {SharedModule} from '../shared/shared.module';
import {UserCodeRepository} from "../user-code/repositories/user-code.repository";
import {UserOtpRepository} from "../user-otp/repositories/user-otp.repository";
import {UserController} from './controllers/user.controller';
import {UserRepository} from './repositories/user.repository';
import {UserService} from './services/user.service';
import {UserAclService} from './services/user-acl.service';

@Module({
  imports: [
    SharedModule,
    UserOtpModule,
    SettingsModule,
    NftAttributesModule,
    TypeOrmModule.forFeature([UserRepository, UserCodeRepository, UserOtpRepository]),
  ],
  providers: [UserService, JwtAuthStrategy, UserAclService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {
}
