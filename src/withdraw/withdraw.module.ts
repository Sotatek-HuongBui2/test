import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { NftAttributesRepository } from 'src/nft-attributes/nft-attributes.repository'
import { SpendingBalancesRepository } from 'src/spending_balances/spending_balances.repository'

import {NftRepository} from "../nfts/nfts.repository";
import {UserModule} from "../user/user.module";
import { WithdrawRepository } from './withdraw.repository'
import { WithdrawController } from './withdraws.controller'
import { WithdrawSevice } from './withdraws.service'


@Module({
  imports: [UserModule, TypeOrmModule.forFeature([WithdrawRepository, SpendingBalancesRepository, NftAttributesRepository, NftRepository])],
  controllers: [WithdrawController],
  providers: [WithdrawSevice]
})
export class WithdrawModule {}
